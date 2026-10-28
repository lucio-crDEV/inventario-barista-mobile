const eye =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
const eyeOff =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 5.1A12 12 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3.2 4.1M6.2 6.2A20 20 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.8-1.8M10 10a3 3 0 0 0 4 4"/></svg>';

// Labels and names are application constants, never supplied by account data.
export function passwordField(label, name, autocomplete, newPassword = true) {
  return `<label>${label}<span class="password-field"><input name="${name}" type="password" autocomplete="${autocomplete}" autocapitalize="none" autocorrect="off" spellcheck="false" required ${newPassword ? 'minlength="8"' : ''}><button type="button" class="reveal-password" data-password-label="${label.toLowerCase()}" aria-label="Mostrar ${label.toLowerCase()}" aria-pressed="false">${eye}</button></span></label>`;
}
export function bindPasswordFields(host) {
  for (const button of host.querySelectorAll('.reveal-password'))
    button.onclick = () => {
      const field = button.previousElementSibling,
        visible = field.type === 'password';
      field.type = visible ? 'text' : 'password';
      button.innerHTML = visible ? eyeOff : eye;
      button.setAttribute('aria-pressed', String(visible));
      button.setAttribute(
        'aria-label',
        `${visible ? 'Ocultar' : 'Mostrar'} ${button.dataset.passwordLabel}`,
      );
    };
}
