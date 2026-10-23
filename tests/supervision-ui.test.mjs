import test from 'node:test';
import assert from 'node:assert/strict';
import {progressParts,mayReopen,movementQuantity,eventCategory,dateTime} from '../pages/admin/supervision-ui.js';

test('combined progress excludes inactive products and keeps finalization distinct', () => {
  assert.deepEqual(progressParts({total:10,counted:4,partial:3,excluded:5}), {total:10,counted:4,partial:3,percent:70,countedPercent:40,partialPercent:30});
  assert.equal(progressParts({total:0,counted:0,partial:0}).percent,0);
  assert.equal(progressParts({total:2,counted:2,partial:3}).percent,100);
});
test('service lead can reopen review, only admin can reopen finalized', () => {
  assert.equal(mayReopen('service_lead','review'),true);
  assert.equal(mayReopen('service_lead','closed'),false);
  assert.equal(mayReopen('admin','closed'),true);
  assert.equal(mayReopen('worker','review'),false);
  assert.equal(mayReopen('admin','open'),false);
});
test('adds are counts and render actual contribution; corrections never invent an added amount', () => {
  assert.equal(eventCategory('add'),'count');
  assert.equal(eventCategory('overwrite'),'correction');
  assert.equal(eventCategory('rectify'),'correction');
  assert.equal(eventCategory('annul'),'annul');
  assert.equal(movementQuantity({action:'add',before:{quantity:3},entered:{quantity:4},after:{quantity:7},unit:'KG'}),'+4 KG');
  assert.equal(movementQuantity({action:'overwrite',before:{quantity:3},after:{quantity:7},unit:'KG'}),'7 KG');
  assert.equal(movementQuantity({action:'annul',after:{status:'pending'}}),'Vuelve a pendiente');
});
test('supervision timestamps omit seconds while retaining date and minute', () => {
  const label = dateTime('2026-10-23T12:34:56.000Z');
  assert.match(label,/2026/); assert.doesNotMatch(label,/:56/);
  assert.equal(dateTime('nonsense'),'Fecha no disponible');
});
