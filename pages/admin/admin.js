import {
  api,
  requireUser,
  identityBar,
  escapeHtml as esc,
} from "/shared/client.js";
const user = await requireUser();
identityBar(user);
const host = document.querySelector("#users"),
  message = document.querySelector("#message");
function roleSelect(role) {
  return `<label>Rol<select name="role"><option value="worker" ${role === "worker" ? "selected" : ""}>Trabajador</option><option value="admin" ${role === "admin" ? "selected" : ""}>Administrador · acceso global</option></select></label>`;
}
function scopeLabel(s, scopes) {
  let name = s.name,
    p = scopes.find((x) => x.id === s.parent);
  while (p) {
    name = p.name + " / " + name;
    p = scopes.find((x) => x.id === p.parent);
  }
  return (
    name +
    (s.id === "servicio"
      ? " · Incluye Barra, Armado / Línea / Copería, Mercadito y todas las zonas de Garzones"
      : scopes.some((x) => x.parent === s.id)
        ? " · Incluye todos sus descendientes"
        : "")
  );
}
async function load() {
  try {
    const { users, scopes } = await api("/api/admin/users");
    host.innerHTML =
      `<h2>Crear usuario</h2><form id="create"><label>Usuario<input name="username" required pattern="[a-z0-9._-]{3,40}" autocomplete="off"></label><label>Nombre visible<input name="name" maxlength="80" required></label>${roleSelect("worker")}<label>Contraseña temporal<input name="password" type="password" minlength="12" autocomplete="new-password" required></label><p>Se exigirá cambiarla al ingresar. Los trabajadores nuevos no tienen áreas.</p><button>Crear usuario</button></form><h2>Cuentas existentes</h2>` +
      users
        .map(
          (u) =>
            `<article><h3>${esc(u.username)}</h3><form data-user="${u.id}"><label>Nombre visible<input name="name" value="${esc(u.name)}" maxlength="80" required></label>${roleSelect(u.role)}<label><input type="checkbox" name="active" ${u.active ? "checked" : ""}>Activo</label><fieldset><legend>Ámbitos · varias asignaciones forman una unión</legend>${scopes.map((s) => `<label><input type="checkbox" name="grants" value="${esc(s.id)}" ${u.grants.includes(s.id) ? "checked" : ""}>${esc(scopeLabel(s, scopes))}</label>`).join("")}</fieldset><p>Sin asignaciones: sin acceso al inventario. Administradores: acceso global por rol.</p><button>Guardar cuenta y accesos</button></form><form data-reset="${u.id}"><label>Nueva contraseña temporal<input name="password" type="password" minlength="12" autocomplete="new-password" required></label><button>Restablecer contraseña y revocar sesiones</button></form></article>`,
        )
        .join("");
    for (const form of host.querySelectorAll("form"))
      form.onsubmit = async (e) => {
        e.preventDefault();
        message.textContent = "";
        const button = form.querySelector("button");
        button.disabled = true;
        try {
          const f = new FormData(form);
          let path, b;
          if (form.id === "create") {
            path = "/api/admin/users";
            b = Object.fromEntries(f);
          } else if (form.dataset.reset) {
            path = `/api/admin/users/${form.dataset.reset}/password`;
            b = { password: f.get("password") };
          } else {
            path = `/api/admin/users/${form.dataset.user}`;
            b = {
              name: f.get("name"),
              role: f.get("role"),
              active: f.has("active"),
              grants: f.getAll("grants"),
            };
          }
          await api(path, b);
          message.textContent = "Cambios guardados.";
          await load();
        } catch (err) {
          message.textContent = err.message;
          button.disabled = false;
        }
      };
  } catch (e) {
    message.textContent = e.message;
    host.replaceChildren();
  }
}
await load();
