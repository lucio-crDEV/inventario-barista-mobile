import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { origin, password } from "./helpers.mjs";
const browser = await chromium.launch({ headless: true });
const checks = [],
  errors = [];
await mkdir("test-results/3a", { recursive: true });
async function login(context, username, p = password) {
  const r = await context.request.post(origin + "/api/login", {
    headers: { Origin: origin },
    data: { username, password: p },
  });
  assert.equal(r.status(), 200);
  return (await r.json()).user;
}
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/pages/cuenta/");
  await expect(page.locator("form [name=username]")).toBeVisible();
  const heading = await page.locator(".view-header").boundingBox(),
    toggle = await page.locator("[data-theme-toggle]").boundingBox();
  assert.ok(toggle.y >= heading.y && toggle.y < heading.y + heading.height);
  await expect(page.locator("[data-settings-toggle], #settings-drawer")).toHaveCount(0);
  assert.equal(await page.getByText("Usa tu cuenta para contar en las áreas que tienes asignadas.").count(), 0);
  assert.equal(await page.locator(".login-help").evaluate(el => getComputedStyle(el).textAlign), "center");
  const icon = await page.locator(".account-heading .account-symbol").boundingBox();
  const title = await page.locator(".account-heading h2").boundingBox();
  assert.ok(icon.x + icon.width <= title.x);
  for (const width of [320, 390, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate((theme) => {
        localStorage.setItem("inventario-theme", theme);
      }, theme);
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      const style = await page.locator("body").evaluate((el) => ({
        font: getComputedStyle(el).fontFamily,
        bg: getComputedStyle(el).backgroundColor,
      }));
      assert.match(style.font, /system-ui/);
      assert.equal(
        style.bg,
        theme === "dark" ? "rgb(17, 19, 21)" : "rgb(250, 248, 243)",
      );
      await expect(page.locator("form [name=username]")).toBeVisible();
      await page.locator("#account-content").evaluate(async el => { await Promise.all(el.getAnimations({subtree: true}).map(a => a.finished.catch(() => {}))); });
      await expect(page.locator("[data-settings-toggle], #settings-drawer")).toHaveCount(0);
      await page.screenshot({
        path: `test-results/3a/login-${width}-${theme}.png`,
      });

    }
  }
  checks.push(
    "Ingreso a 320/390/1024 px, ambos temas, encabezado en fila, ayuda centrada, solo toggle de tema y sin desborde",
  );
  await page.locator("[data-theme-toggle]").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("[name=password]").fill("ejemplo-visible");
  await page.locator(".reveal-password").click();
  await expect(page.locator("[name=password]")).toHaveAttribute("type", "text");
  await expect(page.locator(".reveal-password")).toHaveAttribute("aria-label", "Ocultar contraseña");
  await expect(page.locator(".reveal-password svg")).toHaveCount(1);
  await page.locator(".reveal-password").click();
  await expect(page.locator("[name=password]")).toHaveAttribute(
    "type",
    "password",
  );
  checks.push("Mostrar y ocultar contraseña sin cambiar su contenido");
  // Reproduce the deployed HTML fallback and an API that has not been initialized.
  for (const html of [true, false]) {
    await page.route("**/api/me", (route) =>
      route.fulfill({
        status: html ? 200 : 503,
        contentType: html ? "text/html" : "application/json",
        body: html
          ? "<!doctype html><h1>Inicio</h1>"
          : JSON.stringify({
              code: "NOT_INITIALIZED",
              message:
                "El inventario aún no está habilitado. Contacta al administrador.",
            }),
      }),
    );
    await page.reload();
    await expect(page.locator("#retry-service")).toBeVisible();
    assert.equal(await page.locator("[name=password]").count(), 0);
    assert.ok(
      !(await page.locator("body").innerText()).includes("Unexpected token"),
    );
    await page.unroute("**/api/me");
  }
  checks.push(
    "HTML en lugar de API y D1 sin inicializar muestran indisponibilidad clara sin formulario engañoso",
  );
  const admin = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await login(admin, "admin-prueba");
  const panel = await admin.newPage();
  panel.on("pageerror", (e) => errors.push(e.message));
  await panel.goto(origin + "/pages/admin/");
  await expect(panel.locator("#user-search")).toBeVisible();
  assert.equal(await panel.locator("main > .identity-bar, .back-link").count(), 0);
  await panel.locator("[data-settings-toggle]").click();
  await expect(panel.locator(".identity-bar")).toContainText("Administrador ficticio");
  await expect(panel.getByRole("link", { name: "Usuarios y accesos", exact: true })).toBeVisible();
  await panel.locator(".settings-backdrop").click({ position: { x: 2, y: 2 } });
  await expect(panel.locator("[data-settings-toggle]")).toHaveAttribute("aria-expanded", "false");
  for (const width of [320, 390, 1024]) {
    await panel.setViewportSize({ width, height: 844 });
    for (const theme of ["light", "dark"]) {
      await panel.evaluate(
        (t) => localStorage.setItem("inventario-theme", t),
        theme,
      );
      await panel.reload();
      await expect(panel.locator("#user-search")).toBeVisible();
      await panel.locator("[data-settings-toggle]").click();
      await expect(panel.locator(".settings-panel")).toBeVisible();
      await expect.poll(async () => {
        const menu = await panel.locator(".settings-panel").boundingBox();
        return Math.abs(menu.x + menu.width - (width - 10));
      }).toBeLessThan(2);
      assert.equal(await panel.locator("main").evaluate(el => el.inert), true);
      await panel.screenshot({ path: `test-results/3a/menu-${width}-${theme}.png` });
      await panel.locator(".settings-close").press("Shift+Tab");
      await expect(panel.locator("[data-theme-toggle]")).toBeFocused();
      await panel.locator("[data-theme-toggle]").press("Tab");
      await expect(panel.locator(".settings-close")).toBeFocused();
      await panel.locator(".settings-close").press("Escape");
      await expect(panel.locator("[data-settings-toggle]")).toBeFocused();
      assert.equal(await panel.locator("main").evaluate(el => el.inert), false);
      await panel.screenshot({ path: `test-results/3a/admin-${theme}.png` });
      assert.ok(
        await panel.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    }
  }
  checks.push("Menú autenticado desde la derecha a 320/390/1024 px en ambos temas; fondo inerte, foco contenido y Escape devuelve al botón");
  await panel.setViewportSize({ width: 390, height: 844 });
  await panel.locator("#user-search").fill("bruno");
  await expect(panel.locator(".user-card:visible")).toHaveCount(1);
  checks.push(
    "Administración compacta en claro/oscuro, cuentas plegables y búsqueda",
  );
  await panel.locator(".create-user>summary").click();
  const create = panel.locator("#create"),
    username = "vista-" + Date.now();
  await create.locator("[name=username]").fill(username);
  await create.locator("[name=name]").fill("Persona de ensayo");
  await create.locator("[name=password]").fill("Clave-08");
  let releaseCreate;
  const createGate = new Promise(resolve => { releaseCreate = resolve; });
  await panel.route("**/api/admin/users", async route => {
    if (route.request().method() === "POST") await createGate;
    await route.continue();
  });
  const submitCreate = create.getByRole("button", { name: "Crear usuario", exact: true });
  await submitCreate.click();
  try {
    await expect(create.locator(".button-primary")).toBeDisabled();
    await expect(create.locator(".button-primary")).toContainText("Creando");
    await expect(create.locator(".reveal-password")).toBeEnabled();
  } finally {
    releaseCreate();
  }
  await expect(panel.locator("#message")).toContainText("Cambios guardados");
  await panel.unroute("**/api/admin/users");
  const people = await (
    await admin.request.get(origin + "/api/admin/users")
  ).json();
  const id = people.users.find((u) => u.username === username).id;
  const worker = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const loginUser = await login(worker, username, "Clave-08");
  assert.equal(loginUser.mustChange, true);
  const work = await worker.newPage();
  work.on("pageerror", (e) => errors.push(e.message));
  await work.goto(origin + "/pages/cuenta/");
  await expect(work.locator("[data-settings-toggle]")).toBeVisible();
  await expect(work.locator("[data-account-theme][data-theme-toggle]")).toHaveCount(0);
  await work.locator("[name=currentPassword]").fill("Clave-08");
  await work.locator("[name=newPassword]").fill("Nueva-08");
  await work.locator("[name=confirmPassword]").fill("No-coincide-2026");
  await work
    .getByRole("button", { name: "Guardar contraseña", exact: true })
    .click();
  await expect(work.locator("#message")).toContainText("no coinciden");
  await work.locator("[name=confirmPassword]").fill("Nueva-08");
  await work.screenshot({ path: "test-results/3a/cambio-contrasena.png" });
  await work
    .getByRole("button", { name: "Guardar contraseña", exact: true })
    .click();
  await expect(work.locator("[name=username]")).toBeVisible();
  await login(worker, username, "Nueva-08");
  await work.goto(origin + "/");
  await expect(work.locator("nav")).toContainText("No tienes áreas asignadas");
  checks.push(
    "Alta desde administración, cambio obligatorio, confirmación de contraseña y acceso sin áreas",
  );
  // The worker changed their password/revision after this administrative snapshot.
  await panel.reload();
  await expect(panel.locator("#user-search")).toBeVisible();
  await panel.locator("#user-search").fill(username);
  await panel.locator(".user-card:visible > .user-details > summary").click();
  let form = panel.locator(`form[data-user="${id}"]`);
  await form.locator("..").getByRole("tab", {name:"Accesos", exact:true}).click();
  await form.locator('.scope-group[data-scope="servicio"] > summary').click();
  await form.locator('[value="servicio:barra"]').check();
  await form.locator('[value="servicio:armado-linea-coperia"]').check();
  await form.getByRole("button", { name: "Guardar cuenta y accesos" }).click();
  await expect(panel.locator("#message")).toContainText("Cambios guardados");
  await expect(work).toHaveURL(/area=servicio$/, { timeout: 10000 });
  await work.goto(origin + "/pages/inventario/?area=servicio");
  await expect(work.locator(".scope-card")).toHaveCount(2);
  checks.push("Dos ámbitos otorgados en sesión activa y navegación filtrada");
  await panel.locator("#user-search").fill(username);
  await panel.locator(".user-card:visible > .user-details > summary").click();
  await panel.locator(`.user-card[data-id="${id}"]`).getByRole("tab", {name:"Seguridad", exact:true}).click();
  let reset = panel.locator(`form[data-reset="${id}"]`);
  await reset.locator("[name=password]").fill("Temporal-reset-2026");
  await reset.getByRole("button", { name: "Restablecer contraseña", exact: true }).click();
  await panel.locator("#cancel-reset").click();
  assert.equal((await worker.request.get(origin + "/api/me")).status(), 200);
  await reset.getByRole("button", { name: "Restablecer contraseña", exact: true }).click();
  await panel.locator("#confirm-reset").click();
  await expect(panel.locator("#message")).toContainText("Cambios guardados");
  assert.equal((await worker.request.get(origin + "/api/me")).status(), 401);
  await login(worker, username, "Temporal-reset-2026");
  await work.goto(origin + "/pages/cuenta/");
  await expect(work.locator("[name=newPassword]")).toBeVisible();
  checks.push(
    "Restablecimiento con cancelación segura, confirmación explícita, sesiones revocadas y nuevo cambio obligatorio",
  );
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, errors }, null, 2));
  await writeFile(
    "docs/vistas-local-3a.json",
    JSON.stringify(
      {
        checks,
        errors,
        screenshots: "test-results/3a/",
        physicalDevice: false,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
