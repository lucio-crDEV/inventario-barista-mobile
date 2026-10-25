// Uses only the isolated test server/state, never the demo or production D1.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { origin, password, database } from './helpers.mjs';

const db = database();
db.exec("DELETE FROM attempts; UPDATE cycles SET state='open'; UPDATE cycle_scope_states SET state='open'");
const browser = await chromium.launch();
const checks = [], errors = [];
await mkdir('test-results/inventory-navigation', { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const login = await context.request.post(origin + '/api/login', { headers: { Origin: origin }, data: { username: 'admin-prueba', password } });
  assert.equal(login.status(), 200);
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/pages/inventario/?area=cocina&inventory=prueba-compartida');
  await expect(page.locator('.category-card').first()).toBeVisible();
  await expect(page.locator('main > .inventory-context-bar')).toHaveCount(0);
  await expect(page.locator('#settings-drawer .inventory-context-bar')).toHaveCount(1);
  await page.locator('.category-card').first().click();
  const drawer = page.locator('#item-drawer');
  await expect(drawer).toHaveClass(/is-open/);
  assert.equal(await page.evaluate(() => document.activeElement.className), 'item-drawer-panel');
  await expect(page.locator('.item-drawer-group[open]')).toHaveCount(1);
  await page.locator('.item-drawer-group[open] .item-drawer-link').first().click();
  await expect(drawer).not.toHaveClass(/is-open/);
  await page.locator('#quantity').fill('1.25'); await page.locator('#note').fill('Borrador de navegación');
  await page.reload();
  await expect(drawer).toHaveClass(/is-open/);
  await page.locator('.item-drawer-link.is-current').click();
  await expect(page.locator('#quantity')).toHaveValue('1.25');
  await expect(page.locator('#note')).toHaveValue('Borrador de navegación');
  await page.locator('#next-item').click();
  await expect(drawer).not.toHaveClass(/is-open/);
  checks.push('Categoría y recarga abren el listado sin teclado; elegir cierra el listado, conserva borradores y Siguiente mantiene la ficha');
  await page.locator('[data-settings-toggle]').click();
  await expect(page.locator('#settings-drawer .inventory-context-bar')).toBeVisible();
  await page.locator('[data-select]').click();
  await expect(page.locator('#settings-drawer')).not.toHaveClass(/is-open/);
  await expect(page.getByRole('heading', { name: 'Seleccionar inventario', exact: true })).toBeVisible();
  await expect(page.locator('[data-cycle=prueba-compartida] .inventory-status')).toHaveText('Activo');
  await page.locator('[data-history-close]').click();
  await page.locator('[data-settings-toggle]').click(); await page.locator('[data-new]').click();
  await page.locator('dialog [type=submit]').click();
  await expect(page.locator('[data-warnings]')).toBeVisible();
  assert.equal(await page.locator('[data-warnings]').evaluate(el => el.nextElementSibling.className), 'inventory-submit-row');
  await expect(page.locator('dialog [type=submit]')).toHaveText('Continuar de todas formas');
  for (const width of [320, 390, 654]) {
    await page.setViewportSize({ width, height: 804 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const warning = await page.locator('[data-warnings]').boundingBox(), action = await page.locator('dialog [type=submit]').boundingBox();
    assert.ok(warning.y + warning.height <= action.y);
  }
  await page.locator('dialog [data-cancel]').click();
  checks.push('Selector y creación se abren desde el menú sin dejarlo activo; advertencia junto a Continuar, sin crear un duplicado durante la prueba');
  await page.goto(origin + '/');
  await expect(page.locator('main > .inventory-context-bar')).toBeVisible();
  for (const theme of ['light', 'dark']) for (const width of [320, 390, 654]) {
    await page.setViewportSize({ width, height: 804 });
    await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `test-results/inventory-navigation/home-${width}-${theme}.png` });
  }
  const response = await context.request.get(origin + '/api/bootstrap?area=servicio&sector=garzones');
  const data = await response.json();
  const zone = data.scopes.find(scope => scope.parent === 'servicio:garzones');
  assert.ok(zone);
  await page.goto(origin + '/pages/inventario/?area=servicio&sector=garzones&zone=' + zone.id.split(':').at(-1) + '&inventory=prueba-compartida');
  await expect(drawer).toHaveClass(/is-open/);
  assert.equal(await page.evaluate(() => document.activeElement.className), 'item-drawer-panel');
  checks.push('Inicio compacto en 320/390/654 y ambos temas; Garzones abre directamente el listado de su zona');
  assert.deepEqual(errors, []);
  await writeFile('test-results/inventory-navigation/report.json', JSON.stringify({ checks, errors }, null, 2));
  console.log('PASS inventory navigation: ' + checks.length + ' groups; no page errors.');
} finally { await browser.close(); db.close(); }
