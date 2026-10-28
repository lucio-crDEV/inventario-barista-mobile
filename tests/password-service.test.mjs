import worker from '../worker/index.js';
import {sqliteDB} from './shared/sqlite-adapter.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { PasswordWork } from '../operations/auth-worker/password-work.js';
import { dummyHash } from '../worker/password.js';
import { checkPasswordWithService, hashPasswordWithService } from '../worker/password-service.js';

const partition = 'a'.repeat(64);
const password = 'Local-password-only-2026';
const workRequest = (path, value) => new Request('https://passwords.internal' + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value),
});
function bound(reply) {
  const calls = [];
  return {
    calls,
    PASSWORD_WORK_REQUIRED: '1',
    PASSWORDS: {
      idFromName(key) { assert.equal(key, partition); return key; },
      get() { return { async fetch(request) { calls.push({ path: new URL(request.url).pathname, input: await request.json() }); return reply(request); } }; },
    },
  };
}

test('Private provider rejects public/unknown requests, oversized passwords and work factors other than 12', async () => {
  const provider = new PasswordWork();
  assert.equal((await provider.fetch(new Request('https://test/verify'))).status, 404);
  assert.equal((await provider.fetch(workRequest('/public', {}))).status, 404);
  for (const input of [
    { password, hash: dummyHash.replace('$12$', '$31$') },
    { password: 'é'.repeat(37), hash: dummyHash },
    { password, hash: dummyHash, username: 'never accepted' },
    { password, hash: 'malformed' },
    { password: 'x'.repeat(2000), hash: dummyHash },
  ]) assert.equal((await provider.fetch(workRequest('/verify', input))).status, 400);
  assert.equal((await provider.fetch(workRequest('/hash', { password: 'short' }))).status, 400);
  assert.equal(provider.pending, 0);
  provider.pending = 16;
  assert.equal((await provider.fetch(workRequest('/verify', { password, hash: dummyHash }))).status, 503);
});

test('Adapter uses only the private binding and hashed partition, and normalizes malformed account hashes to cost-12 dummy work', async () => {
  const env = bound(() => Response.json({ match: true }));
  assert.equal(await checkPasswordWithService(env, password, dummyHash, partition), true);
  assert.equal(await checkPasswordWithService(env, password, '$2b$31$malformed', partition), false);
  assert.deepEqual(env.calls.map(call => call.path), ['/verify', '/verify']);
  assert.deepEqual(env.calls[1].input, { password, hash: dummyHash });
  const hashEnv = bound(() => Response.json({ hash: dummyHash }));
  assert.equal(await hashPasswordWithService(hashEnv, password, partition), dummyHash);
  assert.deepEqual(hashEnv.calls[0], { path: '/hash', input: { password } });
});

test('Required binding, invalid partition, malformed service response and provider failures fail closed without local bcrypt', async () => {
  const rejected = promise => assert.rejects(promise, { status: 503, code: 'PASSWORD_SERVICE_UNAVAILABLE' });
  await rejected(checkPasswordWithService({ PASSWORD_WORK_REQUIRED: '1' }, password, dummyHash, partition));
  const env = bound(() => Response.json({ match: true }));
  await rejected(checkPasswordWithService(env, password, dummyHash, 'raw-ip'));
  assert.equal(env.calls.length, 0);
  for (const response of [Response.json({ match: 'true' }), Response.json({ match: true, extra: 'secret' }), new Response('private exception', { status: 503 })])
    await rejected(checkPasswordWithService(bound(() => response), password, dummyHash, partition));
  await rejected(hashPasswordWithService(bound(() => Response.json({ hash: dummyHash.replace('$12$', '$04$') })), password, partition));
  await assert.rejects(hashPasswordWithService(env, 'short', partition), { status: 400, code: 'PASSWORD_POLICY' });
});

test('Private binding timeout returns a generic failure once without retrying or creating a session', async () => {
  const original = globalThis.setTimeout;
  globalThis.setTimeout = callback => { queueMicrotask(callback); return 0; };
  const env = bound(() => new Promise(() => {}));
  try {
    await assert.rejects(checkPasswordWithService(env, password, dummyHash, partition), { status: 503, code: 'PASSWORD_SERVICE_UNAVAILABLE' });
    assert.equal(env.calls.length, 1);
  } finally { globalThis.setTimeout = original; }
});

test('Native SQLite Durable Object hashes and verifies bcrypt12 while the public Worker stays closed', async t => {
  const bundled = await build({
    stdin: { contents: `
      import { DurableObject } from 'cloudflare:workers';
      import { PasswordWork as Core } from './operations/auth-worker/password-work.js';
      export class PasswordWork extends DurableObject {
        constructor(state,env) { super(state,env); this.core=new Core(); }
        fetch(request) { return this.core.fetch(request); }
      }
      export default { fetch() { return new Response('Not found',{status:404}); } };
    `, resolveDir: process.cwd() },
    bundle: true, write: false, format: 'esm', target: 'es2022', external: ['cloudflare:workers'],
  });
  const runtime = new Miniflare(convertV4MiniflareOptions({ name: 'password-native',
    modules: true, script: bundled.outputFiles[0].text, compatibilityDate: '2026-10-01',
    durableObjects: { PASSWORDS: { className: 'PasswordWork', useSQLite: true } },
    telemetry:{enabled:false},outboundService:async()=>{throw Error('Outbound prohibited');},
  }));
  t.after(() => runtime.dispose());
  assert.equal((await runtime.dispatchFetch('https://private.test/hash', { method: 'POST' })).status, 404);
  const namespace = await runtime.getDurableObjectNamespace('PASSWORDS');
  const object = namespace.get(namespace.idFromName(partition));
  const hashed = await object.fetch(workRequest('/hash', { password }));
  assert.equal(hashed.status, 200);
  const { hash } = await hashed.json();
  assert.match(hash, /^\$2[aby]\$12\$/);
  const correct = await object.fetch(workRequest('/verify', { password, hash }));
  assert.deepEqual(await correct.json(), { match: true });
  const wrong = await object.fetch(workRequest('/verify', { password: 'wrong-password', hash }));
  assert.deepEqual(await wrong.json(), { match: false });
  assert.equal(correct.headers.get('cache-control'), 'no-store');
  // Exercise the actual HTTP login adapter against this real private object.
  const DB=sqliteDB(15);t.after(()=>DB.sqlite.close());
  DB.sqlite.prepare("INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES('private-admin','private-admin','Synthetic',?,'admin',0)").run(hash);
  DB.sqlite.exec("INSERT INTO cycles(id,name,catalog_version,state) VALUES('password-test','Synthetic','inventory-v3-2026-10-22','open')");
  const origin='https://password-test.invalid';
  const env={DB,APP_ENV:'production',APP_ORIGIN:origin,ACTIVE_CYCLE_ID:'password-test',PASSWORD_WORK_REQUIRED:'1',PASSWORDS:namespace};
  const login=attempt=>worker.fetch(new Request(origin+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','cf-connecting-ip':'192.0.2.1'},body:JSON.stringify({username:'private-admin',password:attempt})}),env,{});
  const accepted=await login(password);assert.equal(accepted.status,200);assert.match(accepted.headers.get('set-cookie'),/__Host-inventory_session=/);
  assert.equal((await login('wrong-password')).status,401);
  assert.equal(DB.sqlite.prepare('SELECT count(*) n FROM sessions').get().n,1);
  assert.equal(DB.sqlite.prepare('SELECT sum(n) n FROM attempts').get().n,2);
});
