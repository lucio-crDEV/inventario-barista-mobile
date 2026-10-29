import test from 'node:test';
import assert from 'node:assert/strict';
import { html, joinHTML, setHTML } from '../shared/html.js';
import { lintHTML, checkHTML } from '../scripts/lint-html.mjs';
import { scopeView } from '../pages/inventario/view-scope.js';
import { categoriesView } from '../pages/inventario/view-categories.js';
import { itemDrawerView } from '../pages/inventario/view-drawer.js';
import { countView } from '../pages/inventario/view-count.js';
import { summaryGroups } from '../pages/inventario/view-summary.js';
import { passwordField } from '../shared/password-field.js';

const render = (fragment) => {
  const element = {};
  setHTML(element, fragment);
  return element.innerHTML;
};
const malicious = `</textarea><img src=x onerror="globalThis.compromised=true">'&`;

test('html escapes every ordinary value including nested arrays; fragments compose without double escaping', () => {
  assert.equal(
    render(html`<p title="${malicious}">${malicious}</p>`),
    `<p title="&lt;/textarea&gt;&lt;img src=x onerror=&quot;globalThis.compromised=true&quot;&gt;&#39;&amp;">&lt;/textarea&gt;&lt;img src=x onerror=&quot;globalThis.compromised=true&quot;&gt;&#39;&amp;</p>`,
  );
  assert.equal(
    render(html`<ul>${[[html`<li>${'A&B'}</li>`, '<script>bad()</script>'], 0, null]}</ul>`),
    '<ul><li>A&amp;B</li>&lt;script&gt;bad()&lt;/script&gt;0</ul>',
  );
  assert.equal(
    render(html`${joinHTML([html`<b>${'A&B'}</b>`, '<i>text</i>'], '&')}`),
    '<b>A&amp;B</b>&amp;&lt;i&gt;text&lt;/i&gt;',
  );
});
test('DOM boundary rejects strings, arrays, forged fragments and implicit string coercion', () => {
  for (const value of [
    malicious,
    '',
    ['<b>'],
    { html: '<img>' },
    Object.create(null),
    null,
    undefined,
  ])
    assert.throws(() => setHTML({}, value), TypeError);
  assert.throws(() => html(['<img>']), TypeError);
  assert.throws(() => String(html`<b>Safe</b>`), TypeError);
  const original = html`<b>Safe</b>`;
  assert.throws(() => setHTML({}, { ...original }), TypeError);
});
test('syntax lint detects raw DOM APIs regardless of string construction and computed property syntax', async () => {
  for (const code of [
    'el.innerHTML = input',
    "el.innerHTML = '<p>' + input + '</p>'",
    "el['innerHTML'] = html`<p>${input}</p>`",
    "el['inner'+'HTML'] = value",
    'el[`outerHTML`] = value',
    "el.insertAdjacentHTML('beforeend', input)",
    'document.write(input)',
    "new DOMParser().parseFromString(input,'text/html')",
    "Reflect.set(el,'innerHTML', input)",
    "html(['<b>'])",
  ])
    assert.ok(lintHTML(code).length, code);
  assert.deepEqual(lintHTML('setHTML(el, html`<p>${input}</p>`)'), []);
  assert.deepEqual(await checkHTML(), []);
});
const item = {
  id: 'product-1',
  name: malicious,
  unit: malicious,
  areaId: 'cocina',
  category: malicious,
  locationId: 'cocina',
};
const getCount = () => ({ status: 'counted', quantity: 0, note: malicious, outOfStock: true });
const stats = () => ({
  total: 1,
  counted: 1,
  partial: 0,
  countedPercentage: 100,
  partialPercentage: 0,
});
const drawer = () =>
  itemDrawerView({
    currentItemId: item.id,
    activeItems: [item],
    isGarzonZone: false,
    getCountCategory: (x) => x.category,
    getCount,
    getStatusLabel: () => 'Sin stock',
  });
test('extracted views retain item indexes, labels, SVGs, navigation and textarea drafts while treating names and notes as text', () => {
  const snippets = [
    scopeView({
      title: malicious,
      options: [{ name: malicious, url: '?area=cocina', items: [item] }],
      getCategoryStats: stats,
      cycleId: 'cycle',
    }),
    categoriesView({
      categoryGroups: [{ name: malicious, items: [item] }],
      getCategoryStats: stats,
      currentFeedback: malicious,
      currentTone: 'counted',
      drawer: drawer(),
    }),
    drawer(),
    countView({
      item,
      count: getCount(),
      categoryIndex: 0,
      isLastItem: true,
      isGarzonZone: false,
      category: malicious,
      area: 'Cocina',
      quantityValue: '0',
      statusIcon: '🟢',
      statusLabel: 'Sin stock',
      currentFeedback: '',
      currentTone: 'counted',
      drawer: drawer(),
    }),
    passwordField(malicious, 'password', 'new-password'),
  ].map(render);
  for (const source of snippets) {
    assert.ok(source.includes('&lt;img'));
    assert.ok(!source.includes('<img'));
    assert.ok(!source.includes('&amp;lt;'));
  }
  assert.match(snippets[0], /inventory=cycle/);
  assert.match(snippets[1], /data-category-index="0"/);
  assert.match(snippets[2], /data-item-index="0"/);
  assert.match(snippets[2], /aria-current="true"/);
  assert.match(snippets[3], /id="note"[\s\S]*?&lt;\/textarea&gt;/);
  assert.match(snippets[3], /id="previous-item"[\s\S]*?disabled/);
  assert.match(snippets[4], /<svg/);
  assert.equal(
    summaryGroups(
      [item],
      'counted',
      getCount,
      (x) => x.category,
      () => 'Cocina',
    )[0].items[0].item,
    item,
  );
});
