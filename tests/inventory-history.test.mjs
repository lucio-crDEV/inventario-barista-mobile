import test from 'node:test';
import assert from 'node:assert/strict';
import { inventoryHistory, cycleIsActive } from '../shared/inventory-history.js';

const history = Array.from({ length: 180 }, (_, i) => ({
  id: String(i), name: `Inventario ${i}`, type: 'weekly', lifecycle: 'active', state: 'closed',
  period: `${2023 + Math.floor(i / 60)}-${String(1 + Math.floor(i % 60 / 5)).padStart(2, '0')}-${String(1 + i % 5).padStart(2, '0')}`,
}));
test('history spans years, groups by month and renders bounded pages', () => {
  const first = inventoryHistory(history);
  assert.deepEqual(first.years, ['2025', '2024', '2023']);
  assert.equal(first.total, 180);
  assert.equal(first.groups.flatMap(([, rows]) => rows).length, 24);
  assert.equal(first.hasMore, true);
  assert.match(first.groups[0][0], /diciembre.*2025/);
  assert.equal(inventoryHistory(history, { year: '2024' }).total, 60);
  assert.equal(inventoryHistory(history, { query: '01/01/2023' }).total, 1);
  assert.equal(inventoryHistory(history, { query: '2023-01-01', limit: 48 }).hasMore, false);
});
test('active scope remains visible first; prepared/deleted never enter work selection', () => {
  const active = { ...history[0], id: 'active', scopeStates: [{ state: 'open' }] };
  const prepared = { ...active, id: 'prepared', lifecycle: 'prepared' };
  const deleted = { ...active, id: 'deleted', lifecycle: 'deleted' };
  const result = inventoryHistory([...history, active, prepared, deleted]);
  assert.equal(cycleIsActive(active), true);
  assert.equal(cycleIsActive(history[0]), false);
  assert.equal(cycleIsActive(prepared), false);
  assert.equal(result.total, 181);
  assert.deepEqual(result.groups[0], ['Activos', [active]]);
});
