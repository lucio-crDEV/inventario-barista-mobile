import { escapeHtml as esc } from './client.js';
import { inventoryDates, monthCells } from './inventory-dates.js';

const arrow = (direction) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${direction < 0 ? 'm14 5-7 7 7 7' : 'm10 5 7 7-7 7'}"/></svg>`;
const monthName = (value) => {
  const name = new Intl.DateTimeFormat('es-CL', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value + '-01T12:00:00Z'));
  return name[0].toUpperCase() + name.slice(1);
};
const fullDate = (value) =>
  new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value + 'T12:00:00Z'));

export function mountInventoryDatePicker(
  host,
  cycles,
  { initial = '', includePrepared = false, onChange },
) {
  const dates = inventoryDates(cycles, includePrepared),
    months = [...new Set(dates.map(([date]) => date.slice(0, 7)))],
    years = [...new Set(months.map((month) => month.slice(0, 4)))];
  let selected = '',
    month = months.includes(initial.slice(0, 7)) ? initial.slice(0, 7) : months.at(-1),
    periods = false,
    year = month?.slice(0, 4);
  host.innerHTML =
    '<div class="inventory-date-tools"><button type="button" data-date-open aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg><span>Elegir fecha</span></button><button type="button" data-date-clear aria-label="Quitar filtro de fecha" hidden>Ver todos</button></div><section class="inventory-calendar" aria-label="Calendario de inventarios" hidden></section>';
  const open = host.querySelector('[data-date-open]'),
    clear = host.querySelector('[data-date-clear]'),
    calendar = host.querySelector('section');
  open.disabled = !dates.length;
  function render() {
    const index = months.indexOf(month),
      yearIndex = years.indexOf(year);
    calendar.innerHTML = `<div class="inventory-calendar-heading"><button type="button" data-step="-1" aria-label="${periods ? 'Año' : 'Mes'} anterior" ${(periods ? yearIndex : index) <= 0 ? 'disabled' : ''}>${arrow(-1)}</button><button type="button" data-period aria-label="${periods ? 'Volver al calendario' : 'Elegir mes y año'}">${esc(periods ? year : monthName(month))}</button><button type="button" data-step="1" aria-label="${periods ? 'Año' : 'Mes'} siguiente" ${(periods ? yearIndex >= years.length - 1 : index >= months.length - 1) ? 'disabled' : ''}>${arrow(1)}</button></div>${
      periods
        ? `<div class="inventory-month-grid">${Array.from({ length: 12 }, (_, i) => {
            const value = year + '-' + String(i + 1).padStart(2, '0');
            return `<button type="button" data-month="${value}" ${months.includes(value) ? '' : 'disabled'}>${esc(new Intl.DateTimeFormat('es-CL', { month: 'short', timeZone: 'UTC' }).format(new Date(value + '-01T12:00:00Z')))}</button>`;
          }).join('')}</div>`
        : `<div class="inventory-weekdays" aria-hidden="true">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day) => `<span>${day}</span>`).join('')}</div><div class="inventory-day-grid" role="group" aria-label="Fechas disponibles">${monthCells(
            month,
            dates,
          )
            .map((day) =>
              day
                ? `<button type="button" data-date="${day.date}" aria-label="${esc(fullDate(day.date))}, ${day.count ? day.count + ' ' + (day.count === 1 ? 'inventario' : 'inventarios') : 'sin inventarios'}" aria-pressed="${selected === day.date}" ${day.count ? '' : 'disabled'}>${day.number}${day.count ? '<span aria-hidden="true">•</span>' : ''}</button>`
                : '<span></span>',
            )
            .join('')}</div>`
    }`;
  }
  function close() {
    calendar.hidden = true;
    open.setAttribute('aria-expanded', 'false');
    open.focus({ preventScroll: true });
  }
  open.onclick = () => {
    calendar.hidden = !calendar.hidden;
    open.setAttribute('aria-expanded', String(!calendar.hidden));
    if (!calendar.hidden) {
      periods = false;
      year = month.slice(0, 4);
      render();
      calendar.querySelector('[data-date]:not(:disabled)')?.focus({ preventScroll: true });
    }
  };
  clear.onclick = () => {
    selected = '';
    open.querySelector('span').textContent = 'Elegir fecha';
    clear.hidden = true;
    onChange('');
    close();
  };
  calendar.onclick = (event) => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.date) {
      selected = button.dataset.date;
      open.querySelector('span').textContent = selected.split('-').reverse().join('/');
      clear.hidden = false;
      onChange(selected);
      close();
      return;
    }
    if (button.dataset.month) {
      month = button.dataset.month;
      periods = false;
    } else if (button.hasAttribute('data-period')) {
      periods = !periods;
      year = month.slice(0, 4);
    } else if (button.dataset.step) {
      if (periods) year = years[years.indexOf(year) + Number(button.dataset.step)];
      else {
        month = months[months.indexOf(month) + Number(button.dataset.step)];
        year = month.slice(0, 4);
      }
    }
    render();
    calendar.querySelector('[data-period]').focus({ preventScroll: true });
  };
  host.addEventListener('keydown', (event) => {
    if (!calendar.hidden && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
    if (
      !event.target.matches('[data-date]') ||
      !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
    )
      return;
    const controls = [...calendar.querySelectorAll('[data-date]:not(:disabled)')],
      index = controls.indexOf(event.target);
    event.preventDefault();
    controls[
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? controls.length - 1
          : Math.max(0, Math.min(controls.length - 1, index + (event.key === 'ArrowLeft' ? -1 : 1)))
    ]?.focus();
  });
}
