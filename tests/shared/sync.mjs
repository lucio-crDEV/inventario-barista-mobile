import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { origin, password } from "./helpers.mjs";
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const r = await context.request.post(origin + "/api/login", {
    headers: { Origin: origin },
    data: { username: "ana", password },
  });
  assert.equal(r.status(), 200);
  const page = await context.newPage();
  await page.clock.install();
  let polls = 0;
  await page.route("**/api/sync?*", (route) => {
    polls++;
    return route.continue();
  });
  await page.goto(origin + "/pages/inventario/?area=servicio&sector=barra");
  await expect(page.locator(".category-card").first()).toBeVisible();
  await page.locator(".category-card").first().click();
  await page.locator("#quantity").fill("2,5");
  await page.locator("#note").fill("Edición visible");
  await page.evaluate(() =>
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    }),
  );
  await page.clock.fastForward(16000);
  assert.equal(polls, 0);
  const nextPoll = page.waitForResponse((r) => r.url().includes("/api/sync?"));
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await nextPoll;
  assert.equal(polls, 1);
  await expect(page.locator("#quantity")).toHaveValue("2,5");
  await expect(page.locator("#note")).toHaveValue("Edición visible");
  const report = {
    checks: [
      "Sondeo detenido con document.hidden simulado",
      "Al volver visible consulta inmediatamente",
      "La actualización conserva cantidad y nota en edición",
    ],
    osVisibility: false,
    physicalDevice: false,
  };
  await writeFile(
    "docs/sync-local-3a.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
