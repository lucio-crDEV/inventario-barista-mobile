import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sqliteDB } from './shared/sqlite-adapter.mjs';
import { deploymentState, runtimeReadinessSQL } from '../worker/runtime-readiness.js';
import { runtimeObjects } from '../worker/deployment-contract.js';
import { preflightSQL } from '../scripts/preflight.mjs';
import { databaseErrorCode } from '../worker/db-errors.js';
import { errorResponse } from '../worker/http.js';
import { escapeHtml } from '../shared/html.js';
import { catalogCardinalities, allowedArea, catalogScope } from '../shared/deployment-domain.js';
function fixture() {
  const db = sqliteDB(15);
  db.sqlite.exec(
    "INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES('a','aaa','Admin','!','admin',0);INSERT INTO sessions VALUES('a','a',unixepoch()+3600);INSERT INTO cycles(id,name,catalog_version,state) VALUES('target','Target','inventory-v3-2026-10-22','open')",
  );
  return db;
}
const env = { ACTIVE_CYCLE_ID: 'target' };
const fullPreflight = () =>
  preflightSQL('target', { runtime: true, cycles: true, exports: true, capabilities: true });

test('contract 15 checks named guards and counters on every request without serializing DDL or scanning catalog', async () => {
  const db = fixture(),
    statements = [],
    prepare = db.prepare.bind(db);
  db.prepare = (sql) => {
    statements.push(sql);
    return prepare(sql);
  };
  try {
    const changes = db.sqlite.prepare('SELECT total_changes() n').get().n;
    for (let i = 0; i < 3; i++) assert.equal((await deploymentState(db, env)).fast, true);
    assert.deepEqual(statements, [runtimeReadinessSQL, runtimeReadinessSQL, runtimeReadinessSQL]);
    assert.doesNotMatch(
      runtimeReadinessSQL,
      /group_concat|schema_signature|coalesce\(sql|FROM catalog_items|pragma_/i,
    );
    assert.equal(db.sqlite.prepare('SELECT total_changes() n').get().n, changes);
    assert.equal(db.sqlite.prepare(fullPreflight()).get().ready, 1);
    db.sqlite.exec('CREATE INDEX harmless_runtime_index ON attempts(key)');
    assert.equal(
      (await deploymentState(db, env)).fast,
      true,
      'unrelated DDL must not disable requests',
    );
    assert.equal(
      db.sqlite.prepare(fullPreflight()).get(),
      undefined,
      'unreviewed DDL remains unsealed for deployment',
    );
    db.sqlite.exec(
      "UPDATE catalog_integrity SET row_count=row_count-1 WHERE version='inventory-v3-2026-10-22'",
    );
    await assert.rejects(deploymentState(db, env), (error) => error.code === 'NOT_INITIALIZED');
    db.sqlite.exec(
      "UPDATE catalog_integrity SET row_count=1268 WHERE version='inventory-v3-2026-10-22'",
    );
    assert.equal((await deploymentState(db, env)).fast, true, 'readiness result is never cached');
  } finally {
    db.sqlite.close();
  }
});

test('every contract 15 guard/view is required immediately, including warm requests; definitions stay a preflight invariant', async () => {
  const db = fixture();
  try {
    for (const { type, name } of runtimeObjects) {
      const definition = db.sqlite
        .prepare('SELECT sql FROM sqlite_schema WHERE type=? AND name=?')
        .get(type, name).sql;
      assert.equal((await deploymentState(db, env)).fast, true);
      db.sqlite.exec(`DROP ${type} ${name}`);
      await assert.rejects(
        deploymentState(db, env),
        (error) => error.code === 'NOT_INITIALIZED',
        name,
      );
      db.sqlite.exec(definition);
    }
    // Definition changes with the same name remain deliberately a deployment gate.
    db.sqlite.exec(
      'DROP TRIGGER accept_operation; CREATE TRIGGER accept_operation BEFORE INSERT ON operations BEGIN SELECT 1; END;',
    );
    assert.equal((await deploymentState(db, env)).fast, true);
    assert.equal(db.sqlite.prepare(fullPreflight()).get(), undefined);
  } finally {
    db.sqlite.close();
  }
});

test('migration 15 seals definitions and indexes area/version without changing approved catalogs', () => {
  const db = fixture();
  try {
    assert.equal(db.sqlite.prepare(fullPreflight()).get().ready, 1);
    for (const [version, expected] of Object.entries(catalogCardinalities))
      assert.equal(
        db.sqlite.prepare('SELECT count(*) n FROM catalog_items WHERE version=?').get(version).n,
        expected,
      );
    const plan = db.sqlite
      .prepare(
        "EXPLAIN QUERY PLAN SELECT data FROM catalog_items WHERE version=? AND json_extract(data,'$.areaId')=?",
      )
      .all('inventory-v3-2026-10-22', 'servicio');
    assert.match(
      plan.map((row) => row.detail).join('\n'),
      /catalog_items_version_area.*version=\?.*<expr>=\?/,
    );
    const exportPlan = db.sqlite
      .prepare(
        'EXPLAIN QUERY PLAN SELECT id FROM export_snapshots ORDER BY created_at DESC,id DESC LIMIT 20',
      )
      .all();
    assert.match(exportPlan.map((row) => row.detail).join('\n'), /export_snapshots_time/);
    assert.equal(allowedArea('servicio'), true);
    assert.equal(allowedArea('toString'), false);
    assert.equal(
      catalogScope(
        { id: 'servicio:armado-linea-coperia', name: 'Actual' },
        'inventory-v2-2026-10-21',
      ).name,
      'Armado / Línea / Copería (ciclo anterior)',
    );
  } finally {
    db.sqlite.close();
  }
});

test('database decoder accepts exact trigger codes and D1 framing while rejecting substrings, SQL literals, and unknown errors', async () => {
  for (const message of [
    'FORBIDDEN',
    'D1_ERROR: FORBIDDEN: SQLITE_CONSTRAINT',
    'D1_ERROR: STALE: SQLITE_CONSTRAINT_TRIGGER',
  ])
    assert.equal(
      databaseErrorCode(Error(message)),
      message.includes('STALE') ? 'STALE' : 'FORBIDDEN',
    );
  for (const message of [
    'NOT_FORBIDDEN',
    'FORBIDDEN_SUFFIX',
    'XFORBIDDEN',
    '"FORBIDDEN"',
    "SELECT 'FORBIDDEN'",
    'D1_ERROR: no such table: FORBIDDEN_table',
    'UNKNOWN_CODE',
    'This error mentions FORBIDDEN in prose',
  ])
    assert.equal(databaseErrorCode(Error(message)), null, message);
  assert.equal(databaseErrorCode(Error('D1_ERROR: FORBIDDEN: SQLITE_CONSTRAINT'), ['STALE']), null);
  assert.equal(databaseErrorCode(Error('CHECK constraint failed: value=1')), 'ACCOUNT_CHANGED');
  assert.equal(
    databaseErrorCode(Error('D1_ERROR: CHECK constraint failed: value=10: SQLITE_CONSTRAINT')),
    null,
  );
  assert.equal(
    databaseErrorCode(
      Error('D1_ERROR: UNIQUE constraint failed: users.username: SQLITE_CONSTRAINT'),
    ),
    'DUPLICATE',
  );
  assert.equal((await errorResponse(Error('LAST_ADMIN_SUFFIX')).json()).code, 'SERVER_ERROR');
  assert.equal(
    (await errorResponse(Error('D1_ERROR: LAST_ADMIN: SQLITE_CONSTRAINT')).json()).code,
    'LAST_ADMIN',
  );
});

test('shared HTML escaping covers sensitive characters and renderers use the shared safe boundary', () => {
  assert.equal(
    escapeHtml(`<a title="O'Reilly">&</a>`),
    '&lt;a title=&quot;O&#39;Reilly&quot;&gt;&amp;&lt;/a&gt;',
  );
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(0), '0');
  for (const file of ['shared/client.js', 'pages/inventario/inventario.js'])
    assert.match(
      readFileSync(file, 'utf8'),
      /import \{[^}]*\bhtml\b[^}]*\bsetHTML\b[^}]*\} from ['"][^'"]*html\.js['"]/,
    );
});

test('native D1 extended constraint metadata preserves exact business, account and duplicate responses', async () => {
  for (const code of [
    'STALE',
    'FORBIDDEN',
    'LAST_ADMIN',
    'CYCLE_CLOSED',
    'ID_REUSED',
    'CONFIRMATION_REQUIRED',
  ]) {
    const message = `D1_ERROR: ${code}: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_TRIGGER)`;
    assert.equal(databaseErrorCode(Error(message)), code);
    assert.equal(databaseErrorCode(Error(message), [code]), code);
    assert.equal(databaseErrorCode(Error(message), ['UNKNOWN_CODE']), null);
  }
  assert.equal(
    databaseErrorCode(
      Error(
        'D1_ERROR: CHECK constraint failed: value=1: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_CHECK)',
      ),
    ),
    'ACCOUNT_CHANGED',
  );
  assert.equal(
    databaseErrorCode(
      Error(
        'D1_ERROR: UNIQUE constraint failed: users.username: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_UNIQUE)',
      ),
    ),
    'DUPLICATE',
  );
  for (const code of [
    'STALE_SUFFIX',
    'NOT_FORBIDDEN',
    'LAST_ADMIN_SUFFIX',
    "'STALE'",
    'SELECT STALE',
  ])
    assert.equal(
      databaseErrorCode(
        Error(`D1_ERROR: ${code}: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_TRIGGER)`),
      ),
      null,
    );
  const lastAdmin = errorResponse(
    Error('D1_ERROR: LAST_ADMIN: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_TRIGGER)'),
  );
  assert.equal(lastAdmin.status, 409);
  assert.equal((await lastAdmin.json()).code, 'LAST_ADMIN');
  const duplicate = errorResponse(
    Error(
      'D1_ERROR: UNIQUE constraint failed: users.username: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_UNIQUE)',
    ),
  );
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).code, 'DUPLICATE');
});
