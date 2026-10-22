import { api, authenticated, identityBar, escapeHtml } from "./client.js";
import { loading, reveal } from "./loading.js";
import { homeURL } from "./navigation.js";
const nav = document.querySelector("nav"),
  placeholder = document.querySelector("#home-loading");
const finishLoading = loading(placeholder);
try {
  const data = await authenticated("/api/navigation");
  const user = data.user;
  const destination = homeURL(data.scopes);
  if (destination !== "/") {
    location.replace(destination);
    await new Promise(() => {});
  }
  identityBar(user);
  for (const link of nav.querySelectorAll("a")) {
    const id = new URL(link.href).searchParams.get("area");
    if (!data.scopes.some((x) => x.id === id)) link.remove();
  }
  if (!data.scopes.length)
    nav.innerHTML =
      "<p>No tienes áreas asignadas. Contacta al administrador</p>";
  finishLoading();
  placeholder.remove();
  nav.hidden = false;
  reveal(nav);
  // Permissions are rechecked on entering any area; refresh the home projection too.
  let revision = user.revision;
  const tick = async () => {
    if (document.hidden) return;
    try {
      const { user: u } = await api("/api/me");
      if (u.revision !== revision) location.reload();
    } catch (e) {
      if (e.status === 401) location.replace("/pages/cuenta/");
    }
  };
  setInterval(tick, 5000);
  document.addEventListener("visibilitychange", tick);
} catch (e) {
  finishLoading();
  placeholder.remove();
  nav.hidden = false;
  nav.innerHTML = `<p class="error">${escapeHtml(e.message)}</p><button class="button button-primary" type="button">Reintentar conexión</button>`;
  nav.querySelector("button").onclick = () => location.reload();
  reveal(nav);
}
