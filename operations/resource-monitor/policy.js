export const RESOURCE_LIMITS = Object.freeze({
  d1RowsReadDaily: 5_000_000,
  d1RowsWrittenDaily: 100_000,
  workerRequestsDaily: 100_000,
  r2ClassAMonthly: 1_000_000,
  r2ClassBMonthly: 10_000_000,
  r2StandardStorageBytes: 10_000_000_000,
});
export const WARNING_PERCENT = 80;
export const CRITICAL_PERCENT = 95;
export const PROVIDER_INTERVAL_MS = 15 * 60_000;
export const MAX_NOTIFICATION_ATTEMPTS = 3;
export const ALERT_STATE_KEY = 'resource-monitor-state-v1';

function quotaIssue(key, value, limit, unit, extra = {}) {
  if (!Number.isSafeInteger(value) || value < 0 || !Number.isSafeInteger(limit) || limit <= 0)
    return null;
  const percentage = (value / limit) * 100;
  if (percentage < WARNING_PERCENT) return null;
  return {
    key,
    severity: percentage >= CRITICAL_PERCENT ? 'critical' : 'warning',
    value,
    limit,
    percentage: Math.round(percentage * 10) / 10,
    unit,
    ...extra,
  };
}

export function evaluateResourceIssues(metrics, previousIssues = []) {
  const issues = [];
  const preserve = (series, prefix) => {
    if (series?.state !== 'available')
      for (const issue of previousIssues) if (issue.key.startsWith(prefix)) issues.push(issue);
  };
  if (metrics?.d1?.state === 'available') {
    for (const issue of [
      quotaIssue('d1.rowsRead', metrics.d1.rowsRead, RESOURCE_LIMITS.d1RowsReadDaily, 'rows/day'),
      quotaIssue(
        'd1.rowsWritten',
        metrics.d1.rowsWritten,
        RESOURCE_LIMITS.d1RowsWrittenDaily,
        'rows/day',
      ),
    ])
      if (issue) issues.push(issue);
  } else preserve(metrics?.d1, 'd1.');

  if (metrics?.workers?.state === 'available') {
    const issue = quotaIssue(
      'workers.requests',
      metrics.workers.requests,
      RESOURCE_LIMITS.workerRequestsDaily,
      'requests/day',
    );
    if (issue) issues.push(issue);
    const statuses = metrics.workers.statuses || {};
    const countStatus = (name) => {
      const row = statuses[name];
      if (
        !row ||
        !Number.isSafeInteger(row.requests) ||
        row.requests < 0 ||
        !Number.isSafeInteger(row.errors) ||
        row.errors < 0
      )
        return 0;
      return Math.max(row.requests, row.errors);
    };
    const exceeded = countStatus('exceededResources');
    if (exceeded > 0) {
      issues.push({
        key: 'workers.exceededResources',
        severity: 'urgent',
        value: exceeded,
        unit: 'requests-or-errors',
        note: 'Resource exhaustion is suspected; Analytics status does not identify the exact quota or cause.',
      });
    }
    const limited = countStatus('cpuLimit') + countStatus('subrequestLimit');
    if (limited > 0)
      issues.push({
        key: 'workers.resourceLimits',
        severity: 'urgent',
        value: limited,
        unit: 'requests-or-errors',
        note: 'Pages reports a CPU or subrequest limit status.',
      });
    const genericErrors = Object.entries(statuses).reduce((total, [name, row]) => {
      if (['success', 'exceededResources', 'cpuLimit', 'subrequestLimit'].includes(name))
        return total;
      const errors = Number.isSafeInteger(row?.errors) && row.errors >= 0 ? row.errors : 0;
      const sum = total + errors;
      return Number.isSafeInteger(sum) ? sum : total;
    }, 0);
    if (genericErrors > 0)
      issues.push({
        key: 'workers.runtimeErrors',
        severity: 'warning',
        value: genericErrors,
        unit: 'errors/day',
        note: 'Pages reports runtime errors; status totals are generic and do not identify a single cause.',
      });
  } else preserve(metrics?.workers, 'workers.');

  if (metrics?.r2Operations?.state === 'available') {
    const issue = quotaIssue(
      'r2.monthlyOperations',
      metrics.r2Operations.requests,
      RESOURCE_LIMITS.r2ClassAMonthly,
      'operations/month',
      {
        conservativeUpperBound: true,
        note: 'Unclassified R2 operations are compared with the smaller Class A allowance.',
      },
    );
    if (issue) issues.push(issue);
  } else preserve(metrics?.r2Operations, 'r2.');

  if (metrics?.r2Storage?.state === 'available') {
    const issue = quotaIssue(
      'r2.storageCapacityProjection',
      metrics.r2Storage.payloadSize,
      RESOURCE_LIMITS.r2StandardStorageBytes,
      'bytes/capacity-indicator',
      {
        boundProjection: true,
        note: 'Conservative per-bucket 24-hour maximum; capacity indicator only, not billed GB-month usage.',
      },
    );
    if (issue) issues.push(issue);
  } else preserve(metrics?.r2Storage, 'r2.storage');

  return issues.sort((a, b) => a.key.localeCompare(b.key) || a.severity.localeCompare(b.severity));
}

export function transitionEvents(previousIssues, nextIssues, day) {
  const before = new Map(previousIssues.map((issue) => [issue.key, issue]));
  const after = new Map(nextIssues.map((issue) => [issue.key, issue]));
  const events = [];
  for (const [key, issue] of after)
    if (before.get(key)?.severity !== issue.severity)
      events.push({
        fingerprint: `alert:${issue.key}:${issue.severity}:${day}`,
        kind: 'alert',
        issue,
      });
  for (const [key, issue] of before)
    if (!after.has(key))
      events.push({
        fingerprint: `recovery:${issue.key}:${issue.severity}:${day}`,
        kind: 'recovery',
        issue: { key: issue.key, severity: issue.severity },
      });
  return events;
}

export function quotaShares(metrics) {
  const share = (value, limit) =>
    Number.isSafeInteger(value) && value >= 0 ? Math.round((value / limit) * 1000) / 10 : null;
  return {
    d1RowsReadPercent:
      metrics?.d1?.state === 'available'
        ? share(metrics.d1.rowsRead, RESOURCE_LIMITS.d1RowsReadDaily)
        : null,
    d1RowsWrittenPercent:
      metrics?.d1?.state === 'available'
        ? share(metrics.d1.rowsWritten, RESOURCE_LIMITS.d1RowsWrittenDaily)
        : null,
    workerRequestsPercent:
      metrics?.workers?.state === 'available'
        ? share(metrics.workers.requests, RESOURCE_LIMITS.workerRequestsDaily)
        : null,
    r2ClassAUpperBoundPercent:
      metrics?.r2Operations?.state === 'available'
        ? share(metrics.r2Operations.requests, RESOURCE_LIMITS.r2ClassAMonthly)
        : null,
    r2ClassBUpperBoundPercent:
      metrics?.r2Operations?.state === 'available'
        ? share(metrics.r2Operations.requests, RESOURCE_LIMITS.r2ClassBMonthly)
        : null,
    r2StorageCapacityProjectionPercent:
      metrics?.r2Storage?.state === 'available'
        ? share(metrics.r2Storage.payloadSize, RESOURCE_LIMITS.r2StandardStorageBytes)
        : null,
  };
}
