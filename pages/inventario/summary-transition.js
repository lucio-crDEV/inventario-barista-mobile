/** Muestra un acento visual mientras el resumen ya está disponible. */
export function showSummaryTransition(
  container,
  { reducedMotion = false, duration = 800, schedule = setTimeout } = {},
) {
  if (reducedMotion || !container?.querySelector('.summary-view')) return null;

  const indicator = container.ownerDocument.createElement('div');
  indicator.className = 'summary-transition';
  indicator.setAttribute('aria-hidden', 'true');
  indicator.innerHTML =
    '<span class="summary-transition-mark"></span><span>Preparando resumen</span>';
  container.querySelector('.summary-view').prepend(indicator);
  schedule(() => indicator.remove(), duration);
  return indicator;
}
