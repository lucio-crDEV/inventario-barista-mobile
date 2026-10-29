import { html, joinHTML } from '../../shared/html.js';
import { isOutOfStockCount } from './work-selection.js';
export function countView({
  item,
  count,
  categoryIndex,
  isLastItem,
  isGarzonZone,
  category,
  area,
  quantityValue,
  statusIcon,
  statusLabel,
  currentFeedback,
  currentTone,
  drawer,
}) {
  const itemName = item.name,
    itemCategory = category,
    itemArea = area,
    itemUnit = item.unit,
    itemNote = count.note || '';
  return html`
    <section class="count-view">
      <div class="item-navigation-top" role="group" aria-label="Navegación de ítems">
        <button
          id="previous-item"
          class="button button-ghost"
          type="button"
          ${categoryIndex === 0 ? 'disabled' : ''}
        >
          ← Anterior
        </button>

        <button
          id="open-item-drawer"
          class="item-drawer-trigger"
          type="button"
          aria-controls="item-drawer"
          aria-expanded="false"
        >
          <span class="item-drawer-trigger-icon" aria-hidden="true">
            <span></span><span></span><span></span>
          </span>
          <span class="item-drawer-trigger-label">Ver ítems</span>
        </button>

        <button id="next-item" class="button button-ghost" type="button">
          ${isLastItem ? (isGarzonZone ? 'Resumen →' : 'Categorías →') : 'Siguiente →'}
        </button>
      </div>

      ${drawer}

      <article class="item-card">
        <div class="item-header">
          <div class="item-heading">
            <span class="item-category">
              ${isGarzonZone ? itemArea : `${itemCategory} · ${itemArea}`}
            </span>

            <h2>${itemName}</h2>
          </div>

          <span
            class="
              status-badge
              status-${isOutOfStockCount(count) ? 'out-of-stock' : count.status}
            "
          >
            ${statusIcon} ${statusLabel}
          </span>
        </div>

        <div class="field">
          <label for="quantity"> Cantidad (${itemUnit}) </label>

          <input
            id="quantity"
            type="text"
            inputmode="decimal"
            enterkeyhint="done"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            placeholder="0"
            value="${quantityValue}"
          />
        </div>

        <div class="field">
          <label for="note"> Nota </label>

          <textarea id="note" rows="3" maxlength="300" placeholder="Opcional">${itemNote}</textarea>
        </div>
      </article>

      <div class="count-actions">
        <button id="save-out-of-stock" class="button button-out-of-stock" type="button">
          Sin stock
        </button>

        <button id="save-partial" class="button button-secondary" type="button">Avance</button>

        <button id="save-counted" class="button button-primary" type="button">Listo</button>
      </div>

      <div class="summary-navigation">
        <button id="open-summary" class="button button-ghost" type="button">Ir a Resumen</button>
      </div>

      ${
        currentFeedback
          ? html`
              <p class="feedback feedback-toast feedback-toast-${currentTone}" role="status">
                ${currentFeedback}
              </p>
            `
          : ''
      }
    </section>
  `;
}
