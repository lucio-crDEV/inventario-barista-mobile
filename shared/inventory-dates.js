import { inventoryDay } from './inventory-history.js';

export function inventoryDates(cycles, includePrepared = false) {
  const counts = new Map();
  for (const cycle of cycles) {
    if (cycle.lifecycle === 'deleted' || !includePrepared && cycle.lifecycle === 'prepared') continue;
    const day = inventoryDay(cycle);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0,10) !== day) continue;
    counts.set(day, (counts.get(day) || 0) + 1);
  }
  return [...counts].sort(([a],[b]) => a.localeCompare(b));
}
export function monthCells(month, dates) {
  const [year, number] = month.split('-').map(Number);
  const start = (new Date(Date.UTC(year,number-1,1)).getUTCDay()+6)%7;
  const length = new Date(Date.UTC(year,number,0)).getUTCDate(), counts = new Map(dates);
  return Array.from({length:start+length},(_,i)=> {
    if (i<start) return null;
    const date=month+'-'+String(i-start+1).padStart(2,'0');
    return {date,number:i-start+1,count:counts.get(date)||0};
  });
}
