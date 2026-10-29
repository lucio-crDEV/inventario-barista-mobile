import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { passwordLoginScenario } from './password-login-scenario.mjs';
import { digest } from '../../worker/session.js';
import { checkPasswordWithService } from '../../worker/password-service.js';
const bundled = await build({
  stdin: {
    contents: `
    import { DurableObject } from 'cloudflare:workers';
    import { PasswordWork as Core } from './operations/auth-worker/password-work.js';
    export class PasswordWork extends DurableObject {
      constructor(state, env) { super(state, env); this.core = new Core(); }
      fetch(request) {
        const path = new URL(request.url).pathname;
        if(path === '/fixture/hold') { this.core.tail = new Promise(resolve => { this.release = resolve; }); return Response.json({held:true}); }
        if(path === '/fixture/release') { this.release?.(); return Response.json({released:true}); }
        if(path === '/fixture/status') return Response.json({pending:this.core.pending});
        return this.core.fetch(request);
      }
    }
    export default { fetch() { return new Response('Not found', {status:404}); } };
  `,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: 'esm',
  target: 'es2022',
  external: ['cloudflare:workers'],
});
let outboundRequests = 0;
const runtime = new Miniflare(
  convertV4MiniflareOptions({
    name: 'isolated-password-concurrency',
    modules: true,
    script: bundled.outputFiles[0].text,
    compatibilityDate: '2026-10-01',
    durableObjects: { PASSWORDS: { className: 'PasswordWork', useSQLite: true } },
    telemetry: { enabled: false },
    outboundService: async () => {
      outboundRequests++;
      throw Error('Outbound prohibited');
    },
  }),
);
try {
  assert.equal(
    (await runtime.dispatchFetch('https://private.invalid/verify', { method: 'POST' })).status,
    404,
  );
  const namespace = await runtime.getDurableObjectNamespace('PASSWORDS');
  const password = 'Synthetic-only-password-2026';
  const provider = namespace.get(namespace.idFromName('synthetic-fixture-hash'));
  const response = await provider.fetch('https://passwords.internal/hash', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  assert.equal(response.status, 200);
  const { hash } = await response.json();
  assert.match(hash, /^\$2[aby]\$12\$/);
  const result = await passwordLoginScenario(namespace, hash, password);
  // Exercise real interleaving/queue admission in a native private object.
  const saturationKey = await digest('synthetic-saturation');
  const saturated = namespace.get(namespace.idFromName(saturationKey));
  const post = (path, input = {}) =>
    saturated.fetch('https://passwords.internal' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  await post('/fixture/hold');
  const waiting = Array.from({ length: 16 }, () =>
    post('/verify', { password: 'incorrect-password', hash }),
  );
  try {
    for (let i = 0; i < 100; i++) {
      if ((await (await post('/fixture/status')).json()).pending === 16) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal((await (await post('/fixture/status')).json()).pending, 16);
    const busy = await post('/verify', { password, hash });
    assert.equal(busy.status, 503);
    assert.equal((await busy.json()).code, 'PASSWORD_WORK_BUSY');
    await assert.rejects(
      checkPasswordWithService({ PASSWORDS: namespace }, password, hash, saturationKey),
      (error) => error.status === 503 && error.code === 'PASSWORD_SERVICE_UNAVAILABLE',
    );
    // Exercise the real queue deadline in Workerd, without changing its clock.
    // Expired jobs must leave the queue without spending bcrypt CPU on them.
    await new Promise((resolve) => setTimeout(resolve, 8100));
  } finally {
    await post('/fixture/release');
  }
  for (const response of await Promise.all(waiting)) {
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'PASSWORD_WORK_EXPIRED');
  }
  assert.equal((await (await post('/fixture/status')).json()).pending, 0);
  const recovered = await post('/verify', { password, hash });
  assert.equal(recovered.status, 200);
  assert.deepEqual(await recovered.json(), { match: true });
  // A real private fetch remains queued beyond the production caller deadline.
  // This complements the HTTP admission/timeout test: no substituted binding or
  // accelerated timer is used here. Always release the fixture, including on failure.
  await post('/fixture/hold');
  const timeoutStarted = performance.now();
  try {
    await assert.rejects(
      checkPasswordWithService({ PASSWORDS: namespace }, password, hash, saturationKey),
      (error) => error.status === 503 && error.code === 'PASSWORD_SERVICE_UNAVAILABLE',
    );
    assert.ok(performance.now() - timeoutStarted >= 9500, 'real caller deadline elapsed');
  } finally {
    await post('/fixture/release');
  }
  for (let i = 0; i < 100; i++) {
    if ((await (await post('/fixture/status')).json()).pending === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal((await (await post('/fixture/status')).json()).pending, 0);
  const retry = await post('/verify', { password, hash });
  assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), { match: true });
  assert.equal(outboundRequests, 0);
  console.log(
    JSON.stringify({
      nativeSaturationRecovery: true,
      nativeQueueExpiry: true,
      nativeCallerTimeoutRecovery: true,
      passed: true,
      runner: 'native-sqlite-durable-object',
      outboundRequests,
      ...result,
    }),
  );
} finally {
  await runtime.dispose();
}
