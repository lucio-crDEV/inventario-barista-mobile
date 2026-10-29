import { html, setHTML } from './html.js';
const closeIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="m6 6 12 12M18 6 6 18" />
</svg>`;
const themeIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true">
  <path class="theme-icon-moon" d="M20.4 15.3A8.5 8.5 0 0 1 8.7 3.6 8.5 8.5 0 1 0 20.4 15.3Z" />
  <g class="theme-icon-sun">
    <circle cx="12" cy="12" r="4" />
    <path
      d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"
    />
  </g>
</svg>`;

function mountSettings() {
  const trigger = document.querySelector('[data-settings-toggle]');
  if (!trigger) return;
  const drawer = document.createElement('div');
  drawer.id = 'settings-drawer';
  drawer.className = 'settings-drawer';
  drawer.inert = true;
  drawer.setAttribute('aria-hidden', 'true');
  setHTML(
    drawer,
    html`<button
        class="settings-backdrop"
        type="button"
        tabindex="-1"
        aria-label="Cerrar menú"
      ></button>
      <aside
        class="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabindex="-1"
      >
        <header class="settings-heading">
          <h2 id="settings-title">Mi cuenta</h2>
          <button class="settings-close" type="button" aria-label="Cerrar menú">
            ${closeIcon}
          </button>
        </header>
        <div data-settings-account><p class="settings-guest">Acceso personal</p></div>
        <section class="settings-appearance" aria-labelledby="appearance-title">
          <h3 id="appearance-title">Apariencia</h3>
          <button
            class="appearance-toggle"
            type="button"
            data-theme-toggle
            aria-label="Activar modo oscuro"
            aria-pressed="false"
          >
            ${themeIcon}<span data-theme-name>Modo claro</span
            ><span class="theme-switch" aria-hidden="true"></span>
          </button>
        </section>
      </aside>`,
  );
  document.body.append(drawer);
  const main = document.querySelector('main');
  const panel = drawer.querySelector('.settings-panel');
  function close() {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.inert = true;
    main.inert = false;
    document.body.classList.remove('settings-open');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus({ preventScroll: true });
  }
  trigger.addEventListener('click', () => {
    drawer.inert = false;
    drawer.setAttribute('aria-hidden', 'false');
    drawer.classList.add('is-open');
    main.inert = true;
    document.body.classList.add('settings-open');
    trigger.setAttribute('aria-expanded', 'true');
    drawer.querySelector('.settings-close').focus({ preventScroll: true });
  });
  drawer.querySelector('.settings-close').onclick = close;
  drawer.querySelector('.settings-backdrop').onclick = close;
  panel.addEventListener('keydown', (event) => {
    // Inventory shortcuts must not act on a form behind the menu.
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      const controls = [...panel.querySelectorAll('button, a[href]')].filter(
        (el) => !el.disabled && el.getClientRects().length,
      );
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  });
  document.dispatchEvent(new Event('inventory:theme-controls'));
}

mountSettings();
export function settingsAccount(bar) {
  // The sign-in screen starts with a theme control only. An authenticated
  // password-change view upgrades that control to the account menu.
  const accountTheme = document.querySelector('[data-account-theme]');
  if (accountTheme) {
    accountTheme.removeAttribute('data-theme-toggle');
    accountTheme.removeAttribute('aria-pressed');
    accountTheme.removeAttribute('title');
    accountTheme.classList.add('settings-toggle');
    accountTheme.setAttribute('data-settings-toggle', '');
    accountTheme.setAttribute('aria-label', 'Abrir menú de cuenta y ajustes');
    accountTheme.setAttribute('aria-controls', 'settings-drawer');
    accountTheme.setAttribute('aria-expanded', 'false');
    setHTML(
      accountTheme,
      html`<svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
      </svg>`,
    );
  }
  if (!document.querySelector('#settings-drawer')) mountSettings();
  document.querySelector('[data-settings-account]')?.replaceChildren(bar);
}
