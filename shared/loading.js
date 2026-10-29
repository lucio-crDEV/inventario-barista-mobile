import { html } from './html.js';
// Feedback is immediate; no minimum loading time or cached inventory is introduced.
const transitions = new WeakMap();
export function reveal(container, key = 'ready') {
  if (!container || transitions.get(container)?.key === key) return;
  transitions.get(container)?.animation?.cancel();
  const animation = !matchMedia('(prefers-reduced-motion: reduce)').matches
    ? container.animate?.([{ opacity: 0.35 }, { opacity: 1 }], {
        duration: 180,
        easing: 'cubic-bezier(.2,.8,.2,1)',
      })
    : null;
  transitions.set(container, { key, animation });
}
export function loading(container) {
  container.setAttribute('aria-busy', 'true');
  const timeout = setTimeout(() => {
    const hint = container.querySelector('[data-loading-hint]');
    if (hint) hint.textContent = 'La conexión está tardando más de lo habitual.';
  }, 4000);
  return () => {
    clearTimeout(timeout);
    container.setAttribute('aria-busy', 'false');
  };
}
export function pendingButton(button, label) {
  if (!button) return () => {};
  const text = button.textContent,
    disabled = button.disabled;
  button.disabled = true;
  button.textContent = label;
  button.classList.add('is-pending');
  button.setAttribute('aria-busy', 'true');
  return () => {
    button.textContent = text;
    button.disabled = disabled;
    button.classList.remove('is-pending');
    button.removeAttribute('aria-busy');
  };
}
export function historyLoading() {
  return html`<div class="loading-state">
    <p class="loading-label" role="status">Cargando historial…<small data-loading-hint></small></p>
    <div class="skeleton-stack" aria-hidden="true">
      <span class="skeleton skeleton-line"></span><span class="skeleton skeleton-field"></span
      ><span class="skeleton skeleton-line"></span><span class="skeleton skeleton-field"></span>
    </div>
  </div>`;
}
