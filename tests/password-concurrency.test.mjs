import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PasswordWork } from '../operations/auth-worker/password-work.js';
import { dummyHash } from '../worker/password.js';
import { digest, loginPasswordPartition, LOGIN_PASSWORD_LANES } from '../worker/session.js';

const request = (signal) =>
  new Request('https://passwords.internal/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'synthetic-password', hash: dummyHash }),
    signal,
  });
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('Arbitrary account names select only four stable private lanes per IP', async () => {
  const ip = await digest('192.0.2.30'),
    keys = new Set();
  for (let i = 0; i < 2048; i++)
    keys.add(await loginPasswordPartition(ip, await digest(`synthetic-${i}`)));
  assert.equal(keys.size, LOGIN_PASSWORD_LANES);
  const account = await digest('synthetic-account');
  assert.equal(
    await loginPasswordPartition(ip, account),
    await loginPasswordPartition(ip, account),
  );
  assert.ok(!keys.has(await loginPasswordPartition(await digest('192.0.2.31'), account)));
  for (const invalid of ['raw-ip', '', null])
    await assert.rejects(loginPasswordPartition(invalid, account));
});

test('Real private queue admits sixteen, rejects excess, expires/cancels stale work and recovers', async () => {
  const provider = new PasswordWork();
  let release;
  provider.tail = new Promise((resolve) => {
    release = resolve;
  });
  const controllers = Array.from({ length: 16 }, () => new AbortController());
  const waiting = controllers.map((c) => provider.fetch(request(c.signal)));
  while (provider.pending !== 16) await tick();
  assert.equal((await provider.fetch(request())).status, 503);
  assert.equal(provider.pending, 16);
  // Expire admitted work without waiting eight real seconds or running stale bcrypt.
  const now = Date.now;
  try {
    Date.now = () => now() + 8001;
    release();
    const expired = await Promise.all(waiting);
    assert.ok(expired.every((r) => r.status === 503));
    for (const response of expired)
      assert.equal((await response.json()).code, 'PASSWORD_WORK_EXPIRED');
  } finally {
    Date.now = now;
  }
  assert.equal(provider.pending, 0);
  const aborted = new AbortController();
  aborted.abort();
  assert.equal((await provider.fetch(request(aborted.signal))).status, 503);
  assert.equal(provider.pending, 0);
  const recovered = await provider.fetch(request());
  assert.equal(recovered.status, 200);
  assert.deepEqual(await recovered.json(), { match: false });
  assert.equal(provider.pending, 0);
});
