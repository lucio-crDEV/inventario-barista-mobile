import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { html, setHTML } from '../../shared/html.js';
import { countView } from '../../pages/inventario/view-count.js';
import { itemDrawerView } from '../../pages/inventario/view-drawer.js';
import { categoriesView } from '../../pages/inventario/view-categories.js';
import { scopeView } from '../../pages/inventario/view-scope.js';
import { passwordField } from '../../shared/password-field.js';

// This suite is self-contained: no server, credentials or inventory database.
const attack = `"'><img src=x onerror="globalThis.compromised=true"><svg onload="globalThis.compromised=true"></svg></textarea>&`;
const item = { id: 'p1', name: attack, unit: attack, category: attack, areaId: 'cocina' };
const count = { status: 'partial', quantity: 2.5, note: attack, outOfStock: false };
const drawer = itemDrawerView({
  currentItemId: item.id,
  activeItems: [item],
  isGarzonZone: false,
  getCountCategory: (x) => x.category,
  getCount: () => count,
  getStatusLabel: () => 'Avance',
});
const stats = () => ({
  total: 1,
  counted: 0,
  partial: 1,
  countedPercentage: 0,
  partialPercentage: 100,
});
const snippets = [
  html`<p title="${attack}">${[attack, html`<strong>${attack}</strong>`]}</p>`,
  scopeView({
    title: attack,
    options: [{ name: attack, url: '?area=cocina', items: [item] }],
    getCategoryStats: stats,
    cycleId: 'c1',
  }),
  categoriesView({
    categoryGroups: [{ name: attack, items: [item] }],
    getCategoryStats: stats,
    currentFeedback: attack,
    currentTone: 'counted',
    drawer,
  }),
  countView({
    item,
    count,
    categoryIndex: 0,
    isLastItem: true,
    isGarzonZone: false,
    category: attack,
    area: 'Cocina',
    quantityValue: '2,5',
    statusIcon: '🟡',
    statusLabel: 'Avance',
    currentFeedback: '',
    currentTone: 'partial',
    drawer,
  }),
  passwordField(attack, 'password', 'new-password'),
];
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent('<main></main>');
  for (const snippet of snippets) {
    const host = {};
    setHTML(host, snippet);
    await page.locator('main').evaluate((element, markup) => {
      element.innerHTML = markup;
    }, host.innerHTML);
    assert.equal(await page.locator('main img, main [onerror], main [onload]').count(), 0);
    assert.equal(await page.evaluate(() => globalThis.compromised), undefined);
  }
  const host = {};
  setHTML(host, snippets[3]);
  await page.locator('main').evaluate((element, markup) => {
    element.innerHTML = markup;
  }, host.innerHTML);
  assert.equal(await page.locator('#note').inputValue(), attack);
  assert.equal(
    await page
      .locator('.item-heading h2')
      .textContent()
      .then((value) => value.trim()),
    attack,
  );
  assert.equal(await page.locator('.item-drawer-name').textContent(), attack);
  assert.equal(await page.locator('.item-drawer-link').getAttribute('aria-current'), 'true');
  assert.equal(await page.locator('#quantity').inputValue(), '2,5');
  assert.equal(await page.locator('#previous-item').isDisabled(), true);
  assert.equal(await page.locator('.item-drawer-close svg').count(), 1);
  // All buttons belong to their actual group, and the drawer cannot close
  // the surrounding count section when its optional category is absent.
  for (const isGarzonZone of [false, true]) {
    const testDrawer = itemDrawerView({
      currentItemId: item.id,
      activeItems: [item],
      isGarzonZone,
      getCountCategory: (x) => x.category,
      getCount: () => count,
      getStatusLabel: () => 'Avance',
    });
    const snippet = countView({
      item,
      count,
      categoryIndex: 0,
      isLastItem: true,
      isGarzonZone,
      category: attack,
      area: 'Cocina',
      quantityValue: '2,5',
      statusIcon: '🟡',
      statusLabel: 'Avance',
      currentFeedback: '',
      currentTone: 'partial',
      drawer: testDrawer,
    });
    const host = {};
    setHTML(host, snippet);
    await page.locator('main').evaluate((element, markup) => {
      element.innerHTML = markup;
    }, host.innerHTML);
    assert.equal(await page.locator('.count-view .count-actions').count(), 1);
    assert.equal(await page.locator('#item-drawer #item-drawer-empty').count(), 1);
    assert.equal(
      await page
        .locator('#item-drawer .item-drawer-panel [data-item-group] .item-drawer-link')
        .count(),
      1,
    );
    assert.equal(
      await page.locator('#item-drawer [data-item-group]').evaluate((group) => group.tagName),
      isGarzonZone ? 'SECTION' : 'DETAILS',
    );
    assert.equal(await page.locator('#note').inputValue(), attack);
  }
  console.log(
    'HTML browser: malicious names, notes and attributes remain text; drafts and navigation preserved.',
  );
} finally {
  await browser.close();
}
