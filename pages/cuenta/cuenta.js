import { html, setHTML } from '/shared/html.js';
import { showNotice } from '/shared/notices.js';
import { passwordField, bindPasswordFields } from '/shared/password-field.js';
import { loading, reveal, pendingButton } from '/shared/loading.js';
import { api, identityBar } from '/shared/client.js';
const content = document.querySelector('#account-content'),
  message = document.querySelector('#message');
const lock = html`<svg viewBox="0 0 32 32" aria-hidden="true">
  <rect x="7" y="14" width="18" height="14" rx="4" />
  <path d="M11 14V9a5 5 0 0 1 10 0v5m-5 6v3" />
</svg>`;
function notify(text) {
  message.hidden = false;
  message.textContent = text;
  message.dataset.tone = 'error';
  message.setAttribute('role', 'alert');
  message.scrollIntoView({ block: 'nearest' });
}
const finishLoading = loading(content);
let user,
  unavailable = false;
try {
  user = (await api('/api/me')).user;
} catch (e) {
  if (e.status !== 401) {
    unavailable = true;
    notify(
      e.status === 503
        ? e.message
        : 'No pudimos conectar con el inventario. Revisa tu conexión e inténtalo de nuevo.',
    );
  }
}
finishLoading();
if (unavailable) {
  setHTML(
    content,
    html`<section class="account-card">
      <div class="account-symbol">${lock}</div>
      <h2>Inventario no disponible</h2>
      <p>El acceso estará disponible cuando el administrador termine de habilitar el servicio.</p>
      <button class="button button-primary" id="retry-service" type="button">
        Reintentar conexión
      </button>
    </section>`,
  );
  document.querySelector('#retry-service').onclick = () => location.reload();
} else if (user && !user.mustChange && new URLSearchParams(location.search).has('profile')) {
  identityBar(user);
  document.querySelector('#account-back').hidden = false;
  setHTML(
    content,
    html`<section class="account-card">
      <div class="account-heading">
        <div class="account-symbol">${lock}</div>
        <div>
          <p class="eyebrow">${user.username}</p>
          <h2>Mi perfil</h2>
        </div>
      </div>
      <form>
        <label
          >Nombre visible<input
            name="name"
            value="${user.name}"
            required
            maxlength="80"
            autocomplete="name"
        /></label>
        <p class="field-hint">
          Puedes cambiar cómo apareces en la app. Tu usuario de ingreso sigue siendo
          ${user.username}.
        </p>
        <button class="button button-primary" type="submit">Guardar nombre visible</button>
      </form>
      <a class="profile-password-link" href="/pages/cuenta/?change=1"
        >Cambiar contraseña<svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 5 7 7-7 7" /></svg
      ></a>
    </section>`,
  );
  if (user.role === 'admin') {
    // Loading the optional export screen must not prevent editing the profile.
    import('./exports.js')
      .then(({ mountExports }) => mountExports(content, user))
      .catch(() => {
        const fallback = document.createElement('section');
        fallback.className = 'account-card export-card';
        setHTML(
          fallback,
          html`<h2>Exportar Excel</h2>
            <p class="field-hint">No pudimos cargar la exportación.</p>
            <button class="button" type="button">Reintentar exportación</button>`,
        );
        fallback.querySelector('button').onclick = () => location.reload();
        content.append(fallback);
      });
  }
  content.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target,
      button = form.querySelector('button'),
      restore = pendingButton(button, 'Guardando nombre…');
    message.hidden = true;
    message.textContent = '';
    try {
      const result = await api('/api/profile', {
        name: new FormData(form).get('name'),
        expectedRevision: user.revision,
      });
      user = result.user;
      identityBar(user);
      showNotice('Nombre visible actualizado.');
    } catch (error) {
      notify(error.message);
    } finally {
      restore();
    }
  };
} else {
  if (user) identityBar(user);
  document.querySelector('#account-back').hidden = !user || user.mustChange;
  setHTML(
    content,
    html`<section class="account-card">
      <div class="account-heading">
        <div class="account-symbol">${lock}</div>
        <div>
          <p class="eyebrow">${user ? user.name : 'Acceso personal'}</p>
          <h2>${user ? 'Cambiar contraseña' : 'Ingresar al inventario'}</h2>
        </div>
      </div>
      ${user ? html`<p class="view-intro">${user.mustChange ? 'Para continuar, reemplaza tu contraseña temporal.' : 'Al cambiarla, se cerrarán tus sesiones en todos los dispositivos.'}</p>` : ''}
      <form>
        ${user ? [passwordField('Contraseña actual', 'currentPassword', 'current-password', false), passwordField('Nueva contraseña', 'newPassword', 'new-password'), passwordField('Repetir nueva contraseña', 'confirmPassword', 'new-password')] : html`<label>Usuario<input name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required /></label>${passwordField('Contraseña', 'password', 'current-password', false)}`}
        <p class="field-hint ${user ? '' : 'login-help'}">
          ${user ? 'Al menos 8 caracteres.' : '¿Necesitas una cuenta o restablecer tu contraseña? Contacta al administrador.'}
        </p>
        <button class="button button-primary" type="submit">
          ${user ? 'Guardar contraseña' : 'Ingresar'}
        </button>
      </form>
    </section>`,
  );
  bindPasswordFields(content);
  content.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target,
      b = Object.fromEntries(new FormData(form));
    if (user && b.newPassword !== b.confirmPassword) {
      notify('Las contraseñas nuevas no coinciden.');
      return;
    }
    delete b.confirmPassword;
    const button = form.querySelector('[type=submit]');
    const restore = pendingButton(button, user ? 'Guardando contraseña…' : 'Ingresando…');
    message.hidden = true;
    try {
      const result = await api(user ? '/api/password' : '/api/login', b);
      if (user) {
        sessionStorage.removeItem('inventory-user');
        location.replace('/pages/cuenta/');
      } else {
        sessionStorage.setItem('inventory-user', result.user.id);
        location.replace(result.user.mustChange ? '/pages/cuenta/' : result.homeUrl || '/');
      }
    } catch (err) {
      notify(err.message || 'No se pudo conectar. Inténtalo de nuevo.');
      restore();
    }
  };
}

const heading = content.querySelector('.account-heading');
if (heading) heading.after(message);
else content.before(message);
reveal(content);
