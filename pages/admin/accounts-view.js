import { html, setHTML, joinHTML } from '/shared/html.js';
import { showNotice } from '/shared/notices.js';
import { passwordField, bindPasswordFields } from '/shared/password-field.js';
import { api, authenticated, identityBar, dialog } from '/shared/client.js';
import { loading, reveal, pendingButton } from '/shared/loading.js';
import { roleNames } from '/shared/roles.js';
import { temporaryPassword, regenerateIcon } from '/shared/temporary-password.js';

const host = document.querySelector('#users'),
  message = document.querySelector('#message');
let actor,
  createDraft = null,
  createPending = false;
const temporaryField = () =>
  passwordField('Contraseña temporal', 'password', 'new-password', true, {
    className: 'temporary-password-field',
    after: html`<button
      type="button"
      class="regenerate-password"
      aria-label="Generar otra contraseña temporal"
      title="Generar otra contraseña temporal"
    >
      ${regenerateIcon}
    </button>`,
  });
function bindTemporaryFields(root) {
  bindPasswordFields(root);
  for (const button of root.querySelectorAll('.regenerate-password')) {
    const input = button.closest('.password-field').querySelector('input');
    if (!input.value) input.value = temporaryPassword();
    button.onclick = () => {
      input.value = temporaryPassword();
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
  }
}
const roleSelect = (role, manager) =>
  manager === 'service_lead'
    ? html`<input name="role" type="hidden" value="worker" />
        <p class="field-hint">Rol: Trabajador</p>`
    : html`<label
        >Rol<select name="role">
          ${joinHTML(['admin', 'service_lead', 'worker'].map((r) => html`<option value="${r}" ${role === r ? 'selected' : ''}>${roleNames[r]}</option>`))}
        </select></label
      >`;
const chevron = html`<svg class="disclosure-icon" viewBox="0 0 24 24" aria-hidden="true">
  <path d="m8 10 4 4 4-4" />
</svg>`;
function scopeHint(scope, scopes) {
  if (scope.id === 'servicio')
    return 'Incluye Barra, Línea / Armado, Copería, Mercadito, Vitrina y todas las zonas de Garzones.';
  const children = scopes.filter((s) => s.parent === scope.id);
  return children.length ? `Incluye ${children.map((s) => s.name).join(', ')}.` : '';
}
function assignments(u, scopes) {
  const render = (scope) => {
    const children = scopes.filter((s) => s.parent === scope.id);
    const hint = scopeHint(scope, scopes);
    const checkbox = html`<label class="scope-assignment"
      ><input
        type="checkbox"
        name="grants"
        value="${scope.id}"
        ${u.grants.includes(scope.id) ? 'checked' : ''}
      /><span
        >${children.length ? (scope.id.endsWith(':garzones') ? 'Todas las zonas de Garzones' : `Todo ${scope.name}`) : scope.name}${hint ? html`<small>${hint}</small>` : ''}</span
      ></label
    >`;
    if (!children.length) return checkbox;
    return html`<details class="scope-group" data-scope="${scope.id}">
      <summary><span>${scope.name}</span><small data-scope-count></small>${chevron}</summary>
      <div class="scope-group-content">
        ${checkbox}
        <div class="scope-children">${joinHTML(children.map(render))}</div>
      </div>
    </details>`;
  };
  return html`<fieldset class="scope-tree">
    <legend class="visually-hidden">Áreas y zonas asignadas</legend>
    ${joinHTML(scopes.filter((s) => !s.parent || !scopes.some((p) => p.id === s.parent)).map(render))}
  </fieldset>`;
}
function tabs(u) {
  return html`<div class="account-tabs" role="tablist" aria-label="Opciones de ${u.username}">
    ${joinHTML(
      [
        ['account', 'Cuenta'],
        ['access', 'Accesos'],
        ['security', 'Seguridad'],
      ].map(
        ([id, label], i) =>
          html`<button
            type="button"
            role="tab"
            id="tab-${u.id}-${id}"
            aria-controls="panel-${u.id}-${id}"
            aria-selected="${i === 0}"
            tabindex="${i === 0 ? 0 : -1}"
            data-account-tab="${id}"
          >
            ${label}
          </button>`,
      ),
    )}
  </div>`;
}
function panelAttributes(u, id) {
  return html`id="panel-${u.id}-${id}"
  data-account-panel="${id}"${u.limited ? '' : html` role="tabpanel" aria-labelledby="tab-${u.id}-${id}" tabindex="0"`}${id !== 'account' && !u.limited ? ' hidden' : ''}`;
}
function card(u, scopes) {
  const summary = u.limited
    ? 'Solo puedes cambiar sus accesos de Servicio. La cuenta queda a cargo del Administrador.'
    : '';
  return html`<article
    class="user-card"
    data-id="${u.id}"
    data-search="${(u.name + ' ' + u.username).toLowerCase()}"
  >
    <details class="user-details">
      <summary>
        <span class="user-card-name"><strong>${u.name}</strong><small>${u.username}</small></span
        ><span class="user-card-meta"
          ><span class="role-chip">${roleNames[u.role]}</span
          ><span class="state-chip ${u.active ? 'is-active' : 'is-inactive'}"
            >${u.active ? 'Activo' : 'Inactivo'}</span
          ></span
        >${chevron}
      </summary>
      <div class="user-editor">
        ${summary ? html`<p class="user-access-summary">${summary}</p>` : tabs(u)}
        <form data-user="${u.id}" data-revision="${u.revision}">
          ${
            u.limited
              ? ''
              : html`<div class="editor-panel account-fields" ${panelAttributes(u, 'account')}>
                  <label class="username-field"
                    >Usuario<input
                      name="username"
                      value="${u.username}"
                      required
                      pattern="(?:[a-z0-9._]|-){3,40}"
                      autocomplete="off"
                      autocapitalize="none"
                      spellcheck="false"
                    /><small class="field-hint"
                      >Cambiar el usuario cierra sus sesiones.</small
                    ></label
                  >
                  ${roleSelect(u.role, actor.role)}
                  <label class="account-active"
                    ><span>Cuenta activa<small>Permite iniciar sesión.</small></span
                    ><input type="checkbox" name="active" ${u.active ? 'checked' : ''}
                  /></label>
                  <p class="field-hint profile-hint">
                    Cada persona cambia su nombre visible en Mi perfil.
                  </p>
                </div>`
          }
          <div class="editor-panel access-panel" ${panelAttributes(u, 'access')}>
            <div class="access-heading">
              <h3>Áreas y zonas</h3>
              <span class="assignment-count" data-assignment-count></span>
            </div>
            <p class="field-hint" data-access-hint>
              Selecciona áreas, subáreas o zonas. Sin asignaciones no hay acceso al inventario.
            </p>
            ${assignments(u, scopes)}
          </div>
          <div class="editor-save">
            <button class="button button-primary">Guardar cuenta y accesos</button>
          </div>
        </form>
        ${
          u.limited
            ? ''
            : html`<div class="editor-panel security-panel" ${panelAttributes(u, 'security')}>
                <section class="security-section">
                  <h3>Restablecer contraseña</h3>
                  <p class="field-hint">
                    Cierra sus sesiones. Deberá cambiar la contraseña temporal al ingresar.
                  </p>
                  <form class="reset-form" data-reset="${u.id}" data-revision="${u.revision}">
                    ${temporaryField()}<button class="button button-secondary">
                      Restablecer contraseña
                    </button>
                  </form>
                </section>
                <section class="security-section delete-account">
                  <h3>Eliminar usuario</h3>
                  <p class="field-hint">
                    Acción irreversible. Los conteos y el historial se conservan.
                  </p>
                  <button
                    class="button button-danger"
                    type="button"
                    data-delete="${u.id}"
                    data-revision="${u.revision}"
                    data-username="${u.username}"
                  >
                    Eliminar usuario
                  </button>
                </section>
              </div>`
        }
      </div>
    </details>
  </article>`;
}
function bindAccountEditor(row) {
  const form = row.querySelector('form[data-user]'),
    tabs = [...row.querySelectorAll('[data-account-tab]')];
  const show = (tab) => {
    for (const item of tabs) {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    }
    for (const panel of row.querySelectorAll('[data-account-panel]'))
      panel.hidden = panel.dataset.accountPanel !== tab.dataset.accountTab;
    row.querySelector('.editor-save').hidden = tab.dataset.accountTab === 'security';
  };
  for (const tab of tabs) {
    tab.onclick = () => show(tab);
    tab.onkeydown = (event) => {
      let index = tabs.indexOf(tab);
      if (event.key === 'ArrowRight') index = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') index = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = tabs.length - 1;
      else return;
      event.preventDefault();
      show(tabs[index]);
      tabs[index].focus();
    };
  }
  // Native validation must reveal its field even when another tab is selected.
  form.addEventListener(
    'invalid',
    (event) => {
      const panel = event.target.closest('[data-account-panel]');
      const tab = tabs.find((t) => t.dataset.accountTab === panel?.dataset.accountPanel);
      if (tab) show(tab);
    },
    true,
  );
  const updateAssignments = () => {
    const selected = [...form.querySelectorAll('[name="grants"]:checked')].map(
      (input) => input.value,
    );
    const count = row.querySelector('[data-assignment-count]');
    count.textContent = `${selected.length} ${selected.length === 1 ? 'asignación' : 'asignaciones'}`;
    for (const group of form.querySelectorAll('.scope-group')) {
      const assigned = selected.filter(
        (id) => id === group.dataset.scope || id.startsWith(group.dataset.scope + ':'),
      ).length;
      const inherited = selected.some((id) => group.dataset.scope.startsWith(id + ':'));
      group.querySelector('[data-scope-count]').textContent =
        selected.includes(group.dataset.scope) || inherited
          ? 'Completo'
          : assigned
            ? `${assigned} ${assigned === 1 ? 'asignación' : 'asignaciones'}`
            : '';
    }
    const role = form.querySelector('[name="role"]')?.value || 'worker';
    form.querySelector('.scope-tree').hidden = role !== 'worker';
    count.hidden = role !== 'worker';
    form.querySelector('[data-access-hint]').textContent =
      role === 'admin'
        ? 'Acceso a todas las áreas por su rol de Administrador.'
        : role === 'service_lead'
          ? 'Acceso a todas las subáreas y zonas de Servicio por su rol de Jefa de servicio.'
          : 'Selecciona áreas, subáreas o zonas. Sin asignaciones no hay acceso al inventario.';
  };
  form.addEventListener('change', updateAssignments);
  updateAssignments();
}
function confirmation(title, text, label, danger = false) {
  return new Promise((resolve) => {
    const el = dialog(
      title,
      html`<p>${text}</p>
        <div class="dialog-actions">
          <button
            type="button"
            id="${danger ? 'cancel-delete' : 'cancel-reset'}"
            data-cancel
            autofocus
          >
            Cancelar</button
          ><button
            type="button"
            id="${danger ? 'confirm-delete' : 'confirm-reset'}"
            data-confirm
            class="${danger ? 'button-danger' : ''}"
          >
            ${label}
          </button>
        </div>`,
    );
    let confirmed = false;
    el.querySelector('[data-cancel]').onclick = () => el.close();
    el.querySelector('[data-confirm]').onclick = () => {
      confirmed = true;
      el.close();
    };
    el.addEventListener('close', () => resolve(confirmed), { once: true });
  });
}
function notify(text, tone = 'error') {
  if (tone === 'success') {
    message.hidden = true;
    showNotice(text);
    return;
  }
  message.hidden = false;
  message.dataset.tone = tone;
  message.textContent = text;
  message.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  message.scrollIntoView({ block: 'nearest' });
}
function credentials(username, password) {
  // Only call after the API confirmed success. The text exists solely in this
  // dialog closure and is released when dismissed; never add a URL parameter.
  const text = `Acceso al inventario\nUsuario: ${username}\nContraseña temporal: ${password}\nAl ingresar deberás cambiar tu contraseña.`;
  const el = dialog(
    'Acceso preparado',
    html`<p>
        Comparte estas credenciales con la persona. Deberá cambiar la contraseña al ingresar.
      </p>
      <dl class="credentials">
        <dt>Usuario</dt>
        <dd>${username}</dd>
        <dt>Contraseña temporal</dt>
        <dd class="credential-secret">${password}</dd>
      </dl>
      <p class="field-hint">
        La clave solo se muestra aquí. Para recuperarla después, genera una nueva.
      </p>
      <p class="credential-feedback" role="status"></p>
      <div class="dialog-actions">
        <button type="button" data-copy class="button-secondary">Copiar accesos</button
        >${navigator.share ? html`<button type="button" data-share>Compartir</button>` : ''}<button
          type="button"
          data-close
          class="button-secondary"
        >
          Cerrar
        </button>
      </div>`,
  );
  el.classList.add('account-credentials');
  const feedback = el.querySelector('.credential-feedback');
  el.querySelector('[data-copy]').onclick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      feedback.textContent = 'Accesos copiados.';
    } catch {
      feedback.textContent = 'No se pudo copiar. Selecciona las credenciales y cópialas.';
    }
  };
  if (navigator.share)
    el.querySelector('[data-share]').onclick = async () => {
      try {
        await navigator.share({ title: 'Acceso al inventario', text });
        feedback.textContent = 'Se abrió el menú para compartir.';
      } catch (error) {
        if (error.name !== 'AbortError')
          feedback.textContent = 'No se pudo compartir. Puedes copiar los accesos.';
      }
    };
  el.querySelector('[data-close]').onclick = () => el.close();
}
function createAccount(scopes) {
  if (createPending) {
    notify(
      'La creación sigue en curso. Espera la confirmación antes de intentarlo de nuevo.',
      'pending',
    );
    return;
  }
  const draft = createDraft || {
    username: '',
    name: '',
    role: 'worker',
    grants: [],
    password: temporaryPassword(),
    step: 0,
  };
  createDraft = draft;
  const el = dialog(
    'Crear usuario',
    html`<form id="create" novalidate>
      <nav class="create-steps" aria-label="Pasos del alta">
        ${joinHTML(['Cuenta', 'Accesos', 'Confirmar'].map((name, i) => html`<span data-step-label="${i}">${i + 1}. ${name}</span>`))}
      </nav>
      <p class="create-feedback" role="status"></p>
      <section data-create-step="0">
        <label
          >Usuario<input
            name="username"
            value="${draft.username}"
            required
            pattern="(?:[a-z0-9._]|-){3,40}"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false" /></label
        ><label
          >Nombre visible<input
            name="name"
            value="${draft.name}"
            maxlength="80"
            required
            autocomplete="off" /></label
        >${roleSelect(draft.role, actor.role)}
      </section>
      <section data-create-step="1">
        <p class="field-hint" data-create-scope-hint></p>
        ${assignments(draft, scopes)}
      </section>
      <section data-create-step="2">
        <p class="create-confirmation"></p>
        ${temporaryField()}
        <p class="field-hint">Se exigirá cambiarla al ingresar.</p>
      </section>
      <div class="dialog-actions">
        <button type="button" class="button-secondary" data-create-back>Atrás</button
        ><button type="submit" data-create-next>Continuar</button>
      </div>
    </form>`,
  );
  el.classList.add('account-create');
  const form = el.querySelector('form'),
    next = form.querySelector('[data-create-next]'),
    back = form.querySelector('[data-create-back]'),
    feedback = form.querySelector('.create-feedback');
  form.elements.password.value = draft.password;
  bindTemporaryFields(form);
  function capture() {
    const values = new FormData(form);
    Object.assign(draft, {
      username: values.get('username'),
      name: values.get('name'),
      role: values.get('role'),
      password: values.get('password'),
      grants: values.getAll('grants'),
    });
  }
  function show() {
    for (const section of form.querySelectorAll('[data-create-step]'))
      section.hidden = Number(section.dataset.createStep) !== draft.step;
    for (const label of form.querySelectorAll('[data-step-label]')) {
      label.classList.toggle('is-current', Number(label.dataset.stepLabel) === draft.step);
      if (Number(label.dataset.stepLabel) === draft.step)
        label.setAttribute('aria-current', 'step');
      else label.removeAttribute('aria-current');
    }
    const role = form.elements.role.value;
    form.querySelector('.scope-tree').hidden = role !== 'worker';
    form.querySelector('[data-create-scope-hint]').textContent =
      role === 'admin'
        ? 'Acceso global incluido por el rol de Administrador.'
        : role === 'service_lead'
          ? 'Acceso a Servicio incluido por el rol de Jefa de servicio.'
          : 'Selecciona al menos un área, subárea o zona.';
    form.querySelector('.create-confirmation').textContent =
      `${draft.name || 'Nueva persona'} · ${draft.username || 'Usuario'} · ${roleNames[role]}. ${role === 'worker' ? `${draft.grants.length} asignaciones seleccionadas.` : 'Alcance incluido por su rol.'}`;
    next.textContent = draft.step === 2 ? 'Crear usuario' : 'Continuar';
    back.textContent = draft.step === 0 ? 'Cancelar' : 'Atrás';
  }
  form.addEventListener('input', capture);
  form.addEventListener('change', () => {
    capture();
    show();
  });
  back.onclick = () => {
    if (draft.step === 0) el.close();
    else {
      draft.step--;
      feedback.textContent = '';
      show();
    }
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    capture();
    feedback.textContent = '';
    if (draft.step === 0) {
      const fields = [...form.querySelectorAll('[data-create-step="0"] input')];
      if (fields.some((field) => !field.reportValidity())) return;
      draft.step++;
      show();
      return;
    }
    if (draft.step === 1) {
      if (draft.role === 'worker' && !draft.grants.length) {
        feedback.textContent = 'Selecciona al menos un área, subárea o zona.';
        return;
      }
      draft.step++;
      show();
      return;
    }
    if (!form.elements.password.reportValidity()) return;
    const restore = pendingButton(next, 'Creando usuario…');
    back.disabled = true;
    createPending = true;
    host.querySelector('.create-user-trigger').disabled = true;
    const submitted = {
      username: draft.username,
      name: draft.name,
      role: draft.role,
      password: draft.password,
      grants: draft.role === 'worker' ? [...draft.grants] : [],
    };
    try {
      await api('/api/admin/users', submitted);
      createDraft = null;
      el.close();
      await load();
      credentials(submitted.username, submitted.password);
    } catch (error) {
      feedback.textContent =
        error.message +
        (error.status >= 500 || !error.status
          ? ' No se confirmó el resultado: revisa la lista antes de volver a crear la cuenta.'
          : '');
    } finally {
      createPending = false;
      restore();
      back.disabled = false;
      const trigger = host.querySelector('.create-user-trigger');
      if (trigger) trigger.disabled = false;
    }
  };
  show();
}
async function load() {
  const finish = loading(host);
  try {
    const { users, scopes, user } = await authenticated('/api/admin/users');
    actor = user;
    identityBar(user);
    setHTML(
      host,
      html`<div class="users-toolbar">
          <div class="users-heading">
            <h2>Cuentas</h2>
            <p id="user-results" role="status" aria-live="polite"></p>
          </div>
          <button type="button" class="button button-primary create-user-trigger">
            Crear usuario</button
          ><label class="users-search"
            ><span class="visually-hidden">Buscar cuenta</span
            ><input
              id="user-search"
              type="search"
              placeholder="Buscar nombre o usuario"
              autocomplete="off"
          /></label>
        </div>
        <div class="users-list">${joinHTML(users.map((u) => card(u, scopes)))}</div>`,
    );
    bindTemporaryFields(host);
    reveal(host, crypto.randomUUID());
    host.querySelector('.create-user-trigger').onclick = () => createAccount(scopes);
    for (const row of host.querySelectorAll('.user-card')) bindAccountEditor(row);
    const search = host.querySelector('#user-search');
    const filter = () => {
      let visible = 0;
      for (const row of host.querySelectorAll('.user-card')) {
        row.hidden = !row.dataset.search.includes(search.value.trim().toLowerCase());
        if (!row.hidden) visible++;
      }
      host.querySelector('#user-results').textContent =
        `${visible} ${visible === 1 ? 'cuenta' : 'cuentas'}`;
    };
    search.oninput = filter;
    filter();
    for (const form of host.querySelectorAll('form'))
      form.onsubmit = async (event) => {
        event.preventDefault();
        message.hidden = true;
        message.textContent = '';
        const button = form.querySelector('button:not([type]),button[type="submit"]');
        button.disabled = true;
        let restore = () => {};
        try {
          const f = new FormData(form);
          let path, payload, preparedCredentials;
          if (form.dataset.reset) {
            if (
              !(await confirmation(
                'Restablecer contraseña',
                'Se cerrarán sus sesiones y deberá cambiar la contraseña temporal al ingresar.',
                'Restablecer contraseña',
              ))
            ) {
              button.disabled = false;
              button.focus();
              return;
            }
            path = `/api/admin/users/${form.dataset.reset}/password`;
            payload = {
              password: f.get('password'),
              expectedRevision: Number(form.dataset.revision),
            };
            preparedCredentials = {
              username: users.find((u) => u.id === form.dataset.reset).username,
              password: f.get('password'),
            };
          } else {
            path = `/api/admin/users/${form.dataset.user}`;
            const user = users.find((u) => u.id === form.dataset.user);
            payload = {
              expectedRevision: Number(form.dataset.revision),
              grants: f.getAll('grants'),
            };
            if (!user.limited)
              Object.assign(payload, {
                username: f.get('username'),
                role: f.get('role'),
                active: f.has('active'),
                grants: f.get('role') === 'worker' ? f.getAll('grants') : [],
              });
          }
          restore = pendingButton(
            button,
            form.dataset.reset ? 'Restableciendo…' : 'Guardando accesos…',
          );
          await api(path, payload);
          await load();
          notify('Cambios guardados.', 'success');
          if (preparedCredentials)
            credentials(preparedCredentials.username, preparedCredentials.password);
        } catch (error) {
          notify(error.message);
          restore();
          button.disabled = false;
        }
      };
    for (const button of host.querySelectorAll('[data-delete]'))
      button.onclick = async () => {
        message.hidden = true;
        message.textContent = '';
        button.disabled = true;
        let restore = () => {};
        try {
          if (
            !(await confirmation(
              'Eliminar usuario',
              html`Vas a eliminar <strong>${button.dataset.username}</strong>. Esta acción es
                irreversible. Se conservan sus conteos e historial.`,
              'Eliminar definitivamente',
              true,
            ))
          ) {
            button.disabled = false;
            button.focus();
            return;
          }
          restore = pendingButton(button, 'Eliminando…');
          await api(`/api/admin/users/${button.dataset.delete}/delete`, {
            confirm: true,
            expectedRevision: Number(button.dataset.revision),
          });
          if (button.dataset.delete === actor.id) {
            location.replace('/pages/cuenta/');
            return;
          }
          await load();
          notify('Usuario eliminado. Su historial se conserva.', 'success');
        } catch (error) {
          notify(error.message);
          restore();
          button.disabled = false;
        }
      };
  } catch (error) {
    notify(error.message);
    host.replaceChildren();
  } finally {
    finish();
  }
}
await load();
