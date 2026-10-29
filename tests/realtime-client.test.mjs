import test from 'node:test';
import assert from 'node:assert/strict';
import { startRealtime } from '../shared/realtime.js';
const flush = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};
const event = (target, type, fields = {}) => {
  const e = new Event(type);
  Object.assign(e, fields);
  target.dispatchEvent(e);
};
function fixture({ enabled = true, onChange, onRecords, online = true } = {}) {
  let time = 0,
    serial = 0,
    reads = 0,
    pauses = 0,
    resumes = 0,
    auth = 0;
  const timers = new Map(),
    sockets = [],
    doc = Object.assign(new EventTarget(), { hidden: false });
  const nav = { onLine: online },
    win = Object.assign(new EventTarget(), {
      navigator: nav,
      location: { href: 'https://inventory.example/pages/inventario/?private=never' },
    });
  class Socket extends EventTarget {
    constructor(url) {
      super();
      this.url = url;
      this.sent = [];
      sockets.push(this);
    }
    send(value) {
      this.sent.push(value);
    }
    close() {
      this.closed = true;
      event(this, 'close', { code: 1000 });
    }
    message(type) {
      event(this, 'message', { data: JSON.stringify(typeof type === 'string' ? { type } : type) });
    }
    serverClose(code) {
      this.closed = true;
      event(this, 'close', { code });
    }
  }
  const polling = {
    pause() {
      pauses++;
    },
    resume() {
      resumes++;
    },
    refresh() {
      reads++;
      return Promise.resolve();
    },
  };
  const realtime = startRealtime({
    enabled,
    cycleId: 'opaque-cycle',
    polling,
    onChange,
    onRecords,
    document: doc,
    window: win,
    WebSocket: Socket,
    onAuth() {
      auth++;
    },
    setTimer(fn, delay) {
      const id = ++serial;
      timers.set(id, { fn, at: time + delay });
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    },
  });
  return {
    realtime,
    doc,
    win,
    nav,
    sockets,
    timers,
    get reads() {
      return reads;
    },
    get pauses() {
      return pauses;
    },
    get resumes() {
      return resumes;
    },
    get auth() {
      return auth;
    },
    async advance(ms) {
      time += ms;
      const due = [...timers].filter(([, t]) => t.at <= time);
      for (const [id, t] of due) {
        if (!timers.has(id)) continue;
        timers.delete(id);
        t.fn();
        await flush();
      }
    },
    visible(hidden) {
      doc.hidden = hidden;
      event(doc, 'visibilitychange');
    },
  };
}

test('disabled realtime makes zero socket attempts, timers or listener-triggered probes', async () => {
  const f = fixture({ enabled: false });
  event(f.win, 'online');
  f.visible(true);
  f.visible(false);
  await f.advance(120000);
  assert.equal(f.sockets.length, 0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.reads, 0);
});

test('ready pauses empty polls, notifications coalesce and hints during a read are retained', async () => {
  let count = 0,
    release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const f = fixture({
      onChange: async () => {
        count++;
        if (count === 2) await gate;
      },
    }),
    ws = f.sockets[0];
  assert.equal(ws.url, 'wss://inventory.example/api/realtime?cycle=opaque-cycle');
  ws.message('ready');
  await f.advance(125);
  assert.equal(count, 1);
  assert.ok(f.pauses >= 1);
  ws.message('changed');
  ws.message('changed');
  ws.message('refresh');
  await f.advance(124);
  assert.equal(count, 1);
  await f.advance(1);
  assert.equal(count, 2);
  ws.message('changed');
  ws.message('changed');
  await f.advance(500);
  assert.equal(count, 2);
  release();
  await flush();
  await f.advance(125);
  assert.equal(count, 3);
  f.realtime.stop();
});

test('failed reads and socket closures restore fallback, reconnect backs off, auth4001 stops', async () => {
  let fail = true;
  const f = fixture({
      onChange: async () => {
        if (fail) throw Error('offline');
      },
    }),
    ws = f.sockets[0];
  ws.message('ready');
  await f.advance(125);
  assert.ok(f.resumes > 0);
  fail = false;
  await f.advance(2000);
  assert.ok(f.pauses >= 2);
  ws.serverClose(1012);
  assert.ok(f.resumes >= 2);
  await f.advance(1999);
  assert.equal(f.sockets.length, 1);
  await f.advance(1);
  assert.equal(f.sockets.length, 2);
  f.sockets[1].message('ready');
  await f.advance(125);
  f.sockets[1].serverClose(4001);
  assert.equal(f.auth, 1);
  await f.advance(120000);
  assert.equal(f.sockets.length, 2);
  f.realtime.stop();
});

test('hidden/offline/bfcache pages close sockets and return with immediate catchup; stop removes recovery', async () => {
  const f = fixture(),
    first = f.sockets[0];
  first.message('ready');
  await f.advance(125);
  f.visible(true);
  assert.equal(first.closed, true);
  await f.advance(120000);
  assert.equal(f.sockets.length, 1);
  f.visible(false);
  assert.equal(f.sockets.length, 2);
  await f.advance(125);
  assert.equal(f.reads, 2);
  event(f.win, 'pagehide');
  await f.advance(120000);
  assert.equal(f.sockets.length, 2);
  event(f.win, 'pageshow');
  assert.equal(f.sockets.length, 3);
  f.nav.onLine = false;
  event(f.win, 'offline');
  await f.advance(120000);
  assert.equal(f.sockets.length, 3);
  f.nav.onLine = true;
  event(f.win, 'online');
  assert.equal(f.sockets.length, 4);
  f.realtime.stop();
  event(f.win, 'pageshow');
  f.visible(false);
  await f.advance(120000);
  assert.equal(f.sockets.length, 4);
});

test('initial offline state does not connect; handshake and heartbeat watchdogs recover', async () => {
  const f = fixture({ online: false });
  assert.equal(f.sockets.length, 0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.pauses, 1);
  f.nav.onLine = true;
  event(f.win, 'online');
  assert.equal(f.sockets.length, 1);
  await f.advance(15000);
  assert.equal(f.sockets[0].closed, true);
  await f.advance(2000);
  assert.equal(f.sockets.length, 2);
  const ws = f.sockets[1];
  ws.message('ready');
  await f.advance(125);
  await f.advance(60000);
  assert.deepEqual(ws.sent, ['{"type":"ping"}']);
  ws.message('pong');
  await f.advance(15000);
  assert.notEqual(ws.closed, true);
  await f.advance(45000);
  assert.equal(ws.sent.length, 2);
  await f.advance(15000);
  assert.equal(ws.closed, true);
  f.realtime.stop();
});

test('v2 opts in only for record callbacks, queues frames behind ready catchup and performs no hint read', async () => {
  let release;
  const gate = new Promise((done) => {
      release = done;
    }),
    changes = [],
    records = [];
  const f = fixture({
      onChange: async (type, data) => {
        changes.push([type, data]);
        await gate;
      },
      onRecords: async (frame) => records.push(frame),
    }),
    ws = f.sockets[0];
  assert.match(ws.url, /&v=2$/);
  ws.message({ type: 'ready', cycleId: 'opaque-cycle', cursor: 80 });
  const frame = {
    type: 'records',
    cycleId: 'opaque-cycle',
    fromCursor: 80,
    toCursor: 81,
    records: [],
  };
  ws.message(frame);
  await f.advance(125);
  assert.equal(changes.length, 1);
  assert.equal(changes[0][1].cursor, 80);
  assert.equal(records.length, 0);
  release();
  await flush();
  assert.deepEqual(records, [frame]);
  assert.equal(changes.length, 1);
  assert.equal(f.reads, 0);
  f.realtime.stop();
});

test('a rejected v2 frame restores one HTTP catchup and stop discards buffered frames', async () => {
  let frames = 0,
    reads = 0;
  const f = fixture({
      onChange: async () => {
        reads++;
      },
      onRecords: async () => {
        frames++;
        throw Error('invalid frame');
      },
    }),
    ws = f.sockets[0];
  ws.message({ type: 'ready', cursor: 1 });
  await f.advance(125);
  ws.message({ type: 'records', fromCursor: 1, toCursor: 2, records: [] });
  await flush();
  await f.advance(125);
  assert.equal(frames, 1);
  assert.equal(reads, 2);
  assert.ok(f.resumes > 0);
  f.realtime.stop();
  ws.message({ type: 'records' });
  await flush();
  assert.equal(frames, 1);
});
