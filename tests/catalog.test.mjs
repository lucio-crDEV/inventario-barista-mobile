import assert from "node:assert/strict";
import test from "node:test";

import { items } from "../data/inventario/items/index.js";
import { excelRows, serviceRows } from "../data/inventario/items/catalogo-excel.js";
import { principalCountGroups } from "../data/inventario/items/principal.js";

const rowKey = (sheet, row) => `${sheet}:${row}`;
const referencedItems = items.filter(item => item.exportRow !== null);

test("cada ítem de conteo tiene un ID interno único", () => {
  assert.equal(new Set(items.map(item => item.id)).size, items.length);
});

test("todas las filas del Excel tienen al menos un ítem vinculado", () => {
  const expected = new Set(Object.entries(excelRows).flatMap(([sheet, rows]) =>
    rows.map(row => rowKey(sheet, row[0]))));
  const actual = new Set(referencedItems.map(item =>
    rowKey(item.exportSheet, item.exportRow)));

  assert.deepEqual(actual, expected);
});

test("los datos de exportación de cada ítem coinciden con su fila", () => {
  for (const item of referencedItems) {
    const row = excelRows[item.exportSheet]?.find(candidate =>
      candidate[0] === item.exportRow);
    assert.ok(row, `${item.id}: fila de exportación inexistente`);
    assert.equal(item.justoId, row[1], item.id);
    assert.equal(item.exportUnit, row[3], item.id);
    assert.equal(item.exportCategory, row[4] || "Sin categoría", item.id);
  }
});

test("las áreas directas cuentan cada fila una sola vez", () => {
  for (const sheet of ["principal", "cocina", "panaderia", "pasteleria"]) {
    const areaItems = items.filter(item => item.areaId === sheet);
    assert.equal(areaItems.length, excelRows[sheet].length, sheet);
    assert.equal(new Set(areaItems.map(item => item.exportRow)).size,
      excelRows[sheet].length, sheet);
  }
});

test("Principal muestra grupos prácticos sin alterar las referencias del Excel", () => {
  const principalItems = items.filter(item => item.areaId === "principal");
  const rowGroups = new Map(principalCountGroups.flatMap((group, order) =>
    group.rows.map(row => [row, { name: group.name, order }])));

  assert.equal(principalCountGroups.length, 14);
  assert.equal(rowGroups.size, excelRows.principal.length);
  for (const item of principalItems) {
    const group = rowGroups.get(item.exportRow);
    const row = excelRows.principal.find(candidate => candidate[0] === item.exportRow);
    assert.ok(group, `Fila ${item.exportRow} sin grupo de conteo`);
    assert.ok(row, `${item.id}: fila inexistente en Principal`);
    assert.equal(item.countCategory, group.name, item.id);
    assert.equal(item.countCategoryOrder, group.order, item.id);
    assert.equal(item.name, row[2], item.id);
    assert.equal(item.unit, row[3], item.id);
    assert.equal(item.toExportFactor, 1, item.id);
  }

  for (const row of [8, 9, 288]) {
    const item = principalItems.find(candidate => candidate.exportRow === row);
    assert.equal(item.countCategory, "Carnes, aves y pescados");
    assert.equal(item.exportCategory,
      row === 288 ? "Carnes y Aves" : "Abarrotes");
  }
});

test("Servicio cubre todas sus filas y Garzones repite las 16 por zona", () => {
  const expected = new Set(excelRows.servicio.map(row => row[0]));
  const actual = new Set(Object.values(serviceRows).flat());
  assert.deepEqual(actual, expected);

  for (const zone of ["privada", "salon", "terraza"]) {
    const zoneItems = items.filter(item => item.areaId === "servicio"
      && item.sectorId === "garzones" && item.zoneId === zone);
    assert.equal(zoneItems.length, 16, zone);
    assert.deepEqual(new Set(zoneItems.map(item => item.exportRow)),
      new Set(serviceRows.garzones), zone);
  }
});

test("las conversiones acordadas se conservan y las pendientes son explícitas", () => {
  const chai = items.find(item => item.id === "chai-polvo");
  assert.equal(chai.unit, "KG");
  assert.equal(chai.toExportFactor, 1);

  const syrups = items.filter(item => item.areaId === "servicio"
    && item.sectorId === "barra" && item.unit === "CC"
    && /syrup esencia/i.test(item.name));
  assert.ok(syrups.length > 0);
  for (const item of syrups) {
    assert.equal(item.toExportFactor, 1 / 750, item.id);
  }

  const unresolved = referencedItems.filter(item =>
    !Number.isFinite(item.toExportFactor));
  assert.deepEqual(new Set(unresolved.map(item => item.name)),
    new Set(["Rinza", "Chocolate Liquido"]));

  const unlinked = items.filter(item => item.exportRow === null);
  assert.equal(unlinked.length, 18);
  assert.ok(unlinked.every(item => item.exportSheet === null
    && item.justoId === null && item.toExportFactor === null));
});
