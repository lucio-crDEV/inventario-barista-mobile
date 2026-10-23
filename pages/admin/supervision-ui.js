// Presentation helpers never change counts, product identity or Excel references.
export const stateNames = Object.freeze({
  open: 'Abierto', review: 'Cerrado para revisión', closed: 'Finalizado y enviado',
  pending: 'Pendiente', partial: 'Avance', counted: 'Contado', excluded: 'Inactivo',
});
export const actionNames = Object.freeze({
  direct: 'Conteo guardado', add: 'Conteo guardado', overwrite: 'Corrección',
  rectify: 'Corrección', annul: 'Anulación', activation: 'Actividad de producto', state: 'Estado del inventario',
});
export function progressParts(group) {
  const total = Math.max(0, Number(group.total) || 0);
  const counted = Math.min(total, Math.max(0, Number(group.counted) || 0));
  const partial = Math.min(total - counted, Math.max(0, Number(group.partial) || 0));
  return { total, counted, partial, percent: total ? Math.round((counted + partial) * 100 / total) : 0,
    countedPercent: total ? counted * 100 / total : 0, partialPercent: total ? partial * 100 / total : 0 };
}
export function asDate(value) {
  if (!value) return null;
  const date = new Date(typeof value === 'number' && value < 1e12 ? value * 1000 : value);
  return Number.isFinite(date.getTime()) ? date : null;
}
export function dateTime(value) {
  const date = asDate(value);
  return date ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date) : 'Fecha no disponible';
}
export function calendarDay(value) {
  const date = asDate(value);
  return date ? new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }).format(date) : 'Fecha no disponible';
}
export function eventCategory(action) {
  return action === 'annul' ? 'annul' : ['overwrite', 'rectify'].includes(action) ? 'correction' : 'count';
}
export function mayReopen(role, current) {
  return role === 'admin' ? ['review', 'closed'].includes(current) : role === 'service_lead' && current === 'review';
}
export function movementQuantity(event) {
  if (event.action === 'annul') return 'Vuelve a pendiente';
  const after = event.after;
  if (!after || after.status === 'pending') return 'Sin conteo';
  if (event.action === 'add' && Number.isFinite(Number(event.entered?.quantity))) {
    return `+${Number(event.entered.quantity)}${event.unit ? ` ${event.unit}` : ''}`;
  }
  if (event.action === 'add' && Number.isFinite(Number(after.quantity)) && Number.isFinite(Number(event.before?.quantity))) {
    return `+${Number(after.quantity) - Number(event.before.quantity)}${event.unit ? ` ${event.unit}` : ''}`;
  }
  return `${Number(after.quantity)}${event.unit ? ` ${event.unit}` : ''}`;
}
