import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { localDatabase, wrangler } from './operations/storage.mjs';
import {
  buildCatalogImportSQL,
  catalogItemRowBytes,
  catalogImportStatements,
  canonicalCatalogPackage,
  compareExistingCatalog,
  MAX_ROW_BYTES,
  MAX_STATEMENT_BYTES,
  validateCatalogPackage,
  validateTargetScopes,
} from './operations/catalog-data.mjs';

function rows(sql) {
  return JSON.parse(
    wrangler(['execute', 'DB', ...target.args, '--command', sql, '--json']),
  ).flatMap((result) => result.results || []);
}

let target;
function importBounds(pkg) {
  const statements = catalogImportStatements(pkg);
  const sql = statements.map((statement) => `${statement};`).join('\n') + '\n';
  return {
    d1Statements: statements.length,
    sqlBytes: Buffer.byteLength(sql, 'utf8'),
    maxStatementBytes: Math.max(
      ...statements.map((statement) => Buffer.byteLength(statement, 'utf8')),
    ),
    maxRowBytes: Math.max(...pkg.items.map((item) => catalogItemRowBytes(pkg.version, item))),
    statementLimit: 50,
    statementByteLimit: MAX_STATEMENT_BYTES,
    rowByteLimit: MAX_ROW_BYTES,
  };
}

function main() {
  const { values: v } = parseArgs({
    options: {
      export: { type: 'boolean' },
      import: { type: 'boolean' },
      output: { type: 'string' },
      input: { type: 'string' },
      local: { type: 'boolean' },
      remote: { type: 'boolean' },
      state: { type: 'string' },
      config: { type: 'string' },
    },
  });
  if (v.export === v.import) throw Error('Choose exactly one of --export or --import.');
  if (v.export) {
    if (!v.output || v.input || v.local || v.remote || v.state || v.config)
      throw Error('Use --export --output FILE.');
    const pkg = canonicalCatalogPackage();
    validateCatalogPackage(pkg);
    writeFileSync(resolve(v.output), `${JSON.stringify(pkg, null, 2)}\n`, {
      flag: 'wx',
      mode: 0o600,
    });
    console.log(
      JSON.stringify({
        exported: true,
        version: pkg.version,
        count: pkg.items.length,
        sha256: pkg.sha256,
      }),
    );
    return;
  }
  if (
    !v.input ||
    !!v.local === !!v.remote ||
    (v.remote && (!v.config || v.state)) ||
    (v.local && (!v.state || v.config))
  )
    throw Error(
      'Use --import --input FILE --local --state STATE, or --import --input FILE --remote --config CONFIG.',
    );
  const pkg = JSON.parse(readFileSync(resolve(v.input), 'utf8'));
  const summary = validateCatalogPackage(pkg);
  const bounds = importBounds(pkg);
  target = v.local
    ? localDatabase(v.state || '.wrangler/state')
    : { args: ['--remote', '--config', v.config], close() {} };
  const tempDir = mkdtempSync(`${tmpdir()}/inventory-catalog-import-`);
  try {
    const preflight = rows(
      `SELECT name FROM sqlite_schema WHERE type='table' AND name IN('catalog_items','catalog_integrity','scopes','scope_closure','cycles')`,
    );
    if (
      new Set(preflight.map((row) => row.name)).size !== 5 ||
      !rows(`SELECT name FROM pragma_table_info('cycles') WHERE name='lifecycle'`).length
    )
      throw Error(
        'Target schema is missing catalog data tables or cycle lifecycle state; run reviewed schema migrations first.',
      );
    const [integrityTrigger] = rows(
      `SELECT sql FROM sqlite_schema WHERE type='trigger' AND name='catalog_integrity_insert'`,
    );
    const triggerSQL = String(integrityTrigger?.sql || '').toLowerCase();
    if (
      !triggerSQL.includes('inventory-v3-2026-10-22') ||
      !triggerSQL.includes('1268') ||
      !triggerSQL.includes('row_count=row_count+1')
    )
      throw Error(
        'Target catalog integrity trigger is missing or does not match the approved v3 cardinality.',
      );
    const quote = (value) => `'${value.replaceAll("'", "''")}'`;
    const [integrity] = rows(
      `SELECT version,row_count,expected_count FROM catalog_integrity WHERE version=${quote(pkg.version)}`,
    );
    const existing = rows(
      `SELECT id,location_id,unit,data FROM catalog_items WHERE version=${quote(pkg.version)} ORDER BY rowid`,
    );
    const targetScopes = rows('SELECT id,name,parent FROM scopes ORDER BY id');
    const targetClosure = rows(
      'SELECT ancestor,descendant FROM scope_closure ORDER BY ancestor,descendant',
    );
    validateTargetScopes(pkg, targetScopes, targetClosure);
    const state = compareExistingCatalog(pkg, existing, integrity);
    if (state === 'exact') {
      console.log(
        JSON.stringify({
          imported: false,
          noOp: true,
          environment: v.local ? 'local' : 'remote',
          ...summary,
          bounds,
        }),
      );
      return;
    }
    if (
      rows(
        `SELECT id FROM cycles WHERE catalog_version=${quote(pkg.version)} AND lifecycle='active' LIMIT 1`,
      ).length
    )
      throw Error(
        'An active cycle already references this incomplete catalog version; refusing import.',
      );
    const sql = buildCatalogImportSQL(pkg);
    const sqlPath = resolve(tempDir, 'catalog-import.sql');
    writeFileSync(sqlPath, sql, { mode: 0o600, flag: 'wx' });
    wrangler(['execute', 'DB', ...target.args, '--file', sqlPath, '--json']);
    const [afterIntegrity] = rows(
      `SELECT version,row_count,expected_count FROM catalog_integrity WHERE version=${quote(pkg.version)}`,
    );
    const afterRows = rows(
      `SELECT id,location_id,unit,data FROM catalog_items WHERE version=${quote(pkg.version)} ORDER BY rowid`,
    );
    compareExistingCatalog(pkg, afterRows, afterIntegrity);
    console.log(
      JSON.stringify({
        imported: true,
        noOp: false,
        environment: v.local ? 'local' : 'remote',
        ...summary,
        bounds,
      }),
    );
  } finally {
    target.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main();
