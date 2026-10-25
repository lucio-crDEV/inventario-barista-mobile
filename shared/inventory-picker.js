import { dialog, escapeHtml as esc } from './client.js';
import { cycleLabel, cycleTypeNames } from './cycles.js';
import { cycleIsActive, inventoryHistory } from './inventory-history.js';

export function inventoryStatus(cycle) {
  if (!cycle) return '';
  const active = cycleIsActive(cycle);
  return `<span class="inventory-status${active ? ' is-active' : ''}">${active ? 'Activo' : 'Finalizado'}</span>`;
}

export function closeAccountMenu() {
  document.querySelector('#settings-drawer.is-open .settings-close')?.click();
}

export function openInventoryPicker(cycles, current) {
  closeAccountMenu();
  const el = dialog('Seleccionar inventario', `<div class="inventory-history-tools"><input type="search" aria-label="Buscar inventario" placeholder="Buscar por fecha" autocomplete="off" data-history-search><select aria-label="Año" data-history-year><option value="">Todos los años</option>${inventoryHistory(cycles).years.map(year => `<option>${esc(year)}</option>`).join('')}</select></div><p class="inventory-history-count" role="status" data-history-count></p><div class="inventory-history-list" data-history-list></div><button type="button" class="inventory-history-more" data-history-more>Cargar más</button><button type="button" class="inventory-history-close" data-history-close>Cerrar</button>`);
  el.classList.add('inventory-history-dialog');
  let limit = 24;
  const search = el.querySelector('[data-history-search]'), year = el.querySelector('[data-history-year]');
  function render() {
    const history = inventoryHistory(cycles, { query: search.value, year: year.value, limit });
    el.querySelector('[data-history-count]').textContent = `${history.total} ${history.total === 1 ? 'inventario' : 'inventarios'}`;
    el.querySelector('[data-history-more]').hidden = !history.hasMore;
    el.querySelector('[data-history-list]').innerHTML = history.groups.length ? history.groups.map(([month, entries]) => `<section><h3>${esc(month)}</h3>${entries.map(cycle => `<button type="button" class="inventory-history-entry" data-cycle="${esc(cycle.id)}" ${cycle.id === current?.id ? 'aria-current="true"' : ''}><span><strong>${esc(cycleLabel(cycle))}</strong><small>${esc(cycleTypeNames[cycle.type] || '')}${cycle.id === current?.id ? ' · Seleccionado' : ''}</small></span>${inventoryStatus(cycle)}</button>`).join('')}</section>`).join('') : '<p>No hay inventarios para esta búsqueda.</p>';
  }
  search.oninput = year.onchange = () => { limit = 24; render(); };
  el.querySelector('[data-history-more]').onclick = () => { limit += 24; render(); };
  el.querySelector('[data-history-close]').onclick = () => el.close();
  el.querySelector('[data-history-list]').onclick = event => {
    const selected = event.target.closest('[data-cycle]');
    if (!selected) return;
    if (selected.dataset.cycle === current?.id) return el.close();
    const next = selected.dataset.cycle;
    const confirm = dialog('Cambiar inventario', '<p>Los cambios pendientes se conservarán en el inventario actual.</p><div class="inventory-dialog-actions"><button type="button" data-cancel autofocus>Cancelar</button><button type="button" data-go>Cambiar inventario</button></div>');
    confirm.querySelector('[data-cancel]').onclick = () => confirm.close();
    confirm.querySelector('[data-go]').onclick = () => { const url = new URL(location.href); url.searchParams.set('inventory', next); location.assign(url); };
  };
  render();
}
