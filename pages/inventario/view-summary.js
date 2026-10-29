import { html, setHTML, joinHTML } from '../../shared/html.js';

export function createSummaryState() {
  return { status: 'pending', open: new Set(), pages: new Map(), scroll: 0, animated: false };
}

export function summaryGroups(items, status, getCount, category, location) {
  const groups = new Map();
  const locations = new Set(items.map((item) => item.locationId));
  for (const [index, item] of items.entries()) {
    if (getCount(item.id).status !== status) continue;
    const name = category(item),
      key = `${item.locationId || item.areaId}|${name}`;
    if (!groups.has(key))
      groups.set(key, { key, name, location: locations.size > 1 ? location(item) : '', items: [] });
    groups.get(key).items.push({ item, index });
  }
  return [...groups.values()];
}

export function renderSummaryView(
  container,
  { items, getCount, category, location, state, onItem },
) {
  if (container.querySelector('.summary-view')) state.scroll = window.scrollY;
  const stats = { pending: 0, partial: 0, counted: 0, total: items.length };
  for (const item of items)
    stats[
      ['pending', 'partial', 'counted'].includes(getCount(item.id).status)
        ? getCount(item.id).status
        : 'pending'
    ]++;
  const percent = stats.total
    ? Math.round(((stats.counted + stats.partial) / stats.total) * 100)
    : 0;
  const counted = stats.total ? (stats.counted / stats.total) * 100 : 0;
  const partial = stats.total ? (stats.partial / stats.total) * 100 : 0;
  const names = { pending: 'Pendientes', partial: 'Avance', counted: 'Contados' };
  const groups = summaryGroups(items, state.status, getCount, category, location);
  const motion = !state.animated && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const value = (n) => (motion ? 0 : n);
  const quantities = (item, count) =>
    count.status === 'pending'
      ? 'Sin conteo'
      : html`${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 3 }).format(count.quantity)}
        ${item.unit || ''}${count.outOfStock ? html`<small>Sin stock</small>` : ''}`;
  setHTML(
    container,
    html`<section class="summary-view summary-compact">
      <h2>
        ${stats.total && !stats.pending && !stats.partial ? 'Inventario completo' : 'Resumen del inventario'}
      </h2>
      <div class="summary-progress-heading">
        <h3>Avance del área</h3>
        <p>${stats.counted} de ${stats.total} ítems contabilizados</p>
      </div>
      <section
        class="summary-progress-card"
        aria-label="${percent}% con registro, ${stats.counted} contados y ${stats.partial} con avance de ${stats.total} activos"
      >
        <svg class="summary-circle" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="43" class="summary-circle-track" />
          <circle
            cx="50"
            cy="50"
            r="43"
            pathLength="100"
            data-ring="counted"
            class="summary-circle-counted"
            stroke-dasharray="${value(counted)} ${100 - value(counted)}"
          />
          <circle
            cx="50"
            cy="50"
            r="43"
            pathLength="100"
            data-ring="partial"
            class="summary-circle-partial"
            stroke-dasharray="${value(partial)} ${100 - value(partial)}"
            stroke-dashoffset="${-value(counted)}"
          />
          <text
            x="50"
            y="48"
            class="summary-circle-value"
            text-anchor="middle"
            data-counter="${percent}"
            data-suffix="%"
          >
            ${value(percent)}%
          </text>
          <text x="50" y="64" class="summary-circle-label" text-anchor="middle">con registro</text>
        </svg>
        <div class="summary-counters" role="group" aria-label="Ver productos por estado">
          ${joinHTML(
            Object.entries(names).map(
              ([key, label]) =>
                html`<button
                  type="button"
                  class="summary-counter summary-counter-${key}"
                  data-summary-status="${key}"
                  aria-pressed="${state.status === key}"
                  aria-label="${label}: ${stats[key]}"
                >
                  <span><i aria-hidden="true"></i>${label}</span
                  ><strong data-counter="${stats[key]}" aria-hidden="true"
                    >${value(stats[key])}</strong
                  >
                </button>`,
            ),
          )}
        </div>
      </section>
      <div class="summary-group-heading">
        <h3>
          ${state.status === 'pending' ? 'Productos pendientes' : state.status === 'partial' ? 'Productos con avance' : 'Productos contados'}
        </h3>
        <span>${groups.length} categorías</span>
      </div>
      <div class="summary-groups">
        ${
          groups.length
            ? joinHTML(
                groups.map((group, groupIndex) => {
                  const page = Math.min(
                    state.pages.get(group.key) || 0,
                    Math.max(0, Math.ceil(group.items.length / 20) - 1),
                  );
                  const visible = group.items.slice(page * 20, (page + 1) * 20);
                  return html`<details
                    class="summary-category"
                    data-group="${groupIndex}"
                    ${state.open.has(`${state.status}|${group.key}`) ? 'open' : ''}
                  >
                    <summary>
                      <span
                        >${group.name}${group.location ? html`<small>${group.location}</small>` : ''}</span
                      ><span class="summary-category-count">${group.items.length}</span
                      ><span class="summary-chevron" aria-hidden="true">›</span>
                    </summary>
                    <div>
                      ${joinHTML(
                        visible.map(
                          ({ item, index }) =>
                            html`<button
                              type="button"
                              class="summary-item-button"
                              data-item-index="${index}"
                            >
                              <span class="summary-item-main"
                                ><strong>${item.name}</strong
                                >${state.status === 'pending' ? html`<small>${item.unit || ''}</small>` : ''}</span
                              ><span class="summary-item-value"
                                >${quantities(item, getCount(item.id))}<span aria-hidden="true"
                                  >›</span
                                ></span
                              >
                            </button>`,
                        ),
                      )}${group.items.length > 20 ? html`<div class="summary-group-pages"><button type="button" data-group-page="${groupIndex}" data-delta="-1" ${page === 0 ? 'disabled' : ''}>Anterior</button><span>${page * 20 + 1}–${Math.min((page + 1) * 20, group.items.length)} de ${group.items.length}</span><button type="button" data-group-page="${groupIndex}" data-delta="1" ${(page + 1) * 20 >= group.items.length ? 'disabled' : ''}>Siguiente</button></div>` : ''}
                    </div>
                  </details>`;
                }),
              )
            : html`<p class="summary-empty">No hay productos en este estado.</p>`
        }
      </div>
    </section>`,
  );
  for (const button of container.querySelectorAll('[data-summary-status]'))
    button.onclick = () => {
      state.status = button.dataset.summaryStatus;
      renderSummaryView(container, { items, getCount, category, location, state, onItem });
    };
  for (const details of container.querySelectorAll('[data-group]'))
    details.addEventListener('toggle', () => {
      if (!details.isConnected) return;
      const key = `${state.status}|${groups[Number(details.dataset.group)].key}`;
      if (details.open) state.open.add(key);
      else state.open.delete(key);
    });
  for (const button of container.querySelectorAll('[data-item-index]'))
    button.onclick = () => {
      state.scroll = window.scrollY;
      onItem(Number(button.dataset.itemIndex));
    };
  for (const button of container.querySelectorAll('[data-group-page]'))
    button.onclick = () => {
      const group = groups[Number(button.dataset.groupPage)];
      state.pages.set(group.key, (state.pages.get(group.key) || 0) + Number(button.dataset.delta));
      renderSummaryView(container, { items, getCount, category, location, state, onItem });
    };
  if (state.scroll) requestAnimationFrame(() => window.scrollTo(0, state.scroll));
  state.animated = true;
  if (motion) {
    const counters = [...container.querySelectorAll('[data-counter]')],
      green = container.querySelector('[data-ring=counted]'),
      amber = container.querySelector('[data-ring=partial]');
    let start;
    const frame = (now) => {
      if (!counters.every((el) => el.isConnected)) return;
      start ??= now;
      const t = Math.min(1, (now - start) / 420),
        p = 1 - (1 - t) ** 3;
      for (const el of counters)
        el.textContent = Math.round(Number(el.dataset.counter) * p) + (el.dataset.suffix || '');
      green.setAttribute('stroke-dasharray', `${counted * p} ${100 - counted * p}`);
      amber.setAttribute('stroke-dasharray', `${partial * p} ${100 - partial * p}`);
      amber.setAttribute('stroke-dashoffset', String(-counted * p));
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}
