export const cycleTypeNames = {weekly:'Semanal',month_end:'Fin de mes',both:'Semanal y fin de mes'};
export function cycleLabel(cycle) {
  const date = cycle.period?.split('-').reverse().join('/');
  return `${cycle.name}${date && !cycle.name.includes(date) && !cycle.name.includes(cycle.period) ? ' · '+date : ''}`;
}
export function defaultCycle(cycles) {
  const visible=cycles.filter(c=>c.lifecycle!=='deleted');
  return visible.find(c=>c.lifecycle!=='prepared'&&(c.state==='open'||c.state==='review'||c.scopeStates?.some(s=>s.state!=='closed')))
    || visible.find(c=>c.lifecycle!=='prepared'&&c.state==='closed') || null;
}
