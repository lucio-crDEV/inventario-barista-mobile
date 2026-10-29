import { offlineActive, listenOfflineIdentity, setOffline } from './offline-cache.js';
export { offlineActive } from './offline-cache.js';
export function startOffline() {
  listenOfflineIdentity();
  let banner;
  const render = () => {
    if (!document.body) return;
    if (offlineActive()) {
      if (!banner?.isConnected) {
        banner = document.createElement('p');
        banner.className = 'feedback-message';
        banner.dataset.tone = 'warning';
        banner.id = 'offline-state';
        banner.setAttribute('role', 'status');
        document.querySelector('main > header, main .app-header, .home-header')?.after(banner);
        if (!banner.isConnected) document.querySelector('main')?.prepend(banner);
      }
      banner.textContent =
        'Sin conexión · datos del último acceso. Tus borradores se conservan. Envíalos con conexión.';
      const label = document.querySelector('#sync-state');
      if (label && label.dataset.state !== 'error') {
        label.textContent = 'Sin conexión';
        label.dataset.state = 'pending';
      }
    } else banner?.remove();
  };
  window.addEventListener('inventory:offline', render);
  window.addEventListener('offline', () => {
    setOffline(true);
    render();
  });
  // Being online is only a hint. A successful API response removes the banner.
  window.addEventListener('DOMContentLoaded', render, { once: true });
  render();
  if (!('serviceWorker' in navigator)) return;
  const warm = () =>
    navigator.serviceWorker.controller?.postMessage({ type: 'INVENTORY_WARM_SHELL' });
  navigator.serviceWorker.addEventListener('controllerchange', warm);
  const register = () =>
    navigator.serviceWorker
      .register('/service-worker.js', { scope: '/', updateViaCache: 'none' })
      .then(() => navigator.serviceWorker.ready)
      .then(warm)
      .catch(() => {});
  // The visible screen wins the initial network budget; no full-site precache.
  const idle = () =>
    'requestIdleCallback' in window
      ? requestIdleCallback(register, { timeout: 2000 })
      : setTimeout(register, 0);
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle, { once: true });
}
