import { api, escapeHtml, logout } from "/shared/client.js";
const content = document.querySelector("#account-content"),
  message = document.querySelector("#message");
let user;
try {
  user = (await api("/api/me")).user;
} catch (e) {
  if (e.status !== 401) message.textContent = e.message;
}
if (user) {
  content.innerHTML = `<p>${escapeHtml(user.name)}</p><h2>Cambiar contraseña</h2><p>${user.mustChange ? "Debes cambiar tu contraseña temporal antes de acceder." : "Al cambiarla se cerrarán tus sesiones en todos los dispositivos."}</p><form><label>Contraseña actual<input name="currentPassword" type="password" autocomplete="current-password" required></label><label>Nueva contraseña<input name="newPassword" type="password" autocomplete="new-password" minlength="12" required></label><p>Al menos 12 caracteres, máximo 72 bytes.</p><button>Guardar contraseña</button></form><button id="logout">Cerrar sesión</button>${!user.mustChange ? '<a href="/">Volver al inventario</a>' : ""}`;
  document.querySelector("#logout").onclick = logout;
} else
  content.innerHTML =
    '<h2>Ingresar</h2><form><label>Usuario<input name="username" autocomplete="username" autocapitalize="none" required></label><label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label><button>Ingresar</button></form><p>Acceso personal. Si necesitas una cuenta o restablecer tu contraseña, contacta al administrador.</p>';
content.querySelector("form").onsubmit = async (e) => {
  e.preventDefault();
  const button = e.target.querySelector("button");
  button.disabled = true;
  message.textContent = "";
  try {
    const b = Object.fromEntries(new FormData(e.target));
    const result = await api(user ? "/api/password" : "/api/login", b);
    if (user) {
      location.replace("/pages/cuenta/");
    } else location.replace(result.user.mustChange ? "/pages/cuenta/" : "/");
  } catch (err) {
    message.textContent = err.message;
    button.disabled = false;
  }
};
