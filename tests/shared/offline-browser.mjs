// Genuine Chromium network-offline, service worker and IndexedDB regression.
// A private fixture server exercises the real client/counting code, never live D1.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
const fixture = await mkdtemp(join(tmpdir(), 'inventory-offline-'));
const actor = (id) => ({
  id,
  username: id,
  name: 'Persona ' + id,
  role: 'worker',
  active: true,
  mustChange: false,
  revision: 1,
});
let user = actor('one'),
  forceStatus = 0,
  dropNextCount = false,
  swVersion = 'one';
const cycle = { id: 'cycle-1', state: 'open', revision: 1, lifecycle: 'active', scopeStates: [] };
const item = {
  id: 'item-1',
  name: 'Producto autorizado',
  locationId: 'cocina',
  areaId: 'cocina',
  unit: 'kg',
  active: true,
};
let record = {
  itemId: item.id,
  locationId: item.locationId,
  quantity: 2,
  status: 'counted',
  note: '',
  authorId: 'one',
  authorName: 'Persona one',
  version: 1,
};
const commands = new Map(),
  attempts = [],
  reads = [];
const bundle = await build({
  stdin: {
    contents: `import {SharedInventory} from ${JSON.stringify(resolve('shared/inventory.js'))};
import {api,logout} from ${JSON.stringify(resolve('shared/client.js'))};
import {createAPI} from ${JSON.stringify(resolve('shared/api-request.js'))};
import {clearOfflineIdentity} from ${JSON.stringify(resolve('shared/offline-cache.js'))};
window.api=api; window.logout=logout; window.createAPI=createAPI;window.clearOfflineIdentity=clearOfflineIdentity;
try {
 if(location.pathname.includes('cuenta')) {try {document.querySelector('#result').textContent=(await api('/api/me')).user.id;}catch(e){document.querySelector('#result').textContent=e.status===401?'Ingresar':e.message;}}
 else {
 const inv=window.inventory=await SharedInventory.create('cycle-1'); const item=inv.data.items[0],count=inv.data.counts[0];
 document.querySelector('#result').textContent=inv.user.id; inv.mount(item,count);
 inv.onRecord=r=>{document.querySelector('#result').textContent=inv.user.id+':'+r.quantity;};
 document.querySelector('#save-counted').onclick=()=>inv.save(item,document.querySelector('#quantity').value,'counted',document.querySelector('#note').value,false);
 document.body.dataset.ready='1';
 }
}catch(e){document.querySelector('#result').textContent=e.message;document.body.dataset.error=e.code||'error';}
`,
    resolveDir: process.cwd(),
    sourcefile: 'offline-fixture.js',
    loader: 'js',
  },
  bundle: true,
  format: 'esm',
  target: 'es2022',
  write: false,
  minify: true,
});
const js = bundle.outputFiles[0].text,
  asset = '/assets/offline-fixture-12345678.js';
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width"><script type="module" src="${asset}"></script></head><body><main><header class="app-header"><h1>Inventario</h1><button data-settings-toggle>Cuenta</button></header><p id="result"></p><section id="app-content"><label class="field">Cantidad<input id="quantity"></label><label class="field">Nota<textarea id="note"></textarea></label><button id="save-counted">Listo</button></section></main></body></html>`;
const shells = {
  '/pages/inventario/': '/offline-shells/count-12345678.html',
  '/pages/cuenta/': '/offline-shells/account-12345678.html',
};
const worker = await readFile('shared/offline-worker.js', 'utf8');
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://fixture'),
      path = url.pathname;
    if (path === '/service-worker.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.setHeader('Cache-Control', 'no-store');
      res.end(
        worker.replace(
          '__INVENTORY_OFFLINE_MANIFEST__',
          JSON.stringify({ version: swVersion, assets: [asset], shells }),
        ),
      );
      return;
    }
    if (path === asset) {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(js);
      return;
    }
    if (path.startsWith('/api/')) {
      let raw = '';
      for await (const part of req) raw += part;
      const body = raw ? JSON.parse(raw) : null;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      if (req.method === 'GET') reads.push(path);
      if (path === '/api/logout') {
        user = null;
        res.end('{"ok":true}');
        return;
      }
      if (path === '/api/login') {
        user = actor(body.username);
        res.setHeader('X-Inventory-Session-Expires', String(Math.floor(Date.now() / 1000) + 43200));
        res.end(JSON.stringify({ user }));
        return;
      }
      if (forceStatus || !user) {
        res.statusCode = forceStatus || 401;
        res.end(JSON.stringify({ code: 'REJECTED', message: 'Acceso rechazado' }));
        return;
      }
      res.setHeader('X-Inventory-Session-Expires', String(Math.floor(Date.now() / 1000) + 43200));
      let data =
        path === '/api/bootstrap'
          ? {
              user,
              cycle,
              items: [item],
              counts: [record],
              scopes: [{ id: 'cocina', name: 'Cocina' }],
              cursor: 1,
              realtime: false,
            }
          : path === '/api/me'
            ? { user }
            : path === '/api/navigation'
              ? { user, scopes: [{ id: 'cocina', name: 'Cocina' }], cycleId: cycle.id }
              : path === '/api/cycles'
                ? { user, cycles: [cycle], defaultCycleId: cycle.id }
                : path === '/api/record'
                  ? { record }
                  : path === '/api/sync'
                    ? { user, cycleRevision: 1, changes: [], cursor: 1 }
                    : { ok: true };
      if (path === '/api/count') {
        attempts.push(body);
        if (commands.has(body.id)) data = commands.get(body.id);
        else {
          record = {
            ...record,
            quantity: body.quantity,
            version: record.version + 1,
            authorId: user.id,
            authorName: user.name,
          };
          data = { record };
          commands.set(body.id, data);
        }
        if (dropNextCount) {
          req.socket.destroy();
          return;
        }
      }
      res.end(JSON.stringify(data));
      return;
    }
    if (Object.values(shells).includes(path) || Object.keys(shells).includes(path)) {
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
  browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const errors = [];
context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)));
const countURL = origin + '/pages/inventario/?area=cocina&inventory=cycle-1';
const snapshots = (page) =>
  page.evaluate(async () => {
    const db = await new Promise((ok, no) => {
      const q = indexedDB.open('inventory-offline-v1', 1);
      q.onsuccess = () => ok(q.result);
      q.onerror = () => no(q.error);
    });
    return new Promise((ok) => {
      const q = db.transaction('snapshots').objectStore('snapshots').getAll();
      q.onsuccess = () => ok(q.result);
    });
  });
const warm = async (page, shell) => {
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.waitForFunction(async (path) => {
    for (const name of await caches.keys())
      if (await (await caches.open(name)).match(path)) return true;
    return false;
  }, shell);
};
try {
  let page = await context.newPage();
  await page.goto(origin + '/pages/cuenta/');
  await warm(page, shells['/pages/cuenta/']);
  await page.goto(countURL);
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1');
  await warm(page, shells['/pages/inventario/']);
  await context.setOffline(true);
  await expect(page.locator('#sync-state')).toHaveAttribute('data-state', 'pending');
  await page.locator('#quantity').fill('7');
  await page.locator('#save-counted').click();
  await expect(page.locator('#retry-operation')).toBeVisible();
  await expect(page.locator('#sync-state')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#sync-state')).toContainText('Sin conexión.');
  await expect(page.locator('#sync-feedback')).toContainText(/reintenta/i);
  const pending = await page.evaluate(
    () => window.inventory.draft(window.inventory.data.items[0]).operation,
  );
  assert.equal(attempts.length, 0, 'offline count never appears accepted');
  await page.close();
  page = await context.newPage();
  await page.goto(countURL);
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1');
  await expect(page.locator('#offline-state')).toContainText(
    'Sin conexión · datos del último acceso',
  );
  await expect(page.locator('#sync-state')).toHaveAttribute('data-state', 'pending');
  assert.equal(await page.locator('#quantity').inputValue(), '7');
  assert.equal(
    await page.evaluate(() => window.inventory.draft(window.inventory.data.items[0]).operation.id),
    pending.id,
  );
  assert.equal((await snapshots(page)).filter((row) => row.data.items).length, 1);
  await assert.rejects(
    page.evaluate(() => window.api('/api/bootstrap?cycle=cycle-1&area=servicio')),
  );
  await assert.rejects(page.evaluate(() => window.api('/api/admin/users')));
  await assert.rejects(
    page.evaluate(() => window.api('/api/login', { username: 'two', password: 'fixture' })),
  );
  // A failed offline login intentionally clears the old identity. Restore online.
  await context.setOffline(false);
  await page.evaluate(() => window.api('/api/login', { username: 'one' }));
  await page.goto(countURL);
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1');
  assert.equal(attempts.length, 0, 'reconnect never automatically replays a write');
  await page.locator('#retry-operation').click();
  await expect(page.locator('#result')).toHaveText('one:7');
  assert.equal(attempts[0].id, pending.id);
  assert.equal(commands.size, 1);
  // An accepted write with a lost response retains and retries the same command.
  dropNextCount = true;
  await page.locator('#quantity').fill('9');
  await page.locator('#save-counted').click();
  await expect(page.locator('#retry-operation')).toBeVisible();
  const uncertain = await page.evaluate(
    () => window.inventory.draft(window.inventory.data.items[0]).operation.id,
  );
  await expect(page.locator('#sync-state')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#sync-state')).toContainText('Sin conexión.');
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.locator('#sync-state')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#sync-feedback')).toContainText(/reintenta/i);
  assert.equal(commands.size, 2);
  dropNextCount = false;
  await page.locator('#retry-operation').click();
  await expect(page.locator('#result')).toHaveText('one:9');
  assert.equal(attempts.at(-1).id, uncertain);
  assert.equal(commands.size, 2, 'retry is idempotent');
  await expect(page.locator('#sync-state')).toHaveAttribute('data-state', 'synced');
  // A manual refresh failure keeps its error alongside the offline banner.
  await page.locator('#quantity').fill('10');
  await page.locator('#note').fill('Conservar durante actualización');
  const beforeRefresh = await page.evaluate(() => JSON.stringify(window.inventory.drafts.all()));
  const failRefresh = (route) => route.abort('failed');
  await page.route('**/api/sync?*', failRefresh);
  await page.locator('.sync-refresh').evaluate((button) => button.onclick());
  await expect(page.locator('#sync-state')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#sync-state')).toContainText('No se pudo actualizar');
  await expect(page.locator('#sync-feedback')).toContainText('No se pudo actualizar');
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.locator('#sync-state')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#sync-state')).toContainText('No se pudo actualizar');
  assert.equal(
    await page.evaluate(() => JSON.stringify(window.inventory.drafts.all())),
    beforeRefresh,
  );
  await page.unroute('**/api/sync?*', failRefresh);
  await page.clock.install();
  await page.clock.fastForward(30001);
  await page.locator('.sync-refresh').evaluate((button) => button.onclick());
  await expect(page.locator('#sync-state')).toHaveAttribute('data-state', 'pending');
  await expect(page.locator('#sync-state')).toHaveText('Cambios pendientes');
  await expect(page.locator('#sync-feedback')).toHaveCount(0);
  assert.equal(await page.locator('#quantity').inputValue(), '10');
  assert.equal(
    await page.evaluate(() => JSON.stringify(window.inventory.drafts.all())),
    beforeRefresh,
  );
  const cachePaths = await page.evaluate(async () => {
    const paths = [];
    for (const name of await caches.keys())
      for (const req of await (await caches.open(name)).keys())
        paths.push(new URL(req.url).pathname);
    return paths;
  });
  assert.ok(cachePaths.length);
  assert.ok(
    cachePaths.every((path) => path.startsWith('/assets/') || path.startsWith('/offline-shells/')),
  );
  assert.ok((await snapshots(page)).length <= 4);
  forceStatus = 503;
  assert.equal(
    await page.evaluate(() => window.api('/api/me').catch((e) => e.status)),
    503,
    '503 must never use snapshot',
  );
  forceStatus = 0;
  forceStatus = 401;
  assert.equal(
    await page.evaluate(() => window.api('/api/me').catch((e) => e.status)),
    401,
    'online unauthorized never falls back',
  );
  assert.equal((await snapshots(page)).length, 0);
  forceStatus = 0;
  await page.goto(countURL);
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1');
  const other = await context.newPage();
  await other.goto(countURL);
  await expect(other.locator('body')).toHaveAttribute('data-ready', '1');
  await page.evaluate(() => window.api('/api/login', { username: 'two' }));
  await other.waitForURL('**/pages/cuenta/');
  await page.goto(countURL);
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1');
  assert.ok((await snapshots(page)).every((row) => row.data.user?.id === 'two'));
  await context.setOffline(true);
  await page.evaluate(() => window.logout());
  await page.waitForURL('**/pages/cuenta/');
  assert.equal((await snapshots(page)).length, 0);
  await context.setOffline(false);
  await page.reload();
  await expect(page.locator('#result')).toHaveText('Ingresar');
  assert.equal(user, null, 'old cookie revoked before next read');
  // Updates wait, preserve edits, then activate and remove stale shell versions.
  await page.evaluate(() => window.api('/api/login', { username: 'one' }));
  await page.goto(countURL);
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1');
  await page.locator('#quantity').fill('11');
  swVersion = 'two';
  await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    await r.update();
  });
  await page.waitForFunction(
    async () => !!(await navigator.serviceWorker.getRegistration()).waiting,
  );
  assert.equal(await page.locator('#quantity').inputValue(), '11');
  assert.ok((await page.evaluate(() => caches.keys())).includes('inventory-shell-one'));
  await other.close();
  await page.close();
  page = await context.newPage();
  await page.goto(countURL);
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1');
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    return keys.includes('inventory-shell-two') && !keys.includes('inventory-shell-one');
  });
  assert.equal(await page.locator('#quantity').inputValue(), '11', 'upgrade preserves local draft');
  // Quota failures cannot turn an accepted server read into a client failure.
  assert.equal(
    await page.evaluate(async () => {
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function () {
        throw new DOMException('fixture quota', 'QuotaExceededError');
      };
      try {
        return (await window.api('/api/me')).user.id;
      } finally {
        IDBObjectStore.prototype.put = put;
      }
    }),
    'one',
  );
  assert.ok((await snapshots(page)).every((row) => row.expires <= Date.now() + 43200000));
  // An initial read started before logout cannot recreate a private cache.
  assert.equal(
    await page.evaluate(async () => {
      await window.clearOfflineIdentity();
      let release;
      const gated = window.createAPI({
        identity: () => '',
        fetch: () =>
          new Promise((done) => {
            release = done;
          }),
      });
      const pending = gated('/api/me').catch((e) => e.code);
      await window.clearOfflineIdentity({ logout: true });
      release(
        new Response(JSON.stringify({ user: { id: 'stale', revision: 1 } }), {
          headers: {
            'Content-Type': 'application/json',
            'X-Inventory-Session-Expires': String(Math.floor(Date.now() / 1000) + 43200),
          },
        }),
      );
      return await pending;
    }),
    'IDENTITY_CHANGED',
  );
  assert.equal((await snapshots(page)).length, 0);
  await page.evaluate(() => window.api('/api/login', { username: 'one' }));
  await page.goto(countURL);
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1');
  // Expiry is enforced in an already-open tab as well as a cold offline tab.
  await context.setOffline(true);
  await page.evaluate(() => {
    const key = 'inventory-offline-session-v1';
    const session = JSON.parse(localStorage.getItem(key));
    session.expires = Date.now() - 1;
    localStorage.setItem(key, JSON.stringify(session));
    window.dispatchEvent(new Event('pageshow'));
  });
  await page.waitForURL('**/pages/cuenta/');
  assert.equal((await snapshots(page)).length, 0);
  assert.deepEqual(errors, []);
  console.log(
    'Offline browser: cold tab, bounded private snapshot, exact scope, drafts, reconnect, uncertain idempotence, 401/503, identity switch/logout, static-only SW, graceful upgrade, quota failure and session expiry passed.',
  );
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
  await rm(fixture, { recursive: true, force: true });
}
