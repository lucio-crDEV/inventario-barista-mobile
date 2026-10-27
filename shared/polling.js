// Polls, manual triggers and realtime hints share one read. Only failures back off.
export function startPolling(task, { interval = 5000, document: doc = document, window: win = window,
  now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let timer, pending, failures = 0, retryAt = 0, suspended = false, stopped = false, paused = false;
  function schedule(delay = interval) {
    clearTimer(timer);
    if (!stopped && !paused && !suspended && !doc.hidden) timer = setTimer(tick, delay);
  }
  function read(force = false) {
    clearTimer(timer);
    if (stopped || suspended || doc.hidden || paused && !force) return Promise.resolve();
    if (pending) return pending;
    if (now() < retryAt) { schedule(retryAt - now()); return Promise.reject(Object.assign(Error('Espera antes de volver a sincronizar.'), { retryAfter: (retryAt-now())/1000 })); }
    const started = now();
    pending = Promise.resolve().then(task);
    const settled = () => { pending = null; schedule(Math.max(0, retryAt - now(), interval - (now() - started))); };
    pending.then(() => { failures = 0; retryAt = 0; settled(); }, error => {
      failures = Math.min(6, failures + 1);
      retryAt = now() + Math.max(Number(error?.retryAfter) || 0, Math.min(60, 2 ** failures)) * 1000;
      settled();
    });
    return pending;
  }
  function tick() { return read().catch(() => {}); }
  const visible = () => { if (doc.hidden) clearTimer(timer); else tick(); };
  const hide = () => { suspended = true; clearTimer(timer); };
  const show = () => { suspended = false; tick(); };
  doc.addEventListener('visibilitychange', visible);
  win.addEventListener('pagehide', hide);
  win.addEventListener('pageshow', show);
  tick.refresh = async ({ afterPending = false } = {}) => {
    // A hint may arrive after an existing request took its snapshot. Finish it
    // before fetching again, so sharing that older response cannot lose a hint.
    if (afterPending && pending) await pending;
    return read(true);
  };
  tick.pause = () => { paused = true; clearTimer(timer); };
  tick.resume = ({ immediate = false } = {}) => { paused = false; if (immediate) tick(); else schedule(Math.max(interval, retryAt-now())); };
  tick.stop = () => {
    stopped = true; clearTimer(timer);
    doc.removeEventListener('visibilitychange', visible);
    win.removeEventListener('pagehide', hide);
    win.removeEventListener('pageshow', show);
  };
  schedule();
  return tick;
}
