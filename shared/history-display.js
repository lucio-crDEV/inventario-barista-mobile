export const historyCategory = (action) =>
  ['overwrite', 'rectify'].includes(action) ? 'correction' : action === 'annul' ? 'annul' : 'count';
const zone = 'America/Santiago';
const dayKey = (date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
export function absoluteTime(value) {
  const date = new Date(value);
  return Number.isFinite(+date)
    ? new Intl.DateTimeFormat('es-CL', {
        timeZone: zone,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date)
    : 'Fecha no disponible';
}
export function relativeTime(value, now = Date.now()) {
  const date = new Date(value),
    current = new Date(now);
  if (!Number.isFinite(+date)) return 'Fecha no disponible';
  const day = dayKey(date),
    today = dayKey(current),
    yesterday = new Date(Date.parse(today + 'T12:00:00Z') - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
  if (day === today) {
    const seconds = Math.max(0, Math.floor((+current - +date) / 1000));
    if (seconds < 60) return 'Hace unos segundos';
    if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
    return `Hace ${Math.floor(seconds / 3600)} h`;
  }
  if (day === yesterday) return 'Ayer';
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
export function historyDay(value) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: zone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}
export function movementLabel(h, unit = '') {
  if (h.action === 'annul') return 'Conteo anulado';
  if (historyCategory(h.action) === 'correction') return 'Total corregido';
  if (h.action === 'add' && Number.isFinite(h.entered?.quantity))
    return `+${h.entered.quantity} ${unit}`.trim();
  if (h.after?.outOfStock) return 'Sin stock guardado';
  return 'Conteo guardado';
}
