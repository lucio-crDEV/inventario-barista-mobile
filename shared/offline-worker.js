// Build replaces this single literal with the content-hashed public allowlist.
const manifest = __INVENTORY_OFFLINE_MANIFEST__;
const cacheName = 'inventory-shell-' + manifest.version;
const publicFiles = new Set([...manifest.assets, ...Object.values(manifest.shells)]);
const shellFor = (pathname) =>
  manifest.shells[
    pathname === '/index.html'
      ? '/'
      : pathname
          .replace(/\/index\.html$/, '/')
          .replace(/^\/pages\/(inventario|cuenta|admin)$/, '/pages/$1/')
          .replace(/^\/pages\/admin\/supervision$/, '/pages/admin/supervision.html')
  ];
self.addEventListener('install', (event) => {
  // Never force activation over an open count: an update waits until old tabs
  // close, preserving fields, drafts and uncertain commands without a reload.
  event.waitUntil(caches.open(cacheName));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith('inventory-shell-') && name !== cacheName) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});
async function cachePublic(path) {
  if (!publicFiles.has(path)) return;
  let cache;
  try {
    cache = await caches.open(cacheName);
    const cached = await cache.match(path);
    if (cached) return cached;
  } catch {
    /* Storage unavailable: a successful network read still works. */
  }
  const response = await fetch(path, { credentials: 'omit', cache: 'no-cache' });
  if (!response.ok || response.redirected) throw Error('Public shell unavailable');
  try {
    await cache?.put(path, response.clone());
  } catch {
    /* Quota: remain online without caching this asset. */
  }
  return response;
}
self.addEventListener('message', (event) => {
  if (event.data?.type === 'INVENTORY_IDENTITY_CLEARED') {
    // No private content is stored here. The page owns IndexedDB and sends this
    // notification on logout/account changes; API responses never enter Cache.
    event.source?.postMessage({ type: 'INVENTORY_IDENTITY_CLEARED' });
  }
  if (event.data?.type !== 'INVENTORY_WARM_SHELL') return;
  const clientURL = event.source?.url && new URL(event.source.url);
  const shell = clientURL?.origin === self.location.origin && shellFor(clientURL.pathname);
  if (!shell) return;
  event.waitUntil(
    (async () => {
      const response = await cachePublic(shell);
      const html = await response.text();
      // HTML contains the entry and its modulepreload dependencies. Warm only
      // this visited page, leaving other screens and optional chunks lazy.
      const paths = [...html.matchAll(/(?:src|href)=["'](\/assets\/[\w.-]+\.(?:js|css))["']/g)].map(
        (match) => match[1],
      );
      await Promise.all([...new Set(paths)].map((path) => cachePublic(path)));
    })().catch(() => {}),
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // API, private downloads, login POST and all non-manifest URLs bypass SW.
  if (publicFiles.has(url.pathname) && !url.search) {
    event.respondWith(cachePublic(url.pathname));
    return;
  }
  const shell = request.mode === 'navigate' && shellFor(url.pathname);
  if (!shell) return;
  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch {
        const cached = await (await caches.open(cacheName)).match(shell);
        return (
          cached ||
          new Response('Sin conexión. Abre esta pantalla una vez con conexión para conservarla.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        );
      }
    })(),
  );
});
