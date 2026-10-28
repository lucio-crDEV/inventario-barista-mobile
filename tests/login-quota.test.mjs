import { test } from 'node:test';
import assert from 'node:assert/strict';
import { login, digest } from '../worker/session.js';
import { hashPassword } from '../worker/password.js';
import { sqliteDB } from './shared/sqlite-adapter.mjs';

const password = 'Valid-local-password-2026';
const passwordHash = await hashPassword(password);
const ip = '192.0.2.10';
const windowNow = () => Math.floor(Date.now() / 900000);
async function keys(address = ip, username = 'admin') {
  const ipKey = 'ip:' + await digest(address);
  return [ipKey, 'login-ip-user:' + await digest(ipKey + '\0' + username)];
}
function fixture(t) {
  const DB = sqliteDB();
  t.after(() => DB.sqlite.close());
  DB.sqlite.prepare("INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES('admin','admin','Admin',?,'admin',0)").run(passwordHash);
  DB.sqlite.exec("INSERT INTO cycles(id,name,catalog_version,state) VALUES('test','Test','inventory-v2-2026-10-21','open')");
  return { DB, APP_ENV: 'production', ACTIVE_CYCLE_ID: 'test' };
}
function attempt(env, { address = ip, username = 'admin', value = password } = {}) {
  return login(new Request('https://example.test/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': address },
    body: JSON.stringify({ username, password: value }),
  }), env, {}, false);
}
function seed(env, key, count, window = windowNow()) {
  env.DB.sqlite.prepare('INSERT INTO attempts VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET window=excluded.window,n=excluded.n').run(key, window, count);
}
function count(env, key) { return env.DB.sqlite.prepare('SELECT n FROM attempts WHERE key=?').get(key)?.n; }
function interceptSession(env, action) {
  const prepare = env.DB.prepare.bind(env.DB);
  env.DB.prepare = sql => {
    const statement = prepare(sql);
    if (sql.startsWith('INSERT INTO sessions SELECT')) {
      const run = statement.run;
      statement.run = async () => { action(); return run(); };
    }
    return statement;
  };
}

test('More than ten successful logins consume neither IP nor account failure budgets; bcrypt stays at cost 12', async t => {
  const env = fixture(t), [ipKey, accountKey] = await keys();
  assert.match(passwordHash, /^\$2[aby]\$12\$/);
  seed(env, ipKey, 99); seed(env, accountKey, 8);
  seed(env, 'user:' + await digest('admin'), 100); // Legacy global account rows no longer lock an account.
  for (let n = 0; n < 12; n++) {
    const response = await attempt(env, { username: ' ADMIN ' });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Strict;.*Secure/);
    assert.equal(count(env, ipKey), 99);
    assert.equal(count(env, accountKey), 8);
  }
});

test('Failures are durable, the ten-attempt account limit is scoped to its IP, and shared IP budget remains enforced', async t => {
  const env = fixture(t), [ipKey, accountKey] = await keys();
  await assert.rejects(attempt(env, { value: 'incorrect-password' }), { status: 401, code: 'INVALID_LOGIN' });
  assert.equal(count(env, ipKey), 1); assert.equal(count(env, accountKey), 1);
  seed(env, accountKey, 10);
  await assert.rejects(attempt(env), { status: 429, code: 'RATE_LIMIT', retryAfter: 900 });
  assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM sessions').get().n, 0);
  assert.equal((await attempt(env, { address: '192.0.2.11' })).status, 200, 'another network can still sign into the same account');
  seed(env, ipKey, 100);
  await assert.rejects(attempt(env, { username: 'other-user' }), { status: 429, code: 'RATE_LIMIT' });
  seed(env, ipKey, 100, windowNow() - 1); seed(env, accountKey, 100, windowNow() - 1);
  assert.equal((await attempt(env)).status, 200, 'previous window does not lock the account');
  assert.equal(count(env, ipKey), 0); assert.equal(count(env, accountKey), 0);
});

test('A successful login releases its own reservations without erasing concurrent failures', async t => {
  const env = fixture(t), [ipKey, accountKey] = await keys();
  interceptSession(env, () => env.DB.sqlite.prepare('UPDATE attempts SET n=n+3 WHERE key IN (?,?)').run(ipKey, accountKey));
  assert.equal((await attempt(env)).status, 200);
  assert.equal(count(env, ipKey), 3); assert.equal(count(env, accountKey), 3);
});

test('Successful verification crossing a time window does not refund attempts from the new window', async t => {
  const env = fixture(t), [ipKey, accountKey] = await keys();
  const originalNow = Date.now;
  let time = Math.floor(originalNow() / 900000) * 900000 + 899000;
  Date.now = () => time;
  try {
    interceptSession(env, () => {
      time += 2000;
      seed(env, ipKey, 4); seed(env, accountKey, 4);
    });
    assert.equal((await attempt(env)).status, 200);
    assert.equal(count(env, ipKey), 4); assert.equal(count(env, accountKey), 4);
  } finally { Date.now = originalNow; }
});

test('Password verification racing a password reset still fails atomically and retains the failure budget', async t => {
  const env = fixture(t), [ipKey, accountKey] = await keys();
  interceptSession(env, () => env.DB.sqlite.exec("UPDATE users SET password_hash=password_hash||'changed' WHERE id='admin'"));
  await assert.rejects(attempt(env), { status: 401, code: 'INVALID_LOGIN' });
  assert.equal(count(env, ipKey), 1); assert.equal(count(env, accountKey), 1);
  assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM sessions').get().n, 0);
});
