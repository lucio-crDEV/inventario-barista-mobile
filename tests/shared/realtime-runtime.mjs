// Local provider-runtime test: synthetic D1 only, outbound traffic always blocked.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(resolve('package.json'));
const { Miniflare, convertV4MiniflareOptions } = require('miniflare'),
  { build } = require('esbuild'),
  WebSocket = require('ws');
const source = `
import {InventoryRealtime as Native} from ${JSON.stringify(resolve('operations/realtime-worker/entry.js'))};
export class RuntimeTest extends Native {
 constructor(ctx,env){
  const stats={reads:0,journalReads:0,messageWakes:0,fail:false,race:false,revokeAfterData:false,delayAfterData:0};
  const instrument=db=>({withSession:(...args)=>instrument(db.withSession(...args)),prepare(sql){
   const wrap=statement=>({bind(...params){return wrap(statement.bind(...params));},async first(...args){stats.reads++;if(stats.fail)throw Error('Synthetic D1 failure');const value=await statement.first(...args);if(stats.race&&sql.includes('access_revision')){stats.race=false;await env.DB.prepare("INSERT INTO history(seq,cycle_id,location_id) VALUES(3,'a','servicio:barra')").run();}return value;},async all(...args){stats.reads++;if(stats.fail)throw Error('Synthetic D1 failure');const value=await statement.all(...args);if(sql.includes('after_record')){stats.journalReads++;if(stats.revokeAfterData){stats.revokeAfterData=false;await env.DB.prepare('UPDATE runtime_contract SET users_metadata_revision=users_metadata_revision+1').run();}if(stats.delayAfterData){const delay=stats.delayAfterData;stats.delayAfterData=0;await new Promise(done=>setTimeout(done,delay));}}return value;}});
   return wrap(db.prepare(sql));
  }});
  super(ctx,{...env,DB:instrument(env.DB)});this.stats=stats;this.testContext=ctx;
 }
 async fetch(request){
  const path=new URL(request.url).pathname;
  if(path==='/__stats')return Response.json({...this.stats,sockets:this.testContext.getWebSockets().filter(s=>s.readyState===1).length,alarm:await this.testContext.storage.getAlarm()});
  if(path==='/__alarm'){await this.alarm();return Response.json({ok:true});}
  if(path==='/__fail'){this.stats.fail=(await request.json()).enabled;return Response.json({ok:true});}
  if(path==='/__race'){this.stats.race=true;return Response.json({ok:true});}
  if(path==='/__revoke-after-data'){this.stats.revokeAfterData=true;return Response.json({ok:true});}
  if(path==='/__delay-after-data'){this.stats.delayAfterData=2300;return Response.json({ok:true});}
  return super.fetch(request);
 }
 webSocketMessage(socket,message){this.stats.messageWakes++;return super.webSocketMessage(socket,message);}
}
export default {fetch(request,env){if(new URL(request.url).pathname==='/connect')return env.REALTIME.get(env.REALTIME.idFromName('inventory')).fetch(request);return new Response('Not found',{status:404});}};
`;
const bundle = await build({
  stdin: { contents: source, resolveDir: resolve('.') },
  bundle: true,
  write: false,
  format: 'esm',
  target: 'es2022',
  external: ['cloudflare:workers'],
});
let outbound = 0;
const mf = new Miniflare(
  convertV4MiniflareOptions({
    telemetry: { enabled: false },
    modules: true,
    script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-10-01',
    d1Databases: { DB: 'realtime-runtime-synthetic' },
    durableObjects: { REALTIME: { className: 'RuntimeTest', useSQLite: true } },
    outboundService: async () => {
      outbound++;
      throw Error('Network prohibited in realtime runtime test');
    },
  }),
);
const wait = async (condition) => {
  const deadline = Date.now() + 6000;
  while (!condition()) {
    if (Date.now() > deadline) throw Error('Timed out waiting for realtime runtime event');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};
const peers = [];
let accessRevision = 1;
try {
  assert.equal((await mf.dispatchFetch('http://localhost/')).status, 404);
  const db = await mf.getD1Database('DB');
  await db.exec(
    "CREATE TABLE history(seq INTEGER PRIMARY KEY,cycle_id TEXT,location_id TEXT,after_record TEXT DEFAULT '{}'); CREATE TABLE runtime_contract(id INTEGER PRIMARY KEY,users_metadata_revision INTEGER); INSERT INTO runtime_contract VALUES(1,1); CREATE TABLE cycle_registry(id INTEGER PRIMARY KEY,revision INTEGER); INSERT INTO cycle_registry VALUES(1,1);",
  );
  const namespace = await mf.getDurableObjectNamespace('REALTIME'),
    stub = namespace.get(namespace.idFromName('inventory'));
  const stats = async () => await (await stub.fetch('https://realtime.internal/__stats')).json();
  const invoke = async (path, data) => {
    const response = await stub.fetch('https://realtime.internal/' + path, {
      method: 'POST',
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    assert.equal(response.status, 200);
  };
  async function connect(cycleId = 'a', scopeIds = ['servicio:barra'], options = {}) {
    const auth = {
      userId: 'synthetic-user',
      revision: 1,
      accessRevision,
      expires: Math.floor(Date.now() / 1000) + (options.expires || 600),
      cycleId,
      scopeIds,
      ...(options.protocol ? { protocol: options.protocol } : {}),
    };
    const url = new URL('/connect', await mf.ready);
    url.protocol = 'ws:';
    const ws = new WebSocket(url, {
      closeTimeout: 100,
      headers: { 'X-Inventory-Context': JSON.stringify(auth) },
    });
    const peer = { ws, messages: [], frames: [], code: null };
    peers.push(peer);
    ws.on('upgrade', (response) => assert.equal(response.statusCode, 101));
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'records' || (options.protocol === 2 && message.type === 'ready'))
        peer.frames.push(message);
      else assert.deepEqual(Object.keys(message), ['type']);
      peer.messages.push(message.type);
    });
    ws.on('close', (code) => {
      peer.code = code;
    });
    ws.on('error', (error) => {
      throw error;
    });
    await wait(() => peer.messages.includes('ready'));
    return peer;
  }
  assert.equal(
    (await stub.fetch('https://realtime.internal/connect', { headers: { Upgrade: 'websocket' } }))
      .status,
    403,
  );
  const initial = await Promise.all(
    Array.from({ length: 30 }, (_, i) =>
      connect(i === 3 ? '' : i === 2 ? 'b' : 'a', i === 1 ? ['cocina'] : ['servicio:barra']),
    ),
  );
  assert.equal(
    (await stats()).reads,
    1,
    'thirty simultaneous initial subscribers share one D1 snapshot',
  );
  assert.equal((await stats()).sockets, 30);
  await db
    .prepare("INSERT INTO history(seq,cycle_id,location_id) VALUES(1,'a','servicio:barra')")
    .run();
  await wait(() => initial[0].messages.includes('changed')); // Real scheduled alarm, not a mocked timer.
  assert.equal(initial[1].messages.includes('changed'), false);
  assert.equal(initial[2].messages.includes('changed'), false);
  assert.equal(initial[3].messages.includes('changed'), false);
  const afterChange = await stats();
  assert.equal(
    afterChange.reads,
    4,
    'one bounded journal read and two control checks shared by thirty peers',
  );
  const beforeIdle = afterChange.reads;
  await invoke('__alarm');
  assert.equal((await stats()).reads, beforeIdle + 1);
  const beforePing = (await stats()).reads;
  initial[0].ws.send(JSON.stringify({ type: 'ping' }));
  await wait(() => initial[0].messages.includes('pong'));
  assert.equal((await stats()).reads, beforePing, 'heartbeats never query D1');
  await db.prepare('UPDATE cycle_registry SET revision=revision+1').run();
  await invoke('__alarm');
  await wait(() => initial.every((peer) => peer.messages.includes('refresh')));
  await db
    .prepare('UPDATE runtime_contract SET users_metadata_revision=users_metadata_revision+1')
    .run();
  await invoke('__alarm');
  await wait(() => initial.every((peer) => peer.code === 4001));
  accessRevision = 2;
  const stale = {
    userId: 'synthetic-user',
    revision: 1,
    accessRevision: 1,
    expires: Math.floor(Date.now() / 1000) + 600,
    cycleId: 'a',
    scopeIds: ['servicio:barra'],
  };
  assert.equal(
    (
      await stub.fetch('https://realtime.internal/connect', {
        headers: { Upgrade: 'websocket', 'X-Inventory-Context': JSON.stringify(stale) },
      })
    ).status,
    403,
    'revocation committed between API preflight and first initialization rejects stale context',
  );
  await db.prepare('UPDATE runtime_contract SET users_metadata_revision=3').run();
  stale.accessRevision = 2;
  assert.equal(
    (
      await stub.fetch('https://realtime.internal/connect', {
        headers: { Upgrade: 'websocket', 'X-Inventory-Context': JSON.stringify(stale) },
      })
    ).status,
    403,
    'an idle rejected context never pins an obsolete cached access revision',
  );
  accessRevision = 3;
  const emptyReads = (await stats()).reads;
  await invoke('__alarm');
  assert.equal((await stats()).reads, emptyReads);
  assert.equal((await stats()).alarm, null);
  const race = await connect();
  await db
    .prepare("INSERT INTO history(seq,cycle_id,location_id) VALUES(2,'b','servicio:barra')")
    .run();
  await invoke('__race');
  await invoke('__alarm');
  assert.equal(
    race.messages.filter((t) => t === 'changed').length,
    0,
    'future authorized entry is outside the snapshot cursor',
  );
  await invoke('__alarm');
  await wait(() => race.messages.includes('changed'));
  assert.equal(race.messages.filter((t) => t === 'changed').length, 1);
  await invoke('__fail', { enabled: true });
  await invoke('__alarm');
  await wait(() => race.code === 1011);
  await invoke('__fail', { enabled: false });
  const overflow = await connect();
  await db.exec(
    'INSERT INTO history(seq,cycle_id,location_id) VALUES ' +
      Array.from({ length: 1001 }, (_, i) => `(${i + 4},'a','servicio:barra')`).join(','),
  );
  await invoke('__alarm');
  await wait(() => overflow.code === 1012);
  // Protocol 2 fans one private, scope-checked journal query to thirty phones.
  const v2 = await Promise.all(
    Array.from({ length: 30 }, (_, i) =>
      connect(i === 2 ? 'b' : 'a', i === 1 ? ['cocina'] : ['servicio:barra'], { protocol: 2 }),
    ),
  );
  const legacy = await connect();
  let seq = 1005;
  const add = async (count, note = '') => {
    const values = Array.from({ length: count }, (_, i) => {
      const id = seq++;
      const record = JSON.stringify({
        itemId: 'item-' + i,
        locationId: 'servicio:barra',
        quantity: i,
        status: 'counted',
        version: id,
        note,
      }).replace(/'/g, "''");
      return `(${id},'a','servicio:barra','${record}')`;
    });
    let chunk = [],
      size = 0;
    for (const value of values) {
      if (size + value.length > 40000 && chunk.length) {
        await db.exec('INSERT INTO history VALUES ' + chunk.join(','));
        chunk = [];
        size = 0;
      }
      chunk.push(value);
      size += value.length;
    }
    if (chunk.length) await db.exec('INSERT INTO history VALUES ' + chunk.join(','));
  };
  const records = (peer) => peer.frames.filter((frame) => frame.type === 'records');
  const beforeData = await stats();
  await add(1);
  await invoke('__alarm');
  await wait(() => records(v2[0]).length === 1);
  assert.equal(
    (await stats()).journalReads,
    beforeData.journalReads + 1,
    'thirty subscribers share exactly one data query',
  );
  assert.equal(
    (await stats()).reads,
    beforeData.reads + 3,
    'data + control + post-data revocation check',
  );
  assert.equal(records(v2[0])[0].records.length, 1);
  assert.equal(records(v2[1])[0].records.length, 0);
  assert.equal(records(v2[2])[0].records.length, 0);
  await wait(() => legacy.messages.includes('changed'));
  assert.equal(legacy.frames.length, 0, 'legacy connections receive no record content');
  const beforeHeartbeat = await stats();
  v2[0].ws.send('{"type":"ping"}');
  await wait(() => v2[0].messages.includes('pong'));
  assert.equal((await stats()).reads, beforeHeartbeat.reads);
  assert.equal(
    (await stats()).messageWakes,
    beforeHeartbeat.messageWakes,
    'native ping/pong does not wake JS',
  );
  await add(600);
  await invoke('__alarm');
  await wait(() => records(v2[0]).length === 4);
  assert.deepEqual(
    records(v2[0])
      .slice(1)
      .map((frame) => frame.records.length),
    [250, 250, 100],
  );
  await add(40, 'n'.repeat(3000));
  await invoke('__alarm');
  await wait(() => records(v2[0]).at(-1).toCursor === seq - 1);
  for (const peer of v2) {
    let cursor = peer.frames.find((frame) => frame.type === 'ready').cursor;
    for (const frame of records(peer)) {
      assert.equal(frame.cycleId, peer === v2[2] ? 'b' : 'a');
      assert.equal(frame.fromCursor, cursor);
      cursor = frame.toCursor;
      assert.ok(frame.records.length <= 250);
      assert.ok(Buffer.byteLength(JSON.stringify(frame)) <= 48 * 1024);
      if (peer === v2[1] || peer === v2[2]) assert.equal(frame.records.length, 0);
    }
  }
  // A revocation committed while the D1 data query is in flight sends zero content.
  const priorFrames = records(v2[0]).length;
  await add(1);
  await invoke('__revoke-after-data');
  await invoke('__alarm');
  await wait(() => v2.every((peer) => peer.code === 4001));
  assert.equal(records(v2[0]).length, priorFrames);
  accessRevision++;
  const expiry = await connect('a', ['servicio:barra'], { protocol: 2, expires: 2 });
  await add(1);
  await invoke('__delay-after-data');
  await invoke('__alarm');
  await wait(() => expiry.code === 4001);
  assert.equal(records(expiry).length, 0, 'expiry after data await sends zero records');
  const failureV2 = await connect('a', ['servicio:barra'], { protocol: 2 });
  await add(1);
  await invoke('__fail', { enabled: true });
  await invoke('__alarm');
  await wait(() => failureV2.code === 1011);
  await invoke('__fail', { enabled: false });
  assert.equal(records(failureV2).length, 0);
  const overflowV2 = await connect('a', ['servicio:barra'], { protocol: 2 });
  await add(1001);
  await invoke('__alarm');
  await wait(() => overflowV2.code === 1012);
  assert.equal(records(overflowV2).length, 0);
  const finalStats = await stats(),
    finalReads = finalStats.reads;
  await invoke('__alarm');
  assert.equal((await stats()).reads, finalReads);
  assert.equal((await stats()).alarm, null);
  assert.equal(outbound, 0);
  console.log(
    JSON.stringify({
      pass: true,
      runtime: 'local workerd + SQLite Durable Object + synthetic D1 + native WebSocket',
      peers: 30,
      initialD1Reads: 1,
      changedSweepD1Reads: 3,
      idleSweepD1Reads: 1,
      heartbeatD1Reads: 0,
      emptySweepD1Reads: 0,
      recordProtocol: 2,
      multiFrame: true,
      racedRevocation: true,
      racedExpiry: true,
      legacyHintsCompatible: true,
      scopeAndCycleIsolation: true,
      snapshotUpperBound: true,
      authClose: 4001,
      failureClose: 1011,
      overflowClose: 1012,
      outboundRequests: outbound,
      localClientCloseTimeoutMs: 100,
      productionCPUCertified: false,
    }),
  );
} finally {
  for (const peer of peers)
    try {
      peer.ws.close();
    } catch {}
  await mf.dispose();
}
