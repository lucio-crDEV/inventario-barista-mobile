import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

// Mock only the measurement library and generated build constants. The complete
// client module is bundled unchanged; tests drive its real lifecycle listeners.
const bundled = await build({
  entryPoints: [new URL('../shared/telemetry-client.js', import.meta.url).pathname],
  bundle: true, write: false, format: 'esm', platform: 'browser',
  plugins: [{
    name: 'telemetry-dependencies',
    setup(builder) {
      builder.onResolve({ filter: /^(web-vitals|\.\/telemetry-config\.js)$/ }, args => ({ path: args.path, namespace: 'test' }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, args => ({ contents: args.path === 'web-vitals'
        ? 'export const onLCP = () => {}; export const onINP = () => {}; export const onCLS = () => {};'
        : 'export const APP_VERSION = "test-version"; export const CLIENT_METRICS_ENABLED = true;' }));
    },
  }],
});
const { startClientTelemetry } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);

function emit(target, name, properties = {}) {
  const event = new Event(name);
  Object.assign(event, properties);
  target.dispatchEvent(event);
}
const settled = () => new Promise(resolve => queueMicrotask(resolve));

function fixture({ path = '/pages/inventario/', search = '?summary=1&inventory=secret', width = 390, vitals, fetch } = {}) {
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const requests = [];
  const callbacks = {};
  const win = Object.assign(new EventTarget(), {
    document: doc,
    location: { pathname: path, search, href: `https://private.invalid${path}${search}` },
    innerWidth: width,
    queueMicrotask,
    fetch: fetch || ((url, options) => { requests.push({ url, ...options, payload: JSON.parse(options.body) }); return Promise.resolve(); }),
  });
  const library = vitals || Object.fromEntries(['LCP', 'INP', 'CLS'].map(name => [`on${name}`, callback => { callbacks[name] = callback; }]));
  return {
    win, doc, requests, callbacks,
    start: options => startClientTelemetry({ window: win, vitals: library, ...options }),
    async hide() { doc.visibilityState = 'hidden'; emit(doc, 'visibilitychange'); await settled(); },
    show(persisted = false) { doc.visibilityState = 'visible'; emit(win, 'pageshow', { persisted }); },
  };
}

test('strict payload whitelist strips content, identifiers and query; errors are bounded', async () => {
  const f = fixture();
  f.start();
  const privateMetric = { value: 123.45678, name: 'secret-name', id: 'private-id', entries: [{ url: 'private-url', element: 'secret-dom' }], attribution: { target: 'private-target' } };
  f.callbacks.LCP(privateMetric);
  f.callbacks.INP({ ...privateMetric, value: 48.8 });
  f.callbacks.CLS({ ...privateMetric, value: 0.123456 });
  emit(f.win, 'error', { error: { name: 'TypeError', message: 'password', stack: 'private-url' }, filename: 'private-url' });
  emit(f.win, 'unhandledrejection', { reason: { name: 'secret-person', message: 'password' } });
  for (let i = 0; i < 30; i++) emit(f.win, 'error', { error: new Error('password') });
  await f.hide();
  assert.equal(f.requests.length, 1);
  const request = f.requests[0];
  assert.deepEqual(request.payload, {
    version: 'test-version', page: 'summary', device: 'mobile',
    vitals: [{ name: 'LCP', value: 123 }, { name: 'INP', value: 49 }, { name: 'CLS', value: 0.1235 }],
    errors: [{ code: 'TypeError', count: 1 }, { code: 'other', count: 1 }, { code: 'Error', count: 18 }],
  });
  assert.equal(request.url, '/api/telemetry');
  assert.equal(request.credentials, 'omit');
  assert.equal(request.referrerPolicy, 'no-referrer');
  assert.equal(request.redirect, 'error');
  assert.equal(request.keepalive, true);
  assert.equal(request.method, 'POST');
  assert.doesNotMatch(request.body, /secret|private|password|inventory|stack|entries|attribution/);
});

test('first hidden includes final library callbacks and suppresses duplicate observations and startup', async () => {
  const f = fixture();
  f.start();
  const original = f.callbacks.LCP;
  f.start();
  assert.equal(f.callbacks.LCP, original);
  f.doc.addEventListener('visibilitychange', () => f.callbacks.CLS({ value: 0.25 }));
  f.callbacks.LCP({ value: 1000 });
  await f.hide();
  emit(f.win, 'pagehide');
  f.show();
  f.callbacks.LCP({ value: 2000 });
  emit(f.win, 'error', { error: new TypeError('later') });
  await f.hide();
  assert.equal(f.requests.length, 1);
  assert.deepEqual(f.requests[0].payload.vitals, [{ name: 'LCP', value: 1000 }, { name: 'CLS', value: 0.25 }]);
});

test('BFCache restores reset values once per visit and cap sends at four per document', async () => {
  const f = fixture({ path: '/pages/cuenta/', width: 1000 });
  f.start();
  f.callbacks.LCP({ value: 1000 });
  emit(f.win, 'error', { error: new RangeError() });
  await f.hide();
  for (let i = 1; i <= 5; i++) {
    f.show(true);
    f.callbacks.CLS({ value: i / 10 });
    await f.hide();
    emit(f.win, 'pagehide');
  }
  assert.equal(f.requests.length, 4);
  assert.deepEqual(f.requests[1].payload, { version: 'test-version', page: 'account', device: 'other', vitals: [{ name: 'CLS', value: 0.1 }], errors: [] });
});

test('unsupported APIs, invalid values and rejected transport degrade without invented INP or retries', async () => {
  const f = fixture({ vitals: { onLCP() { throw new Error('unsupported'); } } });
  assert.doesNotThrow(() => f.start());
  await f.hide();
  assert.equal(f.requests.length, 0);
  const invalid = fixture();
  invalid.start();
  for (const value of [NaN, Infinity, -1, '100']) invalid.callbacks.INP({ value });
  emit(invalid.win, 'error', { error: { get name() { throw new Error('getter'); } } });
  await invalid.hide();
  assert.deepEqual(invalid.requests[0].payload.vitals, []);
  assert.deepEqual(invalid.requests[0].payload.errors, [{ code: 'other', count: 1 }]);
  let attempts = 0;
  const failed = fixture({ fetch() { attempts++; return Promise.reject(new Error('offline')); } });
  failed.start();
  failed.callbacks.LCP({ value: 1 });
  await failed.hide();
  await failed.hide();
  assert.equal(attempts, 1);
  const missingFetch = fixture();
  delete missingFetch.win.fetch;
  missingFetch.start();
  missingFetch.callbacks.LCP({ value: 1 });
  await missingFetch.hide();
  assert.doesNotThrow(() => startClientTelemetry({ window: undefined }));
});

test('unknown paths never become telemetry dimensions; disabling starts no observers', async () => {
  const f = fixture({ path: '/private/person-123' });
  f.start({ enabled: false });
  assert.deepEqual(f.callbacks, {});
  f.start();
  f.callbacks.LCP({ value: 20 });
  await f.hide();
  assert.equal(f.requests[0].payload.page, 'other');
});
