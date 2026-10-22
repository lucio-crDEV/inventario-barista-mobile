import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
const base = process.env.INVENTORY_PAGES_ORIGIN || "https://127.0.0.1:8791";
if (!/^https:\/\/127\.0\.0\.1:\d+$/.test(base)) throw Error("Pages tests require loopback HTTPS.");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 390, height: 844 },
});
const checks = [];
try {
  let r = await context.request.get(base + "/api/status");
  assert.equal(r.status(), 401);
  r = await context.request.get(base + "/api/me");
  assert.equal(r.status(), 401);
  assert.ok(r.headers()["content-type"].includes("application/json"));
  checks.push(
    "Pages ejecuta la API y devuelve JSON; ausencia de sesión es 401",
  );
  for (const path of [
    "/data/inventario/items/catalogo-excel.js",
    "/migrations/0001_core.sql",
    "/worker/index.js",
    "/scripts/bootstrap.mjs",
    "/_worker.js",
    "/inventarios_og/11_10-INVENTARIO-totalizado.xlsx",
  ])
    assert.equal((await context.request.get(base + path)).status(), 404);
  checks.push(
    "Catálogo global, servidor, bootstrap, SQL y libros no son públicos",
  );
  r = await context.request.post(base + "/api/login", {
    headers: { Origin: base },
    data: { username: "ana", password: "Solo-pruebas-2026" },
  });
  assert.equal(r.status(), 200);
  r = await context.request.get(base + "/api/status");
  assert.equal(r.status(), 200);
  assert.deepEqual(await r.json(), { ready: true, stage: "3A", increment: "usuarios-servicio" });
  const cookie = (await context.cookies()).find(
    (c) => c.name === "__Host-inventory_session",
  );
  assert.ok(
    cookie?.httpOnly &&
      cookie.secure &&
      cookie.sameSite === "Strict" &&
      cookie.path === "/",
  );
  const page = await context.newPage();
  await page.goto(base + "/");
  await expect(page.locator(".identity-person")).toContainText("Ana");
  assert.equal(
    await page.evaluate(() => document.cookie.includes("inventory_session")),
    false,
  );
  checks.push(
    "Cookie __Host segura, HttpOnly, SameSite Strict y fuera de JavaScript en HTTPS",
  );
  const data = await (
    await context.request.get(base + "/api/bootstrap")
  ).json();
  assert.ok(
    data.items.length && data.items.every((x) => x.sectorId === "barra"),
  );
  const item = data.items[80];
  const key = `?cycle=${data.cycle.id}&item=${encodeURIComponent(item.id)}&location=${encodeURIComponent(item.locationId)}`;
  const previous = await (
    await context.request.get(base + "/api/record" + key)
  ).json();
  const op = {
    id: crypto.randomUUID(),
    cycleId: data.cycle.id,
    itemId: item.id,
    locationId: item.locationId,
    expectedVersion: previous.record?.version || 0,
    action: previous.record ? "overwrite" : "direct",
    quantity: 1.25,
    unit: item.unit,
    status: "counted",
    note: "Ensayo Pages HTTPS",
    outOfStock: false,
  };
  const headers = { Origin: base, "X-Inventory-User": data.user.id };
  const saved = await context.request.post(base + "/api/count", {
    headers,
    data: op,
  });
  assert.equal(saved.status(), 200);
  const result = await saved.json();
  assert.equal(result.record.quantity, 1.25);
  const retried = await context.request.post(base + "/api/count", {
    headers,
    data: op,
  });
  assert.deepEqual(await retried.json(), result);
  checks.push(
    "Guardado HTTPS y reintento idéntico pasan por el Worker de Pages sin duplicarse",
  );
  const bad = await context.request.post(base + "/api/logout", {
    headers: { Origin: "https://externo.test" },
    data: {},
  });
  assert.equal(bad.status(), 403);
  checks.push("Permisos de Barra y rechazo de otro origen sobre Pages HTTPS");
  await context.request.post(base + "/api/logout", {
    headers: { Origin: base },
    data: {},
  });
  assert.equal((await context.request.get(base + "/api/me")).status(), 401);
  checks.push("Cierre de sesión revoca la cookie en Pages");
  await mkdir("test-results/3a", { recursive: true });
  await page.goto(base + "/pages/cuenta/");
  await page.screenshot({ path: "test-results/3a/pages-https-login.png" });
  await writeFile(
    "docs/pages-local-3a.json",
    JSON.stringify(
      {
        transport: "Pages advanced mode + D1 aislado, HTTPS local",
        checks,
        remoteProduction: false,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ checks }, null, 2));
} finally {
  await browser.close();
}
