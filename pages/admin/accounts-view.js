import { passwordField, bindPasswordFields } from "/shared/password-field.js";
import { api, authenticated, identityBar, escapeHtml as esc, dialog } from "/shared/client.js";
import { loading, reveal, pendingButton } from "/shared/loading.js";
import { roleNames } from "/shared/roles.js";

const host = document.querySelector("#users"), message = document.querySelector("#message");
let actor;
const roleSelect = (role, manager) => manager === "service_lead"
  ? '<input name="role" type="hidden" value="worker"><p class="field-hint">Rol: Trabajador</p>'
  : `<label>Rol<select name="role">${["admin","service_lead","worker"].map(r => `<option value="${r}" ${role === r ? "selected" : ""}>${roleNames[r]}</option>`).join("")}</select></label>`;
const chevron = '<svg class="disclosure-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg>';
function scopeHint(scope, scopes) {
  if (scope.id === "servicio") return "Incluye Barra, Línea / Armado, Copería, Mercadito, Vitrina y todas las zonas de Garzones.";
  const children = scopes.filter(s => s.parent === scope.id);
  return children.length ? `Incluye ${children.map(s => s.name).join(", ")}.` : "";
}
function assignments(u, scopes) {
  const render = scope => {
    const children = scopes.filter(s => s.parent === scope.id);
    const hint = scopeHint(scope, scopes);
    const checkbox = `<label class="scope-assignment"><input type="checkbox" name="grants" value="${esc(scope.id)}" ${u.grants.includes(scope.id) ? "checked" : ""}><span>${children.length ? (scope.id.endsWith(":garzones") ? "Todas las zonas de Garzones" : `Todo ${esc(scope.name)}`) : esc(scope.name)}${hint ? `<small>${esc(hint)}</small>` : ""}</span></label>`;
    if (!children.length) return checkbox;
    return `<details class="scope-group" data-scope="${esc(scope.id)}"><summary><span>${esc(scope.name)}</span><small data-scope-count></small>${chevron}</summary><div class="scope-group-content">${checkbox}<div class="scope-children">${children.map(render).join("")}</div></div></details>`;
  };
  return `<fieldset class="scope-tree"><legend class="visually-hidden">Áreas y zonas asignadas</legend>${scopes.filter(s => !s.parent || !scopes.some(p => p.id === s.parent)).map(render).join("")}</fieldset>`;
}
function tabs(u) {
  return `<div class="account-tabs" role="tablist" aria-label="Opciones de ${esc(u.username)}">${[["account","Cuenta"],["access","Accesos"],["security","Seguridad"]].map(([id,label],i) => `<button type="button" role="tab" id="tab-${u.id}-${id}" aria-controls="panel-${u.id}-${id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-account-tab="${id}">${label}</button>`).join("")}</div>`;
}
function panelAttributes(u, id) {
  return `id="panel-${u.id}-${id}" data-account-panel="${id}"${u.limited ? "" : ` role="tabpanel" aria-labelledby="tab-${u.id}-${id}" tabindex="0"`}${id !== "account" && !u.limited ? " hidden" : ""}`;
}
function card(u, scopes) {
  const summary = u.limited ? "Solo puedes cambiar sus accesos de Servicio. La cuenta queda a cargo del Administrador." : "";
  return `<article class="user-card" data-id="${u.id}" data-search="${esc((u.name+" "+u.username).toLowerCase())}">
    <details class="user-details"><summary><span class="user-card-name"><strong>${esc(u.name)}</strong><small>${esc(u.username)}</small></span><span class="user-card-meta"><span class="role-chip">${roleNames[u.role]}</span><span class="state-chip ${u.active ? "is-active" : "is-inactive"}">${u.active ? "Activo" : "Inactivo"}</span></span>${chevron}</summary>
      <div class="user-editor">${summary ? `<p class="user-access-summary">${summary}</p>` : tabs(u)}
        <form data-user="${u.id}" data-revision="${u.revision}">
          ${u.limited ? "" : `<div class="editor-panel account-fields" ${panelAttributes(u,"account")}>
            <label class="username-field">Usuario<input name="username" value="${esc(u.username)}" required pattern="(?:[a-z0-9._]|-){3,40}" autocomplete="off" autocapitalize="none" spellcheck="false"><small class="field-hint">Cambiar el usuario cierra sus sesiones.</small></label>
            ${roleSelect(u.role, actor.role)}
            <label class="account-active"><span>Cuenta activa<small>Permite iniciar sesión.</small></span><input type="checkbox" name="active" ${u.active ? "checked" : ""}></label>
            <p class="field-hint profile-hint">Cada persona cambia su nombre visible en Mi perfil.</p>
          </div>`}
          <div class="editor-panel access-panel" ${panelAttributes(u,"access")}>
            <div class="access-heading"><h3>Áreas y zonas</h3><span class="assignment-count" data-assignment-count></span></div>
            <p class="field-hint" data-access-hint>Selecciona uno o varios ámbitos. Sin asignaciones no hay acceso al inventario.</p>
            ${assignments(u,scopes)}
          </div>
          <div class="editor-save"><button class="button button-primary">Guardar cuenta y accesos</button></div>
        </form>
        ${u.limited ? "" : `<div class="editor-panel security-panel" ${panelAttributes(u,"security")}>
          <section class="security-section"><h3>Restablecer contraseña</h3><p class="field-hint">Cierra sus sesiones. Deberá cambiar la contraseña temporal al ingresar.</p>
            <form class="reset-form" data-reset="${u.id}" data-revision="${u.revision}">${passwordField("Nueva contraseña temporal","password","new-password")}<button class="button button-secondary">Restablecer contraseña</button></form>
          </section>
          <section class="security-section delete-account"><h3>Eliminar usuario</h3><p class="field-hint">Acción irreversible. Los conteos y el historial se conservan.</p><button class="button button-danger" type="button" data-delete="${u.id}" data-revision="${u.revision}" data-username="${esc(u.username)}">Eliminar usuario</button></section>
        </div>`}
      </div>
    </details>
  </article>`;
}
function bindAccountEditor(row) {
  const form = row.querySelector("form[data-user]"), tabs = [...row.querySelectorAll("[data-account-tab]")];
  const show = tab => {
    for (const item of tabs) {
      const selected = item === tab;
      item.setAttribute("aria-selected", String(selected)); item.tabIndex = selected ? 0 : -1;
    }
    for (const panel of row.querySelectorAll("[data-account-panel]")) panel.hidden = panel.dataset.accountPanel !== tab.dataset.accountTab;
    row.querySelector(".editor-save").hidden = tab.dataset.accountTab === "security";
  };
  for (const tab of tabs) {
    tab.onclick = () => show(tab);
    tab.onkeydown = event => {
      let index = tabs.indexOf(tab);
      if (event.key === "ArrowRight") index = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") index = (index + tabs.length - 1) % tabs.length;
      else if (event.key === "Home") index = 0;
      else if (event.key === "End") index = tabs.length - 1;
      else return;
      event.preventDefault(); show(tabs[index]); tabs[index].focus();
    };
  }
  // Native validation must reveal its field even when another tab is selected.
  form.addEventListener("invalid", event => {
    const panel = event.target.closest("[data-account-panel]");
    const tab = tabs.find(t => t.dataset.accountTab === panel?.dataset.accountPanel);
    if (tab) show(tab);
  }, true);
  const updateAssignments = () => {
    const selected = [...form.querySelectorAll('[name="grants"]:checked')].map(input => input.value);
    const count = row.querySelector("[data-assignment-count]");
    count.textContent = `${selected.length} ${selected.length === 1 ? "asignación" : "asignaciones"}`;
    for (const group of form.querySelectorAll(".scope-group")) {
      const assigned = selected.filter(id => id === group.dataset.scope || id.startsWith(group.dataset.scope + ":")).length;
      const inherited = selected.some(id => group.dataset.scope.startsWith(id + ":"));
      group.querySelector("[data-scope-count]").textContent = selected.includes(group.dataset.scope) || inherited ? "Completo" : assigned ? `${assigned} ${assigned === 1 ? "asignación" : "asignaciones"}` : "";
    }
    const role = form.querySelector('[name="role"]')?.value || "worker";
    form.querySelector(".scope-tree").hidden = role !== "worker";
    count.hidden = role !== "worker";
    form.querySelector("[data-access-hint]").textContent = role === "admin" ? "Acceso a todas las áreas por su rol de Administrador." : role === "service_lead" ? "Acceso a todas las subáreas y zonas de Servicio por su rol de Jefa de servicio." : "Selecciona uno o varios ámbitos. Sin asignaciones no hay acceso al inventario.";
  };
  form.addEventListener("change", updateAssignments); updateAssignments();
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
    host.innerHTML = `<details class="create-user"><summary>Crear usuario</summary><form id="create"><label>Usuario<input name="username" required pattern="(?:[a-z0-9._]|-){3,40}" autocomplete="off" autocapitalize="none" spellcheck="false"></label><label>Nombre visible<input name="name" maxlength="80" required></label>${roleSelect("worker",actor.role)}${passwordField("Contraseña temporal","password","new-password")}<p class="field-hint create-note"><span>Se exigirá cambiarla al ingresar.</span><span>Los trabajadores nuevos no tienen áreas.</span></p><button class="button button-primary">Crear usuario</button></form></details><div class="users-toolbar"><div class="users-heading"><h2>Cuentas existentes</h2><p id="user-results" role="status" aria-live="polite"></p></div><label>Buscar cuenta<input id="user-search" type="search" placeholder="Nombre o usuario" autocomplete="off"></label></div>${users.map(u => card(u, scopes)).join("")}`;
    bindPasswordFields(host); reveal(host, crypto.randomUUID());
    for (const row of host.querySelectorAll(".user-card")) bindAccountEditor(row);
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
