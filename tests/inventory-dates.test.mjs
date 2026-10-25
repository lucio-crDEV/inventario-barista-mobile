import test from 'node:test';
import assert from 'node:assert/strict';
import { inventoryDates, monthCells } from '../shared/inventory-dates.js';
import { inventoryHistory } from '../shared/inventory-history.js';
test('calendar exposes only authorized inventory dates, counts duplicates and excludes invalid/prepared/deleted dates',()=>{
  const cycles=[{id:'a',period:'2024-02-29',lifecycle:'active',state:'closed'},{id:'b',period:'2024-02-29',lifecycle:'active',state:'open'},{id:'c',period:'2026-10-25',lifecycle:'prepared'},{period:'2026-10-18',lifecycle:'deleted'},{period:'2023-02-29',lifecycle:'active'}];
  assert.deepEqual(inventoryDates(cycles),[['2024-02-29',2]]);
  assert.deepEqual(inventoryDates(cycles,true),[['2024-02-29',2],['2026-10-25',1]]);
  assert.equal(inventoryHistory(cycles,{date:'2024-02-29'}).total,2);
  assert.equal(inventoryHistory(cycles,{date:'2026-10-25'}).total,0);
  assert.equal(inventoryHistory(cycles,{date:'2026-10-25',includePrepared:true}).total,1);
});
test('Monday-first calendar places leap day correctly and disables dates without inventories',()=>{
  const cells=monthCells('2024-02',[['2024-02-29',2]]);
  assert.deepEqual(cells.slice(0,3),[null,null,null]);
  assert.equal(cells.length,32);
  assert.equal(cells.filter(cell=>cell?.count).length,1);
  assert.deepEqual(cells.at(-1),{date:'2024-02-29',number:29,count:2});
  assert.equal(monthCells('2026-02',[]).filter(Boolean).length,28);
});
