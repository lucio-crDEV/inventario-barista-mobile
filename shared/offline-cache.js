// Private snapshots live outside the service worker. Only the last authorized
// cycle/area is retained, with the server session's actual expiry (at most 12h).
const markerKey = 'inventory-offline-session-v1';
const generationKey = 'inventory-offline-generation-v1';
const logoutKey = 'inventory-offline-logout-v1';
const database = 'inventory-offline-v1';
const maxBytes = 2 * 1024 * 1024;
const fits = (row) => new TextEncoder().encode(JSON.stringify(row)).byteLength <= maxBytes;
const routes = new Set(['/api/me', '/api/navigation', '/api/bootstrap', '/api/cycles']);
const supported = () => typeof window !== 'undefined' && !!globalThis.indexedDB;
let databasePromise,
  serial = Promise.resolve();
let offline = false;
const readMarker = () => {
  try {
    return JSON.parse(localStorage.getItem(markerKey) || 'null');
  } catch {
    return null;
  }
};
const notify = () =>
  window.dispatchEvent(new CustomEvent('inventory:offline', { detail: { offline } }));
export const offlineActive = () => offline || globalThis.navigator?.onLine === false;
export function setOffline(value) {
  if (!supported()) return;
  if (offline !== value) {
    offline = value;
    notify();
  }
}
export function offlineMessage(path) {
  return path === '/api/login'
    ? 'Necesitas conexión para iniciar sesión.'
    : path.startsWith('/api/admin/export')
      ? 'Necesitas conexión para revisar, generar o descargar Excel.'
      : path.startsWith('/api/admin/')
        ? 'Necesitas conexión para gestionar usuarios o inventarios.'
        : path === '/api/count'
          ? 'Sin conexión. Borrador conservado; reintenta el envío al volver la conexión.'
          : 'Sin conexión. Esta acción necesita conexión; tus cambios no se enviaron.';
}
export const offlineError = (path) =>
  Object.assign(Error(offlineMessage(path)), { code: 'OFFLINE_UNAVAILABLE' });
function open() {
  if (!databasePromise)
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(database, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('snapshots');
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => {
        databasePromise = undefined;
        reject(request.error);
      };
    });
  return databasePromise;
}
async function transaction(mode, run) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('snapshots', mode),
      store = tx.objectStore('snapshots');
    let result;
    run(store, (value) => {
      result = value;
    });
    tx.oncomplete = () => resolve(result);
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}
const enqueue = (task) => {
  const next = serial.then(task);
  serial = next.catch(() => {});
  return next;
};
export function offlineContext() {
  if (!supported()) return '';
  try {
    let generation = localStorage.getItem(generationKey);
    if (!generation) {
      generation = crypto.randomUUID();
      localStorage.setItem(generationKey, generation);
    }
    return generation;
  } catch {
    return '';
  }
}
export function offlineLogoutPending() {
  try {
    return supported() && !!localStorage.getItem(logoutKey);
  } catch {
    return false;
  }
}
export async function clearOfflineIdentity({ logout = false } = {}) {
  if (!supported()) return;
  // Invalidate synchronously before waiting for IndexedDB, including in-flight reads.
  try {
    localStorage.setItem(generationKey, crypto.randomUUID());
    localStorage.removeItem(markerKey);
    if (logout) localStorage.setItem(logoutKey, '1');
  } catch {}
  try {
    sessionStorage.removeItem('inventory-user');
  } catch {}
  navigator.serviceWorker?.controller?.postMessage({ type: 'INVENTORY_IDENTITY_CLEARED' });
  await enqueue(() => transaction('readwrite', (store) => store.clear())).catch(() => {});
}
export function logoutAcknowledged() {
  try {
    localStorage.removeItem(logoutKey);
  } catch {}
}
function changed() {
  return Object.assign(Error('La sesión cambió. Inicia sesión de nuevo.'), {
    status: 401,
    code: 'IDENTITY_CHANGED',
  });
}
function live(marker) {
  return marker && marker.expires > Date.now() && !offlineLogoutPending();
}
export async function cacheOfflineResponse(path, data, headers, context) {
  if (!supported()) return;
  const url = new URL(path, location.origin),
    user = data.user;
  if (context && offlineContext() !== context) throw changed();
  if (url.pathname === '/api/login') logoutAcknowledged();
  if (user?.mustChange) {
    await clearOfflineIdentity();
    return;
  }
  if (!user?.id) return;
  const expires = Math.min(
    Number(headers.get('X-Inventory-Session-Expires')) * 1000,
    Date.now() + 43200000,
  );
  if (!Number.isFinite(expires) || expires <= Date.now()) return;
  let marker = readMarker();
  if (marker && (marker.userId !== user.id || marker.revision !== user.revision)) {
    await clearOfflineIdentity();
    marker = null;
  }
  if (!marker) {
    const generation = offlineContext();
    if (!generation) return;
    marker = { userId: user.id, revision: user.revision, expires, epoch: generation };
    try {
      localStorage.setItem(markerKey, JSON.stringify(marker));
    } catch {
      return;
    }
    window.dispatchEvent(new Event('inventory:offline-session'));
  }
  const epoch = marker.epoch;
  try {
    sessionStorage.setItem('inventory-user', user.id);
  } catch {}
  if (!routes.has(url.pathname) && url.pathname !== '/api/sync') return;
  await enqueue(async () => {
    if (readMarker()?.epoch !== epoch) return;
    await transaction('readwrite', (store) => {
      store.put({ epoch, expires, data: { user } }, '/api/me');
      if (url.pathname === '/api/sync') {
        const request = store.get('/api/bootstrap');
        request.onsuccess = () => {
          const row = request.result;
          if (
            !row ||
            row.epoch !== epoch ||
            row.cycle !== url.searchParams.get('cycle') ||
            row.data.cycle?.revision !== data.cycleRevision
          )
            return;
          for (const count of data.changes || []) {
            if (
              !row.data.items.some(
                (item) => item.id === count.itemId && item.locationId === count.locationId,
              )
            )
              continue;
            const i = row.data.counts.findIndex(
              (old) => old.itemId === count.itemId && old.locationId === count.locationId,
            );
            if (i < 0) row.data.counts.push(count);
            else if (count.version > row.data.counts[i].version) row.data.counts[i] = count;
          }
          row.data.cursor = Math.max(row.data.cursor || 0, data.cursor);
          if (fits(row)) store.put(row, '/api/bootstrap');
        };
        return;
      }
      let projection = data;
      const cycle = data.cycle?.id || data.cycleId || '';
      if (url.pathname === '/api/bootstrap' && (!cycle || !url.searchParams.get('area'))) return;
      if (url.pathname === '/api/cycles') {
        const selected =
          new URLSearchParams(location.search).get('inventory') || data.defaultCycleId;
        projection = {
          user,
          cycles: data.cycles.filter((c) => c.id === selected),
          defaultCycleId: selected,
        };
      }
      const row = {
        epoch,
        expires,
        cycle,
        area: url.searchParams.get('area') || '',
        data: projection,
      };
      if (!fits(row)) {
        store.delete(url.pathname);
        return;
      }
      store.put(row, url.pathname);
      if (url.pathname === '/api/bootstrap') {
        store.put(
          {
            epoch,
            expires,
            cycle,
            data: { user, scopes: data.scopes, cycleId: cycle, realtime: false },
          },
          '/api/navigation',
        );
        // This is the only catalog snapshot. A cycle selector offline contains
        // just that cycle, rather than inviting access to uncached inventories.
        store.put(
          { epoch, expires, data: { user, cycles: [data.cycle], defaultCycleId: cycle } },
          '/api/cycles',
        );
      }
    });
  }).catch(() => {}); // Storage/quota failure must never fail an accepted request.
}
export async function readOfflineResponse(path, context) {
  if (!supported()) return null;
  const marker = readMarker();
  if (!live(marker)) {
    if (marker) await clearOfflineIdentity();
    return null;
  }
  if (context && marker.epoch !== context) return null;
  const tabIdentity = sessionStorage.getItem('inventory-user');
  if (tabIdentity && tabIdentity !== marker.userId) return null;
  const url = new URL(path, location.origin);
  if (
    !routes.has(url.pathname) ||
    [...url.searchParams.keys()].some((k) => !['cycle', 'area'].includes(k))
  )
    return null;
  const row = await enqueue(() =>
    transaction('readonly', (store, result) => {
      const request = store.get(url.pathname);
      request.onsuccess = () => result(request.result);
    }),
  ).catch(() => null);
  if (
    !row ||
    row.epoch !== marker.epoch ||
    readMarker()?.epoch !== marker.epoch ||
    row.expires <= Date.now()
  )
    return null;
  if (url.searchParams.get('cycle') && row.cycle !== url.searchParams.get('cycle')) return null;
  if (url.pathname === '/api/bootstrap' && row.area !== (url.searchParams.get('area') || ''))
    return null;
  sessionStorage.setItem('inventory-user', marker.userId);
  setOffline(true);
  return { ...structuredClone(row.data), realtime: false };
}
export async function cacheAcceptedCount(body, data, context) {
  if (!supported() || !data.record) return;
  const epoch = context;
  await enqueue(() =>
    transaction('readwrite', (store) => {
      const request = store.get('/api/bootstrap');
      request.onsuccess = () => {
        const row = request.result;
        if (
          !row ||
          row.epoch !== epoch ||
          readMarker()?.epoch !== epoch ||
          row.cycle !== body.cycleId
        )
          return;
        const count = data.record;
        if (
          !row.data.items.some(
            (item) => item.id === count.itemId && item.locationId === count.locationId,
          )
        )
          return;
        const index = row.data.counts.findIndex(
          (old) => old.itemId === count.itemId && old.locationId === count.locationId,
        );
        if (index < 0) row.data.counts.push(count);
        else if (count.version > row.data.counts[index].version) row.data.counts[index] = count;
        if (fits(row)) store.put(row, '/api/bootstrap');
      };
    }),
  ).catch(() => {});
}
// Push frames can update only an existing authorized snapshot; they never
// establish identity, extend a session or add a catalog/area to the cache.
export async function cacheRealtimeRecords({
  cycleId,
  records,
  cursor,
  userId,
  revision,
  context = offlineContext(),
}) {
  if (!supported()) return;
  const current = () => {
    const marker = readMarker();
    return (
      marker?.epoch === context &&
      marker.userId === userId &&
      marker.revision === revision &&
      live(marker)
    );
  };
  if (!current()) return;
  await enqueue(() =>
    transaction('readwrite', (store) => {
      const request = store.get('/api/bootstrap');
      request.onsuccess = () => {
        const row = request.result;
        if (!current() || !row || row.epoch !== context || row.cycle !== cycleId) return;
        for (const count of records) {
          if (
            !row.data.items.some(
              (item) => item.id === count.itemId && item.locationId === count.locationId,
            )
          )
            continue;
          const index = row.data.counts.findIndex(
            (old) => old.itemId === count.itemId && old.locationId === count.locationId,
          );
          if (index < 0) row.data.counts.push(count);
          else if (count.version > row.data.counts[index].version) row.data.counts[index] = count;
        }
        if (Number.isSafeInteger(cursor)) row.data.cursor = Math.max(row.data.cursor || 0, cursor);
        if (fits(row)) store.put(row, '/api/bootstrap');
      };
    }),
  ).catch(() => {});
}
export function listenOfflineIdentity() {
  if (!supported()) return;
  let timer;
  const checkExpiry = () => {
    clearTimeout(timer);
    const marker = readMarker();
    if (!marker) return;
    const remaining = marker.expires - Date.now();
    if (remaining <= 0) {
      void clearOfflineIdentity().then(() => location.replace('/pages/cuenta/'));
    } else timer = setTimeout(checkExpiry, Math.min(remaining, 2147483647));
  };
  window.addEventListener('inventory:offline-session', checkExpiry);
  document.addEventListener('visibilitychange', checkExpiry);
  window.addEventListener('pageshow', checkExpiry);
  checkExpiry();
  window.addEventListener('storage', (event) => {
    if (event.key !== markerKey) return;
    checkExpiry();
    const before = (() => {
      try {
        return JSON.parse(event.oldValue || 'null');
      } catch {
        return null;
      }
    })();
    const after = readMarker();
    if (before?.epoch && before.epoch !== after?.epoch) {
      sessionStorage.removeItem('inventory-user');
      location.replace('/pages/cuenta/');
    }
  });
}
