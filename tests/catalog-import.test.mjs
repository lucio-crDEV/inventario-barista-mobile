import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import {
  catalogItemRowBytes,
  catalogImportStatements,
  canonicalCatalogPackage,
  compareExistingCatalog,
  MAX_STATEMENTS,
  MAX_STATEMENT_BYTES,
  MAX_ROW_BYTES,
  validateCatalogPackage,
} from '../scripts/operations/catalog-data.mjs';

const pkg = canonicalCatalogPackage();

test('approved v3 catalog is pinned, validated, and split within D1 limits', () => {
  assert.deepEqual(validateCatalogPackage(pkg), {
    version: pkg.version,
    count: 1268,
    sha256: '36c5a11f8e76ccdb3a5157c429b8a35967b16907963644c3697cea98d031ca97',
  });
  const statements = catalogImportStatements(pkg);
  const statementCount = statements.length;
  assert.ok(statementCount <= MAX_STATEMENTS);
  assert.ok(
    statements.every((statement) => Buffer.byteLength(statement, 'utf8') < MAX_STATEMENT_BYTES),
  );
  assert.ok(pkg.items.every((item) => catalogItemRowBytes(pkg.version, item) < MAX_ROW_BYTES));
  assert.equal(statementCount, 26);
  assert.throws(
    () => validateCatalogPackage({ ...pkg, items: pkg.items.slice(1) }),
    /hash|cardinality/,
  );
  assert.throws(
    () => validateCatalogPackage({ ...pkg, version: 'inventory-v4-future' }),
    /not approved/,
  );
});

test('exact catalog is a no-op; partial and altered versions are refused', () => {
  const rows = pkg.items.map((item) => ({
    id: item.id,
    location_id: item.locationId,
    unit: item.unit ?? '',
    data: JSON.stringify(item),
  }));
  const integrity = { row_count: pkg.items.length, expected_count: pkg.items.length };
  assert.equal(compareExistingCatalog(pkg, rows, integrity), 'exact');
  assert.throws(() => compareExistingCatalog(pkg, rows.slice(1), integrity), /incomplete/);
  assert.throws(
    () => compareExistingCatalog(pkg, [{ ...rows[0], data: '{}' }, ...rows.slice(1)], integrity),
    /different content/,
  );
});

test('native local D1 rolls back the full bounded import when its final statement fails', async () => {
  const root = mkdtempSync(`${tmpdir()}/catalog-import-d1-test-`);
  try {
    const sqlQuote = (value) =>
      value === null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
    const schemaStatements = [
      'CREATE TABLE scopes(id TEXT PRIMARY KEY,name TEXT NOT NULL,parent TEXT)',
      'CREATE TABLE scope_closure(ancestor TEXT NOT NULL,descendant TEXT NOT NULL,PRIMARY KEY(ancestor,descendant))',
      'CREATE TABLE catalog_items(version TEXT NOT NULL,id TEXT NOT NULL,location_id TEXT NOT NULL REFERENCES scopes(id),unit TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(version,id,location_id))',
      'CREATE TABLE catalog_integrity(version TEXT PRIMARY KEY,row_count INTEGER NOT NULL,expected_count INTEGER NOT NULL)',
      `CREATE TRIGGER catalog_integrity_insert AFTER INSERT ON catalog_items BEGIN
        INSERT INTO catalog_integrity VALUES(NEW.version,1,CASE NEW.version WHEN 'inventory-v3-2026-10-22' THEN 1268 ELSE 0 END)
        ON CONFLICT(version) DO UPDATE SET row_count=row_count+1;
      END`,
      ...pkg.scopes.map(
        (scope) =>
          `INSERT INTO scopes VALUES(${sqlQuote(scope.id)},${sqlQuote(scope.name)},${sqlQuote(scope.parent)})`,
      ),
      ...pkg.scopeClosure.map(
        ([ancestor, descendant]) =>
          `INSERT INTO scope_closure VALUES(${sqlQuote(ancestor)},${sqlQuote(descendant)})`,
      ),
    ];
    let mf;
    try {
      mf = new Miniflare(
        convertV4MiniflareOptions({
          modules: true,
          script: 'export default {}',
          compatibilityDate: '2026-10-01',
          port: 0,
          inspectorPort: 0,
          resourcePersistencePath: resolve(root, 'state'),
          d1Databases: { DB: '00000000-0000-0000-0000-000000000099' },
        }),
      );
      const db = await mf.getD1Database('DB');
      await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
      const prepared = catalogImportStatements(pkg).map((statement) => db.prepare(statement));
      await assert.rejects(
        db.batch([...prepared, db.prepare('INSERT INTO intentionally_missing_table VALUES(1)')]),
      );
      const counts = await db.batch([
        db.prepare('SELECT count(*) n FROM catalog_items'),
        db.prepare('SELECT count(*) n FROM catalog_integrity'),
      ]);
      assert.deepEqual(
        counts.map((result) => result.results[0].n),
        [0, 0],
      );
      await db.batch(prepared);
      const result = await db
        .prepare(
          `SELECT id,location_id,unit,data FROM catalog_items WHERE version=? ORDER BY rowid`,
        )
        .bind(pkg.version)
        .all();
      const state = await db
        .prepare('SELECT row_count,expected_count FROM catalog_integrity WHERE version=?')
        .bind(pkg.version)
        .first();
      assert.equal(compareExistingCatalog(pkg, result.results, state), 'exact');
    } finally {
      await mf?.dispose();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
