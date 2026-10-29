import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

const root = resolve('.');
const state = resolve(root, '.wrangler/free-capacity-profile-state');
const fixtureSql = resolve(root, '.wrangler/free-capacity-profile.bootstrap.sql');
const origin = 'http://127.0.0.1:8793';
const cycleId = 'prueba-compartida';
const reportPath = resolve(root, 'docs/free-capacity-profile-2026-10-28.json');
const wrangler = resolve(root, 'node_modules/wrangler/bin/wrangler.js');
const areas = [
  { id: 'cocina', users: 6 },
  { id: 'panaderia', users: 6 },
  { id: 'pasteleria', users: 6 },
  { id: 'principal', users: 6 },
  { id: 'servicio', users: 6 },
];
const samples = new Map();
const statuses = {};
let metadata = {
  responses: 0,
  missingHeaders: 0,
  missingStatementMetadata: 0,
  nonzeroResponses: 0,
  rowsRead: 0,
  rowsWritten: 0,
  statements: 0,
  calls: 0,
};
const metadataByLabel = {};
let server;
let db;
let fixtureSqlExists = false;
let profileStarted;

function wranglerRun(args, options = {}) {
  return execFileSync(process.execPath, [wrangler, ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 180_000,
    ...options,
  });
}

function databaseFile() {
  const directory = join(state, 'v3/d1/miniflare-D1DatabaseObject');
  const file = readdirSync(directory).find(
    (name) => name.endsWith('.sqlite') && name !== 'metadata.sqlite',
  );
  assert.ok(file, 'Isolated local D1 database was not created.');
  return join(directory, file);
}

function parseServerTiming(value) {
  if (!value) return null;
  const valueFor = (name) => {
    const match = value.match(new RegExp(`${name};desc="(\\d+)"`));
    return match ? Number(match[1]) : null;
  };
  const result = {
    rowsRead: valueFor('d1_rows_read'),
    rowsWritten: valueFor('d1_rows_written'),
    statements: valueFor('d1_statements'),
    calls: valueFor('d1_calls'),
    missing: valueFor('d1_metadata_missing'),
  };
  return Object.values(result).some((number) => number !== null) ? result : null;
}

function measure(label, response) {
  const bucket = samples.get(label) || [];
  bucket.push(response.ms);
  samples.set(label, bucket);
  statuses[label] ||= {};
  statuses[label][response.status] = (statuses[label][response.status] || 0) + 1;
  const byLabel = (metadataByLabel[label] ||= {
    responses: 0,
    missingHeaders: 0,
    missingStatementMetadata: 0,
    rowsRead: 0,
    rowsWritten: 0,
    statements: 0,
    calls: 0,
  });
  const detail = parseServerTiming(response.headers.get('server-timing'));
  if (!detail || detail.rowsRead === null || detail.rowsWritten === null) {
    metadata.missingHeaders++;
    byLabel.missingHeaders++;
  } else {
    metadata.responses++;
    byLabel.responses++;
    metadata.rowsRead += detail.rowsRead;
    metadata.rowsWritten += detail.rowsWritten;
    metadata.statements += detail.statements || 0;
    metadata.calls += detail.calls || 0;
    metadata.missingStatementMetadata += detail.missing || 0;
    byLabel.rowsRead += detail.rowsRead;
    byLabel.rowsWritten += detail.rowsWritten;
    byLabel.statements += detail.statements || 0;
    byLabel.calls += detail.calls || 0;
    byLabel.missingStatementMetadata += detail.missing || 0;
    if (detail.rowsRead || detail.rowsWritten) metadata.nonzeroResponses++;
  }
  return response;
}

async function waitReady(child, logs) {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null)
      throw Error(
        `Local Worker exited before readiness: ${Buffer.concat(logs).toString().slice(-3000)}`,
      );
    try {
      const response = await fetch(`${origin}/api/me`);
      if (response.status === 401) return;
    } catch {}
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
  throw Error(`Local Worker did not become ready: ${Buffer.concat(logs).toString().slice(-3000)}`);
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.floor((sorted.length - 1) * p)]);
}

function saveReport(report) {
  mkdirSync(resolve(root, 'docs'), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
}

async function main() {
  const started = performance.now();
  mkdirSync(resolve(root, '.wrangler'), { recursive: true });
  rmSync(state, { recursive: true, force: true });
  mkdirSync(state, { recursive: true });
  try {
    const build = execFileSync(process.execPath, ['scripts/build-pages.mjs'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    void build;
    wranglerRun([
      'd1',
      'migrations',
      'apply',
      'DB',
      '--local',
      '--env',
      'local',
      '--persist-to',
      state,
    ]);
    writeFileSync(
      fixtureSql,
      execFileSync(process.execPath, ['scripts/bootstrap.mjs', '--fixtures'], { cwd: root }),
      { mode: 0o600 },
    );
    fixtureSqlExists = true;
    wranglerRun([
      'd1',
      'execute',
      'DB',
      '--local',
      '--env',
      'local',
      '--persist-to',
      state,
      '--file',
      fixtureSql,
    ]);

    db = new DatabaseSync(databaseFile());
    db.exec('PRAGMA busy_timeout=5000');
    const passwordHash = db
      .prepare("SELECT password_hash FROM users WHERE username='admin-prueba'")
      .get()?.password_hash;
    assert.ok(passwordHash, 'Fixture administrator is missing.');
    const insertUser = db.prepare(
      "INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES(?,?,?,?,'admin',0)",
    );
    const usernames = ['admin-prueba'];
    db.exec('BEGIN');
    try {
      for (let index = 2; index <= 30; index++) {
        const username = `profile-capacity-${String(index).padStart(2, '0')}`;
        insertUser.run(randomUUID(), username, `Perfil local ${index}`, passwordHash);
        usernames.push(username);
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    // The catalog intentionally contains inactive products. Activate them in
    // this disposable D1 only so the profile can exercise all 1,268 rows.
    db.prepare(
      `INSERT INTO item_activity(area_id,item_id,active,changed_by,changed_at,inactive_since,revision)
      SELECT json_extract(data,'$.areaId'),id,1,NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NULL,1
      FROM catalog_items WHERE version='inventory-v3-2026-10-22' AND 1
      ON CONFLICT(area_id,item_id) DO UPDATE SET active=1,changed_by=NULL,changed_at=excluded.changed_at,inactive_since=NULL,revision=item_activity.revision+1`,
    ).run();
    assert.equal(
      db
        .prepare("SELECT count(*) n FROM catalog_items WHERE version='inventory-v3-2026-10-22'")
        .get().n,
      1268,
    );
    assert.equal(
      db
        .prepare(
          'SELECT count(*) n FROM item_activity WHERE active=1 AND area_id IN(SELECT id FROM scopes)',
        )
        .get().n,
      1268,
    );
    assert.equal(db.prepare('SELECT count(*) n FROM operations').get().n, 0);

    const logs = [];
    server = spawn(
      process.execPath,
      [
        wrangler,
        'dev',
        '--env',
        'local',
        '--ip',
        '127.0.0.1',
        '--port',
        '8793',
        '--inspector-port',
        '9433',
        '--persist-to',
        state,
        '--var',
        `APP_ORIGIN:${origin}`,
        '--var',
        'METRICS_ENABLED:1',
      ],
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    server.stdout.on('data', (chunk) => logs.push(chunk));
    server.stderr.on('data', (chunk) => logs.push(chunk));
    await waitReady(server, logs);

    process.env.INVENTORY_TEST_ORIGIN = origin;
    const { Client, operation } = await import('./helpers.mjs');
    const clients = usernames.map(() => new Client());
    await Promise.all(
      clients.map(async (client, index) => {
        measure('login', await client.login(usernames[index]));
      }),
    );
    profileStarted = performance.now();

    const plans = [];
    let clientOffset = 0;
    for (const area of areas) {
      const clientsForArea = clients.slice(clientOffset, clientOffset + area.users);
      clientOffset += area.users;
      const boots = await Promise.all(
        clientsForArea.map((client) => client.request(`/api/bootstrap?area=${area.id}`)),
      );
      let areaItems = null;
      boots.forEach((response) => {
        const counted = measure('bootstrap_by_area', response);
        assert.equal(counted.status, 200, JSON.stringify(counted.data));
        if (areaItems === null) areaItems = counted.data.items;
        else
          assert.deepEqual(
            counted.data.items.map((item) => `${item.id}\0${item.locationId}`),
            areaItems.map((item) => `${item.id}\0${item.locationId}`),
          );
      });
      const ownership = clientsForArea.map(() => []);
      areaItems.forEach((item, index) => ownership[index % ownership.length].push(item));
      clientsForArea.forEach((client, index) =>
        plans.push({ client, area: area.id, items: ownership[index] }),
      );
    }
    assert.equal(clientOffset, 30);
    const coverage = new Set(
      plans.flatMap((plan) => plan.items.map((item) => `${item.id}\0${item.locationId}`)),
    );
    const itemTotal = plans.reduce((sum, plan) => sum + plan.items.length, 0);
    assert.equal(itemTotal, 1268);
    assert.equal(
      coverage.size,
      1268,
      'Every item/location must belong to exactly one profile user.',
    );
    assert.ok(
      Math.max(...plans.map((plan) => plan.items.length)) <= 80,
      'Per-user request rate would exceed a safe test bound.',
    );

    const firstPass = await Promise.all(
      plans.map(async (plan) => {
        for (let i = 0; i < plan.items.length; i++) {
          const item = plan.items[i];
          const quantity = 1 + (item.order % 10) / 10;
          const command = operation(item, quantity, { expectedVersion: 0, status: 'partial' });
          const accepted = measure(
            'advance_partial',
            await plan.client.request('/api/count', command),
          );
          assert.equal(
            accepted.status,
            200,
            `partial ${plan.area}/${item.id}: ${JSON.stringify(accepted.data)}`,
          );
          if (i === 0) {
            const replay = measure(
              'idempotent_retry',
              await plan.client.request('/api/count', command),
            );
            assert.equal(replay.status, 200);
            assert.deepEqual(replay.data, accepted.data);
            const staleCommand = operation(item, quantity, {
              expectedVersion: 0,
              status: 'partial',
            });
            const stale = measure(
              'stale_retry',
              await plan.client.request('/api/count', staleCommand),
            );
            assert.equal(stale.status, 409);
            assert.equal(stale.data.code, 'STALE');
          }
        }
      }),
    );
    void firstPass;

    await Promise.all(
      plans.map(async (plan) => {
        for (const item of plan.items) {
          const command = operation(item, 1 + (item.order % 10) / 10, {
            expectedVersion: 1,
            status: 'counted',
          });
          const response = measure('final_count', await plan.client.request('/api/count', command));
          assert.equal(
            response.status,
            200,
            `count ${plan.area}/${item.id}: ${JSON.stringify(response.data)}`,
          );
        }
      }),
    );

    const maxSeq = db
      .prepare('SELECT coalesce(max(seq),0) n FROM history WHERE cycle_id=?')
      .get(cycleId).n;
    const emptySyncs = await Promise.all(
      clients.map(async (client) => {
        const response = measure(
          'empty_incremental_sync',
          await client.request(`/api/sync?cycle=${cycleId}&cursor=${maxSeq}`),
        );
        assert.equal(response.status, 200);
        assert.equal(response.data.changes.length, 0);
        return response;
      }),
    );
    assert.equal(emptySyncs.length, 30);

    const final = {
      operations: db.prepare('SELECT count(*) n FROM operations WHERE cycle_id=?').get(cycleId).n,
      history: db.prepare('SELECT count(*) n FROM history WHERE cycle_id=?').get(cycleId).n,
      items: db.prepare('SELECT count(*) n FROM counts WHERE cycle_id=?').get(cycleId).n,
      counted: db
        .prepare(
          "SELECT count(*) n FROM counts WHERE cycle_id=? AND status='counted' AND version=2",
        )
        .get(cycleId).n,
      partial: db
        .prepare("SELECT count(*) n FROM counts WHERE cycle_id=? AND status='partial'")
        .get(cycleId).n,
    };
    assert.deepEqual(final, {
      operations: 2536,
      history: 2536,
      items: 1268,
      counted: 1268,
      partial: 0,
    });

    const requests = [...samples.values()].reduce((sum, values) => sum + values.length, 0);
    const noMetadata = metadata.responses === 0;
    const onlyZeroMetadata = !noMetadata && metadata.rowsRead === 0 && metadata.rowsWritten === 0;
    const forecast =
      noMetadata ||
      onlyZeroMetadata ||
      metadata.missingHeaders > 30 ||
      metadata.missingStatementMetadata > 0
        ? {
            freeDailyRowsRead: 5_000_000,
            freeDailyRowsWritten: 100_000,
            rowsPerProfileObserved: null,
            profilesPerDayEstimate: null,
            status: noMetadata
              ? 'unavailable'
              : 'not_certifiable_from_zero_or_incomplete_local_metadata',
            note: 'No capacity claim: local D1 row metadata is absent, zero, or incomplete for this workload.',
          }
        : {
            freeDailyRowsRead: 5_000_000,
            freeDailyRowsWritten: 100_000,
            observedSuccessfulRowsRead: metadata.rowsRead,
            observedSuccessfulRowsWritten: metadata.rowsWritten,
            profilesPerDayUpperBoundFromObservedRows: Math.floor(
              Math.min(5_000_000 / metadata.rowsRead, 100_000 / metadata.rowsWritten),
            ),
            status: 'visible_success_responses_only',
            note: 'Upper bound uses successful response Server-Timing metadata only; 30 stale 409 responses do not expose D1 timing.',
          };

    const report = {
      generatedAt: new Date().toISOString(),
      scope:
        'Disposable local Wrangler D1 + the real Worker route; no production origin, remote D1, or external load.',
      assumptions: {
        fakeUsers: 30,
        catalogItems: 1268,
        activeCycle: cycleId,
        inventoryPasses: 2,
        firstPass: 'partial/advance',
        secondPass: 'counted',
        maxConcurrentActors: 30,
        allItemsEnabledOnlyInDisposableD1: true,
      },
      durationMs: Math.round(performance.now() - started),
      measuredWorkloadDurationMs: Math.round(performance.now() - profileStarted),
      http: {
        requests,
        statusCounts: statuses,
        unexpectedRateLimits: Object.values(statuses).reduce(
          (sum, codeCounts) => sum + (codeCounts[429] || 0),
          0,
        ),
        latencyMs: Object.fromEntries(
          [...samples].map(([label, values]) => [
            label,
            {
              p50: percentile(values, 0.5),
              p95: percentile(values, 0.95),
              max: Math.round(Math.max(...values)),
            },
          ]),
        ),
      },
      workload: {
        catalogActivation:
          'Inactive catalog rows were temporarily enabled through item_activity in the disposable D1 so all 1,268 rows could be exercised; catalog source data was unchanged.',
        itemOwnership:
          'Disjoint item/location sets across all 30 users to avoid false write conflicts.',
        perUserItems: {
          min: Math.min(...plans.map((plan) => plan.items.length)),
          max: Math.max(...plans.map((plan) => plan.items.length)),
        },
        areaBootstrapItems: Object.fromEntries(
          areas.map((area) => [
            area.id,
            plans
              .filter((plan) => plan.area === area.id)
              .reduce((sum, plan) => sum + plan.items.length, 0),
          ]),
        ),
        staleRetry: '30 expected HTTP 409 STALE responses; no operation accepted.',
        idempotentRetry: '30 repeated operation IDs; response matched the original acceptance.',
        emptyIncrementalSyncs: emptySyncs.length,
        verifiedD1State: final,
      },
      d1LocalMetadata: {
        source: 'Authenticated admin Server-Timing counters from the Worker request wrapper.',
        metadataResponses: metadata.responses,
        missingHeaders: metadata.missingHeaders,
        missingStatementMetadata: metadata.missingStatementMetadata,
        nonzeroResponses: metadata.nonzeroResponses,
        rowsRead: metadata.rowsRead,
        rowsWritten: metadata.rowsWritten,
        statements: metadata.statements,
        calls: metadata.calls,
        byWorkload: metadataByLabel,
        freeQuotaForecast: forecast,
      },
      limits: {
        cloudflareCpu:
          'Not measurable with local Workerd/Miniflare; this is not a Cloudflare capacity certification.',
        freeQuotaAssumptions:
          '5,000,000 D1 rows read and 100,000 D1 rows written per day, as requested for this estimate.',
        localD1MetadataCaveat:
          'Miniflare metadata may be unavailable or differ from Cloudflare billed rows. Failed stale responses also omit Server-Timing.',
      },
    };
    saveReport(report);
    console.log(JSON.stringify({ reportPath, ...report }, null, 2));
  } finally {
    if (server && server.exitCode === null) {
      server.kill('SIGTERM');
      await new Promise((resolveExit) => server.once('exit', resolveExit));
    }
    db?.close();
    if (fixtureSqlExists) rmSync(fixtureSql, { force: true });
    rmSync(state, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
