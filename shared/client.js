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
  const data = await r.json();
  if (!r.ok)
    throw Object.assign(Error(data.message || data.code), data, {
      status: r.status,
    });
  return data;
}
export function loginRedirect() {
  location.replace("/pages/cuenta/");
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
export function identityBar(user) {
  const bar = document.createElement("section");
  bar.className = "identity-bar";
  bar.setAttribute("aria-label", "Cuenta y sincronización");
  bar.innerHTML = `<span>${escapeHtml(user.name)} · ${user.role === "admin" ? "Administrador" : "Trabajador"} · Compartido</span><span id="sync-state" role="status">Sincronizado</span><a href="/pages/cuenta/?change=1">Cambiar contraseña</a>${user.role === "admin" ? '<a href="/pages/admin/">Usuarios y accesos</a>' : ""}<button type="button" id="logout">Cerrar sesión</button>`;
  document.querySelector("main").prepend(bar);
  bar.querySelector("#logout").onclick = () =>
    logout().catch((e) => alert(e.message));
  sessionStorage.setItem("inventory-user", user.id);
  return bar;
}
export function setSync(text) {
  const el = document.querySelector("#sync-state");
  if (el) el.textContent = text;
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
    const controls = [...el.querySelectorAll("button, a[href], input, textarea, select, [tabindex]")]
      .filter((control) => !control.disabled && control.tabIndex >= 0 && control.getClientRects().length);
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
