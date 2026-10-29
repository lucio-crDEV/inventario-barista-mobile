import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const require = createRequire(resolve('package.json'));
const { Miniflare, convertV4MiniflareOptions, Response: MFResponse } = require('miniflare');
const entry = resolve('operations/export-worker/entry.js');
const workerIndex = resolve('operations/export-worker/index.js');
const runtimeSource = `
 import worker,{RESOURCE_MONITOR_CRON,AUTH_METADATA_PURGE_CRON} from ${JSON.stringify(workerIndex)};
 export {ResourceMonitor} from ${JSON.stringify(entry)};
 export default {
  fetch(request,env,ctx){
   const url=new URL(request.url);
   if(url.pathname==='/__test/cron'){
    const pending=[];
    worker.scheduled({cron:url.searchParams.get('cron')},env,{waitUntil(promise){pending.push(promise);}});
    return Promise.all(pending).then(results=>Response.json({ok:true,results,hasResources:!!env.RESOURCES,RESOURCE_MONITOR_CRON,AUTH_METADATA_PURGE_CRON}));
   }
   return worker.fetch(request,env,ctx);
  },
  scheduled:worker.scheduled,
 };
`;
const bundled = await build({
  stdin: { contents: runtimeSource, resolveDir: resolve('.') },
  bundle: true,
  write: false,
  format: 'esm',
  target: 'es2022',
  external: ['cloudflare:workers'],
});
const today = new Date().toISOString().slice(0, 10),
  now = new Date().toISOString();
const analytics = {
  data: {
    viewer: {
      accounts: [
        {
          d1: [
            {
              dimensions: { databaseId: 'synthetic-db', date: today },
              sum: { rowsRead: 4_000_000, rowsWritten: 1, readQueries: 1, writeQueries: 1 },
            },
          ],
          pages: [
            {
              dimensions: { scriptName: 'pages-worker--21988261-production', status: 'success' },
              sum: { requests: 100, errors: 0 },
              quantiles: { cpuTimeP50: 10, cpuTimeP99: 100 },
            },
          ],
          r2Ops: [{ dimensions: { actionType: 'GetObject' }, sum: { requests: 10 } }],
          r2Storage: [
            {
              dimensions: { bucketName: 'synthetic-bucket', datetime: now },
              max: { objectCount: 1, payloadSize: 100, metadataSize: 10 },
            },
          ],
        },
      ],
    },
  },
};
let outbound = 0;
const mf = new Miniflare(
  convertV4MiniflareOptions({
    telemetry: { enabled: false },
    modules: true,
    script: bundled.outputFiles[0].text,
    compatibilityDate: '2026-10-01',
    d1Databases: { DB: 'resource-monitor-runtime' },
    durableObjects: { RESOURCES: { className: 'ResourceMonitor', useSQLite: true } },
    bindings: {
      CF_ACCOUNT_ID: '5d7f98ff54c0a691173f3ec3cf29bff2',
      APP_SCRIPT_NAME: 'pages-worker--21988261-production',
      CF_ANALYTICS_TOKEN: 'synthetic-test-token',
    },
    cronTriggers: ['*/15 * * * *', '43 5 * * *'],
    outboundService: async (request) => {
      outbound++;
      assert.equal(request.url, 'https://api.cloudflare.com/client/v4/graphql');
      assert.equal(request.headers.get('authorization'), 'Bearer synthetic-test-token');
      assert.match(await request.text(), /pages-worker--21988261-production/);
      return MFResponse.json(analytics);
    },
  }),
);
try {
  const config = JSON.parse(
    (await readFile('wrangler.exports.production.jsonc', 'utf8'))
      .replace(/^\/\/[^\n]*\n/, '')
      .replace(/,\s*([}\]])/g, '$1'),
  );
  assert.deepEqual(config.triggers.crons, ['*/15 * * * *', '43 5 * * *']);
  assert.equal(config.vars.CF_ACCOUNT_ID, '5d7f98ff54c0a691173f3ec3cf29bff2');
  assert.equal(config.vars.APP_SCRIPT_NAME, 'pages-worker--21988261-production');
  assert.ok(
    config.durable_objects.bindings.some(
      (binding) => binding.name === 'RESOURCES' && binding.class_name === 'ResourceMonitor',
    ),
  );
  assert.deepEqual(config.migrations[1], {
    tag: 'exports-v2-monitor',
    new_sqlite_classes: ['ResourceMonitor'],
  });
  assert.equal(config.observability.enabled, true);
  assert.deepEqual(config.observability.logs, {
    enabled: true,
    invocation_logs: false,
    head_sampling_rate: 1,
    persist: true,
  });
  assert.equal((await mf.dispatchFetch('http://localhost/')).status, 404);
  for (const path of ['/resources/status', '/resources/sample', '/status'])
    assert.equal(
      (
        await mf.dispatchFetch('http://localhost' + path, {
          method: path.endsWith('sample') ? 'POST' : 'GET',
        })
      ).status,
      404,
    );

  const db = await mf.getD1Database('DB');
  for (const sql of [
    'CREATE TABLE sessions(hash TEXT PRIMARY KEY,user_id TEXT,expires INTEGER)',
    'CREATE TABLE attempts(key TEXT,window INTEGER,attempts INTEGER)',
    'CREATE TABLE admin_audit(actor TEXT,target TEXT,action TEXT,detail TEXT)',
  ])
    await db.prepare(sql).run();
  await db
    .prepare(
      "INSERT INTO sessions VALUES('expired-old','synthetic',unixepoch()-172801),('current','synthetic',unixepoch()+3600)",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO attempts VALUES('old',CAST((unixepoch()-172800)/900 AS INTEGER)-1,1),('current',CAST(unixepoch()/900 AS INTEGER),1)",
    )
    .run();

  const cron = async (expression) =>
    mf.dispatchFetch('http://localhost/__test/cron?cron=' + encodeURIComponent(expression));
  await cron('unknown');
  assert.equal(outbound, 0, 'unknown cron expressions trigger neither job');
  await cron('43 5 * * *');
  assert.equal(outbound, 0, 'daily purge must not invoke Analytics');
  assert.equal(
    (await db.prepare("SELECT count(*) AS n FROM sessions WHERE hash='expired-old'").first()).n,
    0,
  );
  assert.equal(
    (await db.prepare("SELECT count(*) AS n FROM sessions WHERE hash='current'").first()).n,
    1,
  );
  assert.equal(
    (await db.prepare("SELECT count(*) AS n FROM attempts WHERE key='old'").first()).n,
    0,
  );
  assert.equal(
    (await db.prepare("SELECT count(*) AS n FROM attempts WHERE key='current'").first()).n,
    1,
  );
  assert.equal((await db.prepare('SELECT count(*) AS n FROM admin_audit').first()).n, 1);

  const beforeAudit = (await db.prepare('SELECT count(*) AS n FROM admin_audit').first()).n;
  const monitorCron = await cron('*/15 * * * *');
  const monitorCronData = await monitorCron.json();
  const namespace = await mf.getDurableObjectNamespace('RESOURCES');
  const stub = namespace.get(namespace.idFromName('account-resource-monitor'));
  const preStatus = await stub.fetch('https://resources.internal/resources/status');
  assert.equal(preStatus.status, 200, 'private Durable Object status endpoint should be reachable');
  assert.equal(
    outbound,
    1,
    '15-minute schedule makes exactly one mocked Analytics request: ' +
      JSON.stringify(monitorCronData),
  );
  assert.equal(
    (await db.prepare('SELECT count(*) AS n FROM admin_audit').first()).n,
    beforeAudit,
    'resource sampling never runs auth cleanup',
  );
  const statusResponse = await stub.fetch('https://resources.internal/resources/status');
  assert.equal(statusResponse.status, 200);
  const status = await statusResponse.json();
  assert.equal(status.health, 'available');
  assert.equal(status.metrics.d1.rowsRead, 4_000_000);
  assert.equal(status.notificationStatus.lastNotificationAt !== null, true);
  const serialized = JSON.stringify(status);
  for (const privateValue of [
    'synthetic-test-token',
    '5d7f98ff54c0a691173f3ec3cf29bff2',
    'synthetic-db',
    'synthetic-bucket',
  ])
    assert.ok(!serialized.includes(privateValue));
  assert.equal((await stub.fetch('https://resources.internal/', { method: 'POST' })).status, 404);
  assert.equal(outbound, 1, 'private status reads do not contact the provider');
  console.log(
    JSON.stringify({
      pass: true,
      runtime: 'local Workerd + SQLite Durable Object + mocked Cloudflare Analytics',
      publicWorker404: true,
      privateStatusOnly: true,
      dailyPurgeIsolated: true,
      monitorCronRequests: outbound,
      analyticsNetwork: 'mocked',
      notificationState: 'persisted',
      productionData: false,
    }),
  );
} finally {
  await mf.dispose();
}
