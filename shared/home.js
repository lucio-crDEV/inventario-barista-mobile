import { startRealtime } from './realtime.js';
import { startPolling } from './polling.js';
import { api, authenticated, identityBar, escapeHtml } from './client.js';
import { loading, reveal } from './loading.js';
import { homeURL } from './navigation.js';
const nav = document.querySelector('nav'),
  placeholder = document.querySelector('#home-loading');
const finishLoading = loading(placeholder);
try {
  const selectedInventory = new URLSearchParams(location.search).get('inventory');
  const navigationPath =
    '/api/navigation' +
    (selectedInventory ? '?cycle=' + encodeURIComponent(selectedInventory) : '');
  const data = await authenticated(navigationPath);
  const user = data.user;
  const destination = homeURL(data.scopes);
  if (destination !== '/') {
    const target = new URL(destination, location.origin);
    const selected = new URLSearchParams(location.search).get('inventory');
    if (selected) target.searchParams.set('inventory', selected);
    location.replace(target);
    await new Promise(() => {});
  }
  identityBar(user, undefined, data.scopes);
  for (const link of nav.querySelectorAll('a')) {
    const id = new URL(link.href).searchParams.get('area');
    if (!data.scopes.some((x) => x.id === id)) link.remove();
  }
  if (!data.scopes.length)
    nav.innerHTML = '<p>No tienes áreas asignadas. Contacta al administrador</p>';
  else if (data.cycleId === null) nav.innerHTML = '<p>No hay inventarios disponibles.</p>';
  finishLoading();
  placeholder.remove();
  nav.hidden = false;
  reveal(nav);
  // Permissions are rechecked on entering any area; refresh the home projection too.
  let revision = user.revision;
  const tick = async () => {
    if (document.hidden) return;
    try {
      const current = await api(data.realtime === true ? navigationPath : '/api/me'),
        u = current.user;
      if (
        u.id !== user.id ||
        u.revision !== revision ||
        (data.realtime === true && current.cycleId !== data.cycleId)
      )
        location.reload();
    } catch (e) {
      if (e.status === 401) location.replace('/pages/cuenta/');
      throw e;
    }
  };
  const polling = startPolling(tick);
  startRealtime({
    enabled: data.realtime,
    polling,
    onChange: async (type) => {
      await polling.refresh({ afterPending: true });
      if (type !== 'ready') location.reload();
    },
  });
} catch (e) {
  finishLoading();
  placeholder.remove();
  nav.hidden = false;
  nav.innerHTML = `<p class="error">${escapeHtml(e.message)}</p><button class="button button-primary" type="button">Reintentar conexión</button>`;
  nav.querySelector('button').onclick = () => location.reload();
  reveal(nav);
}
