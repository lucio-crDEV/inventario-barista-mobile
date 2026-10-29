import {
  offlineContext,
  offlineLogoutPending,
  logoutAcknowledged,
  clearOfflineIdentity,
  cacheOfflineResponse,
  cacheAcceptedCount,
  readOfflineResponse,
  setOffline,
  offlineError,
} from './offline-cache.js';
// Only concurrent reads are shared. A separate bounded, identity-scoped snapshot
// supports network failures; HTTP errors always remain server-authoritative.
export function createAPI({
  fetch: fetcher = globalThis.fetch,
  identity = () => sessionStorage.getItem('inventory-user') || '',
} = {}) {
  const reads = new Map();
  let epoch = 0;
  async function request(path, body) {
    const isWrite = body !== undefined;
    if (path === '/api/login' || path === '/api/logout')
      await clearOfflineIdentity({ logout: true });
    const context = offlineContext();
    // A local logout made without a network must revoke its cookie before any
    // subsequent authenticated read, even after all browser tabs were closed.
    if (offlineLogoutPending() && !['/api/login', '/api/logout'].includes(path)) {
      if (globalThis.navigator?.onLine === false) throw offlineError(path);
      let revoked;
      try {
        revoked = await fetcher('/api/logout', {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
          signal: AbortSignal.timeout(15000),
        });
      } catch {
        setOffline(true);
        throw offlineError(path);
      }
      if (!revoked.ok && revoked.status !== 401)
        throw Object.assign(
          Error('No se pudo completar el cierre de sesión. Reintenta con conexión.'),
          { status: revoked.status },
        );
      logoutAcknowledged();
    }
    if (isWrite && globalThis.navigator?.onLine === false) {
      setOffline(true);
      throw offlineError(path);
    }
    let r;
    try {
      r = await fetcher(path, {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
        ...(body === undefined
          ? {}
          : {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(path === '/api/count' ||
                path === '/api/profile' ||
                path.startsWith('/api/admin/')
                  ? {
                      'X-Inventory-User': identity(),
                    }
                  : {}),
              },
              body: JSON.stringify(body),
            }),
      });
    } catch (error) {
      setOffline(true);
      if (!isWrite) {
        const snapshot = await readOfflineResponse(path, context);
        if (snapshot) return snapshot;
      }
      throw isWrite || path.startsWith('/api/admin/')
        ? offlineError(path)
        : Object.assign(
            Error('Sin conexión. Este inventario aún no está disponible en este dispositivo.'),
            { code: 'OFFLINE_UNAVAILABLE', cause: error },
          );
    }
    setOffline(false);
    if ([401, 403].includes(r.status)) await clearOfflineIdentity();
    if (!r.headers.get('content-type')?.includes('application/json'))
      throw Object.assign(
        Error('El servicio de inventario no está disponible. Contacta al administrador.'),
        { status: 503, code: 'API_UNAVAILABLE' },
      );
    let data;
    try {
      data = await r.json();
    } catch {
      throw Object.assign(Error('No se pudo leer la respuesta del servicio. Inténtalo de nuevo.'), {
        status: 503,
        code: 'INVALID_RESPONSE',
      });
    }
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw Object.assign(Error('El servicio de inventario no está disponible.'), {
        status: 503,
        code: 'INVALID_RESPONSE',
      });
    if (!r.ok)
      throw Object.assign(Error(data.message || data.code), data, {
        status: r.status,
        retryAfter: Math.min(900, Math.max(0, Number(r.headers.get('Retry-After')) || 0)),
      });
    if (path === '/api/logout' || (path === '/api/password' && data.loginRequired)) {
      await clearOfflineIdentity();
      logoutAcknowledged();
    } else {
      await cacheOfflineResponse(path, data, r.headers, context);
      if (path === '/api/count' && isWrite) await cacheAcceptedCount(body, data, context);
    }
    return data;
  }
  return function api(path, body) {
    if (body !== undefined) {
      epoch++;
      reads.clear();
      return request(path, body);
    }
    const key = JSON.stringify([epoch, identity(), path]);
    let pending = reads.get(key);
    if (!pending) {
      pending = request(path, body).finally(() => {
        if (reads.get(key) === pending) reads.delete(key);
      });
      reads.set(key, pending);
    }
    // Callers may mutate their own projection, never another caller's result.
    return pending.then((data) => structuredClone(data));
  };
}
