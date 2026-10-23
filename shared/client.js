import { settingsAccount } from "./settings.js";
import { refreshLimit } from "./refresh-limit.js";
import { roleNames, managesUsers } from "./roles.js";
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
            ...(path === "/api/count" || path === "/api/profile" || path.startsWith("/api/admin/")
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
      retryAfter: Math.min(900, Math.max(0, Number(r.headers.get("Retry-After")) || 0)),
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
let disposeIdentity = () => {};
export function identityBar(user, refresh) {
  disposeIdentity();
  const bar = document.createElement("section");
  bar.className = "identity-bar";
  bar.setAttribute("aria-label", "Cuenta y sincronización");
  bar.innerHTML = `<div class="identity-person"><span class="identity-name"><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(roleNames[user.role] || user.role)}</small></span>${!user.mustChange ? '<a class="identity-profile" href="/pages/cuenta/?profile=1">Mi perfil</a>' : ""}</div><div class="sync-controls"><span id="sync-state" role="status" data-state="synced">Sincronizado</span><button class="sync-refresh" type="button" aria-label="Actualizar sincronización" title="Actualizar sincronización"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 6M20 4v7h-7"/></svg></button></div><div class="settings-actions">${!user.mustChange && managesUsers(user) ? '<a class="settings-action" href="/pages/admin/">Gestionar usuarios y accesos</a><a class="settings-action" href="/pages/admin/supervision.html">Panel de supervisión</a>' : ""}</div><button class="settings-action account-logout" type="button" id="logout">Cerrar sesión</button>`;
  settingsAccount(bar);
  const button = bar.querySelector(".sync-refresh");
  const limit = refreshLimit(user.id);
  const listeners = new AbortController();
  let checking = false, timer;
  const updateAvailability = () => {
    clearTimeout(timer);
    const wait = limit.remaining();
    button.disabled = checking || wait > 0;
    button.title = checking ? "Comprobando…" : wait
      ? `Volver a comprobar en ${Math.ceil(wait / 1000)} segundos`
      : "Actualizar sincronización";
    if (wait && bar.isConnected) timer = setTimeout(updateAvailability, wait);
  };
  window.addEventListener("storage", e => {
    if (e.key === limit.key) updateAvailability();
  }, { signal: listeners.signal });
  document.addEventListener("visibilitychange", updateAvailability, { signal: listeners.signal });
  disposeIdentity = () => { clearTimeout(timer); listeners.abort(); };
  updateAvailability();
  button.onclick = async () => {
    if (checking) return;
    checking = true;
    updateAvailability();
    const label = bar.querySelector("#sync-state");
    const previous = { text: label.textContent, state: label.dataset.state };
    try {
      const status = await limit.run(async () => {
        button.setAttribute("aria-busy", "true");
        setSync("Actualizando…", "syncing");
        if (refresh) return refresh();
        const { user: current } = await api("/api/me");
        if (current.id !== user.id)
          throw Object.assign(Error("La sesión cambió."), { status: 401 });
        return "Sincronizado";
      });
      if (status) setSync(status);
      else if (label.textContent === "Actualizando…")
        setSync(previous.text, previous.state);
    } catch (e) {
      if (e.code === "REFRESH_COOLDOWN") return;
      if (e.status === 401 || e.code === "PASSWORD_CHANGE_REQUIRED")
        loginRedirect();
      else setSync("No se pudo actualizar. Inténtalo de nuevo.", "error");
    } finally {
      checking = false;
      button.removeAttribute("aria-busy");
      updateAvailability();
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
  // A complete gesture must start and end on the backdrop. Dragging from a
  // field outside the dialog must never discard its presentation or draft.
  const outside = event => {
    const rect = el.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };
  let backdropPointer = null;
  el.addEventListener("pointerdown", event => {
    backdropPointer = outside(event) ? event.pointerId : null;
  });
  el.addEventListener("pointerup", event => {
    if (backdropPointer === event.pointerId && outside(event)) el.close();
    backdropPointer = null;
  });
  el.addEventListener("pointercancel", () => { backdropPointer = null; });
  el.addEventListener("close", () => {
    el.remove();
    if (previous?.isConnected) previous.focus();
  });
  return el;
}
