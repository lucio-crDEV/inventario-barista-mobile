import { items as previousBarraItems } from "./barra.js";
import { excelRows, serviceRows } from "./catalogo-excel.js";
import { cocinaCountGroups } from "./cocina.js";
import { pasteleriaCountGroups } from "./pasteleria.js";
import { panaderiaCountGroups } from "./panaderia.js";
import { principalCountGroups } from "./principal.js";
import { serviceLayout } from "./service-layout.js";

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
  principal: countGroupsByRow("principal", principalCountGroups),
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

// Barra conserva las categorías de conteo de la versión anterior. Las categorías
// de la hoja Servicio pertenecen solo a la referencia de exportación.
const barraCategoryOrder = [
  "Insumos", "Syrups", "Congelados", "Te / Infusiones", "Desechables", "Limpieza",
];
const barraCategoryByExcelCategory = {
  Abarrotes: "Insumos",
  Bebestibles: "Insumos",
  "Cafetería": "Insumos",
  Congelados: "Congelados",
  Desechables: "Desechables",
  "Frutas y Verduras": "Insumos",
  Insumos: "Insumos",
  "Lácteos y Quesos": "Insumos",
  Limpieza: "Limpieza",
  "Pastelería": "Insumos",
  "Productos Elaborados": "Insumos",
  Syrups: "Syrups",
  "Te / Infusiones": "Te / Infusiones",
};
const barraCategoryOverridesByRow = new Map([
  [10, "Te / Infusiones"],
  [59, "Congelados"], [60, "Congelados"], [61, "Congelados"],
  [225, "Te / Infusiones"], [226, "Te / Infusiones"],
]);

function barraCategoryOrderFor(category) {
  const order = barraCategoryOrder.indexOf(category);
  if (order < 0) throw new Error(`Categoría de Barra sin definir: ${category}`);
  return order;
}

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

  if (!legacy) {
    const countCategory = barraCategoryOverridesByRow.get(rowNumber)
      || barraCategoryByExcelCategory[row[4]];
    const countCategoryOrder = barraCategoryOrderFor(countCategory);
    return {
      ...itemFromRow("servicio", row, "barra"),
      countCategory,
      countCategoryOrder,
      order: previousBarraItems.length + rowNumber,
    };
  }
  usedLegacyIds.add(legacy.id);

  // Chai se contará en kilos; el Excel también usa kilos.
  const countUnit = legacy.id === "chai-polvo" ? "KG" : legacy.unit;
  return {
    ...legacy,
    countCategory: legacy.category,
    countCategoryOrder: barraCategoryOrderFor(legacy.category),
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
    countCategory: item.category,
    countCategoryOrder: barraCategoryOrderFor(item.category),
    justoId: null,
    exportSheet: null,
    exportRow: null,
    exportUnit: null,
    exportCategory: null,
    toExportFactor: null,
  }));

// Estos productos se contaban en Barra antes de mover las bebidas envasadas a
// Armado/Línea/Copería. Sus ID internos permanecen estables para conservar conteos.
const movedDrinksFromBarra = new Set([45, 46, 47, 48, 49, 71, 72]);

function serviceItems(sectorId, zoneId = null) {
  return serviceRows[sectorId].map(rowNumber => {
    const row = serviceByRow.get(rowNumber);
    if (!row) throw new Error(`Falta la fila ${rowNumber} de servicio`);
    const item = itemFromRow("servicio", row, sectorId, zoneId);
    if (sectorId === "armado-linea-coperia" && movedDrinksFromBarra.has(rowNumber)) {
      item.id = `servicio:barra:${rowNumber}`;
      item.countCategory = "Bebidas";
    }
    return item;
  });
}

export const items = serviceLayout([
  ...directItems,
  ...barraItems,
  ...pendingBarraItems,
  ...serviceItems("armado-linea-coperia"),
  ...serviceItems("mercadito"),
  ...["privada", "salon", "terraza"].flatMap(zone => serviceItems("garzones", zone)),
]);
