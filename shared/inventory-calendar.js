export function localDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
export function recommendation(date = new Date()) {
  const day = localDay(date),
    d = new Date(day + 'T12:00:00Z');
  const sunday = d.getUTCDay() === 0;
  const monthEnd =
    d.getUTCDate() === new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return {
    day,
    type: sunday && monthEnd ? 'both' : monthEnd ? 'month_end' : 'weekly',
    message:
      sunday && monthEnd
        ? 'Hoy es domingo y fin de mes. Te recomendamos abrir un inventario.'
        : monthEnd
          ? 'Hoy es fin de mes. Te recomendamos abrir un inventario.'
          : sunday
            ? 'Hoy es domingo. Te recomendamos abrir un inventario.'
            : '',
  };
}
export function relativeInventoryDate(value, date = new Date()) {
  if (!value) return 'sin anteriores';
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return 'fecha no disponible';
  const day = localDay(new Date(time)),
    elapsed = Math.max(0, Math.round((Date.parse(localDay(date)) - Date.parse(day)) / 86400000));
  return elapsed === 0
    ? 'hoy'
    : elapsed < 7
      ? `hace ${elapsed} ${elapsed === 1 ? 'día' : 'días'}`
      : day.split('-').reverse().join('/');
}
