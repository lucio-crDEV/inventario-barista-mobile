// Only concurrent reads are shared. Responses never survive settlement or identity changes.
export function createAPI({
  fetch: fetcher = globalThis.fetch,
  identity = () => sessionStorage.getItem('inventory-user') || '',
} = {}) {
  const reads = new Map();
  let epoch = 0;
  async function request(path, body) {
    const r = await fetcher(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
      ...(body === undefined
        ? {}
        : {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(path === '/api/count' || path === '/api/profile' || path.startsWith('/api/admin/')
                ? {
                    'X-Inventory-User': identity(),
                  }
                : {}),
            },
            body: JSON.stringify(body),
          }),
    });
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
