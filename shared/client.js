import { settingsAccount } from "./settings.js";
export const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export async function api(path, body) {
  const r = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(path === "/api/count"
              ? {
                  "X-Inventory-User":
                    sessionStorage.getItem("inventory-user") || "",
                }
              : {}),
          },
          body: JSON.stringify(body),
        }),
  });
  if (!r.headers.get("content-type")?.includes("application/json"))
    throw Object.assign(
      Error(
        "El servicio de inventario no está disponible. Contacta al administrador.",
      ),
      { status: 503, code: "API_UNAVAILABLE" },
    );
  let data;
  try {
    data = await r.json();
  } catch {
    throw Object.assign(
      Error("No se pudo leer la respuesta del servicio. Inténtalo de nuevo."),
      { status: 503, code: "INVALID_RESPONSE" },
    );
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw Object.assign(
      Error("El servicio de inventario no está disponible."),
      { status: 503, code: "INVALID_RESPONSE" },
    );
  if (!r.ok)
    throw Object.assign(Error(data.message || data.code), data, {
      status: r.status,
    });
  return data;
}
export function loginRedirect() {
  location.replace("/pages/cuenta/");
}
// Inventory/admin responses already include the authenticated identity.
export async function authenticated(path) {
  try {
    return await api(path);
  } catch (e) {
    if (e.status === 401 || e.code === "PASSWORD_CHANGE_REQUIRED") {
      loginRedirect();
      return await new Promise(() => {});
    }
    throw e;
  }
}
export async function requireUser() {
  try {
    const { user } = await api("/api/me");
    if (user.mustChange && !location.pathname.startsWith("/pages/cuenta")) {
      loginRedirect();
      return await new Promise(() => {});
    }
    return user;
  } catch (e) {
    if (e.status === 401) {
      loginRedirect();
      return await new Promise(() => {});
    }
    throw e;
  }
}
export async function logout() {
  await api("/api/logout", {});
  localStorage.setItem("inventory-logout-event", crypto.randomUUID());
  sessionStorage.removeItem("inventory-user");
  loginRedirect();
}
window.addEventListener("storage", (e) => {
  if (e.key === "inventory-logout-event") loginRedirect();
});
export function identityBar(user, refresh) {
  const bar = document.createElement("section");
  bar.className = "identity-bar";
  bar.setAttribute("aria-label", "Cuenta y sincronización");
  bar.innerHTML = `<div class="identity-person"><span class="identity-avatar" aria-hidden="true">${escapeHtml(user.name.slice(0, 1).toUpperCase())}</span><span><strong>${escapeHtml(user.name)}</strong><small>${user.role === "admin" ? "Administrador" : "Trabajador"} · Compartido</small></span></div><div class="sync-controls"><button class="sync-refresh" type="button" aria-label="Actualizar sincronización" title="Actualizar sincronización"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 17.9 17"/></svg></button><span id="sync-state" role="status" data-state="synced">Sincronizado</span></div><div class="settings-actions">${!user.mustChange ? '<a class="settings-action" href="/pages/cuenta/?change=1">Cambiar contraseña</a>' + (user.role === "admin" ? '<a class="settings-action" href="/pages/admin/">Usuarios y accesos</a>' : "") : ""}<button class="settings-action" type="button" id="logout">Cerrar sesión</button></div>`;
  settingsAccount(bar);
  const button = bar.querySelector(".sync-refresh");
  button.onclick = async () => {
    if (button.disabled) return;
    const label = bar.querySelector("#sync-state");
    const previous = { text: label.textContent, state: label.dataset.state };
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    setSync("Actualizando…", "syncing");
    try {
      let status;
      if (refresh) status = await refresh();
      else {
        const { user: current } = await api("/api/me");
        if (current.id !== user.id)
          throw Object.assign(Error("La sesión cambió."), { status: 401 });
        status = "Sincronizado";
      }
      if (status) setSync(status);
      else if (label.textContent === "Actualizando…")
        setSync(previous.text, previous.state);
    } catch (e) {
      if (e.status === 401 || e.code === "PASSWORD_CHANGE_REQUIRED")
        loginRedirect();
      else setSync("No se pudo actualizar. Inténtalo de nuevo.", "error");
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  };
  bar.querySelector("#logout").onclick = () =>
    logout().catch((e) => alert(e.message));
  sessionStorage.setItem("inventory-user", user.id);
  return bar;
}
export function setSync(text, state) {
  const el = document.querySelector("#sync-state");
  if (el) {
    el.textContent = text;
    el.dataset.state = state || (text.startsWith("Sincronizado")
      ? "synced"
      : /pendiente|borrador recuperado/i.test(text) ? "pending" : "error");
  }
}
export function draftsFor(userId, cycleId, storage = localStorage) {
  const key = `inventory-drafts-v1:${userId}:${cycleId}`;
  let values = {};
  try {
    values = JSON.parse(storage.getItem(key) || "{}");
  } catch {}
  function flush() {
    storage.setItem(key, JSON.stringify(values));
  }
  return {
    get: (id) => values[id],
    set(id, value) {
      values[id] = value;
      flush();
    },
    remove(id) {
      delete values[id];
      flush();
    },
    all: () => ({ ...values }),
  };
}
export function dialog(title, content) {
  const el = document.createElement("dialog");
  el.className = "shared-dialog";
  const titleId = `dialog-${crypto.randomUUID()}`;
  el.setAttribute("aria-labelledby", titleId);
  el.innerHTML = `<h2 id="${titleId}">${escapeHtml(title)}</h2>${content}`;
  document.body.append(el);
  const previous = document.activeElement;
  el.showModal();
  el.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const controls = [
      ...el.querySelectorAll(
        "button, a[href], input, textarea, select, [tabindex]",
      ),
    ].filter(
      (control) =>
        !control.disabled &&
        control.tabIndex >= 0 &&
        control.getClientRects().length,
    );
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  el.addEventListener("close", () => {
    el.remove();
    if (previous?.isConnected) previous.focus();
  });
  return el;
}
