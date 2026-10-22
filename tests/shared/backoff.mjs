import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { origin, password } from "./helpers.mjs";
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const r = await context.request.post(origin + "/api/login", { headers: { Origin: origin }, data: { username: "ana", password } });
  assert.equal(r.status(), 200);
  const page = await context.newPage();
  await page.goto(origin + "/pages/inventario/?area=servicio&sector=barra");
  await expect(page.locator(".category-card").first()).toBeVisible();
  await page.clock.install();
  await page.evaluate(() => Object.defineProperty(document, "hidden", { configurable: true, value: true }));
  let reads = 0;
  await page.route("**/api/sync?*", route => {
    reads++;
    return route.fulfill({ status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" }, body: JSON.stringify({ code: "RATE_LIMIT", message: "Espera un minuto." }) });
  });
  const result = await page.evaluate(async () => {
    const { SharedInventory } = await import("/shared/inventory.js");
    const data = await (await fetch("/api/bootstrap")).json();
    const inventory = new SharedInventory(data.user, data);
    window.testInventory = inventory;
    try { await inventory.sync(); } catch (e) { return { status: e.status, wait: inventory.retrySyncAt - Date.now() }; }
  });
  assert.equal(result.status, 429); assert.ok(result.wait >= 59000 && result.wait <= 60000);
  await page.evaluate(() => window.testInventory.sync().catch(() => {}));
  assert.equal(reads, 1);
  await page.clock.fastForward(60001);
  await page.evaluate(() => window.testInventory.sync().catch(() => {}));
  assert.equal(reads, 2);
  await expect(page.locator("#sync-state")).toContainText("borrador conservado");
  console.log("PASS browser honors Retry-After, does not poll during cooldown or claim synced after 429");
} finally { await browser.close(); }
