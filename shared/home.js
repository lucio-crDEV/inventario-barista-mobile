import { api, requireUser, identityBar, escapeHtml } from "./client.js";
const nav = document.querySelector("nav");
try {
  const user = await requireUser();
  identityBar(user);
  const data = await api("/api/bootstrap");
  for (const link of nav.querySelectorAll("a")) {
    const id = new URL(link.href).searchParams.get("area");
    if (!data.scopes.some((x) => x.id === id)) link.remove();
  }
  if (!data.items.length)
    nav.innerHTML =
      "<p>No tienes áreas asignadas. Contacta al administrador</p>";
  nav.hidden = false;
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
  nav.hidden = false;
  nav.innerHTML = `<p class="error">${escapeHtml(e.message)}. No se ha activado ningún modo local.</p>`;
}
