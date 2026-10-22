import { passwordField, bindPasswordFields } from "/shared/password-field.js";
import { api, authenticated, identityBar, escapeHtml as esc, dialog } from "/shared/client.js";
import { loading, reveal, pendingButton } from "/shared/loading.js";
import { roleNames } from "/shared/roles.js";

const host = document.querySelector("#users"), message = document.querySelector("#message");
let actor;
const roleSelect = (role, manager) => manager === "service_lead"
  ? '<input name="role" type="hidden" value="worker"><p class="field-hint">Rol: Trabajador</p>'
  : `<label>Rol<select name="role">${["admin","service_lead","worker"].map(r => `<option value="${r}" ${role === r ? "selected" : ""}>${roleNames[r]}</option>`).join("")}</select></label>`;
function scopeLabel(scope, scopes) {
  let label = scope.name, parent = scopes.find(s => s.id === scope.parent);
  while (parent) { label = parent.name + " / " + label; parent = scopes.find(s => s.id === parent.parent); }
  return label + (scope.id === "servicio" ? " · Incluye Barra, Línea / Armado, Copería, Mercadito, Vitrina y todas las zonas de Garzones" : scopes.some(s => s.parent === scope.id) ? " · Incluye sus descendientes" : "");
}
function assignments(u, scopes) {
  return `<fieldset><legend>Ámbitos · varias asignaciones forman una unión</legend>${scopes.map(s => `<label class="scope-assignment" style="--scope-depth:${s.id.split(":").length - 1}"><input type="checkbox" name="grants" value="${esc(s.id)}" ${u.grants.includes(s.id) ? "checked" : ""}>${esc(scopeLabel(s, scopes))}</label>`).join("")}</fieldset>`;
}
function card(u, scopes) {
  return `<article class="user-card" data-id="${u.id}" data-search="${esc((u.name+" "+u.username).toLowerCase())}"><details><summary><span class="user-card-name"><strong>${esc(u.name)}</strong><small>${esc(u.username)}</small></span><span class="role-chip">${roleNames[u.role]}</span><span class="state-chip ${u.active ? "is-active" : "is-inactive"}">${u.active ? "Activo" : "Inactivo"}</span></summary><div class="user-access-summary">${u.limited ? "Solo puedes administrar sus accesos de Servicio. La cuenta queda a cargo del Administrador." : u.role === "service_lead" ? "Jefatura de Servicio" : u.role === "admin" ? "Administrador" : u.grants.length ? u.grants.map(id => esc(scopes.find(s => s.id === id)?.name || id)).join(" · ") : "Sin áreas asignadas"}</div><form data-user="${u.id}" data-revision="${u.revision}">${u.limited ? "" : `<label>Usuario<input name="username" value="${esc(u.username)}" required pattern="[a-z0-9._-]{3,40}" autocomplete="off" autocapitalize="none" spellcheck="false"></label><p class="field-hint">Cambiar el usuario cierra sus sesiones. El nombre visible lo cambia cada persona desde Mi perfil.</p>${roleSelect(u.role, actor.role)}<label><input type="checkbox" name="active" ${u.active ? "checked" : ""}>Activo</label>`}${assignments(u,scopes)}<p class="field-hint">Un trabajador sin asignaciones no accede al inventario.</p><button class="button button-primary">Guardar cuenta y accesos</button></form>${u.limited ? "" : `<form class="reset-form" data-reset="${u.id}" data-revision="${u.revision}">${passwordField("Nueva contraseña temporal","password","new-password")}<p class="field-hint">Cierra todas las sesiones y exige cambiar la contraseña al ingresar.</p><button class="button button-secondary">Restablecer contraseña y revocar sesiones</button></form><div class="delete-account"><p>Eliminar retira la cuenta de forma irreversible. Sus conteos e historial se conservan.</p><button class="button button-danger" type="button" data-delete="${u.id}" data-revision="${u.revision}" data-username="${esc(u.username)}">Eliminar usuario</button></div>`}</details></article>`;
}
function confirmation(title, text, label, danger = false) {
  return new Promise(resolve => {
    const el = dialog(title, `<p>${text}</p><div class="dialog-actions"><button type="button" id="${danger ? "cancel-delete" : "cancel-reset"}" data-cancel autofocus>Cancelar</button><button type="button" id="${danger ? "confirm-delete" : "confirm-reset"}" data-confirm class="${danger ? "button-danger" : ""}">${esc(label)}</button></div>`);
    let confirmed = false;
    el.querySelector("[data-cancel]").onclick = () => el.close();
    el.querySelector("[data-confirm]").onclick = () => { confirmed = true; el.close(); };
    el.addEventListener("close", () => resolve(confirmed), { once: true });
  });
}
function notify(text, tone = "error") {
  message.hidden = false; message.dataset.tone = tone; message.textContent = text; message.focus();
}
async function load() {
  const finish = loading(host);
  try {
    const { users, scopes, user } = await authenticated("/api/admin/users");
    actor = user; identityBar(user);
    host.innerHTML = `<details class="create-user"><summary>Crear usuario</summary><form id="create"><label>Usuario<input name="username" required pattern="[a-z0-9._-]{3,40}" autocomplete="off" autocapitalize="none" spellcheck="false"></label><label>Nombre visible<input name="name" maxlength="80" required></label>${roleSelect("worker",actor.role)}${passwordField("Contraseña temporal","password","new-password")}<p>Se exigirá cambiarla al ingresar. Los trabajadores nuevos no tienen áreas.</p><button class="button button-primary">Crear usuario</button></form></details><div class="users-toolbar"><h2>Cuentas existentes</h2><label>Buscar cuenta<input id="user-search" type="search" placeholder="Nombre o usuario" autocomplete="off"></label><p id="user-results" role="status"></p></div>${users.map(u => card(u, scopes)).join("")}`;
    document.querySelector(".view-intro").textContent = actor.role === "service_lead" ? "Trabajadores y accesos de Servicio. Las cuentas con otras áreas conservan su administración general." : "Cuentas personales y permisos por área, subárea o zona.";
    bindPasswordFields(host); reveal(host, crypto.randomUUID());
    for (const form of host.querySelectorAll("form[data-user]")) {
      const role = form.querySelector("select[name=role]");
      if (role) {
        const updateScopeFields = () => { form.querySelector("fieldset").hidden = role.value !== "worker"; };
        role.onchange = updateScopeFields; updateScopeFields();
      }
    }
    const search = host.querySelector("#user-search");
    const filter = () => {
      let visible = 0;
      for (const row of host.querySelectorAll(".user-card")) {
        row.hidden = !row.dataset.search.includes(search.value.trim().toLowerCase());
        if (!row.hidden) visible++;
      }
      host.querySelector("#user-results").textContent = `${visible} ${visible === 1 ? "cuenta" : "cuentas"}`;
    };
    search.oninput = filter; filter();
    for (const form of host.querySelectorAll("form")) form.onsubmit = async event => {
      event.preventDefault(); message.hidden = true; message.textContent = "";
      const button = form.querySelector('button:not([type]),button[type="submit"]');
      button.disabled = true; let restore = () => {};
      try {
        const f = new FormData(form); let path, payload;
        if (form.id === "create") { path = "/api/admin/users"; payload = Object.fromEntries(f); }
        else if (form.dataset.reset) {
          if (!await confirmation("Restablecer contraseña", "Se cerrarán las sesiones de esta persona y deberá cambiar su contraseña temporal al ingresar.", "Confirmar restablecimiento")) { button.disabled = false; button.focus(); return; }
          path = `/api/admin/users/${form.dataset.reset}/password`;
          payload = { password: f.get("password"), expectedRevision: Number(form.dataset.revision) };
        } else {
          path = `/api/admin/users/${form.dataset.user}`;
          const user = users.find(u => u.id === form.dataset.user);
          payload = { expectedRevision: Number(form.dataset.revision), grants: f.getAll("grants") };
          if (!user.limited) Object.assign(payload, { username: f.get("username"), role: f.get("role"), active: f.has("active"), grants: f.get("role") === "worker" ? f.getAll("grants") : [] });
        }
        restore = pendingButton(button, form.id === "create" ? "Creando usuario…" : form.dataset.reset ? "Restableciendo…" : "Guardando accesos…");
        await api(path,payload); await load(); notify("Cambios guardados.","success");
      } catch (e) { notify(e.message); restore(); button.disabled = false; }
    };
    for (const button of host.querySelectorAll("[data-delete]")) button.onclick = async () => {
      message.hidden = true; message.textContent = "";
      button.disabled = true; let restore = () => {};
      try {
        if (!await confirmation("Eliminar usuario", `Vas a eliminar <strong>${esc(button.dataset.username)}</strong>. Esta acción es irreversible: se retirarán sus accesos y se cerrarán sus sesiones. Los conteos y el historial se conservan.`, "Eliminar definitivamente", true)) { button.disabled = false; button.focus(); return; }
        restore = pendingButton(button,"Eliminando…");
        await api(`/api/admin/users/${button.dataset.delete}/delete`, { confirm: true, expectedRevision: Number(button.dataset.revision) });
        if (button.dataset.delete === actor.id) { location.replace("/pages/cuenta/"); return; }
        await load(); notify("Usuario eliminado. Su historial se conserva.","success");
      } catch (e) { notify(e.message); restore(); button.disabled = false; }
    };
  } catch (e) { notify(e.message); host.replaceChildren(); }
  finally { finish(); }
}
await load();
