// Only templates created here can cross the DOM markup boundary. Ordinary
// interpolations, including array members, always become escaped text.
const fragments = new WeakMap();
export const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );

function text(value) {
  if (value !== null && typeof value === 'object' && fragments.has(value))
    return fragments.get(value);
  if (Array.isArray(value)) return value.map(text).join('');
  return escapeHtml(value);
}
function fragment(markup) {
  const result = Object.freeze(Object.create(null));
  fragments.set(result, markup);
  return result;
}
export function html(strings, ...values) {
  if (
    !Array.isArray(strings) ||
    !Object.isFrozen(strings) ||
    !Array.isArray(strings.raw) ||
    !Object.isFrozen(strings.raw)
  ) {
    throw new TypeError('html debe usarse como etiqueta de una plantilla.');
  }
  return fragment(
    strings.reduce(
      (result, part, index) => result + part + (index < values.length ? text(values[index]) : ''),
      '',
    ),
  );
}
export function joinHTML(values, separator = '') {
  return fragment(Array.from(values, text).join(escapeHtml(separator)));
}
export function setHTML(element, content) {
  if (content === null || typeof content !== 'object' || !fragments.has(content)) {
    throw new TypeError('El contenido debe proceder de una plantilla html.');
  }
  element.innerHTML = fragments.get(content);
}
