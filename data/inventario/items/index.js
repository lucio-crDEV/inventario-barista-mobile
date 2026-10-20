import { items as previousBarraItems } from "./barra.js";
import { excelRows, serviceRows } from "./catalogo-excel.js";
import { cocinaCountGroups } from "./cocina.js";
import { pasteleriaCountGroups } from "./pasteleria.js";
import { panaderiaCountGroups } from "./panaderia.js";

function countGroupsByRow(sheet, groups) {
  const byRow = new Map();
  for (const [order, group] of groups.entries()) {
    for (const row of group.rows) {
      if (byRow.has(row)) throw new Error(`Fila ${row} repetida en ${sheet}`);
      byRow.set(row, { name: group.name, order });
    }
  }
  if (byRow.size !== excelRows[sheet].length ||
      excelRows[sheet].some(row => !byRow.has(row[0]))) {
    throw new Error(`Los grupos de ${sheet} no cubren sus filas del Excel`);
  }
  return byRow;
}

const countGroups = {
  cocina: countGroupsByRow("cocina", cocinaCountGroups),
  pasteleria: countGroupsByRow("pasteleria", pasteleriaCountGroups),
  panaderia: countGroupsByRow("panaderia", panaderiaCountGroups),
};

const serviceByRow = new Map(
  excelRows.servicio.map(row => [row[0], row])
);

function normalizedName(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizedUnit(value) {
  return String(value || "").trim().toUpperCase();
}

function conversion(countUnit, exportUnit, name) {
  const from = normalizedUnit(countUnit);
  const to = normalizedUnit(exportUnit);

  if (from === to) return 1;
  if ((from === "GR" || from === "G") && to === "KG") return 0.001;
  if (from === "CC" && to === "UN" && /syrup esencia/i.test(name)) return 1 / 750;
  return null;
}

function reference(sheet, row) {
  return {
    justoId: row[1],
    exportSheet: sheet,
    exportRow: row[0],
    exportUnit: row[3],
    exportCategory: row[4] || "Sin categoría",
  };
}

function itemFromRow(sheet, row, sectorId = null, zoneId = null) {
  const scope = [sheet, sectorId, zoneId].filter(Boolean).join(":");
  const countGroup = countGroups[sheet]?.get(row[0]) ?? null;
  return {
    id: `${scope}:${row[0]}`,
    name: row[2],
    category: row[4] || "Sin categoría",
    countCategory: countGroup?.name || row[4] || "Sin categoría",
    countCategoryOrder: countGroup?.order ?? null,
    areaId: sheet,
    sectorId,
    zoneId,
    unit: row[3],
    toExportFactor: 1,
    order: row[0],
    active: true,
    ...reference(sheet, row),
  };
}

const directAreas = ["cocina", "panaderia", "pasteleria", "principal"];
const directItems = directAreas.flatMap(sheet =>
  excelRows[sheet].map(row => itemFromRow(sheet, row))
);

// Los ID internos de Barra se conservan para no perder sus conteos locales.
const legacyByName = new Map();
for (const item of previousBarraItems) {
  const key = normalizedName(item.name);
  const matches = legacyByName.get(key) || [];
  matches.push(item);
  legacyByName.set(key, matches);
}

const confirmedAliases = new Map([
  ["cafe-grano", "Café grano 1k"],
  ["helado-frutilla-crema", "Helado frutilla"],
]);

const legacyByExcelName = new Map();
for (const [id, excelName] of confirmedAliases) {
  const item = previousBarraItems.find(candidate => candidate.id === id);
  if (item) legacyByExcelName.set(normalizedName(excelName), item);
}

const usedLegacyIds = new Set();
const barraItems = serviceRows.barra.map(rowNumber => {
  const row = serviceByRow.get(rowNumber);
  if (!row) throw new Error(`Falta la fila ${rowNumber} de servicio`);

  const key = normalizedName(row[2]);
  const matches = legacyByName.get(key) || [];
  const legacy = matches.length === 1 ? matches[0] : legacyByExcelName.get(key);

  if (!legacy) return itemFromRow("servicio", row, "barra");
  usedLegacyIds.add(legacy.id);

  // Chai se contará en kilos; el Excel también usa kilos.
  const countUnit = legacy.id === "chai-polvo" ? "KG" : legacy.unit;
  return {
    ...legacy,
    countCategory: legacy.category,
    active: true,
    areaId: "servicio",
    sectorId: "barra",
    zoneId: null,
    unit: countUnit,
    toExportFactor: conversion(countUnit, row[3], row[2]),
    ...reference("servicio", row),
  };
});

const pendingBarraItems = previousBarraItems
  .filter(item => !usedLegacyIds.has(item.id))
  .map(item => ({
    ...item,
    areaId: "servicio",
    sectorId: "barra",
    zoneId: null,
    countCategory: "Por vincular al Excel",
    justoId: null,
    exportSheet: null,
    exportRow: null,
    exportUnit: null,
    exportCategory: null,
    toExportFactor: null,
  }));

function serviceItems(sectorId, zoneId = null) {
  return serviceRows[sectorId].map(rowNumber => {
    const row = serviceByRow.get(rowNumber);
    if (!row) throw new Error(`Falta la fila ${rowNumber} de servicio`);
    return itemFromRow("servicio", row, sectorId, zoneId);
  });
}

export const items = [
  ...directItems,
  ...barraItems,
  ...pendingBarraItems,
  ...serviceItems("armado-linea-coperia"),
  ...serviceItems("mercadito"),
  ...["privada", "salon", "terraza"].flatMap(zone => serviceItems("garzones", zone)),
];
