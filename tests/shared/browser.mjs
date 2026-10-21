import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import {
  Client,
  database,
  resetLocal,
  record,
  updateUser,
  password,
  origin,
} from "./helpers.mjs";
const db = database();
resetLocal(db);
const adminAPI = new Client(),
  aAPI = new Client();
await adminAPI.login("admin-prueba");
await aAPI.login("ana");
const items = (await aAPI.boot()).items,
  target = items[12],
  other = items[13];
const browser = await chromium.launch({ headless: true });
const contexts = [],
  errors = [],
  checks = [];
await mkdir("test-results/3a", { recursive: true });
async function session(username) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  contexts.push(context);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/pages/cuenta/");
  await page.locator("[name=username]").fill(username);
  await page.locator("[name=password]").fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.waitForURL(origin + "/");
  await expect(page.locator(".identity-bar")).toBeVisible();
  return { context, page };
}
async function openItem(page, x) {
  await page.goto(origin + "/pages/inventario/?area=servicio&sector=barra");
  await page.locator("#header-open-item-drawer").click();
  await page.locator("#item-drawer-search").fill(x.name);
  await page
    .locator(".item-drawer-link")
    .filter({ has: page.getByText(x.name, { exact: true }) })
    .first()
    .click();
  await expect(page.locator("#quantity")).toBeVisible();
}
async function seed4() {
  const prev = await record(aAPI, target);
  const r = await aAPI.save(target, 4, {
    expectedVersion: prev?.version || 0,
    action: prev ? "overwrite" : "direct",
    note: "Base Ana",
  });
  assert.equal(r.status, 200);
}
async function propose(page) {
  await page.locator("#quantity").fill("3");
  await page.locator("#note").fill("Aporte desde navegador");
  await page.locator("#save-counted").click();
  await expect(page.locator("dialog[open]")).toBeVisible();
}
try {
  const A = await session("ana"),
    B = await session("bruno"),
    K = await session("cocina"),
    M = await session("multiple"),
    D = await session("admin-prueba"),
    N = await session("sin-areas");
  await expect(A.page.locator("nav a")).toHaveCount(1);
  await expect(K.page.locator("nav a")).toHaveCount(1);
  await expect(K.page.locator("nav a")).toContainText("Cocina");
  await expect(N.page.locator("nav")).toContainText(
    "No tienes áreas asignadas. Contacta al administrador",
  );
  await M.page.goto(origin + "/pages/inventario/?area=servicio");
  await expect(M.page.locator(".scope-card")).toHaveCount(2);
  await expect(M.page.locator(".scope-card")).toContainText([
    "Barra",
    "Armado",
  ]);
  checks.push(
    "Sesiones independientes, Cocina/Barra aisladas, múltiples ámbitos y usuario sin áreas",
  );
  await K.page.goto(origin + "/pages/inventario/?area=servicio&sector=barra");
  await expect(K.page.locator("#app-content")).not.toContainText(target.name);
  checks.push("URL fuera del ámbito no revela productos");
  await A.page.goto(origin + "/");
  await A.page.evaluate(() =>
    localStorage.setItem(
      "inventario-session-v2",
      JSON.stringify({ legacy: "conservar" }),
    ),
  );
  await seed4();
  await openItem(B.page, other);
  await B.page.locator("#quantity").fill("8");
  await B.page.locator("#note").fill("Otro borrador");
  await openItem(B.page, target);
  await propose(B.page);
  await expect(B.page.locator("#discard")).toBeFocused();
  await expect(B.page.locator("#choose-add")).toBeVisible();
  await expect(B.page.locator("#choose-overwrite")).toBeVisible();
  await B.page.keyboard.press("Shift+Tab");
  assert.equal(
    await B.page.evaluate(() => !!document.activeElement.closest("dialog")),
    true,
  );
  await B.page.keyboard.press("Escape");
  await expect(B.page.locator("dialog")).toHaveCount(0);
  await expect(B.page.locator("#quantity")).toHaveValue("3");
  await B.page.locator("#save-counted").click();
  await expect(B.page.locator("dialog")).toBeVisible();
  checks.push("Tab permanece en el diálogo; Escape conserva el borrador");
  await B.page.screenshot({
    path: "test-results/3a/conflicto-claro.png",
    fullPage: true,
  });
  await B.page.locator("#discard").click();
  await expect(B.page.locator("dialog")).toHaveCount(0);
  assert.equal((await record(aAPI, target)).quantity, 4);
  await expect(B.page.locator("#quantity")).toHaveValue("4");
  const drafts = await B.page.evaluate(() =>
    Object.entries(localStorage)
      .filter(([k]) => k.startsWith("inventory-drafts-"))
      .map(([, v]) => JSON.parse(v)),
  );
  assert.ok(drafts.some((d) => d[other.id]?.note === "Otro borrador"));
  assert.ok(drafts.every((d) => !d[target.id]));
  await expect(B.page.locator("#sync-state")).toContainText("otros borradores");
  checks.push(
    "Descartar recupera 4 y elimina solo el borrador afectado; foco inicial seguro",
  );
  await propose(B.page);
  await B.page.locator("#choose-add").click();
  await expect(B.page.locator("#result-preview")).toContainText("4 + 3 = 7");
  await B.page.locator("#confirm-choice").click();
  await expect(B.page.locator("dialog")).toHaveCount(0);
  assert.equal((await record(aAPI, target)).quantity, 7);
  checks.push("Sumar explícito confirma 4 + 3 = 7");
  await seed4();
  await openItem(B.page, target);
  await propose(B.page);
  await B.page.locator("#choose-overwrite").click();
  await expect(B.page.locator("#result-preview")).toContainText("Resultado: 3");
  await B.page.locator("#confirm-choice").click();
  await expect(B.page.locator("dialog")).toHaveCount(0);
  assert.equal((await record(aAPI, target)).quantity, 3);
  checks.push("Sobrescribir explícito reemplaza 4 por 3");
  await seed4();
  await openItem(B.page, target);
  await propose(B.page);
  await B.page.locator("#choose-add").click();
  const current = await record(aAPI, target);
  await aAPI.save(target, 5, { expectedVersion: current.version });
  await B.page.locator("#confirm-choice").click();
  await expect(B.page.locator("dialog")).toContainText("5");
  await expect(B.page.locator("#confirm-choice")).toBeHidden();
  assert.equal((await record(aAPI, target)).quantity, 5);
  checks.push("Cambio remoto invalida la confirmación y exige nueva elección");
  await B.page.locator("#keep-draft").click();
  await expect(B.page.locator("#quantity")).toHaveValue("3");
  await B.page.waitForTimeout(5200);
  await expect(B.page.locator("#quantity")).toHaveValue("3");
  checks.push("Sincronización remota conserva campos en edición");
  await B.page.reload();
  await B.page.locator("#header-open-item-drawer").click();
  await B.page.locator("#item-drawer-search").fill(target.name);
  await B.page
    .locator(".item-drawer-link")
    .filter({ has: B.page.getByText(target.name, { exact: true }) })
    .first()
    .click();
  await expect(B.page.locator("#quantity")).toHaveValue("3");
  checks.push("Borrador recuperado después de recarga");
  await B.page.locator("#save-out-of-stock").click();
  await expect(B.page.locator("#choose-add")).toBeDisabled();
  await expect(B.page.locator("dialog")).toContainText(
    "Sin stock no es un aporte sumable",
  );
  await B.page.locator("#keep-draft").click();
  await B.page.locator("[data-theme-toggle]").click();
  await expect(B.page.locator("html")).toHaveAttribute("data-theme", "dark");
  await B.page.screenshot({
    path: "test-results/3a/conteo-oscuro.png",
    fullPage: true,
  });
  checks.push("Sin stock no sumable; capturas móviles claro/oscuro");
  await B.page.locator("#save-counted").click();
  await expect(B.page.locator("dialog")).toBeVisible();
  // An administrator changes scopes in the actual administration form.
  await D.page.goto(origin + "/pages/admin/");
  const users = await adminAPI.request("/api/admin/users");
  const bruno = users.data.users.find((u) => u.username === "bruno");
  const form = D.page.locator(`form[data-user="${bruno.id}"]`);
  await form.locator("xpath=ancestor::details").locator("summary").click();
  await form.locator('input[value="servicio:barra"]').uncheck();
  await form.getByRole("button", { name: "Guardar cuenta y accesos" }).click();
  await expect(D.page.locator("#message")).toContainText("Cambios guardados");
  await B.page.waitForTimeout(5600);
  await expect(B.page.locator("#app-content")).toContainText(
    "No tienes áreas asignadas",
  );
  await expect(B.page.locator("#sync-state")).toContainText("borradores");
  await expect(B.page.locator("dialog")).toHaveCount(0);
  assert.ok(
    await B.page.evaluate(() =>
      Object.keys(localStorage).some((k) => k.startsWith("inventory-drafts-")),
    ),
  );
  checks.push(
    "Administrador retira acceso durante sesión; desaparecen datos y se conserva borrador aislado",
  );
  await updateUser(adminAPI, "bruno", { grants: ["servicio:barra"] });
  await expect(B.page.locator("#header-open-item-drawer")).toBeVisible({
    timeout: 10000,
  });
  // Logout and switch to another identity in the same browser context.
  await B.page.locator(".account-menu summary").click();
  await B.page.locator("#logout").click();
  await B.page.waitForURL("**/pages/cuenta/");
  await B.page.locator("[name=username]").fill("cocina");
  await B.page.locator("[name=password]").fill(password);
  await B.page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await B.page.waitForURL(origin + "/");
  await expect(B.page.locator("nav a")).toHaveCount(1);
  await expect(B.page.locator("nav a")).toContainText("Cocina");
  await B.page.goto(origin + "/pages/inventario/?area=cocina");
  await B.page.locator(".category-card").first().click();
  await expect(B.page.locator("#quantity")).toHaveValue("");
  await expect(B.page.locator("#note")).toHaveValue("");
  checks.push("Cambio de usuario no transfiere catálogo ni borradores");
  assert.deepEqual(
    await A.page.evaluate(() =>
      JSON.parse(localStorage.getItem("inventario-session-v2")),
    ),
    { legacy: "conservar" },
  );
  checks.push("Persistencia local anterior intacta");
  // Simulate an accepted write whose response is lost; a retry must use the same operation.
  await openItem(A.page, other);
  await A.page.locator("#quantity").fill("2");
  let lost = true;
  await A.page.route("**/api/count", async (route) => {
    if (lost) {
      lost = false;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await A.page.locator("#save-counted").click();
  await expect(A.page.locator("#sync-state")).toContainText("borrador");
  const accepted = await record(aAPI, other);
  assert.equal(accepted.quantity, 2);
  await A.page.locator("#retry-operation").click();
  await expect(A.page.locator("#sync-state")).toContainText("Sincronizado");
  assert.equal((await record(aAPI, other)).version, accepted.version);
  checks.push(
    "Respuesta perdida recuperada con el mismo ID sin duplicar escritura",
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        checks,
        errors,
        screenshots: ["conflicto-claro.png", "conteo-oscuro.png"],
      },
      null,
      2,
    ),
  );
  await writeFile(
    "docs/navegador-local-3a.json",
    JSON.stringify(
      {
        checks,
        errors,
        viewport: "390 × 844; Chromium independiente por usuario",
        physicalDevice: false,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  try {
    await updateUser(adminAPI, "bruno", { grants: ["servicio:barra"] });
  } catch {}
  await browser.close();
  db.close();
}
