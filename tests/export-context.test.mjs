import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';

// Minimal DOM port for async component lifecycle/command tests, not a layout or
// browser emulator. Real HTML escaping/rendering and production component run here.
class Element {
  constructor(kind = '') {
    this.kind = kind;
    this.nodes = new Map();
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.textContent = '';
  }
  set innerHTML(value) {
    this.markup = value;
    this.nodes.delete('[data-action]');
  }
  get innerHTML() {
    return this.markup || '';
  }
  querySelector(selector) {
    if (!this.nodes.has(selector)) {
      const node = new Element(selector);
      if (selector === '[data-action]') {
        const match = this.innerHTML.match(/data-action="([^"]+)"/);
        if (!match) return null;
        node.dataset.action = match[1];
      }
      this.nodes.set(selector, node);
    }
    return this.nodes.get(selector);
  }
  querySelectorAll(selector) {
    return selector === 'button'
      ? [...this.nodes.values()].filter((node) => node.dataset.action)
      : [];
  }
  setAttribute(name, value) {
    this.attributes[name] = value;
  }
  append(node) {
    this.children.push(node);
  }
  replaceChildren() {
    this.children = [];
    this.innerHTML = '';
  }
  contains() {
    return false;
  }
  addEventListener(name, handler) {
    this[name] = handler;
  }
  remove() {}
}
const bundle = await build({
  entryPoints: ['pages/admin/exports.js'],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  plugins: [
    {
      name: 'isolated-client-port',
      setup(b) {
        b.onResolve({ filter: /^\/shared\/client\.js$/ }, () => ({
          path: 'client',
          namespace: 'test-port',
        }));
        b.onLoad({ filter: /.*/, namespace: 'test-port' }, () => ({
          contents:
            'export const api=(...args)=>globalThis.port.api(...args); export const loginRedirect=()=>globalThis.port.redirect();',
        }));
        b.onResolve({ filter: /^\/shared\// }, (args) => ({ path: resolve('.' + args.path) }));
      },
    },
  ],
});
const cycle = {
  id: 'chosen-cycle',
  name: 'Selected inventory',
  period: '2026-10-29',
  lifecycle: 'active',
  state: 'closed',
  revision: 2,
  completion_revision: 3,
  scopeStates: [],
};
const user = { id: 'synthetic-admin', role: 'admin' };
const capture = {
  snapshotId: 'synthetic-snapshot-00000001',
  capturedAt: '2026-10-29T12:00:00Z',
  review: {
    ready: true,
    summary: { numeric: 1, blank: 1, partial: 0, roundedToZero: 0, blockers: 0 },
    blockers: [],
  },
};
function fixture(api) {
  const storage = new Map(),
    calls = [];
  const context = {
    module: { exports: {} },
    crypto,
    console,
    Intl,
    URL,
    AbortSignal,
    structuredClone,
    document: { hidden: false, createElement: () => new Element(), activeElement: null },
    sessionStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    setTimeout: () => 0,
    clearTimeout: () => {},
    port: {
      api: (...args) => {
        calls.push(args);
        return api(...args);
      },
      redirect: () => {
        throw Error('Unexpected identity change');
      },
    },
  };
  runInNewContext(bundle.outputFiles[0].text, context);
  const parent = new Element();
  const mount = (selected = cycle, actor = user) => {
    const dispose = context.module.exports.mountExports(parent, actor, structuredClone(selected));
    const section = parent.children.at(-1);
    return {
      dispose,
      section,
      form: section?.querySelector('form'),
      history: section?.querySelector('.export-history'),
    };
  };
  return { mount, calls, storage, parent };
}
const submit = (form) => form.onsubmit({ preventDefault() {} });

test('Export context is admin-only, global-finalization gated and history is scoped on demand', async () => {
  const f = fixture(async (path) => ({ snapshots: [], nextCursor: null }));
  f.mount(cycle, { ...user, role: 'service_lead' });
  assert.equal(f.parent.children.length, 0);
  assert.equal(f.calls.length, 0);
  const { form, history, section } = f.mount({ ...cycle, scopeStates: [{ state: 'review' }] });
  assert.equal(form.querySelector('button').disabled, true);
  assert.match(section.innerHTML, /Inventario global · todas las áreas/);
  await submit(form);
  assert.equal(f.calls.length, 0);
  await history.toggle({ target: { open: true } });
  assert.equal(f.calls[0][0], '/api/admin/exports?cycle=chosen-cycle');
  await history.toggle({ target: { open: true } });
  assert.equal(f.calls.length, 1, 'history loaded once');
});

test('Closing an uncertain export preserves the exact command for reopening the same selected cycle', async () => {
  let writes = 0;
  const f = fixture(async (path, body) => {
    if (body) {
      if (++writes === 1) throw Error('Synthetic network interruption');
      return { snapshotId: capture.snapshotId };
    }
    if (path.endsWith('/artifact')) return { state: 'ready' };
    if (path.startsWith('/api/admin/exports?')) return { snapshots: [] };
    return capture;
  });
  const first = f.mount();
  await submit(first.form);
  first.dispose();
  const retry = f.mount();
  await submit(retry.form);
  const commands = f.calls.filter(([, body]) => body).map(([, body]) => body);
  assert.deepEqual(commands[0], commands[1]);
  assert.equal(commands[0].cycleId, cycle.id);
  assert.equal(f.storage.size, 0);
  assert.equal(
    retry.section.querySelector('.export-review').querySelector('[data-action]').dataset.action,
    'download',
  );
});

test('Closing during capture ignores late presentation and preserves an idempotent retry', async () => {
  let accept;
  const f = fixture(
    () =>
      new Promise((resolve) => {
        accept = resolve;
      }),
  );
  const mounted = f.mount(),
    pending = submit(mounted.form);
  mounted.dispose();
  accept({ snapshotId: capture.snapshotId });
  await pending;
  assert.equal(f.calls.length, 1, 'late capture must not open/download/poll after close');
  assert.equal(f.storage.size, 1, 'pending operation remains recoverable');
});

test('Changed inventory refresh never silently switches export to another finalized cycle', async () => {
  const f = fixture(async (path, body) => {
    if (body) throw Object.assign(Error('Source changed'), { code: 'EXPORT_SOURCE_CHANGED' });
    assert.equal(path, '/api/cycles');
    return {
      cycles: [
        { ...cycle, state: 'open' },
        { ...cycle, id: 'another-finalized' },
      ],
    };
  });
  const { form } = f.mount();
  await submit(form);
  assert.equal(form.querySelector('button').disabled, true);
  assert.equal(f.storage.size, 0, 'known stale operation is cleared');
  assert.equal(f.calls[0][1].cycleId, cycle.id);
});
