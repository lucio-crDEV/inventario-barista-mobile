import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALERT_STATE_KEY,
  PROVIDER_INTERVAL_MS,
  MAX_NOTIFICATION_ATTEMPTS,
  evaluateResourceIssues,
  quotaShares,
  transitionEvents,
} from '../operations/resource-monitor/policy.js';
import {
  fetchResourceAnalytics,
  normalizeResourceAnalytics,
  resourceAnalyticsQuery,
} from '../operations/resource-monitor/entry.js';
import { createResourceMonitorAPI } from '../operations/resource-monitor/index.js';

const accountId = 'a'.repeat(32);
const scriptName = 'pages-worker--21988261-production';
const start = Date.parse('2026-10-28T12:00:00.000Z');
const env = {
  CF_ANALYTICS_TOKEN: 'private-token-test',
  CF_ACCOUNT_ID: accountId,
  APP_SCRIPT_NAME: scriptName,
};
const date = (ms) => new Date(ms).toISOString().slice(0, 10);

function payload(
  now,
  {
    rowsRead = 10,
    rowsWritten = 10,
    requests = 10,
    errors = 0,
    statuses = ['success'],
    r2 = 10,
    r2StorageBytes = 400,
    empty = false,
  } = {},
) {
  const account = {
    d1: empty
      ? []
      : [
          {
            dimensions: { databaseId: 'private-db-id', date: date(now) },
            sum: { rowsRead, rowsWritten, readQueries: 2, writeQueries: 1 },
          },
        ],
    pages: empty
      ? []
      : statuses.map((status) => ({
          dimensions: { scriptName, status },
          sum: { requests, errors },
          quantiles: { cpuTimeP50: 500, cpuTimeP99: 1200 },
        })),
    r2Ops: empty ? [] : [{ dimensions: { actionType: 'GetObject' }, sum: { requests: r2 } }],
    r2Storage: empty
      ? []
      : [
          {
            dimensions: { bucketName: 'private-bucket' },
            max: { objectCount: 3, payloadSize: r2StorageBytes, metadataSize: 50 },
          },
        ],
  };
  return { data: { viewer: { accounts: [account] } } };
}

class MemoryStorage {
  values = new Map();
  async get(key) {
    return structuredClone(this.values.get(key));
  }
  async put(key, value) {
    this.values.set(key, structuredClone(value));
  }
}

test('policy uses approved limits, warning/critical thresholds, urgent exhausted status, and conservative R2 upper bound', () => {
  const metrics = {
    d1: { state: 'available', rowsRead: 4_000_000, rowsWritten: 95_000 },
    workers: {
      state: 'available',
      requests: 100_000,
      statuses: { exceededResources: { requests: 1, errors: 0 } },
    },
    r2Operations: { state: 'available', requests: 1_000_000 },
  };
  const issues = evaluateResourceIssues(metrics);
  assert.deepEqual(
    issues.map(({ key, severity }) => [key, severity]),
    [
      ['d1.rowsRead', 'warning'],
      ['d1.rowsWritten', 'critical'],
      ['r2.monthlyOperations', 'critical'],
      ['workers.exceededResources', 'urgent'],
      ['workers.requests', 'critical'],
    ],
  );
  assert.equal(
    issues.find((issue) => issue.key === 'r2.monthlyOperations').conservativeUpperBound,
    true,
  );
  assert.equal(quotaShares(metrics).r2ClassBUpperBoundPercent, 10);
});

test('R2 storage snapshot warns at 8 GB and becomes critical at 9.5 GB without claiming billed GB-month', () => {
  const atWarning = evaluateResourceIssues({
    r2Storage: { state: 'available', payloadSize: 8_000_000_000 },
  });
  assert.equal(atWarning[0].severity, 'warning');
  assert.equal(atWarning[0].boundProjection, true);
  assert.match(atWarning[0].note, /not billed GB-month/i);
  const atCritical = evaluateResourceIssues({
    r2Storage: { state: 'available', payloadSize: 9_500_000_000 },
  });
  assert.equal(atCritical[0].severity, 'critical');
});

test('R2 24-hour per-bucket maxima normalize to a labeled capacity projection', () => {
  const metrics = normalizeResourceAnalytics(payload(start, { r2StorageBytes: 8_000_000_000 }), {
    scriptName,
    now: start,
  });
  assert.equal(metrics.r2Storage.state, 'available');
  assert.equal(metrics.r2Storage.boundProjection, 'per-bucket-maximum-over-24h');
  assert.equal(metrics.r2Storage.payloadSize, 8_000_000_000);
  assert.equal(
    evaluateResourceIssues(metrics).find((issue) => issue.key === 'r2.storageCapacityProjection')
      .severity,
    'warning',
  );
});

test('Pages runtime errors are retained as one generic daily warning', () => {
  const issues = evaluateResourceIssues({
    workers: {
      state: 'available',
      requests: 10,
      errors: 2,
      statuses: { internalError: { requests: 2, errors: 2 } },
    },
  });
  assert.deepEqual(
    issues.map(({ key, severity, value }) => [key, severity, value]),
    [['workers.runtimeErrors', 'warning', 2]],
  );
  assert.match(issues[0].note, /generic/i);
});

test('analytics query is one bounded GraphQL request with strict script filter and no token', async () => {
  const query = resourceAnalyticsQuery({ accountId, scriptName, now: start });
  assert.match(query, /d1AnalyticsAdaptiveGroups\(limit:1000/);
  assert.match(query, /pagesFunctionsInvocationsAdaptiveGroups\(limit:100/);
  assert.match(query, /scriptName:"pages-worker--21988261-production"/);
  assert.match(query, /r2OperationsAdaptiveGroups\(limit:100/);
  assert.match(query, /r2StorageAdaptiveGroups\(limit:30/);
  assert.match(query, /dimensions \{ bucketName \}/);
  assert.doesNotMatch(query, /dimensions \{ bucketName datetime \}/);
  assert.ok(!query.includes(env.CF_ANALYTICS_TOKEN));
  assert.throws(
    () => resourceAnalyticsQuery({ accountId, scriptName: 'another-worker', now: start }),
    /configuration/i,
  );
  let calls = 0;
  const normalized = await fetchResourceAnalytics({
    token: env.CF_ANALYTICS_TOKEN,
    accountId,
    scriptName,
    now: start,
    fetchImpl: async (url, init) => {
      calls++;
      assert.equal(url, 'https://api.cloudflare.com/client/v4/graphql');
      assert.equal(init.headers.Authorization, `Bearer ${env.CF_ANALYTICS_TOKEN}`);
      assert.match(JSON.parse(init.body).query, /pagesFunctionsInvocationsAdaptiveGroups/);
      return new Response(JSON.stringify(payload(start)), { status: 200 });
    },
  });
  assert.equal(calls, 1);
  assert.equal(normalized.d1.rowsRead, 10);
  assert.equal(normalized.workers.requests, 10);
  assert.equal(normalized.r2Operations.requests, 10);
  assert.equal(normalized.r2Storage.payloadSize, 400);
  assert.equal(normalized.r2Storage.boundProjection, 'per-bucket-maximum-over-24h');
  assert.equal(normalized.workers.cpuTimeByStatus.success.p99Us, 1200);
});

test('empty, mixed, malformed, and out-of-range metrics remain unknown instead of becoming zero', () => {
  const empty = normalizeResourceAnalytics(payload(start, { empty: true }), {
    accountId,
    scriptName,
    now: start,
  });
  assert.equal(empty.d1.state, 'unknown');
  assert.equal(empty.d1.rowsRead, undefined);
  assert.deepEqual(evaluateResourceIssues(empty), []);
  const mismatchedScript = payload(start);
  mismatchedScript.data.viewer.accounts[0].pages[0].dimensions.scriptName = 'another-worker';
  assert.equal(
    normalizeResourceAnalytics(mismatchedScript, { scriptName, now: start }).workers.state,
    'unknown',
  );
  const unsafeMetric = payload(start, { rowsRead: Number.MAX_SAFE_INTEGER + 1 });
  assert.equal(
    normalizeResourceAnalytics(unsafeMetric, { scriptName, now: start }).d1.state,
    'unknown',
  );
  const wrongDay = payload(start);
  wrongDay.data.viewer.accounts[0].d1[0].dimensions.date = '2026-10-27';
  assert.equal(
    normalizeResourceAnalytics(wrongDay, { scriptName, now: start }).d1.state,
    'unknown',
  );
});

test('sample serializes concurrent calls, rate-limits the provider, dedupes daily alerts, and sends one recovery', async () => {
  const storage = new MemoryStorage();
  const notifications = [];
  let now = start,
    rowsRead = 4_000_000,
    fetchCalls = 0;
  const monitor = createResourceMonitorAPI({
    storage,
    now: () => now,
    notify: async (message) => {
      notifications.push(message);
    },
    fetchImpl: async () => {
      fetchCalls++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response(JSON.stringify(payload(now, { rowsRead })));
    },
  });
  const [first, concurrent] = await Promise.all([monitor.sample(env), monitor.sample(env)]);
  assert.equal(first.ok, true);
  assert.equal(concurrent.ok, true);
  assert.equal(fetchCalls, 1);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].events[0].key, 'd1.rowsRead');
  assert.equal((await monitor.sample(env)).rateLimited, true);

  now += PROVIDER_INTERVAL_MS;
  await monitor.sample(env);
  assert.equal(notifications.length, 1);
  now = Date.parse('2026-10-29T12:00:00.000Z');
  await monitor.sample(env);
  assert.equal(notifications.length, 2);
  assert.equal(notifications[1].events[0].fingerprint, 'alert:d1.rowsRead:warning:2026-10-29');

  rowsRead = 1_000_000;
  now += PROVIDER_INTERVAL_MS;
  await monitor.sample(env);
  assert.equal(notifications.length, 3);
  assert.equal(notifications[2].events[0].kind, 'recovery');
  now += PROVIDER_INTERVAL_MS;
  await monitor.sample(env);
  assert.equal(notifications.length, 3);

  const serialized = JSON.stringify([...storage.values.values()]);
  for (const secret of [
    env.CF_ANALYTICS_TOKEN,
    accountId,
    scriptName,
    'private-db-id',
    'private-bucket',
  ])
    assert.ok(!serialized.includes(secret));
  assert.ok(!serialized.includes('query ResourceMonitor'));
});

test('monitor outage alerts only after two failures and recovers once', async () => {
  const storage = new MemoryStorage();
  const notifications = [];
  let now = start,
    failed = true;
  const monitor = createResourceMonitorAPI({
    storage,
    now: () => now,
    notify: async (message) => notifications.push(message),
    fetchImpl: async () => {
      if (failed) throw Error('private provider detail');
      return new Response(JSON.stringify(payload(now, { empty: true })));
    },
  });
  assert.equal((await monitor.sample(env)).ok, false);
  assert.equal(notifications.length, 0);
  now += PROVIDER_INTERVAL_MS;
  assert.equal((await monitor.sample(env)).status.failureCount, 2);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].events[0].key, 'monitor.analyticsUnavailable');
  now += PROVIDER_INTERVAL_MS;
  await monitor.sample(env);
  assert.equal(notifications.length, 1);
  failed = false;
  now += PROVIDER_INTERVAL_MS;
  const recovered = await monitor.sample(env);
  assert.equal(recovered.status.health, 'degraded');
  assert.equal(notifications.length, 2);
  assert.equal(notifications[1].events[0].kind, 'recovery');
  assert.equal((await monitor.status()).metrics.d1.state, 'unknown');
});

test('failed notification retries at most three times, then stops', async () => {
  const storage = new MemoryStorage();
  let now = start,
    sends = 0;
  const monitor = createResourceMonitorAPI({
    storage,
    now: () => now,
    notify: async () => {
      sends++;
      throw Error('mail failure');
    },
    fetchImpl: async () => new Response(JSON.stringify(payload(now, { rowsRead: 4_000_000 }))),
  });
  for (let attempt = 0; attempt < MAX_NOTIFICATION_ATTEMPTS + 1; attempt++) {
    await monitor.sample(env);
    now += PROVIDER_INTERVAL_MS;
  }
  assert.equal(sends, MAX_NOTIFICATION_ATTEMPTS);
  const ledger = storage.values.get(ALERT_STATE_KEY).notificationLedger;
  assert.equal(Object.values(ledger)[0].status, 'failed');
});

test('quota severity changes do not announce recovery while that resource is still above its limit', () => {
  const issues = (rowsRead) =>
    evaluateResourceIssues({ d1: { state: 'available', rowsRead, rowsWritten: 0 } });
  const warning = issues(4_000_000),
    critical = issues(4_900_000);
  const escalated = transitionEvents(warning, critical, date(start));
  assert.ok(
    escalated.some((event) => event.kind === 'alert' && event.issue.severity === 'critical'),
  );
  assert.ok(!escalated.some((event) => event.kind === 'recovery'));
  assert.ok(
    !transitionEvents(critical, warning, date(start)).some((event) => event.kind === 'recovery'),
  );
  const recovered = transitionEvents(critical, issues(1_000_000), date(start));
  assert.equal(
    recovered.filter((event) => event.kind === 'recovery' && event.issue.key === 'd1.rowsRead')
      .length,
    1,
  );
});

test('every recognized resource-exhaustion status is urgent without counting errors twice', () => {
  for (const status of ['exceededResources', 'cpuLimit', 'subrequestLimit']) {
    const metrics = normalizeResourceAnalytics(
      payload(start, { requests: 2, errors: 2, statuses: [status] }),
      { scriptName, now: start },
    );
    const urgent = evaluateResourceIssues(metrics).filter((issue) => issue.severity === 'urgent');
    assert.equal(urgent.length, 1, status);
    assert.equal(urgent[0].value, 2, `${status}: two failed requests are two invocations`);
  }
});

test('an unsent Analytics-outage alert keeps its bounded retries across UTC midnight', async () => {
  const storage = new MemoryStorage(),
    notifications = [];
  let now = Date.parse('2026-10-28T23:25:00.000Z');
  const monitor = createResourceMonitorAPI({
    storage,
    now: () => now,
    fetchImpl: async () => {
      throw Error('provider unavailable');
    },
    notify: async (message) => {
      notifications.push(message);
      return notifications.length === MAX_NOTIFICATION_ATTEMPTS;
    },
  });
  for (let sample = 0; sample < MAX_NOTIFICATION_ATTEMPTS + 1; sample++) {
    await monitor.sample(env);
    now += PROVIDER_INTERVAL_MS;
  }
  assert.equal(notifications.length, MAX_NOTIFICATION_ATTEMPTS);
  assert.ok(
    notifications.every((message) =>
      message.events.some(
        (event) => event.kind === 'alert' && event.key === 'monitor.analyticsUnavailable',
      ),
    ),
  );
  const status = await monitor.status();
  assert.equal(status.failureCount, 4);
  assert.equal(status.notificationStatus.lastNotificationAt, '2026-10-29T00:10:00.000Z');
  assert.equal(status.notificationStatus.pending, 0);
  assert.equal(status.notificationStatus.failed, 0);
  now += PROVIDER_INTERVAL_MS;
  await monitor.sample(env);
  assert.equal(notifications.length, MAX_NOTIFICATION_ATTEMPTS, 'sent outage remains deduplicated');
});
