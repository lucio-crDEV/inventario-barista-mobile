import { onLCP, onINP, onCLS } from 'web-vitals';
import { APP_VERSION, CLIENT_METRICS_ENABLED } from './telemetry-config.js';

const started = new WeakSet();
const errorNames = new Set(['TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'Error']);
const metricNames = ['LCP', 'INP', 'CLS'];

function pageName(location) {
  switch (location?.pathname) {
    case '/': case '/index.html': return 'home';
    case '/pages/cuenta/': case '/pages/cuenta/index.html': return 'account';
    case '/pages/admin/': case '/pages/admin/index.html': return 'admin-users';
    case '/pages/admin/supervision': case '/pages/admin/supervision.html': return 'supervision';
    case '/pages/inventario/': case '/pages/inventario/index.html':
      return new URLSearchParams(location.search || '').get('summary') === '1' ? 'summary' : 'count';
    default: return 'other';
  }
}

function errorCode(error) {
  // Never stringify a rejection or inspect its message, stack, URL or contents.
  try {
    const name = error?.name;
    return errorNames.has(name) ? name : 'other';
  }
  catch { return 'other'; }
}

/** Start once per document. Dependencies may be supplied by isolated tests. */
export function startClientTelemetry({
  window: win = globalThis.window,
  document: doc = win?.document,
  vitals = { onLCP, onINP, onCLS },
  enabled = CLIENT_METRICS_ENABLED,
} = {}) {
  if (!enabled || !win || !doc || started.has(win) ||
      typeof win.addEventListener !== 'function' || typeof doc.addEventListener !== 'function') return;
  started.add(win);

  const page = pageName(win.location);
  const device = Number.isFinite(win.innerWidth) && win.innerWidth <= 767 ? 'mobile' : 'other';
  let values = new Map();
  let errors = new Map();
  let errorCount = 0;
  let finalized = false;
  let sends = 0;

  const recordError = error => {
    if (finalized || sends >= 4 || errorCount >= 20) return;
    const code = errorCode(error);
    errors.set(code, (errors.get(code) || 0) + 1);
    errorCount += 1;
  };
  const recordVital = (name, metric) => {
    if (finalized || sends >= 4 || typeof metric?.value !== 'number' ||
        !Number.isFinite(metric.value) || metric.value < 0) return;
    const value = name === 'CLS' ? Math.round(metric.value * 10000) / 10000 : Math.round(metric.value);
    if (Number.isFinite(value)) values.set(name, value);
  };
  const flush = () => {
    if (finalized || sends >= 4) return;
    finalized = true;
    if (!values.size && !errors.size) return;
    sends += 1;
    const payload = {
      version: APP_VERSION,
      page,
      device,
      vitals: metricNames.filter(name => values.has(name)).map(name => ({ name, value: values.get(name) })),
      errors: [...errors].map(([code, count]) => ({ code, count })),
    };
    values.clear();
    errors.clear();
    // Beacon cannot omit ambient cookies. Fetch also suppresses the page referrer.
    try {
      if (typeof win.fetch === 'function') {
        Promise.resolve(win.fetch('/api/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          mode: 'same-origin',
          redirect: 'error',
        })).catch(() => {});
      }
    } catch { /* Telemetry must never affect the application or retry. */ }
  };

  // Reset before the library's restore listeners produce the next visit's values.
  // A visible/hidden transition alone is not a new measurement lifecycle.
  win.addEventListener('pageshow', event => {
    if (!event.persisted || sends >= 4) return;
    values = new Map();
    errors = new Map();
    finalized = false;
  }, true);
  win.addEventListener('error', event => {
    if (event.error) recordError(event.error);
  });
  win.addEventListener('unhandledrejection', event => recordError(event.reason));

  for (const name of metricNames) {
    // Standard web-vitals owns measurement, supported-API checks and BFCache reset.
    // Missing INP (no interaction or unsupported browser) remains missing, not zero.
    try { vitals?.[`on${name}`]?.(metric => recordVital(name, metric)); }
    catch { /* Unsupported observers must not interrupt startup. */ }
  }
  // Match web-vitals' hidden boundary. pagehide can precede visibilitychange,
  // so flushing there would freeze the visit before INP/CLS are finalized.
  // Register after the library and defer to include its final reporters.
  const scheduleFlush = () => {
    if (typeof win.queueMicrotask === 'function') win.queueMicrotask(flush);
    else Promise.resolve().then(flush);
  };
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'hidden') scheduleFlush();
  });
}
