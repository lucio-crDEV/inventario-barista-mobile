import { api, escapeHtml as esc, logout } from "/shared/client.js";
const content = document.querySelector("#account-content"),
  message = document.querySelector("#message");
const lock =
  '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="7" y="14" width="18" height="14" rx="4"/><path d="M11 14V9a5 5 0 0 1 10 0v5m-5 6v3"/></svg>';
function notify(text) {
  message.hidden = false;
  message.textContent = text;
  message.dataset.tone = "error";
  message.focus();
}
function passwordField(label, name, autocomplete) {
  return `<label>${label}<span class="password-field"><input name="${name}" type="password" autocomplete="${autocomplete}" required ${name === "currentPassword" || name === "password" ? "" : 'minlength="12"'}><button type="button" class="reveal-password" aria-label="Mostrar ${label.toLowerCase()}" aria-pressed="false">Ver</button></span></label>`;
}
let user,
  unavailable = false;
try {
  user = (await api("/api/me")).user;
} catch (e) {
  if (e.status !== 401) {
    unavailable = true;
    notify(
      e.status === 503
        ? e.message
        : "No pudimos conectar con el inventario. Revisa tu conexión e inténtalo de nuevo.",
    );
  }
}
if (unavailable) {
  content.innerHTML = `<section class="account-card"><div class="account-symbol">${lock}</div><h2>Inventario no disponible</h2><p>El acceso estará disponible cuando el administrador termine de habilitar el servicio.</p><button class="button button-primary" id="retry-service" type="button">Reintentar conexión</button></section>`;
  document.querySelector("#retry-service").onclick = () => location.reload();
} else {
  content.innerHTML = `<section class="account-card"><div class="account-symbol">${lock}</div><p class="eyebrow">${user ? esc(user.name) : "Acceso personal"}</p><h2>${user ? "Cambiar contraseña" : "Ingresar al inventario"}</h2><p class="view-intro">${user ? (user.mustChange ? "Para continuar, reemplaza tu contraseña temporal." : "Al cambiarla, se cerrarán tus sesiones en todos los dispositivos.") : "Usa tu cuenta para contar en las áreas que tienes asignadas."}</p><form>${user ? passwordField("Contraseña actual", "currentPassword", "current-password") + passwordField("Nueva contraseña", "newPassword", "new-password") + passwordField("Repetir nueva contraseña", "confirmPassword", "new-password") : '<label>Usuario<input name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required></label>' + passwordField("Contraseña", "password", "current-password")}<p class="field-hint">${user ? "Al menos 12 caracteres; máximo 72 bytes." : "¿Necesitas una cuenta o restablecer tu contraseña? Contacta al administrador."}</p><button class="button button-primary" type="submit">${user ? "Guardar contraseña" : "Ingresar"}</button></form>${user ? '<div class="account-footer"><button class="text-action" type="button" id="logout">Cerrar sesión</button>' + (!user.mustChange ? '<a href="/">Volver al inventario</a>' : "") + "</div>" : ""}</section>`;
  document
    .querySelector("#logout")
    ?.addEventListener("click", () => logout().catch((e) => notify(e.message)));
  for (const button of content.querySelectorAll(".reveal-password"))
    button.onclick = () => {
      const field = button.previousElementSibling,
        visible = field.type === "password";
      field.type = visible ? "text" : "password";
      button.textContent = visible ? "Ocultar" : "Ver";
      button.setAttribute("aria-pressed", String(visible));
    };
  content.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target,
      b = Object.fromEntries(new FormData(form));
    if (user && b.newPassword !== b.confirmPassword) {
      notify("Las contraseñas nuevas no coinciden.");
      return;
    }
    delete b.confirmPassword;
    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    message.hidden = true;
    try {
      const result = await api(user ? "/api/password" : "/api/login", b);
      if (user) {
        sessionStorage.removeItem("inventory-user");
        location.replace("/pages/cuenta/");
      } else {
        sessionStorage.setItem("inventory-user", result.user.id);
        location.replace(result.user.mustChange ? "/pages/cuenta/" : "/");
      }
    } catch (err) {
      notify(err.message || "No se pudo conectar. Inténtalo de nuevo.");
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  };
}
