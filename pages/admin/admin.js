import {
  api,
  requireUser,
  identityBar,
  escapeHtml as esc,
  dialog,
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
        ? " · Incluye todas sus zonas"
        : "")
  );
}
async function load() {
  try {
    const { users, scopes } = await api("/api/admin/users");
    host.innerHTML =
      `<details class="create-user"><summary>Crear usuario</summary><form id="create"><label>Usuario<input name="username" required pattern="[a-z0-9._-]{3,40}" autocomplete="off"></label><label>Nombre visible<input name="name" maxlength="80" required></label>${roleSelect("worker")}<label>Contraseña temporal<input name="password" type="password" minlength="12" autocomplete="new-password" required></label><p>Se exigirá cambiarla al ingresar. Los trabajadores nuevos no tienen áreas.</p><button class="button button-primary">Crear usuario</button></form></details><div class="users-toolbar"><h2>Cuentas existentes</h2><label>Buscar cuenta<input id="user-search" type="search" placeholder="Nombre o usuario" autocomplete="off"></label><p id="user-results" role="status"></p></div>` +
      users
        .map(
          (u) =>
            `<article class="user-card" data-search="${esc((u.name + " " + u.username).toLowerCase())}"><details><summary><span class="user-card-name"><strong>${esc(u.name)}</strong><small>${esc(u.username)}</small></span><span class="role-chip">${u.role === "admin" ? "Administrador" : "Trabajador"}</span><span class="state-chip ${u.active ? "is-active" : "is-inactive"}">${u.active ? "Activo" : "Inactivo"}</span></summary><div class="user-access-summary">${u.role === "admin" ? "Acceso global por rol" : u.grants.length ? u.grants.map((id) => esc(scopes.find((s) => s.id === id)?.name || id)).join(" · ") : "Sin áreas asignadas"}</div><form data-user="${u.id}"><label>Nombre visible<input name="name" value="${esc(u.name)}" maxlength="80" required></label>${roleSelect(u.role)}<label><input type="checkbox" name="active" ${u.active ? "checked" : ""}>Activo</label><fieldset><legend>Ámbitos · varias asignaciones forman una unión</legend>${scopes.map((s) => `<label class="scope-assignment" style="--scope-depth:${s.id.split(":").length - 1}"><input type="checkbox" name="grants" value="${esc(s.id)}" ${u.grants.includes(s.id) ? "checked" : ""}>${esc(scopeLabel(s, scopes))}</label>`).join("")}</fieldset><p>Sin asignaciones: sin acceso al inventario. Administradores: acceso global por rol.</p><button class="button button-primary">Guardar cuenta y accesos</button></form><form class="reset-form" data-reset="${u.id}"><label>Nueva contraseña temporal<input name="password" type="password" minlength="12" autocomplete="new-password" required></label><p class="field-hint">Cierra todas las sesiones y exige cambiar la contraseña al ingresar.</p><button class="button button-secondary">Restablecer contraseña y revocar sesiones</button></form></details></article>`,
        )
        .join("");
    host.setAttribute("aria-busy", "false");
    const search = host.querySelector("#user-search");
    const filter = () => {
      let visible = 0;
      for (const card of host.querySelectorAll(".user-card")) {
        card.hidden = !card.dataset.search.includes(
          search.value.trim().toLowerCase(),
        );
        if (!card.hidden) visible++;
      }
      host.querySelector("#user-results").textContent =
        `${visible} ${visible === 1 ? "cuenta" : "cuentas"}`;
    };
    search.addEventListener("input", filter);
    filter();
    for (const form of host.querySelectorAll("form"))
      form.onsubmit = async (e) => {
        e.preventDefault();
        message.hidden = true;
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
            const confirmed = await new Promise((resolve) => {
              const el = dialog(
                "Restablecer contraseña",
                '<p>Se cerrarán las sesiones de esta persona y deberá cambiar su contraseña temporal al ingresar.</p><div class="dialog-actions"><button type="button" id="cancel-reset">Cancelar</button><button type="button" id="confirm-reset">Confirmar restablecimiento</button></div>',
              );
              el.querySelector("#cancel-reset").onclick = () => {
                el.close();
                resolve(false);
              };
              el.querySelector("#confirm-reset").onclick = () => {
                el.close();
                resolve(true);
              };
              el.addEventListener("cancel", () => resolve(false));
            });
            if (!confirmed) {
              button.disabled = false;
              return;
            }
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
          message.hidden = false;
          message.dataset.tone = "success";
          message.textContent = "Cambios guardados.";
          await load();
        } catch (err) {
          message.hidden = false;
          message.dataset.tone = "error";
          message.textContent = err.message;
          message.focus();
          button.disabled = false;
        }
      };
  } catch (e) {
    host.setAttribute("aria-busy", "false");
    message.hidden = false;
    message.dataset.tone = "error";
    message.textContent = e.message;
    host.replaceChildren();
  }
}
await load();
