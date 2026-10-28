import { excelTemplate } from '../data/inventario/export-template.js';
import { readZip, inflateEntry, writeZip } from './excel-zip.js';

const encoder = new TextEncoder(),
  decoder = new TextDecoder('utf-8', { fatal: true });
// These part names are deliberately pinned to the approved template hash.
const sheetParts = Object.freeze({
  principal: 'xl/worksheets/sheet3.xml',
  cocina: 'xl/worksheets/sheet4.xml',
  servicio: 'xl/worksheets/sheet5.xml',
  panaderia: 'xl/worksheets/sheet7.xml',
  pasteleria: 'xl/worksheets/sheet8.xml',
});
const stockCount = Object.values(excelTemplate.sheets).reduce((sum, refs) => sum + refs.length, 0);
const fail = (code) => {
  throw new Error(code);
};
async function sha256(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
function validateCells(cells) {
  if (!Array.isArray(cells) || cells.length !== stockCount) fail('INVALID_STOCK_PLAN');
  const plan = new Map(Object.keys(excelTemplate.sheets).map((sheet) => [sheet, new Map()]));
  for (const item of cells) {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof item.sheet !== 'string' ||
      typeof item.cell !== 'string' ||
      !Object.hasOwn(sheetParts, item.sheet) ||
      !excelTemplate.sheets[item.sheet].includes(item.cell)
    )
      fail('INVALID_STOCK_DESTINATION');
    const targets = plan.get(item.sheet);
    if (targets.has(item.cell)) fail('DUPLICATE_STOCK_DESTINATION');
    const value = item.value;
    if (
      value !== null &&
      (typeof value !== 'string' ||
        value.length > 128 ||
        !/^[0-9]+(?:\.[0-9]{1,3})?$/.test(value) ||
        !Number.isFinite(Number(value)))
    )
      fail('INVALID_STOCK_VALUE');
    targets.set(item.cell, value);
  }
  for (const [sheet, refs] of Object.entries(excelTemplate.sheets)) {
    if (plan.get(sheet).size !== refs.length) fail('MISSING_STOCK_DESTINATION');
  }
  return plan;
}
function patchSheet(xml, sheet, targets) {
  // Scan opening tags and offsets once; never wildcard across the whole sheet.
  const pieces = [],
    seen = new Set(),
    openings = /<c\b[^>]*>/g;
  let cursor = 0,
    changed = 0;
  for (const opening of xml.matchAll(openings)) {
    const ref = /\br="([A-Z]+[1-9][0-9]*)"/.exec(opening[0])?.[1];
    if (!targets.has(ref)) continue;
    if (seen.has(ref)) fail('DUPLICATE_TEMPLATE_CELL');
    seen.add(ref);
    const start = opening.index,
      openEnd = start + opening[0].length;
    const empty = opening[0].endsWith('/>');
    const closeAt = empty ? openEnd : xml.indexOf('</c>', openEnd);
    if (closeAt < 0) fail('INVALID_TEMPLATE_CELL');
    const end = empty ? openEnd : closeAt + 4;
    const original = xml.slice(start, end),
      contents = empty ? '' : xml.slice(openEnd, closeAt);
    if (
      contents.includes('<f') &&
      !excelTemplate.replaceableStockFormulaCells?.[sheet]?.includes(ref)
    )
      fail('PROTECTED_STOCK_FORMULA');
    const value = targets.get(ref);
    const open = empty ? opening[0].slice(0, -2) + '>' : opening[0];
    // The approved stock cells have only r and s attributes. Preserve them byte for byte.
    const replacement =
      value === null ? open.slice(0, -1) + '/>' : open + '<v>' + value + '</v></c>';
    if (replacement !== original) changed++;
    pieces.push(xml.slice(cursor, start), replacement);
    cursor = end;
  }
  if (seen.size !== targets.size) fail('MISSING_TEMPLATE_CELL');
  pieces.push(xml.slice(cursor));
  return { bytes: encoder.encode(pieces.join('')), changed };
}
function requestRecalculation(xml) {
  const tag = /<calcPr\b[^>]*\/>/.exec(xml);
  if (!tag || /\b(?:fullCalcOnLoad|forceFullCalc)=/.test(tag[0]))
    fail('INVALID_TEMPLATE_CALCULATION');
  return encoder.encode(
    xml.slice(0, tag.index) +
      tag[0].slice(0, -2) +
      ' fullCalcOnLoad="1" forceFullCalc="1"/>' +
      xml.slice(tag.index + tag[0].length),
  );
}

/** Generate a copy of the approved template; every authorized stock cell is required. */
export async function generateExcel({ templateBytes, cells, recalculate = false } = {}) {
  if (typeof recalculate !== 'boolean') fail('INVALID_RECALCULATE_OPTION');
  if (!(templateBytes instanceof Uint8Array) && !(templateBytes instanceof ArrayBuffer))
    fail('INVALID_TEMPLATE_BYTES');
  const source =
    templateBytes instanceof Uint8Array
      ? templateBytes.slice()
      : new Uint8Array(templateBytes.slice(0));
  if (source.length > 16 * 1024 * 1024) fail('TEMPLATE_SIZE');
  // Always verify before parsing any ZIP/XML or trusting its destinations.
  const templateSha256 = await sha256(source);
  if (templateSha256 !== excelTemplate.sha256) fail('TEMPLATE_CHANGED');
  const plan = validateCells(cells),
    zip = readZip(source),
    replacements = new Map();
  const sheets = new Map(Object.entries(sheetParts).map(([sheet, part]) => [part, sheet]));
  let changedStockCells = 0;
  for (const entry of zip.entries) {
    // CRC/size validation also covers all untouched, copied compressed members.
    const bytes = await inflateEntry(entry),
      sheet = sheets.get(entry.name);
    if (sheet) {
      const patched = patchSheet(decoder.decode(bytes), sheet, plan.get(sheet));
      replacements.set(entry.name, patched.bytes);
      changedStockCells += patched.changed;
    } else if (recalculate && entry.name === 'xl/workbook.xml') {
      replacements.set(entry.name, requestRecalculation(decoder.decode(bytes)));
    }
  }
  if (replacements.size !== 5 + Number(recalculate)) fail('MISSING_TEMPLATE_PART');
  const bytes = await writeZip(zip, replacements);
  return {
    bytes,
    sha256: await sha256(bytes),
    templateSha256,
    changedStockCells,
    recalculateOnOpen: recalculate,
  };
}
