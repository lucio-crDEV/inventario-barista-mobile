// Notifications carry no records. Every hint uses the normal authorized read path.
export function startRealtime({
  enabled = false,
  cycleId = '',
  polling,
  onChange = () => polling.refresh({ afterPending: true }),
  onAuth = () => location.reload(),
  document: doc = document,
  window: win = window,
  WebSocket: Socket = globalThis.WebSocket,
  navigator: nav = win.navigator,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  if (enabled !== true || !Socket) return { stop() {} };
  let socket,
    ready = false,
    stopped = false,
    suspended = false,
    reconnectTimer,
    changeTimer,
    heartbeatTimer,
    watchdog;
  let failures = 0,
    readFailures = 0,
    pending,
    dirty = false,
    hint = 'ready';
  const active = () => !stopped && !suspended && !doc.hidden && nav?.onLine !== false;
  function clear() {
    for (const timer of [reconnectTimer, changeTimer, heartbeatTimer, watchdog]) clearTimer(timer);
    reconnectTimer = changeTimer = heartbeatTimer = watchdog = undefined;
  }
  function disconnect() {
    clear();
    ready = false;
    const current = socket;
    socket = undefined;
    current?.close();
    polling.resume();
  }
  function retry() {
    if (!active() || reconnectTimer) return;
    failures = Math.min(6, failures + 1);
    reconnectTimer = setTimer(
      () => {
        reconnectTimer = undefined;
        connect();
      },
      Math.min(60000, 1000 * 2 ** failures),
    );
  }
  function heartbeat() {
    clearTimer(heartbeatTimer);
    clearTimer(watchdog);
    if (!ready || !active()) return;
    heartbeatTimer = setTimer(() => {
      if (!ready || !socket) return;
      try {
        socket.send(JSON.stringify({ type: 'ping' }));
      } catch {
        disconnect();
        retry();
        return;
      }
      watchdog = setTimer(() => {
        disconnect();
        retry();
      }, 15000);
    }, 60000);
  }
  function notify(type = 'changed') {
    if (!active()) return;
    dirty = true;
    if (type !== 'ready' || hint === 'ready') hint = type;
    if (pending || changeTimer) return;
    changeTimer = setTimer(read, 125);
  }
  function read() {
    changeTimer = undefined;
    if (!active() || pending || !dirty) return;
    const type = hint;
    dirty = false;
    hint = 'ready';
    pending = Promise.resolve().then(() => onChange(type));
    pending
      .then(
        () => {
          readFailures = 0;
          if (ready) polling.pause();
        },
        () => {
          dirty = true;
          readFailures = Math.min(5, readFailures + 1);
          polling.resume();
        },
      )
      .finally(() => {
        pending = undefined;
        if (dirty && active())
          changeTimer = setTimer(
            read,
            readFailures ? Math.min(30000, 1000 * 2 ** readFailures) : 125,
          );
      });
  }
  function connect() {
    if (!active() || socket) return;
    const url = new URL('/api/realtime', win.location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    if (cycleId) url.searchParams.set('cycle', cycleId);
    let current;
    try {
      current = new Socket(url.href);
      socket = current;
    } catch {
      polling.resume();
      retry();
      return;
    }
    watchdog = setTimer(() => {
      if (!ready && socket === current) {
        disconnect();
        retry();
      }
    }, 15000);
    current.addEventListener('message', (event) => {
      if (socket !== current || !active()) return;
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.type === 'ready') {
        ready = true;
        failures = 0;
        polling.pause();
        heartbeat();
        notify('ready');
      } else if (message.type === 'pong') heartbeat();
      else if (ready && ['changed', 'refresh'].includes(message.type)) notify(message.type);
    });
    current.addEventListener('close', (event) => {
      if (socket !== current) return;
      socket = undefined;
      ready = false;
      clear();
      if (event.code === 4001) {
        stopped = true;
        polling.pause();
        onAuth();
        return;
      }
      polling.resume({ immediate: active() });
      retry();
    });
    current.addEventListener('error', () => {
      if (socket === current) {
        disconnect();
        retry();
      }
    });
  }
  const visible = () => {
    if (!active()) {
      disconnect();
      if (nav?.onLine === false) polling.pause();
    } else {
      notify('ready');
      connect();
    }
  };
  const hide = () => {
    suspended = true;
    disconnect();
  };
  const show = () => {
    suspended = false;
    visible();
  };
  doc.addEventListener('visibilitychange', visible);
  win.addEventListener('offline', visible);
  win.addEventListener('online', visible);
  win.addEventListener('pagehide', hide);
  win.addEventListener('pageshow', show);
  if (nav?.onLine === false) polling.pause();
  else connect();
  return {
    stop() {
      stopped = true;
      disconnect();
      doc.removeEventListener('visibilitychange', visible);
      win.removeEventListener('offline', visible);
      win.removeEventListener('online', visible);
      win.removeEventListener('pagehide', hide);
      win.removeEventListener('pageshow', show);
    },
  };
}
