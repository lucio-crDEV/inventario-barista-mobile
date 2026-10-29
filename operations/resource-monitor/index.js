import { fetchResourceAnalytics } from './entry.js';
import {
  ALERT_STATE_KEY,
  MAX_NOTIFICATION_ATTEMPTS,
  PROVIDER_INTERVAL_MS,
  evaluateResourceIssues,
  quotaShares,
  transitionEvents,
} from './policy.js';

const safeErrorCodes = new Set([
  'MONITOR_CONFIG_INVALID',
  'ANALYTICS_UNAVAILABLE',
  'ANALYTICS_RESPONSE_INVALID',
  'ANALYTICS_QUERY_FAILED',
]);
const dateKey = (ms) => new Date(ms).toISOString().slice(0, 10);
const iso = (ms) => new Date(ms).toISOString();
const initialState = () => ({
  version: 1,
  health: 'unavailable',
  failureCount: 0,
  outageAlerted: false,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastFailureCode: null,
  metricsUpdatedAt: null,
  metrics: null,
  activeIssues: [],
  notificationDay: null,
  notificationAttemptAt: null,
  notificationLedger: {},
  lastNotificationAt: null,
});

function usableState(value) {
  return value?.version === 1 &&
    Array.isArray(value.activeIssues) &&
    value.notificationLedger &&
    typeof value.notificationLedger === 'object'
    ? value
    : initialState();
}
function notificationEvent(event, day, now) {
  const issue = event.issue || {};
  return {
    fingerprint: event.fingerprint,
    kind: event.kind,
    key: issue.key,
    severity: issue.severity,
    day,
    value: Number.isSafeInteger(issue.value) ? issue.value : undefined,
    limit: Number.isSafeInteger(issue.limit) ? issue.limit : undefined,
    percentage: Number.isFinite(issue.percentage) ? issue.percentage : undefined,
    unit: typeof issue.unit === 'string' ? issue.unit : undefined,
    note: typeof issue.note === 'string' ? issue.note.slice(0, 220) : undefined,
    createdAt: iso(now),
    status: 'pending',
    attempts: 0,
    nextAttemptAt: now,
  };
}
function addPendingEvents(state, events, day, now) {
  if (state.notificationDay !== day) {
    state.notificationDay = day;
  }
  for (const event of events) {
    if (!event.fingerprint || state.notificationLedger[event.fingerprint]) continue;
    state.notificationLedger[event.fingerprint] = notificationEvent(event, day, now);
  }
  const keys = Object.keys(state.notificationLedger);
  if (keys.length > 128) {
    const removable = keys.filter((key) => state.notificationLedger[key].status !== 'pending');
    while (Object.keys(state.notificationLedger).length > 128 && removable.length)
      delete state.notificationLedger[removable.shift()];
  }
}
function nextDayIssues(state, issues, day, now) {
  const events = transitionEvents(state.activeIssues, issues, day);
  if (state.notificationDay !== day) {
    for (const issue of issues)
      events.push({
        fingerprint: `alert:${issue.key}:${issue.severity}:${day}`,
        kind: 'alert',
        issue,
      });
  }
  return events;
}
function safeNotificationPayload(events, day) {
  return {
    type: 'resource-monitor-alert',
    day,
    events: events.map(
      ({ fingerprint, kind, key, severity, value, limit, percentage, unit, note }) => ({
        fingerprint,
        kind,
        key,
        severity,
        ...(value === undefined ? {} : { value }),
        ...(limit === undefined ? {} : { limit }),
        ...(percentage === undefined ? {} : { percentage }),
        ...(unit ? { unit } : {}),
        ...(note ? { note } : {}),
      }),
    ),
  };
}

export function createResourceMonitorAPI({
  storage,
  notify,
  fetchImpl = fetch,
  now = () => Date.now(),
}) {
  if (!storage || typeof storage.get !== 'function' || typeof storage.put !== 'function')
    throw Error('Resource monitor storage is required.');
  let inFlight = null;

  async function load() {
    return usableState(await storage.get(ALERT_STATE_KEY));
  }
  async function persist(state) {
    await storage.put(ALERT_STATE_KEY, state);
  }
  async function dispatchNotifications(state, at) {
    if (typeof notify !== 'function') return state;
    if (
      state.notificationAttemptAt !== null &&
      at - state.notificationAttemptAt < PROVIDER_INTERVAL_MS
    )
      return state;
    const pending = Object.values(state.notificationLedger).filter(
      (event) =>
        event.status === 'pending' &&
        event.attempts < MAX_NOTIFICATION_ATTEMPTS &&
        event.nextAttemptAt <= at,
    );
    if (!pending.length) return state;
    state.notificationAttemptAt = at;
    for (const event of pending) {
      event.attempts++;
      event.nextAttemptAt = at + PROVIDER_INTERVAL_MS;
    }
    await persist(state);
    let sent = false;
    try {
      const result = await notify(safeNotificationPayload(pending, dateKey(at)));
      sent = result !== false;
    } catch {}
    for (const event of pending) {
      const ledger = state.notificationLedger[event.fingerprint];
      if (sent) {
        ledger.status = 'sent';
        ledger.sentAt = iso(at);
      } else if (ledger.attempts >= MAX_NOTIFICATION_ATTEMPTS) ledger.status = 'failed';
    }
    if (sent) state.lastNotificationAt = iso(at);
    await persist(state);
    return state;
  }

  async function status() {
    const state = await load();
    const notifications = Object.values(state.notificationLedger);
    return {
      version: 1,
      health: state.health,
      failureCount: state.failureCount,
      lastAttemptAt: state.lastAttemptAt === null ? null : iso(state.lastAttemptAt),
      lastSuccessAt: state.lastSuccessAt,
      lastFailureCode: state.lastFailureCode,
      metricsUpdatedAt: state.metricsUpdatedAt,
      metricsFresh: state.health !== 'unavailable' && state.metricsUpdatedAt !== null,
      metrics: state.metrics,
      quotaShares:
        state.health !== 'unavailable' && state.metrics ? quotaShares(state.metrics) : null,
      activeIssues: state.activeIssues,
      notificationStatus: {
        configured: typeof notify === 'function',
        pending: notifications.filter((item) => item.status === 'pending').length,
        failed: notifications.filter((item) => item.status === 'failed').length,
        lastNotificationAt: state.lastNotificationAt,
      },
      nextSampleAt:
        state.lastAttemptAt === null ? null : iso(state.lastAttemptAt + PROVIDER_INTERVAL_MS),
    };
  }

  async function runSample(env) {
    const at = Number(now());
    if (!Number.isFinite(at) || at < 0) throw Error('Monitor clock is invalid.');
    const day = dateKey(at);
    let state = await load();
    if (state.lastAttemptAt !== null && at - state.lastAttemptAt < PROVIDER_INTERVAL_MS)
      return {
        ok: false,
        rateLimited: true,
        retryAt: iso(state.lastAttemptAt + PROVIDER_INTERVAL_MS),
        status: await status(),
      };
    state.lastAttemptAt = at;
    await persist(state);

    try {
      const metrics = await fetchResourceAnalytics({
        token: env?.CF_ANALYTICS_TOKEN,
        accountId: env?.CF_ACCOUNT_ID,
        scriptName: env?.APP_SCRIPT_NAME,
        now: at,
        fetchImpl,
      });
      const issues = evaluateResourceIssues(metrics, state.activeIssues);
      const events = nextDayIssues(state, issues, day, at);
      if (state.outageAlerted)
        events.push({
          fingerprint: `recovery:monitor.analyticsUnavailable:warning:${day}`,
          kind: 'recovery',
          issue: { key: 'monitor.analyticsUnavailable', severity: 'warning' },
        });
      state = {
        ...state,
        health: [metrics.d1, metrics.workers, metrics.r2Operations, metrics.r2Storage].every(
          (series) => series.state === 'available',
        )
          ? 'available'
          : 'degraded',
        failureCount: 0,
        outageAlerted: false,
        lastSuccessAt: iso(at),
        lastFailureCode: null,
        metricsUpdatedAt: iso(at),
        metrics,
        activeIssues: issues,
      };
      addPendingEvents(state, events, day, at);
      await persist(state);
      await dispatchNotifications(state, at);
      return { ok: true, rateLimited: false, status: await status() };
    } catch (error) {
      state.failureCount = Math.min(1000, state.failureCount + 1);
      state.health = 'unavailable';
      state.lastFailureCode = safeErrorCodes.has(error?.code)
        ? error.code
        : 'ANALYTICS_UNAVAILABLE';
      const events = [];
      if (state.failureCount >= 2 && !state.outageAlerted) {
        state.outageAlerted = true;
        events.push({
          fingerprint: `alert:monitor.analyticsUnavailable:warning:${day}`,
          kind: 'alert',
          issue: {
            key: 'monitor.analyticsUnavailable',
            severity: 'warning',
            note: 'Analytics sampling has failed twice; monitored values are unavailable.',
          },
        });
      }
      addPendingEvents(state, events, day, at);
      await persist(state);
      await dispatchNotifications(state, at);
      return {
        ok: false,
        rateLimited: false,
        errorCode: state.lastFailureCode,
        status: await status(),
      };
    }
  }

  function sample(env) {
    if (inFlight) return inFlight;
    inFlight = runSample(env).finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  async function handle(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/status' && request.method === 'GET')
      return Response.json(await status(), { headers: { 'Cache-Control': 'no-store' } });
    if (url.pathname === '/sample' && request.method === 'POST') {
      const result = await sample(env);
      return Response.json(result, {
        status: result.rateLimited ? 429 : result.ok ? 200 : 503,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    return new Response(null, {
      status: request.method === 'GET' || request.method === 'POST' ? 404 : 405,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  return Object.freeze({ sample, status, handle });
}
