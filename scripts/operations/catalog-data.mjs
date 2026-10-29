import { createHash } from 'node:crypto';
import {
  areas as allowedAreas,
  catalogCardinalities,
  catalogVersion,
} from '../../shared/deployment-domain.js';
import { catalog, scopes } from '../../worker/catalog.js';
import { excelRows } from '../../data/inventario/items/catalogo-excel.js';

// This importer intentionally supports only the catalog currently defined by
// the application. Adding a future version requires a reviewed code change.
export const approvedCatalogs = Object.freeze({
  'inventory-v3-2026-10-22': Object.freeze({
    count: catalogCardinalities['inventory-v3-2026-10-22'],
    sha256: '36c5a11f8e76ccdb3a5157c429b8a35967b16907963644c3697cea98d031ca97',
  }),
});
export const MAX_STATEMENTS = 50;
export const MAX_STATEMENT_BYTES = 90_000;
export const MAX_ROW_BYTES = 1_900_000;
export const ROWS_PER_INSERT = 50;

export function scopeClosureFor(scopeRows) {
  const byId = new Map(scopeRows.map((scope) => [scope.id, scope]));
  const pairs = [];
  for (const scope of scopeRows) {
    const seen = new Set();
    let current = scope;
    while (current) {
      if (seen.has(current.id)) throw Error('Scope hierarchy contains a cycle.');
      seen.add(current.id);
      pairs.push([current.id, scope.id]);
      current = current.parent ? byId.get(current.parent) : null;
      if (current === undefined) throw Error('Scope hierarchy has an unknown parent.');
    }
  }
  return pairs;
}

export function canonicalCatalogPackage() {
  const version = catalogVersion;
  const scopeRows = scopes.map(({ id, name, parent }) => ({ id, name, parent }));
  const closure = scopeClosureFor(scopeRows);
  const items = catalog.map((item) => ({ ...item }));
  const payload = { format: 1, version, scopes: scopeRows, scopeClosure: closure, items };
  return { ...payload, sha256: packageDigest(payload) };
}

export function packageDigest(payload) {
  const { sha256: _ignored, ...content } = payload;
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

export function validateCatalogPackage(pkg) {
  if (!pkg || pkg.format !== 1 || typeof pkg.version !== 'string')
    throw Error('Unsupported catalog package format.');
  const approved = approvedCatalogs[pkg.version];
  if (!approved) throw Error('Catalog version is not approved for import.');
  if (pkg.sha256 !== packageDigest(pkg) || pkg.sha256 !== approved.sha256)
    throw Error('Catalog package hash is not approved.');
  if (
    !Array.isArray(pkg.scopes) ||
    !Array.isArray(pkg.scopeClosure) ||
    !Array.isArray(pkg.items) ||
    pkg.items.length !== approved.count
  )
    throw Error('Catalog package cardinality or shape is invalid.');

  const areas = new Set(allowedAreas.map((area) => area.id));
  const scopeById = new Map();
  for (const scope of pkg.scopes) {
    if (
      !scope ||
      typeof scope.id !== 'string' ||
      !scope.id ||
      typeof scope.name !== 'string' ||
      !scope.name ||
      !(scope.parent === null || typeof scope.parent === 'string') ||
      scopeById.has(scope.id)
    )
      throw Error('Catalog scopes are invalid.');
    scopeById.set(scope.id, scope);
  }
  const expectedClosure = scopeClosureFor(pkg.scopes);
  if (JSON.stringify(pkg.scopeClosure) !== JSON.stringify(expectedClosure))
    throw Error('Catalog scope closure is invalid.');

  const identities = new Set();
  const exportRefs = new Set();
  for (const item of pkg.items) {
    if (
      !item ||
      typeof item.id !== 'string' ||
      !item.id ||
      typeof item.locationId !== 'string' ||
      !item.locationId ||
      identities.has(`${item.id}\0${item.locationId}`)
    )
      throw Error('Catalog ID/location is missing or duplicated.');
    identities.add(`${item.id}\0${item.locationId}`);
    if (
      typeof item.areaId !== 'string' ||
      !areas.has(item.areaId) ||
      !(
        item.unit === null ||
        (typeof item.unit === 'string' && (item.unit === '' || !!item.unit.trim()))
      )
    )
      throw Error('Catalog area or unit is invalid.');
    const derivedLocation = [item.areaId, item.sectorId, item.zoneId].filter(Boolean).join(':');
    if (derivedLocation !== item.locationId || !scopeById.has(item.locationId))
      throw Error('Catalog location is not registered.');
    if ((item.exportSheet == null) !== (item.exportRow == null))
      throw Error('Catalog export reference is incomplete.');
    if (item.exportSheet == null) continue;
    if (typeof item.exportSheet !== 'string' || !Number.isSafeInteger(item.exportRow))
      throw Error('Catalog export reference is invalid.');
    const ref = (excelRows[item.exportSheet] || []).find((row) => row[0] === item.exportRow);
    if (
      !ref ||
      (item.justoId ?? null) !== (ref[1] ?? null) ||
      (item.exportUnit ?? null) !== (ref[3] ?? null) ||
      item.exportCategory !== (ref[4] || 'Sin categoría')
    )
      throw Error('Catalog export reference does not match the approved registry.');
    exportRefs.add(`${item.exportSheet}:C${item.exportRow}`);
  }
  for (const [sheet, rows] of Object.entries(excelRows))
    for (const [row] of rows)
      if (!exportRefs.has(`${sheet}:C${row}`))
        throw Error('Catalog package does not cover the approved export registry.');
  return { version: pkg.version, count: pkg.items.length, sha256: pkg.sha256 };
}

const sqlQuote = (value) => (value === null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`);
export function catalogItemRowBytes(version, item) {
  return (
    Buffer.byteLength(version, 'utf8') +
    Buffer.byteLength(item.id, 'utf8') +
    Buffer.byteLength(item.locationId, 'utf8') +
    Buffer.byteLength(item.unit ?? '', 'utf8') +
    Buffer.byteLength(JSON.stringify(item), 'utf8') +
    128
  );
}

export function buildCatalogImportSQL(pkg) {
  return (
    catalogImportStatements(pkg)
      .map((statement) => `${statement};`)
      .join('\n') + '\n'
  );
}

export function catalogImportStatements(pkg) {
  const chunks = [];
  for (let offset = 0; offset < pkg.items.length; offset += ROWS_PER_INSERT) {
    const tuples = pkg.items
      .slice(offset, offset + ROWS_PER_INSERT)
      .map(
        (item) =>
          `(${sqlQuote(pkg.version)},${sqlQuote(item.id)},${sqlQuote(item.locationId)},${sqlQuote(item.unit ?? '')},${sqlQuote(JSON.stringify(item))})`,
      );
    chunks.push(
      `INSERT INTO catalog_items(version,id,location_id,unit,data) VALUES${tuples.join(',')}`,
    );
  }
  const statements = chunks;
  if (statements.length > MAX_STATEMENTS)
    throw Error('Catalog import exceeds D1 batch statement limit.');
  for (const item of pkg.items)
    if (catalogItemRowBytes(pkg.version, item) > MAX_ROW_BYTES)
      throw Error('Catalog row exceeds D1 row limit.');
  for (const statement of statements) {
    const bytes = Buffer.byteLength(statement, 'utf8');
    if (bytes > MAX_STATEMENT_BYTES) throw Error('Catalog import exceeds D1 SQL statement limit.');
  }
  return statements;
}

export function compareExistingCatalog(pkg, rows, integrity) {
  if (!rows.length && !integrity) return 'missing';
  const approved = approvedCatalogs[pkg.version];
  if (
    !integrity ||
    integrity.row_count !== approved.count ||
    integrity.expected_count !== approved.count ||
    rows.length !== approved.count
  )
    throw Error('Target contains an incomplete catalog version; refusing to overwrite it.');
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i],
      item = pkg.items[i];
    if (
      row.id !== item.id ||
      row.location_id !== item.locationId ||
      row.unit !== (item.unit ?? '') ||
      row.data !== JSON.stringify(item)
    )
      throw Error('Target catalog version has different content; refusing to overwrite it.');
  }
  return 'exact';
}

export function validateTargetScopes(pkg, targetScopes, targetClosure) {
  const actualScopes = new Map(targetScopes.map((scope) => [scope.id, scope]));
  for (const scope of pkg.scopes) {
    const actual = actualScopes.get(scope.id);
    if (!actual || actual.name !== scope.name || actual.parent !== scope.parent)
      throw Error('Target scope registry does not match catalog package.');
  }
  const pairs = new Set(targetClosure.map((pair) => `${pair.ancestor}\0${pair.descendant}`));
  if (pkg.scopeClosure.some(([ancestor, descendant]) => !pairs.has(`${ancestor}\0${descendant}`)))
    throw Error('Target scope closure does not match catalog package.');
}
