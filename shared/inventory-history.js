import { cycleLabel } from './cycles.js';

export function cycleIsActive(cycle) {
  return !['prepared', 'deleted'].includes(cycle.lifecycle) && Boolean(cycle.state !== 'closed' || cycle.scopeStates?.some(scope => scope.state !== 'closed'));
}

const normalize = value => value.toLocaleLowerCase('es-CL').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export function inventoryDay(cycle) {
  return cycle.period || cycle.created_at?.slice(0, 10) || '';
}

// Only a small page is rendered, even when the authorized history spans years.
export function inventoryHistory(cycles, { query = '', year = '', limit = 24 } = {}) {
  const visible = cycles.filter(cycle => !['prepared', 'deleted'].includes(cycle.lifecycle));
  const years = [...new Set(visible.map(cycle => inventoryDay(cycle).slice(0, 4)).filter(Boolean))].sort().reverse();
  const needle = normalize(query.trim());
  const matches = visible.filter(cycle => (!year || inventoryDay(cycle).startsWith(year + '-')) &&
    (!needle || normalize(cycleLabel(cycle) + ' ' + inventoryDay(cycle)).includes(needle)))
    .sort((a, b) => Number(cycleIsActive(b)) - Number(cycleIsActive(a)) || inventoryDay(b).localeCompare(inventoryDay(a)));
  const groups = new Map();
  for (const cycle of matches.slice(0, limit)) {
    const day = inventoryDay(cycle);
    const key = cycleIsActive(cycle) ? 'Activos' : day ? new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(day + 'T12:00:00Z')) : 'Anteriores';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(cycle);
  }
  return { years, groups: [...groups], total: matches.length, hasMore: matches.length > limit };
}
