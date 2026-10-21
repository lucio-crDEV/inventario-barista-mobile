import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { Client, database, origin, password, record } from "./helpers.mjs";

const browser = await chromium.launch({ headless: true });
const db = database(), checks = [], errors = [];
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
page.on("pageerror", e => errors.push(e.message));
const openMenu = () => page.locator("[data-settings-toggle]").click();
const closeMenu = () => page.locator(".settings-close").click();
const button = page.getByRole("button", { name: "Actualizar sincronización", exact: true });
const status = page.locator("#sync-state");
const totals = () => ["counts", "operations", "history"].map(table =>
  db.prepare(`SELECT count(*) n FROM ${table}`).get().n);
const draftSnapshot = () => page.evaluate(() => Object.fromEntries(
  Object.entries(localStorage).filter(([key]) => key.startsWith("inventory-drafts-v1:"))));

async function gateSync() {
  let release, started;
  const hold = new Promise(resolve => { release = resolve; });
  const observed = new Promise(resolve => { started = resolve; });
  let requests = 0;
  const handler = async route => {
    requests++;
    started();
    await hold;
    await route.continue();
  };
  await page.route("**/api/sync?*", handler);
  return { observed, count: () => requests, release, remove: () => page.unroute("**/api/sync?*", handler) };
}

try {
  await mkdir("test-results/refresh", { recursive: true });
  await page.goto(origin + "/pages/cuenta/");
  await expect(page.locator("[name=username]")).toBeVisible();
  await expect(page.locator(".sync-refresh")).toHaveCount(0);
  const login = await context.request.post(origin + "/api/login", {
    headers: { Origin: origin }, data: { username: "ana", password },
  });
  assert.equal(login.status(), 200);
  await page.goto(origin + "/");
  await expect(page.locator("nav a")).toBeVisible();
  for (const width of [320, 390, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(theme => localStorage.setItem("inventario-theme", theme), theme);
      await page.reload();
      await openMenu();
      await expect(status).toHaveAttribute("data-state", "synced");
      await expect(status).toHaveText("Sincronizado");
      assert.equal(await status.evaluate(el => getComputedStyle(el, "::before").backgroundColor), "rgb(18, 167, 125)");
      assert.equal(await button.evaluate(el => getComputedStyle(el).backgroundColor), theme === "dark" ? "rgb(25, 199, 216)" : "rgb(8, 194, 210)");
      const b = await button.boundingBox(), s = await status.boundingBox();
      assert.ok(b.x + b.width <= s.x && b.width >= 44 && b.height >= 44);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.locator(".settings-panel").evaluate(async el => {
        await Promise.all(el.getAnimations().map(a => a.finished.catch(() => {})));
      });
      await page.screenshot({ path: `test-results/refresh/menu-${width}-${theme}.png` });
      await closeMenu();
    }
  }
  checks.push("Botón cian a la izquierda, punto verde y texto; 320/390/1024 px en claro/oscuro; ingreso sin control");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install();
  const api = new Client();
  await api.login("bruno");
  const item = (await api.boot()).items.find(x => x.unit);
  await page.goto(origin + "/pages/inventario/?area=servicio&sector=barra");
  await page.locator("#header-open-item-drawer").click();
  await page.locator("#item-drawer-search").fill(item.name);
  await page.locator(".item-drawer-link").filter({ has: page.getByText(item.name, { exact: true }) }).first().click();
  await expect(page.locator("#quantity")).toBeVisible();
  let writes = 0;
  page.on("request", req => { if (req.method() !== "GET") writes++; });

  // A poll in flight and a manual request must share its result, without reload.
  const gate = await gateSync();
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await gate.observed;
  await openMenu();
  await button.click();
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute("aria-busy", "true");
  await expect(status).toHaveText("Actualizando…");
  await expect(status).toHaveAttribute("data-state", "syncing");
  await button.dispatchEvent("click");
  assert.equal(gate.count(), 1);
  gate.release();
  await expect(button).toBeEnabled();
  await expect(status).toHaveAttribute("data-state", "synced");
  await gate.remove();
  await closeMenu();
  checks.push("Sondeo y actualización manual comparten una sola consulta; doble toque protegido y estado ocupado hasta responder");

  await page.locator("#quantity").fill("3");
  await page.locator("#note").fill("Conservar este borrador");
  const draft = await draftSnapshot();
  const previous = await record(api, item);
  const saved = await api.save(item, 4, {
    expectedVersion: previous?.version || 0,
    action: previous && previous.authorId !== api.user.id ? "overwrite" : "direct",
    note: "Cambio remoto para comprobar actualización",
  });
  assert.equal(saved.status, 200);
  const before = totals();
  await openMenu();
  await button.click();
  await expect(button).toBeEnabled();
  await expect(status).toHaveAttribute("data-state", "pending");
  await expect(status).toContainText("Pendiente de enviar");
  await expect(page.locator("#quantity")).toHaveValue("3");
  await expect(page.locator("#note")).toHaveValue("Conservar este borrador");
  assert.deepEqual(await draftSnapshot(), draft);
  assert.deepEqual(totals(), before);
  assert.equal((await record(api, item)).quantity, 4);
  assert.equal(writes, 0);
  checks.push("Cambio remoto recuperado sin enviar borradores, cambiar campos ni modificar conteos, operaciones o historial");

  const failure = route => route.abort("failed");
  await page.route("**/api/sync?*", failure);
  await button.click();
  await expect(button).toBeEnabled();
  await expect(status).toHaveAttribute("data-state", "error");
  await expect(status).toContainText("No se pudo actualizar");
  await page.unroute("**/api/sync?*", failure);
  await button.click();
  await expect(button).toBeEnabled();
  await expect(status).toHaveAttribute("data-state", "pending");
  assert.deepEqual(await draftSnapshot(), draft);
  assert.deepEqual(totals(), before);
  assert.equal(writes, 0);
  checks.push("Fallo de red indica error, permite reintentar y recupera estado pendiente sin perder borradores");

  await closeMenu();
  await page.goto(origin + "/pages/cuenta/?change=1");
  await page.locator("[name=currentPassword]").fill("Campo de prueba conservado");
  await openMenu();
  const checkSession = page.waitForResponse(r => r.url().endsWith("/api/me"));
  await button.click();
  assert.equal((await checkSession).status(), 200);
  await expect(button).toBeEnabled();
  await expect(status).toHaveAttribute("data-state", "synced");
  await closeMenu();
  await expect(page.locator("[name=currentPassword]")).toHaveValue("Campo de prueba conservado");
  assert.equal(writes, 0);
  checks.push("En Cuenta verifica la sesión mediante GET y conserva el formulario sin recarga");
  assert.deepEqual(errors, []);
  const report = { checks, javascriptErrors: errors, remoteRequests: false };
  await writeFile("docs/actualizacion-local-3a.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  db.close();
  await browser.close();
}
