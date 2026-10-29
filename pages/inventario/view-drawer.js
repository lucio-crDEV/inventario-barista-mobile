import { html, joinHTML } from '../../shared/html.js';
import { isOutOfStockCount } from './work-selection.js';
function drawerList({
  currentItemId,
  activeItems,
  isGarzonZone,
  getCountCategory,
  getCount,
  getStatusLabel,
}) {
  const groups = new Map();

  activeItems.forEach((item, index) => {
    const category = isGarzonZone ? '' : getCountCategory(item);
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category).push({ item, index });
  });

  return joinHTML(
    [...groups].map(([category, groupItems]) => {
      const buttons = groupItems.map(({ item, index }) => {
        const count = getCount(item.id);
        const status = count.status;
        const outOfStock = isOutOfStockCount(count);
        const isCurrent = item.id === currentItemId;
        return html`<button
        class="item-drawer-link${isCurrent ? ' is-current' : ''}${outOfStock ? ' is-out-of-stock' : ''}"
        type="button"
        data-item-index="${index}"
        ${isCurrent ? html`aria-current="true"` : ''}
      >
        <span class="item-drawer-status status-dot-${outOfStock ? 'out-of-stock' : status}" aria-hidden="true"></span>
        <span class="item-drawer-name">${item.name}</span>
        <span class="item-drawer-state">${getStatusLabel(status, outOfStock)}</span>
      </button>`;
      });
      // Each fragment owns its complete element. Splitting opening and closing
      // tags across fragments lets an HTML formatter change the surrounding DOM.
      return category
        ? html`<details class="item-drawer-group" data-item-group data-category="${category}"
      ${groupItems.some(({ item }) => item.id === currentItemId) ? 'open' : ''}>
      <summary class="item-drawer-group-toggle">${category}</summary>${buttons}
    </details>`
        : html`<section class="item-drawer-group" data-item-group>${buttons}</section>`;
    }),
  );
}

export function itemDrawerView(context) {
  return html` <div id="item-drawer" class="item-drawer" aria-hidden="true" inert>
    <button
      class="item-drawer-backdrop"
      type="button"
      tabindex="-1"
      aria-label="Cerrar listado de ítems"
    ></button>
    <aside
      class="item-drawer-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Listado de ítems"
      tabindex="-1"
    >
      <div class="item-drawer-controls">
        <input
          id="item-drawer-search"
          class="item-drawer-search"
          type="search"
          placeholder="Buscar producto"
          aria-label="Buscar producto"
          autocomplete="off"
        />
        <button
          id="close-item-drawer"
          class="item-drawer-close"
          type="button"
          aria-label="Cerrar listado"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M5 5l14 14M19 5 5 19" />
          </svg>
        </button>
      </div>
      <div class="item-drawer-list" id="item-drawer-list">${drawerList(context)}</div>
      <p id="item-drawer-empty" class="item-drawer-empty" hidden>
        No encontramos productos con ese nombre.
      </p>
    </aside>
  </div>`;
}
