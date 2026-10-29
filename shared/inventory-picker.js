import { html, setHTML, joinHTML } from './html.js';
import { dialog } from './client.js';
import { cycleLabel, cycleTypeNames } from './cycles.js';
import { cycleIsActive, inventoryHistory, inventoryDay } from './inventory-history.js';
import { mountInventoryDatePicker } from './inventory-date-picker.js';

export function inventoryStatus(cycle) {
  if (!cycle) return '';
  const active = cycleIsActive(cycle);
  return html`<span class="inventory-status${active ? ' is-active' : ''}"
    >${cycle.lifecycle === 'prepared' ? 'Preparado' : active ? 'Activo' : 'Finalizado'}</span
  >`;
}

export function closeAccountMenu() {
  document.querySelector('#settings-drawer.is-open .settings-close')?.click();
}

export function openInventoryPicker(cycles, current, { includePrepared = false } = {}) {
  closeAccountMenu();
  const el = dialog(
    'Seleccionar inventario',
    html`<div data-inventory-date-picker></div>
      <p class="inventory-history-count" role="status" data-history-count></p>
      <div class="inventory-history-list" data-history-list></div>
      <button type="button" class="inventory-history-more" data-history-more>Cargar más</button
      ><button
        type="button"
        class="inventory-history-close"
        data-history-close
        aria-label="Cerrar selector de inventarios"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>`,
  );
  el.classList.add('inventory-history-dialog');
  let limit = 24,
    date = '';
  function render() {
    const history = inventoryHistory(cycles, { date, limit, includePrepared });
    el.querySelector('[data-history-count]').textContent =
      `${history.total} ${history.total === 1 ? 'inventario' : 'inventarios'}`;
    el.querySelector('[data-history-more]').hidden = !history.hasMore;
    setHTML(
      el.querySelector('[data-history-list]'),
      history.groups.length
        ? joinHTML(
            history.groups.map(
              ([month, entries]) =>
                html`<section>
                  <h3>${month}</h3>
                  ${joinHTML(
                    entries.map(
                      (cycle) =>
                        html`<button
                          type="button"
                          class="inventory-history-entry"
                          data-cycle="${cycle.id}"
                          ${cycle.id === current?.id ? html`aria-current="true"` : ''}
                        >
                          <span
                            ><strong>${cycleLabel(cycle)}</strong
                            ><small
                              >${cycleTypeNames[cycle.type] || ''}${cycle.id === current?.id ? ' · Seleccionado' : ''}</small
                            ></span
                          >${inventoryStatus(cycle)}
                        </button>`,
                    ),
                  )}
                </section>`,
            ),
          )
        : html`<p>No hay inventarios para esta búsqueda.</p>`,
    );
  }
  mountInventoryDatePicker(el.querySelector('[data-inventory-date-picker]'), cycles, {
    initial: current ? inventoryDay(current) : '',
    includePrepared,
    onChange: (value) => {
      date = value;
      limit = 24;
      render();
    },
  });
  el.querySelector('[data-history-more]').onclick = () => {
    limit += 24;
    render();
  };
  el.querySelector('[data-history-close]').onclick = () => el.close();
  el.querySelector('[data-history-list]').onclick = (event) => {
    const selected = event.target.closest('[data-cycle]');
    if (!selected) return;
    if (selected.dataset.cycle === current?.id) return el.close();
    const next = selected.dataset.cycle;
    const confirm = dialog(
      'Cambiar inventario',
      html`<p>Los cambios pendientes se conservarán en el inventario actual.</p>
        <div class="inventory-dialog-actions">
          <button type="button" data-cancel autofocus>Cancelar</button
          ><button type="button" data-go>Cambiar inventario</button>
        </div>`,
    );
    confirm.querySelector('[data-cancel]').onclick = () => confirm.close();
    confirm.querySelector('[data-go]').onclick = () => {
      const url = new URL(location.href);
      url.searchParams.set('inventory', next);
      location.assign(url);
    };
  };
  render();
}
