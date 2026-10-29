// Real browser DOM/IndexedDB and client code, isolated HTTP fixture, synthetic WS.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
const user = {
  id: 'worker',
  revision: 1,
  name: 'Persona de prueba',
  role: 'worker',
  mustChange: false,
};
const item = { id: 'item', locationId: 'cocina', areaId: 'cocina', unit: 'kg', active: true };
const record = (version) => ({
  itemId: 'item',
  locationId: 'cocina',
  quantity: version,
  status: 'counted',
  version,
  authorId: user.id,
  authorName: user.name,
});
const cycle = { id: 'cycle', state: 'open', revision: 1, scopeStates: [] };
let history = [],
  syncReads = 0,
  held = false,
  releaseSync,
  waitingSync = false;
const bundle = await build({
  stdin: {
    contents: `
import {SharedInventory} from ${JSON.stringify(resolve('shared/inventory.js'))};
import {api} from ${JSON.stringify(resolve('shared/client.js'))};
class Socket extends EventTarget {
 constructor(url){super();this.url=url;window.socket=this;}
 close(){this.dispatchEvent(Object.assign(new Event('close'),{code:1000}));}
 send(){}
 emit(message){this.dispatchEvent(Object.assign(new Event('message'),{data:JSON.stringify(message)}));}
}
window.WebSocket=Socket;
const data=await api('/api/bootstrap?cycle=cycle&area=cocina');
const inventory=window.inventory=new SharedInventory(data.user,data);window.accepted=[];
inventory.onRecord=record=>{window.accepted.push(record.version);document.querySelector('#record').textContent=record.quantity;};
inventory.onRender=()=>{window.renders=(window.renders||0)+1;};
inventory.mount(data.items[0],data.counts[0]);inventory.poll();document.body.dataset.ready='1';
`,
    resolveDir: process.cwd(),
    sourcefile: 'realtime-fixture.js',
  },
  bundle: true,
  format: 'esm',
  target: 'es2022',
  write: false,
});
const html =
  '<!doctype html><html><head><script type="module" src="/fixture.js"></script></head><body><main><header class="app-header"><h1>Inventario</h1></header><p id="record"></p><section id="app-content"><label class="field">Cantidad<input id="quantity"></label><label class="field">Nota<textarea id="note"></textarea></label><button id="save-counted">Listo</button></section></main></body></html>';
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://fixture');
    if (url.pathname === '/fixture.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(bundle.outputFiles[0].text);
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Inventory-Session-Expires', String(Math.floor(Date.now() / 1000) + 3600));
      if (url.pathname === '/api/bootstrap') {
        res.end(
          JSON.stringify({
            user,
            cycle,
            items: [item],
            counts: [record(1)],
            scopes: [{ id: 'cocina', name: 'Cocina' }],
            cursor: 1,
            realtime: true,
          }),
        );
        return;
      }
      if (url.pathname === '/api/sync') {
        syncReads++;
        const cursor = Number(url.searchParams.get('cursor')),
          rows = history.filter((row) => row.seq > cursor).slice(0, 250);
        const response = {
          user,
          cycleRevision: 1,
          changes: rows.map((row) => row.record),
          cursor: rows.at(-1)?.seq ?? cursor,
        };
        if (held) {
          waitingSync = true;
          await new Promise((done) => {
            releaseSync = done;
          });
        }
        res.end(JSON.stringify(response));
        return;
      }
      res.end(JSON.stringify({ user }));
      return;
    }
    if (url.pathname === '/pages/inventario/') {
      res.setHeader('Content-Type', 'text/html');
      res.end(html);
      return;
    }
    res.statusCode = 404;
    res.end('Missing');
  } catch (error) {
    res.statusCode = 500;
    res.end(error.message);
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = 'http://127.0.0.1:' + server.address().port,
  browser = await chromium.launch({ headless: true }),
  context = await browser.newContext();
const page = await context.newPage(),
  errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const emit = (message) => page.evaluate((value) => window.socket.emit(value), message);
const frame = (from, to, records) => ({
  type: 'records',
  cycleId: 'cycle',
  fromCursor: from,
  toCursor: to,
  records,
});
try {
  await page.goto(origin + '/pages/inventario/?area=cocina&inventory=cycle');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1');
  assert.match(await page.evaluate(() => window.socket.url), /[?&]v=2(?:&|$)/);
  await emit({ type: 'ready', cycleId: 'cycle', cursor: 50 });
  await page.waitForFunction(() => window.inventory.cursor === 50);
  assert.equal(syncReads, 1);
  await page.locator('#quantity').fill('5');
  await page.locator('#note').fill('Borrador personal');
  await page.locator('#quantity').focus();
  await emit(frame(50, 51, [record(2)]));
  await page.waitForFunction(() => window.inventory.cursor === 51);
  assert.equal(syncReads, 1, 'ordinary pushes cause no HTTP read');
  assert.equal(await page.locator('#quantity').inputValue(), '5');
  assert.equal(await page.locator('#note').inputValue(), 'Borrador personal');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'quantity');
  assert.equal(
    await page.evaluate(() => window.inventory.draft(window.inventory.data.items[0]).quantity),
    '5',
  );
  assert.equal(await page.evaluate(() => window.renders || 0), 0);
  // Delay an older HTTP response; own accepted version and later push stay newer.
  await page.evaluate((value) => window.inventory.acceptRecord(value), record(4));
  history = [{ seq: 52, record: record(3) }];
  held = true;
  await page.evaluate(() => {
    window.syncPending = window.inventory.sync({ force: true });
  });
  const waitUntil = async (predicate) => {
    for (let i = 0; i < 100 && !predicate(); i++) await new Promise((done) => setTimeout(done, 10));
    assert.ok(predicate());
  };
  await waitUntil(() => waitingSync);
  await emit(frame(51, 53, [record(5)]));
  held = false;
  releaseSync();
  await page.waitForFunction(() => window.inventory.cursor === 53);
  assert.ok(!(await page.evaluate(() => window.accepted)).includes(3));
  assert.equal(await page.evaluate(() => window.inventory.data.counts[0].version), 5);
  const beforeDuplicate = syncReads;
  await emit(frame(51, 53, [record(2)]));
  await emit(frame(53, 54, [record(2)]));
  await page.waitForFunction(() => window.inventory.cursor === 54);
  assert.equal(syncReads, beforeDuplicate);
  assert.equal(await page.evaluate(() => window.inventory.data.counts[0].version), 5);
  history = [{ seq: 61, record: record(6) }];
  await emit(frame(60, 61, [record(6)]));
  await page.waitForFunction(() => window.inventory.cursor === 61);
  assert.equal(syncReads, beforeDuplicate + 1, 'gap requires authorized HTTP catchup');
  // Catchup drains the API limit before trusting a global head with scope gaps.
  history = Array.from({ length: 251 }, (_, i) => ({ seq: 62 + i, record: record(62 + i) }));
  const beforePages = syncReads;
  await emit(frame(400, 401, []));
  await page.waitForFunction(() => window.inventory.cursor === 401);
  assert.equal(syncReads, beforePages + 2);
  assert.equal(await page.evaluate(() => window.inventory.data.counts[0].version), 312);
  const tooMany = Array.from({ length: 251 }, () => record(999));
  await emit(frame(401, 402, tooMany));
  await page.waitForFunction(() => !window.inventory.syncing);
  await page.waitForTimeout(150);
  assert.equal(
    await page.evaluate(() => window.inventory.data.counts[0].version),
    312,
    'invalid frame cannot apply unverified payload',
  );
  assert.equal(await page.locator('#quantity').inputValue(), '5');
  assert.equal(await page.locator('#note').inputValue(), 'Borrador personal');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'quantity');
  const snapshot = await page.evaluate(async () => {
    const db = await new Promise((done) => {
      const q = indexedDB.open('inventory-offline-v1');
      q.onsuccess = () => done(q.result);
    });
    return new Promise((done) => {
      const q = db.transaction('snapshots').objectStore('snapshots').get('/api/bootstrap');
      q.onsuccess = () => done(q.result);
    });
  });
  assert.equal(snapshot.data.counts[0].version, 312);
  assert.ok(snapshot.data.cursor >= 401, 'push cursor updates existing offline snapshot');
  assert.deepEqual(errors, []);
  await page.evaluate(() => {
    window.inventory.realtime.stop();
    window.inventory.pollTick.stop();
  });
  console.log(
    'Realtime browser: scoped push without API fanout, cursor gaps/pagination, older HTTP/save/push versions, duplicate frames, offline snapshot, draft fields/focus preserved.',
  );
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
