import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { origin, password } from "./helpers.mjs";

const browser = await chromium.launch({ headless: true });
const checks = [], errors = [], directory = "test-results/admin-layout";
await mkdir(directory, { recursive: true });
async function session(username) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const response = await context.request.post(origin + "/api/login", {
    headers: { Origin: origin }, data: { username, password },
  });
  assert.equal(response.status(), 200);
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(origin + "/pages/admin/");
  await expect(page.locator("#user-search")).toBeVisible();
  return { context, page };
}
try {
  const { page, context } = await session("admin-prueba");
  await expect(page.locator(".view-intro")).toHaveCount(0);
  const heading = await page.locator(".users-heading h2").boundingBox();
  const count = await page.locator("#user-results").boundingBox();
  assert.ok(Math.abs(heading.y - count.y) < 10);
  assert.ok(count.x >= heading.x + heading.width);
  await page.locator(".create-user > summary").click();
  const lines = page.locator(".create-note span");
  await expect(lines).toHaveCount(2);
  assert.ok((await lines.nth(1).boundingBox()).y > (await lines.nth(0).boundingBox()).y);
  await page.locator(".create-user > summary").click();
  checks.push("Sin subtítulo; total junto a Cuentas existentes y ayuda de creación en dos líneas");

  await page.locator("#user-search").fill("bruno");
  await expect(page.locator("#user-results")).toHaveText("1 cuenta");
  const card = page.locator(".user-card:visible");
  await card.locator(".user-details > summary").click();
  await expect(card.getByRole("tabpanel")).toHaveCount(1);
  await expect(card.getByRole("tab", { name: "Cuenta", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(card.locator("[data-reset]")).toBeHidden();
  await expect(card.locator("[data-delete]")).toBeHidden();
  const form = card.locator("form[data-user]");
  await form.locator("[name=username]").fill("bruno-borrador");
  await card.getByRole("tab", { name: "Accesos", exact: true }).click();
  await card.locator('.scope-group[data-scope="servicio"] > summary').click();
  await expect(card.locator('.scope-group[data-scope="servicio:garzones"]')).not.toHaveAttribute("open", "");
  await card.locator('[value="servicio:coperia"]').check();
  await expect(card.locator("[data-assignment-count]")).toHaveText("2 asignaciones");
  await card.getByRole("tab", { name: "Seguridad", exact: true }).click();
  await expect(card.locator(".editor-save")).toBeHidden();
  await expect(card.locator(".reset-form")).toBeVisible();
  await expect(card.locator(".delete-account")).toBeVisible();
  await card.getByRole("tab", { name: "Cuenta", exact: true }).click();
  await expect(form.locator("[name=username]")).toHaveValue("bruno-borrador");
  assert.equal(await card.locator('[value="servicio:coperia"]').isChecked(), true);
  checks.push("Cuenta, Accesos y Seguridad muestran un panel cada vez y conservan campos/asignaciones al cambiar");

  // Capture the submitted payload without changing any account in D1.
  let payload;
  await page.route("**/api/admin/users/*", route => {
    payload = route.request().postDataJSON();
    return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Ensayo sin guardar" }) });
  });
  await form.getByRole("button", { name: "Guardar cuenta y accesos" }).click();
  await expect(page.locator("#message")).toContainText("Ensayo sin guardar");
  assert.equal(payload.username, "bruno-borrador");
  assert.deepEqual(payload.grants.sort(), ["servicio:barra", "servicio:coperia"]);
  await expect(form.locator("[name=username]")).toHaveValue("bruno-borrador");
  await page.unroute("**/api/admin/users/*");
  checks.push("Guardar desde Cuenta incluye accesos de la pestaña oculta; error conserva los campos sin mutación de D1");

  const accountTab = card.getByRole("tab", { name: "Cuenta", exact: true });
  await accountTab.focus(); await page.keyboard.press("ArrowRight");
  await expect(card.getByRole("tab", { name: "Accesos", exact: true })).toBeFocused();
  await page.keyboard.press("End");
  await expect(card.getByRole("tab", { name: "Seguridad", exact: true })).toBeFocused();
  await page.keyboard.press("Home"); await expect(accountTab).toBeFocused();
  await form.locator("[name=username]").fill("!");
  await card.getByRole("tab", { name: "Accesos", exact: true }).click();
  await form.getByRole("button", { name: "Guardar cuenta y accesos" }).click();
  await expect(accountTab).toHaveAttribute("aria-selected", "true");
  await expect(form.locator("[name=username]")).toBeFocused();
  await form.locator("[name=username]").fill("bruno");
  checks.push("Pestañas accesibles con flechas/Home/End; validación revela y enfoca un campo inválido de otra pestaña");

  await page.reload();
  await page.locator("#user-search").fill("bruno");
  await card.locator(".user-details > summary").click();
  await card.getByRole("tab", { name: "Accesos", exact: true }).click();
  await card.locator('.scope-group[data-scope="servicio"] > summary').click();
  for (const width of [320, 390, 1024]) for (const theme of ["light", "dark"]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
    for (const name of ["Cuenta", "Accesos", "Seguridad"]) {
      await card.getByRole("tab", { name, exact: true }).click();
      if (name === "Accesos") {
        await card.locator('.scope-group[data-scope="servicio:garzones"]').evaluate(el => el.open).then(async open => {
          if (!open) await card.locator('.scope-group[data-scope="servicio:garzones"] > summary').click();
        });
        await expect(card.locator('[value="servicio:garzones:terraza"]')).toBeVisible();
        await expect(card.locator('.scope-group[data-scope="servicio"]')).toContainText("Incluye Barra, Línea / Armado, Copería");
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      for (const rect of await card.getByRole("tab").evaluateAll(els => els.map(el => el.getBoundingClientRect().height))) assert.ok(rect >= 44);
      await page.screenshot({ path: `${directory}/${name.toLowerCase()}-${width}-${theme}.png`, fullPage: true });
    }
  }
  checks.push("320/390/1024 px, ambos temas, tres pestañas y Garzones desplegado sin desborde; controles de 44 px");

  const lead = await session("jefa-servicio-2");
  const people = await (await lead.context.request.get(origin + "/api/admin/users")).json();
  // The API restrictions are covered by users-service; exercise the compact
  // limited editor with an isolated DTO, without altering a user's grants.
  const mixed = { ...people.users.find(user => user.role === "worker"), limited: true };
  assert.ok(mixed.id);
  await lead.page.route("**/api/admin/users", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ ...people, users: [mixed] }),
  }));
  await lead.page.reload();
  await lead.page.locator("#user-search").fill(mixed.username);
  const limited = lead.page.locator(`.user-card[data-id="${mixed.id}"]`);
  await limited.locator(".user-details > summary").click();
  await expect(limited.locator(".user-access-summary")).toContainText("Solo puedes cambiar sus accesos de Servicio");
  await expect(limited.locator("[role=tablist], [name=username], [data-reset], [data-delete]")).toHaveCount(0);
  await expect(limited.locator(".access-panel")).toBeVisible();
  assert.equal(await limited.locator('[value="cocina"]').count(), 0);
  checks.push("DTO mixto simulado: jefa ve solo el editor de accesos de Servicio, sin pestañas de cuenta/seguridad ni datos exteriores; sin alterar permisos en D1");
  assert.deepEqual(errors, []);
  const report = { date: "2026-10-22", environment: "Chromium + Workers/D1 local", checks, errors, passed: true, physicalDevice: false };
  await writeFile("docs/usuarios-diseno-local-3b.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  await context.close(); await lead.context.close();
} finally { await browser.close(); }
