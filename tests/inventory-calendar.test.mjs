import test from 'node:test';
import assert from 'node:assert/strict';
import {recommendation,relativeInventoryDate,localDay} from '../shared/inventory-calendar.js';
test('recommendation uses Santiago date and combines Sunday plus month end',()=>{
  assert.equal(recommendation(new Date('2026-05-31T18:00:00Z')).type,'both');
  assert.match(recommendation(new Date('2026-05-31T18:00:00Z')).message,/domingo y fin de mes/);
  assert.equal(recommendation(new Date('2026-10-26T18:00:00Z')).message,'');
  assert.equal(localDay(new Date('2026-10-26T01:00:00Z')),'2026-10-25');
});
test('last inventory date switches to exact date at seven calendar days',()=>{
 const now=new Date('2026-10-25T18:00:00Z');
 assert.equal(relativeInventoryDate('2026-10-25T06:00:00Z',now),'hoy');
 assert.equal(relativeInventoryDate('2026-10-24T06:00:00Z',now),'hace 1 día');
 assert.equal(relativeInventoryDate('2026-10-22T06:00:00Z',now),'hace 3 días');
 assert.equal(relativeInventoryDate('2026-10-18T06:00:00Z',now),'18/10/2026');
});
import {inventoryURL} from '../shared/navigation.js';
test('area/sector/zone/back navigation pins the selected historical inventory',()=>{
 assert.equal(inventoryURL('?area=servicio&sector=garzones','closed-cycle'),'/pages/inventario/?area=servicio&sector=garzones&inventory=closed-cycle');
 assert.equal(inventoryURL('../../','closed-cycle'),'/?inventory=closed-cycle');
 assert.equal(inventoryURL('/pages/inventario/?area=cocina&inventory=old','visible'),'/pages/inventario/?area=cocina&inventory=visible');
});
