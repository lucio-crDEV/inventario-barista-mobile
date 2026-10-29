import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import worker from '../../worker/index.js';
import { sqliteDB } from './sqlite-adapter.mjs';
import { digest, LOGIN_PASSWORD_LANES } from '../../worker/session.js';

// Both runners use the production login handler, SQLite guards and the actual
// private PasswordWork implementation. No remote config, users or network fixtures.
export async function passwordLoginScenario(namespace, hash, password) {
  const DB = sqliteDB(16);
  const origin = 'https://isolated-password.invalid';
  const env = {
    DB,
    APP_ENV: 'production',
    APP_ORIGIN: origin,
    ACTIVE_CYCLE_ID: 'isolated-password',
    PASSWORD_WORK_REQUIRED: '1',
    PASSWORDS: namespace,
  };
  const ip = '192.0.2.30';
  const accounts = Array.from({ length: 30 }, (_, i) => `synthetic-person-${i + 1}`);
  const insert = DB.sqlite.prepare(
    "INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES(?,?,?,?,'worker',0)",
  );
  for (const name of accounts) insert.run(name, name, 'Synthetic account', hash);
  DB.sqlite.prepare("UPDATE users SET role='admin' WHERE id=?").run(accounts[0]);
  DB.sqlite.exec(
    "INSERT INTO cycles(id,name,catalog_version,state) VALUES('isolated-password','Synthetic','inventory-v3-2026-10-22','open')",
  );
  const sessions = () => DB.sqlite.prepare('SELECT count(*) n FROM sessions').get().n;
  const login = (username, attempted = password, address = ip) =>
    worker.fetch(
      new Request(origin + '/api/login', {
        method: 'POST',
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          'cf-connecting-ip': address,
        },
        body: JSON.stringify({ username, password: attempted }),
      }),
      env,
      {},
    );
  const ipKey = 'ip:' + (await digest(ip));
  const accountKey = async (name) => 'login-ip-user:' + (await digest(ipKey + '\0' + name));
  const count = (key) => DB.sqlite.prepare('SELECT n FROM attempts WHERE key=?').get(key)?.n || 0;
  try {
    const started = performance.now();
    const results = await Promise.all(
      accounts.map(async (name) => {
        const start = performance.now(),
          response = await login(name);
        // Never print a response header or body containing a session/identity.
        return { status: response.status, ms: performance.now() - start };
      }),
    );
    assert.deepEqual(
      results.map((r) => r.status),
      Array(30).fill(200),
      'all thirty shared-IP logins accepted',
    );
    assert.equal(sessions(), 30);
    assert.equal(count(ipKey), 0, 'successful reservations released');
    assert.equal(DB.sqlite.prepare('SELECT sum(n) n FROM attempts').get().n, 0);
    const burstMs = performance.now() - started;
    const before = sessions();
    const mixed = await Promise.all([
      login(accounts[0], 'incorrect-password'),
      login(accounts[1]),
      login('synthetic-absent'),
    ]);
    assert.deepEqual(
      mixed.map((r) => r.status),
      [401, 200, 401],
    );
    assert.equal(sessions(), before + 1);
    assert.equal(count(ipKey), 2, 'success preserves concurrent failures');
    assert.equal(count(await accountKey(accounts[0])), 1);
    const window = Math.floor(Date.now() / 1000 / 900);
    const put = DB.sqlite.prepare(
      'INSERT INTO attempts(key,window,n) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET window=excluded.window,n=excluded.n',
    );
    put.run(await accountKey(accounts[0]), window, 10);
    assert.equal((await login(accounts[0])).status, 429, 'IP/account budget still enforced');
    assert.equal((await login(accounts[2])).status, 200, 'other account unaffected');
    put.run(ipKey, window, 100);
    assert.equal(
      (await login(accounts[3])).status,
      429,
      'global IP budget cannot be split by lanes',
    );
    const limitedSessions = sessions();
    put.run(ipKey, window - 1, 100);
    put.run(await accountKey(accounts[0]), window - 1, 10);
    assert.equal((await login(accounts[0])).status, 200, 'expired quota recovers');
    assert.equal(sessions(), limitedSessions + 1);
    assert.equal(
      (await login(accounts[0], password, '192.0.2.31')).status,
      200,
      'another network is independent',
    );
    // A stalled private binding times out once, cannot mint a session and consumes
    // its reserved attempt. The normal provider recovers on an explicit retry.
    const originalTimer = globalThis.setTimeout;
    let serviceCalls = 0;
    env.PASSWORDS = {
      idFromName: (key) => key,
      get: () => ({
        fetch: () => {
          serviceCalls++;
          return new Promise(() => {});
        },
      }),
    };
    const beforeTimeout = sessions();
    try {
      globalThis.setTimeout = (callback, delay, ...args) => {
        if (delay === 10000) {
          queueMicrotask(callback);
          return 0;
        }
        return originalTimer(callback, delay, ...args);
      };
      assert.equal((await login(accounts[5])).status, 503);
      assert.equal(serviceCalls, 1, 'no automatic password retry');
      assert.equal(sessions(), beforeTimeout);
    } finally {
      globalThis.setTimeout = originalTimer;
      env.PASSWORDS = namespace;
    }
    assert.equal((await login(accounts[5])).status, 200);
    // Disable the account after real private verification and before admission.
    env.PASSWORDS = {
      idFromName: (key) => namespace.idFromName(key),
      get: (key) => ({
        async fetch(request) {
          const response = await namespace.get(key).fetch(request);
          DB.sqlite.prepare('UPDATE users SET active=0 WHERE id=?').run(accounts[4]);
          return response;
        },
      }),
    };
    assert.equal((await login(accounts[4])).status, 401);
    assert.equal(
      DB.sqlite.prepare('SELECT count(*) n FROM sessions WHERE user_id=?').get(accounts[4]).n,
      0,
    );
    env.PASSWORDS = namespace;
    const times = results.map((r) => r.ms).sort((a, b) => a - b);
    return {
      people: 30,
      statuses: { 200: 30 },
      burstMs: Math.round(burstMs),
      p50Ms: Math.round(times[14]),
      p95Ms: Math.round(times[28]),
      fixedLanesPerIP: LOGIN_PASSWORD_LANES,
      incorrectAndAbsentRejected: true,
      sharedIPAndPairQuotas: true,
      recovery: true,
      timeoutFailsClosed: true,
      disabledDuringVerificationRejected: true,
      productionCPUCertified: false,
    };
  } finally {
    DB.sqlite.close();
  }
}
