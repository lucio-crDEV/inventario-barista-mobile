import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import {
  Client,
  database,
  origin,
  password,
  record,
  updateUser,
} from "./helpers.mjs";
const db = database();
db.exec("DELETE FROM attempts");
const checks = [],
  errors = [],
  requests = {};
const browser = await chromium.launch({ headless: true });
await mkdir("test-results/ux", { recursive: true });
const a = new Client(),
  b = new Client(),
  admin = new Client();
await a.login("ana");
await b.login("bruno");
await admin.login("admin-prueba");
async function context(username, reducedMotion = "no-preference") {
  const c = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion,
  });
  if (username) {
    const r = await c.request.post(origin + "/api/login", {
      headers: { Origin: origin },
      data: { username, password },
    });
    assert.equal(r.status(), 200);
  }
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  return { c, p };
}
async function gate(page, pattern) {
  let release, handled;
  const wait = new Promise((resolve) => {
    release = resolve;
  });
  const done = new Promise((resolve) => {
    handled = resolve;
  });
  const handler = async (route) => {
    try {
      await wait;
      await route.continue();
    } finally {
      handled();
    }
  };
  await page.route(pattern, handler);
  return async () => {
    release();
    await done;
    await page.unroute(pattern, handler);
  };
}
function measure(page) {
  const paths = [];
  const handler = (req) => {
    const url = new URL(req.url());
    if (url.pathname.startsWith("/api/")) paths.push(url.pathname);
  };
  page.on("request", handler);
  return () => {
    page.off("request", handler);
    return paths;
  };
}
async function captureLoading(page, name) {
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    }
    assert.equal(
      await page
        .locator(".skeleton")
        .first()
        .evaluate((el) => getComputedStyle(el).animationName),
      "skeleton-pulse",
    );
    await page.screenshot({ path: `test-results/ux/${name}-${theme}.png` });
  }
}
async function openItem(page, x) {
  if (!(await page.locator("#header-open-item-drawer").isVisible()))
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
try {
  // Every navigation response is authenticated and contains exactly the allowed hierarchy.
  assert.equal((await new Client().request("/api/navigation")).status, 401);
  for (const username of [
    "ana",
    "cocina",
    "multiple",
    "terraza",
    "garzones",
    "sin-areas",
    "admin-prueba",
  ]) {
    const user = new Client();
    await user.login(username);
    const nav = await user.request("/api/navigation"),
      boot = await user.boot();
    assert.equal(nav.status, 200);
    assert.deepEqual(nav.data.scopes, boot.scopes);
    assert.deepEqual(Object.keys(nav.data).sort(), ["scopes", "user"]);
  }
  await updateUser(admin, "multiple", { grants: ["servicio:barra"] });
  const multi = new Client();
  await multi.login("multiple");
  assert.ok(
    !(await multi.request("/api/navigation")).data.scopes.some((s) =>
      s.id.includes("armado"),
    ),
  );
  await updateUser(admin, "multiple", { grants: [] });
  assert.deepEqual((await multi.request("/api/navigation")).data.scopes, []);
  await updateUser(admin, "multiple", {
    grants: ["servicio:barra", "servicio:armado-linea-coperia"],
  });
  checks.push(
    "Navegación mínima autenticada, sin catálogo, con herencia y retirada de permisos inmediata",
  );

  const login = await context(null, "reduce");
  const releaseLogin = await gate(login.p, "**/api/me");
  await login.p.goto(origin + "/pages/cuenta/", { waitUntil: "commit" });
  await expect(login.p.locator(".loading-account")).toBeVisible();
  await expect(login.p.locator("#account-content")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  assert.equal(await login.p.locator("form").count(), 0);
  for (const theme of ["light", "dark"]) {
    await login.p.evaluate(
      (t) => (document.documentElement.dataset.theme = t),
      theme,
    );
    assert.equal(
      await login.p
        .locator(".skeleton")
        .first()
        .evaluate((el) => getComputedStyle(el).animationName),
      "none",
    );
    assert.ok(
      await login.p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await login.p.screenshot({
      path: `test-results/ux/skeleton-login-${theme}.png`,
    });
  }
  await expect(login.p.locator("[data-loading-hint]")).toContainText(
    "tardando",
    { timeout: 6500 },
  );
  await releaseLogin();
  await expect(login.p.locator("[name=username]")).toBeVisible();
  await expect(login.p.locator("#account-content")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  assert.equal(
    await login.p
      .locator("#account-content")
      .evaluate((el) => el.getAnimations().length),
    0,
  );
  // A slow failed login must be busy and recover without erasing the entered fields.
  const releasePost = await gate(login.p, "**/api/login");
  await login.p.locator("[name=username]").fill("no-existe");
  await login.p.locator("[name=password]").fill("ejemplo-incorrecto");
  await login.p.locator("button[type=submit]").click();
  await expect(login.p.locator("button[type=submit]")).toContainText(
    "Ingresando",
  );
  await expect(login.p.locator("button[type=submit]")).toBeDisabled();
  await releasePost();
  await expect(login.p.locator("#message")).toContainText("incorrectos");
  await expect(login.p.locator("button[type=submit]")).toBeEnabled();
  await expect(login.p.locator("[name=username]")).toHaveValue("no-existe");
  checks.push(
    "Skeleton inmediato en ambos temas, espera larga explícita, movimiento reducido y error de ingreso recuperable",
  );

  const worker = await context("ana");
  let stop = measure(worker.p);
  const releaseHome = await gate(worker.p, "**/api/navigation");
  await worker.p.goto(origin + "/", { waitUntil: "commit" });
  await expect(worker.p.locator("#home-loading")).toBeVisible();
  await expect(worker.p.locator("nav")).toBeHidden();
  await captureLoading(worker.p, "skeleton-inicio");
  await releaseHome();
  await expect(worker.p.locator("nav a")).toHaveCount(1);
  requests.home = stop();
  assert.deepEqual(requests.home, ["/api/navigation"]);
  const nav = await a.request("/api/navigation"),
    boot = await a.boot();
  requests.navigationBytes = Buffer.byteLength(JSON.stringify(nav.data));
  requests.previousHomeBootstrapBytes = Buffer.byteLength(JSON.stringify(boot));
  checks.push(
    "Inicio usa una petición ligera, conserva áreas ocultas hasta autorización y no descarga el catálogo",
  );

  stop = measure(worker.p);
  const releaseInventory = await gate(worker.p, "**/api/bootstrap");
  await worker.p.goto(
    origin + "/pages/inventario/?area=servicio&sector=barra",
    { waitUntil: "commit" },
  );
  await expect(worker.p.locator(".loading-inventory")).toBeVisible();
  await expect(worker.p.locator("#progress-text")).toBeHidden();
  await expect(worker.p.locator("#app-content")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await captureLoading(worker.p, "skeleton-inventario");
  await releaseInventory();
  await expect(worker.p.locator(".category-card").first()).toBeVisible();
  requests.inventory = stop();
  assert.deepEqual(requests.inventory, ["/api/bootstrap"]);
  checks.push(
    "Inventario carga con una petición, sin progreso ficticio y sin esperar una animación para permitir uso",
  );

  const boss = await context("admin-prueba");
  stop = measure(boss.p);
  const releaseAdmin = await gate(boss.p, "**/api/admin/users");
  await boss.p.goto(origin + "/pages/admin/", { waitUntil: "commit" });
  await expect(boss.p.locator(".loading-users")).toBeVisible();
  await expect(boss.p.locator("#user-search")).toHaveCount(0);
  await captureLoading(boss.p, "skeleton-admin");
  await releaseAdmin();
  await expect(boss.p.locator("#user-search")).toBeVisible();
  requests.admin = stop();
  assert.deepEqual(requests.admin, ["/api/admin/users"]);
  await expect(boss.p.locator("#users")).toHaveAttribute("aria-busy", "false");
  checks.push(
    "Administración obtiene identidad y cuentas en una petición y retira su skeleton al terminar",
  );

  const x = boot.items[90],
    old = await record(a, x);
  await a.save(x, 4, {
    expectedVersion: old?.version || 0,
    action: old ? "overwrite" : "direct",
  });
  // Load the fixture we just wrote before beginning a deliberate own edit.
  await worker.p.reload();
  await expect(worker.p.locator(".category-card").first()).toBeVisible();
  await openItem(worker.p, x);
  await worker.p.locator("#quantity").fill("3");
  stop = measure(worker.p);
  const releaseCount = await gate(worker.p, "**/api/count");
  await worker.p.locator("#save-counted").click();
  await expect(worker.p.locator("#save-counted")).toContainText("Guardando");
  await expect(worker.p.locator("#quantity")).toHaveAttribute("readonly", "");
  await expect(worker.p.locator("#next-item")).toBeDisabled();
  assert.equal(
    (await record(a, x)).quantity,
    4,
    "no éxito optimista antes del servidor",
  );
  await worker.p.locator("#save-counted").evaluate((el) => el.click());
  assert.ok(
    await worker.p
      .locator("#save-counted")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
    "el texto de envío cabe en el botón móvil",
  );
  await worker.p.screenshot({ path: "test-results/ux/guardando.png" });
  await releaseCount();
  await expect(worker.p.locator("#sync-state")).toHaveText("Sincronizado");
  requests.save = stop().filter((path) => path != "/api/sync");
  assert.deepEqual(requests.save, ["/api/count"]);
  assert.equal((await record(a, x)).quantity, 3);
  checks.push(
    "Guardado nuevo usa una petición: controles protegidos, sin doble envío ni éxito anticipado",
  );

  await openItem(worker.p, x);
  await worker.p
    .locator("#note")
    .fill("Borrador conservado al consultar historial");
  await worker.p.emulateMedia({ reducedMotion: "reduce" });
  const releaseHistory = await gate(worker.p, "**/api/history?*");
  await worker.p.locator("#record-history").click();
  await expect(
    worker.p.locator("dialog[open] .skeleton").first(),
  ).toBeVisible();
  assert.equal(
    await worker.p
      .locator("dialog[open]")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await worker.p.screenshot({ path: "test-results/ux/historial-cargando.png" });
  await worker.p.getByRole("button", { name: "Cerrar", exact: true }).click();
  await releaseHistory();
  await expect(worker.p.locator("dialog[open]")).toHaveCount(0);
  await expect(worker.p.locator("#note")).toHaveValue(
    "Borrador conservado al consultar historial",
  );
  await worker.p.locator("#record-history").click();
  await expect(worker.p.locator(".history-list")).toBeVisible();
  await worker.p.getByRole("button", { name: "Cerrar", exact: true }).click();
  checks.push(
    "Historial abre inmediatamente con skeleton, permite cerrar durante carga y conserva el borrador",
  );

  // An old successful response must never restore a count superseded by another person.
  let once = true;
  await worker.p.route("**/api/count", async (route) => {
    if (!once) return route.continue();
    once = false;
    await route.fetch();
    await route.abort("failed");
  });
  await worker.p.locator("#quantity").fill("6");
  await worker.p.locator("#save-counted").click();
  await expect(worker.p.locator("#retry-operation")).toBeVisible();
  const accepted = await record(a, x);
  assert.equal(accepted.quantity, 6);
  await b.save(x, 9, {
    expectedVersion: accepted.version,
    action: "overwrite",
  });
  stop = measure(worker.p);
  await worker.p.locator("#retry-operation").click();
  await expect(worker.p.locator("#quantity")).toHaveValue("9");
  requests.retry = stop().filter((path) => path != "/api/sync");
  assert.deepEqual(requests.retry, ["/api/count", "/api/record"]);
  assert.equal((await record(a, x)).quantity, 9);
  checks.push(
    "Respuesta perdida seguida de un cambio ajeno: reintento recupera la versión vigente sin restaurar la anterior",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    "docs/ux-local-v3.json",
    JSON.stringify(
      {
        checks,
        requests,
        errors,
        network:
          "Peticiones retenidas y liberadas de forma controlada; latencia real de producción no medida",
        physicalDevice: false,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ checks, requests, errors }, null, 2));
} finally {
  await browser.close();
  db.close();
}
