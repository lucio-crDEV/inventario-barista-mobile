// Bounded aggregate dimensions only: no SQL, bindings, identities or content.
const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'development';
const collectors = new WeakMap();
const pages = new Set([
  'home',
  'account',
  'count',
  'summary',
  'admin-users',
  'supervision',
  'other',
]);
const routes = new Set([
  'login',
  'logout',
  'password',
  'profile',
  'me',
  'status',
  'navigation',
  'bootstrap',
  'sync',
  'realtime',
  'search',
  'summary',
  'record',
  'history',
  'count',
  'metrics',
  'cycles',
  'inventory-management',
  'supervision',
  'admin-users',
  'unknown',
]);
const errors = new Set([
  'TypeError',
  'ReferenceError',
  'SyntaxError',
  'RangeError',
  'Error',
  'SERVER_ERROR',
  'NOT_INITIALIZED',
  'NOT_CONFIGURED',
  'other',
]);
const latency = [100, 300, 1000, 3000, 10000, 60000];
const bucket = (ms) => String(latency.find((x) => ms < x) ?? 'overflow');
const milliseconds = (n) => Math.max(0, Math.min(60000, Math.round(Number(n) || 0)));
function collector(env) {
  let c = collectors.get(env.DB);
  if (!c) {
    c = {
      rows: new Map(),
      usage: new Map(),
      next: 0,
      busy: false,
      lost: 0,
      failed: 0,
      oldest: null,
      retentionHour: null,
      quota: 0,
      window: 0,
    };
    collectors.set(env.DB, c);
  }
  return c;
}
function add(c, row, now) {
  if (c.oldest === null) c.oldest = now;
  const key = JSON.stringify(row.slice(0, 7)),
    old = c.rows.get(key);
  if (old) {
    old[7] += row[7];
    old[8] += row[8];
    return;
  }
  if (c.rows.size >= 512) {
    const first = c.rows.keys().next().value;
    c.lost += c.rows.get(first)[7];
    c.rows.delete(first);
  }
  c.rows.set(key, row);
}
function addUsage(c, event, route, ms, now) {
  const day = new Date(now).toISOString().slice(0, 10);
  const method = ['GET', 'POST'].includes(event.method) ? event.method : 'other';
  const status = Math.floor(event.status / 100),
    key = `${day}|${route}|${method}|${status}`;
  const row = c.usage.get(key) || { day, route, method, status, n: 0, ms: 0, slow: 0 };
  row.n++;
  row.ms += ms;
  row.slow += ms >= 1000 ? 1 : 0;
  if (c.usage.size >= 512 && !c.usage.has(key)) c.usage.delete(c.usage.keys().next().value);
  c.usage.set(key, row);
}
function retention(db, day, hour) {
  // Only the first successful batch of an hour/version prunes. The health row
  // comes LAST in that atomic batch, so other isolates skip the expired ranges.
  const cutoff = new Date(Date.parse(day) - 90 * 86400000).toISOString().slice(0, 10);
  const guard =
    'NOT EXISTS(SELECT 1 FROM collector_health WHERE day=? AND version=? AND last_success_at>=?)';
  return [
    db
      .prepare(
        `DELETE FROM usage_daily WHERE (day,route,method,status_class) IN (SELECT day,route,method,status_class FROM usage_daily WHERE day<? AND ${guard} LIMIT 1000)`,
      )
      .bind(cutoff, day, VERSION, hour),
    db
      .prepare(
        `DELETE FROM telemetry_hourly WHERE (hour,version,kind,route,device,metric,bucket) IN (SELECT hour,version,kind,route,device,metric,bucket FROM telemetry_hourly WHERE hour<? AND ${guard} LIMIT 1000)`,
      )
      .bind(cutoff, day, VERSION, hour),
    db
      .prepare(
        `DELETE FROM collector_health WHERE (day,version) IN (SELECT day,version FROM collector_health WHERE day<? AND ${guard} LIMIT 1000)`,
      )
      .bind(cutoff, day, VERSION, hour),
  ];
}
async function flush(env, c, now) {
  if (c.busy || now < c.next) return;
  c.busy = true;
  c.next = now + 60000;
  const rows = [...c.rows.values()],
    usage = [...c.usage.values()],
    lost = c.lost,
    failed = c.failed;
  const age = c.oldest === null ? 0 : Math.max(0, now - c.oldest),
    day = new Date(now).toISOString().slice(0, 10);
  const hourStart = new Date(now).toISOString().slice(0, 13) + ':00:00.000Z';
  c.rows.clear();
  c.usage.clear();
  c.lost = 0;
  c.failed = 0;
  c.oldest = null;
  const n = rows.reduce((sum, r) => sum + r[7], 0);
  try {
    await env.DB.batch([
      ...rows.map((r) =>
        env.DB.prepare(
          `INSERT INTO telemetry_hourly VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(hour,version,kind,route,device,metric,bucket) DO UPDATE SET n=n+excluded.n,value_sum=value_sum+excluded.value_sum`,
        ).bind(...r),
      ),
      ...usage.map((r) =>
        env.DB.prepare(
          `INSERT INTO usage_daily VALUES(?,?,?,?,?,?,?) ON CONFLICT(day,route,method,status_class) DO UPDATE SET requests=requests+excluded.requests,elapsed_ms=elapsed_ms+excluded.elapsed_ms,slow_requests=slow_requests+excluded.slow_requests`,
        ).bind(r.day, r.route, r.method, r.status, r.n, r.ms, r.slow),
      ),
      ...(c.retentionHour === hourStart ? [] : retention(env.DB, day, hourStart)),
      env.DB.prepare(
        `INSERT INTO collector_health VALUES(?,?,?,1,?,?,?,?) ON CONFLICT(day,version) DO UPDATE SET last_success_at=excluded.last_success_at,flushes=flushes+1,recorded=recorded+excluded.recorded,known_lost=known_lost+excluded.known_lost,failed_flushes=failed_flushes+excluded.failed_flushes,max_buffer_age_ms=max(max_buffer_age_ms,excluded.max_buffer_age_ms)`,
      ).bind(day, VERSION, new Date(now).toISOString(), n, lost, failed, age),
    ]);
    c.retentionHour = hourStart;
  } catch {
    c.lost += lost + n;
    c.failed += failed + 1;
    if (!failed) console.log(JSON.stringify({ type: 'inventory-metrics-unavailable' }));
    // No retry of an ambiguous result: never double-count a committed batch.
  } finally {
    c.busy = false;
  }
}
export async function observeRequest(env, event, now = Date.now()) {
  if (env.METRICS_ENABLED !== '1' || !env.DB) return;
  const status = Math.floor(Number(event.status) / 100);
  if (!Number.isInteger(status) || status < 1 || status > 5) return;
  const c = collector(env),
    hour = new Date(now).toISOString().slice(0, 13) + ':00:00Z';
  const route = routes.has(event.route) ? event.route : 'unknown',
    ms = milliseconds(event.elapsedMs);
  add(c, [hour, VERSION, 'latency', route, 'server', String(status), bucket(ms), 1, ms], now);
  addUsage(c, event, route, ms, now);
  if (event.status >= 500)
    add(
      c,
      [
        hour,
        VERSION,
        'error',
        route,
        'server',
        errors.has(event.errorCode) ? event.errorCode : 'SERVER_ERROR',
        'count',
        1,
        0,
      ],
      now,
    );
  // Sampled diagnostics share the existing bounded buffer and flush. Header
  // diagnostics remain per-request; these sums cover sampled requests ONLY.
  if (event.diagnostics?.sampled) {
    const stats = event.diagnostics.stats || {},
      phases = event.diagnostics.phases || {};
    for (const name of [
      'calls',
      'statements',
      'rows_read',
      'rows_written',
      'metadata_missing',
      'sql_ms',
      'binding_ms',
    ]) {
      // Partial/missing D1 metadata must never masquerade as a zero-cost request.
      if (['rows_read', 'rows_written', 'sql_ms'].includes(name) && stats.metadata_missing !== 0)
        continue;
      const value = stats[name];
      if (Number.isFinite(value) && value >= 0)
        add(
          c,
          [hour, VERSION, 'd1', route, 'server', name, 'sum', 1, Math.min(1e12, Math.round(value))],
          now,
        );
    }
    for (const name of ['preflight', 'auth', 'cycle', 'handler']) {
      if (Number.isFinite(phases[name]) && phases[name] >= 0) {
        const value = milliseconds(phases[name]);
        add(c, [hour, VERSION, 'phase', route, 'server', name, 'sum', 1, value], now);
      }
    }
  }
  await flush(env, c, now);
}
const bad = (status, code) => {
  throw Object.assign(Error(code), { status, code });
};
const exact = (o, keys) =>
  o &&
  typeof o === 'object' &&
  !Array.isArray(o) &&
  Object.keys(o).length === keys.length &&
  keys.every((k) => Object.hasOwn(o, k));
export async function receiveTelemetry(req, env, now = Date.now()) {
  if (!env.DB || !env.APP_ORIGIN || new URL(req.url).origin !== env.APP_ORIGIN)
    bad(503, 'NOT_CONFIGURED');
  if (req.method !== 'POST') bad(405, 'METHOD_NOT_ALLOWED');
  if (
    req.headers.get('origin') !== env.APP_ORIGIN ||
    req.headers.get('sec-fetch-site') === 'cross-site'
  )
    bad(403, 'ORIGIN_REJECTED');
  if (env.METRICS_ENABLED !== '1') return new Response(null, { status: 204 });
  if (!req.headers.get('content-type')?.startsWith('application/json')) bad(415, 'JSON_REQUIRED');
  const c = collector(env),
    win = Math.floor(now / 60000);
  if (c.window !== win) {
    c.window = win;
    c.quota = 0;
  }
  if (++c.quota > 120) bad(429, 'RATE_LIMIT');
  const reader = req.body?.getReader();
  let raw = '',
    size = 0;
  const decoder = new TextDecoder();
  if (reader)
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) {
        await reader.cancel();
        bad(413, 'TOO_LARGE');
      }
      raw += decoder.decode(value, { stream: true });
    }
  raw += decoder.decode();
  let b;
  try {
    b = JSON.parse(raw);
  } catch {
    bad(400, 'INVALID_JSON');
  }
  if (
    !exact(b, ['version', 'page', 'device', 'vitals', 'errors']) ||
    b.version !== VERSION ||
    !pages.has(b.page) ||
    !['mobile', 'other'].includes(b.device) ||
    !Array.isArray(b.vitals) ||
    b.vitals.length > 3 ||
    !Array.isArray(b.errors) ||
    b.errors.length > 6 ||
    (!b.vitals.length && !b.errors.length)
  )
    bad(400, 'INVALID_TELEMETRY');
  const seen = new Set(),
    rows = [],
    hour = new Date(now).toISOString().slice(0, 13) + ':00:00Z';
  let count = 0;
  for (const v of b.vitals) {
    if (
      !exact(v, ['name', 'value']) ||
      !['LCP', 'INP', 'CLS'].includes(v.name) ||
      seen.has(v.name) ||
      typeof v.value !== 'number' ||
      !Number.isFinite(v.value) ||
      v.value < 0 ||
      v.value > (v.name === 'CLS' ? 100 : 600000)
    )
      bad(400, 'INVALID_TELEMETRY');
    seen.add(v.name);
    const thresholds =
      v.name === 'LCP' ? [2500, 4000] : v.name === 'INP' ? [200, 500] : [0.1, 0.25];
    rows.push([
      hour,
      VERSION,
      'vital',
      b.page,
      b.device,
      v.name,
      v.value <= thresholds[0] ? 'good' : v.value <= thresholds[1] ? 'needs_improvement' : 'poor',
      1,
      Math.round(v.value * (v.name === 'CLS' ? 10000 : 1)),
    ]);
  }
  seen.clear();
  for (const e of b.errors) {
    if (
      !exact(e, ['code', 'count']) ||
      !errors.has(e.code) ||
      seen.has(e.code) ||
      !Number.isSafeInteger(e.count) ||
      e.count < 1 ||
      (count += e.count) > 20
    )
      bad(400, 'INVALID_TELEMETRY');
    seen.add(e.code);
    rows.push([hour, VERSION, 'error', b.page, b.device, e.code, 'count', e.count, 0]);
  }
  for (const row of rows) add(c, row, now);
  await flush(env, c, now);
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
