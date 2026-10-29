export const ANALYTICS_URL = 'https://api.cloudflare.com/client/v4/graphql';
export const MAX_RESPONSE_BYTES = 262_144;
export const APPROVED_SCRIPT_NAME = 'pages-worker--21988261-production';

const DAY_MS = 86_400_000;
const validAccountId = (value) => typeof value === 'string' && /^[a-f0-9]{32}$/i.test(value);
const validScriptName = (value) => value === APPROVED_SCRIPT_NAME;
const date = (ms) => new Date(ms).toISOString().slice(0, 10);
const iso = (ms) => new Date(ms).toISOString();
const gql = (value) => JSON.stringify(value);

export function resourceAnalyticsQuery({ accountId, scriptName, now = Date.now() }) {
  if (!validAccountId(accountId) || !validScriptName(scriptName) || !Number.isFinite(now))
    throw Object.assign(Error('Monitor configuration is invalid.'), {
      code: 'MONITOR_CONFIG_INVALID',
    });
  const today = date(now),
    monthStart = `${today.slice(0, 7)}-01T00:00:00.000Z`;
  const dayStart = `${today}T00:00:00.000Z`,
    end = iso(now),
    recent = iso(now - DAY_MS);
  const account = gql(accountId);
  return `query ResourceMonitor {
    viewer { accounts(filter:{accountTag:${account}}) {
      d1:d1AnalyticsAdaptiveGroups(limit:1000,filter:{date_geq:${gql(today)},date_leq:${gql(today)}}) {
        sum { rowsRead rowsWritten readQueries writeQueries }
        dimensions { databaseId date }
      }
      pages:pagesFunctionsInvocationsAdaptiveGroups(limit:100,filter:{scriptName:${gql(scriptName)},datetime_geq:${gql(dayStart)},datetime_leq:${gql(end)}}) {
        sum { requests errors }
        quantiles { cpuTimeP50 cpuTimeP99 }
        dimensions { scriptName status }
      }
      r2Ops:r2OperationsAdaptiveGroups(limit:100,filter:{datetime_geq:${gql(monthStart)},datetime_leq:${gql(end)}}) {
        sum { requests }
        dimensions { actionType }
      }
      r2Storage:r2StorageAdaptiveGroups(limit:30,filter:{datetime_geq:${gql(recent)},datetime_leq:${gql(end)}}) {
        max { objectCount payloadSize metadataSize }
        dimensions { bucketName }
      }
    } }
  }`;
}

function metric(value, max = Number.MAX_SAFE_INTEGER) {
  return Number.isSafeInteger(value) && value >= 0 && value <= max ? value : null;
}
function bounded(value, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max
    ? value
    : null;
}
function safeAdd(left, right) {
  const sum = left + right;
  return Number.isSafeInteger(sum) ? sum : null;
}
function unknown(reason) {
  return { state: 'unknown', reason };
}
function groups(account, name) {
  const value = account?.[name];
  return Array.isArray(value) ? value : null;
}
function accountFrom(payload) {
  const accounts = payload?.data?.viewer?.accounts;
  return Array.isArray(accounts) && accounts.length === 1 ? accounts[0] : null;
}

export function normalizeResourceAnalytics(payload, { scriptName, now = Date.now() }) {
  const account = accountFrom(payload);
  if (!account)
    return {
      d1: unknown('account-unavailable'),
      workers: unknown('account-unavailable'),
      r2Operations: unknown('account-unavailable'),
      r2Storage: unknown('account-unavailable'),
    };
  const day = date(now);
  const d1Rows = groups(account, 'd1');
  let d1 = unknown('empty-series');
  if (d1Rows?.length) {
    if (d1Rows.length >= 1000) d1 = unknown('bounded-result-reached');
    else {
      let rowsRead = 0,
        rowsWritten = 0,
        readQueries = 0,
        writeQueries = 0,
        readQueriesKnown = true,
        writeQueriesKnown = true,
        valid = true;
      for (const row of d1Rows) {
        if (
          row?.dimensions?.date !== day ||
          typeof row.dimensions.databaseId !== 'string' ||
          !row.dimensions.databaseId
        ) {
          valid = false;
          break;
        }
        const read = metric(row.sum?.rowsRead),
          written = metric(row.sum?.rowsWritten);
        if (read === null || written === null) {
          valid = false;
          break;
        }
        rowsRead = safeAdd(rowsRead, read);
        rowsWritten = safeAdd(rowsWritten, written);
        if (rowsRead === null || rowsWritten === null) {
          valid = false;
          break;
        }
        const readCount = metric(row.sum?.readQueries),
          writeCount = metric(row.sum?.writeQueries);
        if (readCount !== null) readQueries = safeAdd(readQueries, readCount);
        else readQueriesKnown = false;
        if (writeCount !== null) writeQueries = safeAdd(writeQueries, writeCount);
        else writeQueriesKnown = false;
        if (
          (readQueriesKnown && readQueries === null) ||
          (writeQueriesKnown && writeQueries === null)
        ) {
          valid = false;
          break;
        }
      }
      d1 = valid
        ? {
            state: 'available',
            day,
            rowsRead,
            rowsWritten,
            readQueries: readQueriesKnown ? readQueries : null,
            writeQueries: writeQueriesKnown ? writeQueries : null,
            databases: d1Rows.length,
          }
        : unknown('invalid-or-mixed-series');
    }
  } else if (d1Rows === null) d1 = unknown('dataset-unavailable');

  const pagesRows = groups(account, 'pages');
  let workers = unknown('empty-series');
  if (pagesRows?.length) {
    if (pagesRows.length >= 100) workers = unknown('bounded-result-reached');
    else {
      let requests = 0,
        errors = 0,
        valid = true;
      const statuses = {},
        cpuTimeByStatus = {};
      for (const row of pagesRows) {
        const statusName = row?.dimensions?.status;
        if (
          row?.dimensions?.scriptName !== scriptName ||
          typeof statusName !== 'string' ||
          !statusName
        ) {
          valid = false;
          break;
        }
        const status = [
          'success',
          'exceededResources',
          'internalError',
          'scriptThrewException',
          'cpuLimit',
          'subrequestLimit',
        ].includes(statusName)
          ? statusName
          : 'other';
        const requestCount = metric(row.sum?.requests),
          errorCount = metric(row.sum?.errors);
        if (requestCount === null || errorCount === null) {
          valid = false;
          break;
        }
        requests = safeAdd(requests, requestCount);
        errors = safeAdd(errors, errorCount);
        statuses[status] ||= { requests: 0, errors: 0 };
        statuses[status].requests = safeAdd(statuses[status].requests, requestCount);
        statuses[status].errors = safeAdd(statuses[status].errors, errorCount);
        if (
          requests === null ||
          errors === null ||
          statuses[status].requests === null ||
          statuses[status].errors === null
        ) {
          valid = false;
          break;
        }
        cpuTimeByStatus[status] = {
          p50Us: bounded(row.quantiles?.cpuTimeP50, 60_000_000),
          p99Us: bounded(row.quantiles?.cpuTimeP99, 60_000_000),
        };
      }
      workers = valid
        ? { state: 'available', day, requests, errors, statuses, cpuTimeByStatus }
        : unknown('invalid-or-mixed-series');
    }
  } else if (pagesRows === null) workers = unknown('dataset-unavailable');

  const opRows = groups(account, 'r2Ops');
  let r2Operations = unknown('empty-series');
  if (opRows?.length) {
    if (opRows.length >= 100) r2Operations = unknown('bounded-result-reached');
    else {
      let requests = 0,
        valid = true;
      const actionTypes = {};
      for (const row of opRows) {
        const count = metric(row.sum?.requests),
          action = row?.dimensions?.actionType;
        if (count === null || typeof action !== 'string' || !action) {
          valid = false;
          break;
        }
        requests = safeAdd(requests, count);
        if (requests === null) {
          valid = false;
          break;
        }
        const safeAction = /^[a-z][a-z0-9_]{0,63}$/i.test(action) ? action : 'other';
        actionTypes[safeAction] = safeAdd(actionTypes[safeAction] || 0, count);
        if (actionTypes[safeAction] === null) {
          valid = false;
          break;
        }
      }
      r2Operations = valid
        ? {
            state: 'available',
            month: day.slice(0, 7),
            requests,
            actionTypes,
            classification: 'unclassified-class-A-upper-bound',
          }
        : unknown('invalid-series');
    }
  } else if (opRows === null) r2Operations = unknown('dataset-unavailable');

  const storageRows = groups(account, 'r2Storage');
  const recent = iso(now - DAY_MS),
    end = iso(now);
  let r2Storage = unknown('empty-series');
  if (storageRows?.length) {
    if (storageRows.length >= 30) r2Storage = unknown('bounded-result-reached');
    else {
      const byBucket = new Map();
      let valid = true;
      for (const row of storageRows) {
        const bucket = row?.dimensions?.bucketName;
        const objectCount = metric(row.max?.objectCount),
          payloadSize = metric(row.max?.payloadSize),
          metadataSize = metric(row.max?.metadataSize);
        if (
          typeof bucket !== 'string' ||
          !bucket ||
          objectCount === null ||
          payloadSize === null ||
          metadataSize === null
        ) {
          valid = false;
          break;
        }
        byBucket.set(bucket, { objectCount, payloadSize, metadataSize });
      }
      if (!valid) r2Storage = unknown('invalid-series');
      else {
        const latest = [...byBucket.values()];
        const sumField = (field) => {
          let sum = 0;
          for (const row of latest) {
            sum = safeAdd(sum, row[field]);
            if (sum === null) break;
          }
          return sum;
        };
        const objectCount = sumField('objectCount');
        const payloadSize = sumField('payloadSize');
        const metadataSize = sumField('metadataSize');
        r2Storage =
          latest.length && objectCount !== null && payloadSize !== null && metadataSize !== null
            ? {
                state: 'available',
                buckets: latest.length,
                windowStart: recent,
                windowEnd: end,
                boundProjection: 'per-bucket-maximum-over-24h',
                objectCount,
                payloadSize,
                metadataSize,
              }
            : unknown(latest.length ? 'invalid-series' : 'empty-series');
      }
    }
  } else if (storageRows === null) r2Storage = unknown('dataset-unavailable');

  return { d1, workers, r2Operations, r2Storage };
}

async function fetchResponseText(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    if (!response?.ok) throw Error('HTTP');
    const contentLength = Number(response.headers?.get?.('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) throw Error('SIZE');
    if (response.body?.getReader) {
      const reader = response.body.getReader();
      const chunks = [];
      let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throw Error('SIZE');
        }
        chunks.push(value);
      }
      const joined = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        joined.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return new TextDecoder().decode(joined);
    }
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) throw Error('SIZE');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchResourceAnalytics({
  token,
  accountId,
  scriptName,
  now = Date.now(),
  fetchImpl = fetch,
  timeoutMs = 10_000,
}) {
  if (typeof token !== 'string' || !token || token.length > 4096)
    throw Object.assign(Error('Monitor credentials are unavailable.'), {
      code: 'MONITOR_CONFIG_INVALID',
    });
  const query = resourceAnalyticsQuery({ accountId, scriptName, now });
  let text;
  try {
    text = await fetchResponseText(
      fetchImpl,
      ANALYTICS_URL,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query }),
      },
      timeoutMs,
    );
  } catch {
    throw Object.assign(Error('Analytics provider request failed.'), {
      code: 'ANALYTICS_UNAVAILABLE',
    });
  }
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw Object.assign(Error('Analytics provider response was invalid.'), {
      code: 'ANALYTICS_RESPONSE_INVALID',
    });
  }
  if (!payload || (Array.isArray(payload.errors) && payload.errors.length) || !payload.data)
    throw Object.assign(Error('Analytics provider query failed.'), {
      code: 'ANALYTICS_QUERY_FAILED',
    });
  return normalizeResourceAnalytics(payload, { accountId, scriptName, now });
}
