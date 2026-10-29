import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { permissionsSQL } from '../worker/authorization.js';
import { resolveCycle } from '../worker/inventory-cycles.js';
import { sqliteDB } from './shared/sqlite-adapter.mjs';

test('migration 0016 supports the real cycle lookup and preserves its scope checks', async () => {
  const db = sqliteDB(16),
    userId = 'lookup-admin',
    token = 'catalog-lookup-session';
  const hash = createHash('sha256').update(token).digest('hex');
  try {
    db.sqlite
      .prepare(
        "INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES(?,?,?,'!', 'admin',0)",
      )
      .run(userId, userId, 'Admin');
    db.sqlite.prepare('INSERT INTO sessions VALUES(?,?,unixepoch()+3600)').run(hash, userId);
    db.sqlite.exec(
      "INSERT INTO cycles(id,name,catalog_version,state,lifecycle) VALUES('target','Target','inventory-v3-2026-10-22','open','active'),('other','Other','inventory-v3-2026-10-22','open','active'),('deleted','Deleted','inventory-v3-2026-10-22','open','deleted')",
    );

    const columns = db.sqlite
      .prepare("PRAGMA index_info('catalog_items_version_location')")
      .all()
      .map((row) => row.name);
    assert.deepEqual(columns, ['version', 'location_id']);

    const lookup = `${permissionsSQL()} SELECT c.id FROM cycles c WHERE c.id=?2
      AND c.lifecycle!='deleted' AND (c.lifecycle!='prepared' OR EXISTS(SELECT 1 FROM actor WHERE role IN('admin','service_lead')))
      AND EXISTS(SELECT 1 FROM catalog_items ci WHERE ci.version=c.catalog_version AND ci.location_id IN(SELECT scope_id FROM allowed))`;
    const plan = db.sqlite
      .prepare(`EXPLAIN QUERY PLAN ${lookup}`)
      .all(hash, 'target')
      .map((row) => row.detail)
      .join('\n');
    assert.match(
      plan,
      /catalog_items_version_location/,
      'the cycle lookup should use the migration 0016 composite index',
    );

    assert.equal(await resolveCycle(db, hash, 'target', null, true), 'target');
    assert.equal(await resolveCycle(db, hash, 'other', null, true), 'other');
    assert.equal(
      await resolveCycle(db, hash, 'deleted', null, true),
      null,
      'deleted cycles remain unavailable',
    );
    db.sqlite.exec("UPDATE cycles SET catalog_version='missing' WHERE id='other'");
    assert.equal(
      await resolveCycle(db, hash, 'other', null, true),
      null,
      'a cycle with no matching catalog rows remains unavailable',
    );
  } finally {
    db.sqlite.close();
  }
});
