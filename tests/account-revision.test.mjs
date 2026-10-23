import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { accountRequest } from '../worker/accounts.js';
import { temporaryPassword } from '../shared/temporary-password.js';
import { sqliteDB } from './shared/sqlite-adapter.mjs';
function fixture(role = 'admin') {
  const db = sqliteDB(), id = randomUUID(), hash = randomUUID();
  db.sqlite.prepare('INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES(?,?,?,?,?,0)').run(id, 'manager-'+id, 'Manager', '!fixture', role);
  db.sqlite.prepare('INSERT INTO sessions VALUES(?,?,unixepoch()+3600)').run(hash, id);
  const u = db.sqlite.prepare('SELECT * FROM users WHERE id=?').get(id);
  const helpers = { body: req => req.json(), fail(status,code,message) { throw Object.assign(Error(message || code), { status, code }); }, json(data,status=200) { return { data,status }; }, quota: async()=>{}, event:{} };
  const call = payload => accountRequest(new Request('https://example.test/api/admin/users', { method:'POST',body:JSON.stringify(payload) }), db, '/api/admin/users', {u,hash}, helpers);
  const create = extra => ({ username:'test-'+randomUUID().slice(0,8),name:'Test',role:'worker',password:'Only-fixture-2026',grants:['servicio:barra'],...extra });
  return {db,u,call,create};
}
await test('Account revision: worker access is required, scoped and created in the same transaction',async()=>{
  const f=fixture('service_lead');try {
    for(const grants of [undefined,[],['not-real'],['servicio:barra','servicio:barra']]) await assert.rejects(f.call(f.create({grants})),e=>e.status===400);
    await assert.rejects(f.call(f.create({grants:['cocina']})),e=>e.status===403);
    const made=await f.call(f.create());assert.equal(made.status,201);
    assert.deepEqual(f.db.sqlite.prepare('SELECT scope_id FROM grants WHERE user_id=?').all(made.data.id).map(x=>x.scope_id),['servicio:barra']);
    const row=f.db.sqlite.prepare('SELECT must_change,managed_scope FROM users WHERE id=?').get(made.data.id);assert.equal(row.must_change,1);assert.equal(row.managed_scope,'servicio');
    assert.equal(f.db.sqlite.prepare("SELECT count(*) n FROM admin_audit WHERE action='create'").get().n,1);
    assert.ok(!f.db.sqlite.prepare('SELECT detail FROM admin_audit').all().some(x=>x.detail.includes('Only-fixture-2026')));
  } finally { f.db.sqlite.close(); }
});
await test('Account revision: role scopes are inherited and forged worker scopes are rejected',async()=>{
  const f=fixture();try {
    await assert.rejects(f.call(f.create({role:'admin',grants:['cocina']})),e=>e.code==='ROLE_SCOPE');
    const made=await f.call(f.create({role:'service_lead',grants:[]}));assert.equal(made.status,201);
    assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM grants WHERE user_id=?').get(made.data.id).n,0);
  } finally { f.db.sqlite.close(); }
});
await test('Account revision: revoked manager or changed scope during password hashing rolls back user, grants and audit',async()=>{
  for(const mutate of [f=>f.db.sqlite.prepare('UPDATE users SET revision=revision+1 WHERE id=?').run(f.u.id),f=>f.db.sqlite.exec("DELETE FROM scope_closure WHERE ancestor='servicio' AND descendant='servicio:barra'")]) {
    const f=fixture('service_lead');try {
      const original=f.db.batch.bind(f.db);f.db.batch=async statements=>{mutate(f);return original(statements);};
      const payload=f.create();await assert.rejects(f.call(payload),e=>e.code==='ACCOUNT_CHANGED');
      assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM users WHERE username=?').get(payload.username).n,0);
      assert.equal(f.db.sqlite.prepare("SELECT count(*) n FROM admin_audit WHERE action='create'").get().n,0);
    } finally { f.db.sqlite.close(); }
  }
});
await test('Account revision: generated passwords use secure random values, readable words and required character classes',()=>{
  const values=Array.from({length:500},()=>temporaryPassword());
  assert.equal(new Set(values).size,values.length);
  for(const value of values){assert.match(value,/^[A-Z][a-z]+[-_$!][A-Z][a-z]+-[a-zA-Z2-9]{12}$/);assert.match(value,/[2-9]/);assert.ok(new TextEncoder().encode(value).length<=72);}
  assert.throws(()=>temporaryPassword({}),/segura/);
});
