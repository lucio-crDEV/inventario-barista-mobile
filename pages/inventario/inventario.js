import { escapeHtml } from '/shared/html.js';
import { createSummaryState, renderSummaryView } from './summary-view.js';
import { showNotice, transitionItem } from '/shared/notices.js';
import { SharedInventory } from '/shared/inventory.js';
import { loading, reveal } from '/shared/loading.js';
import { homeScope, canonicalScope, scopeURL, inventoryURL } from '/shared/navigation.js';
const initialContent = document.querySelector('#app-content');
const finishLoading = loading(initialContent);
let shared;
try {
  shared = await SharedInventory.create(new URLSearchParams(location.search).get('inventory'));
} catch (error) {
  finishLoading();
  const content = initialContent;
  content.textContent = error.message || 'No se pudo conectar con el inventario.';
  const retry = document.createElement('button');
  retry.className = 'button button-primary';
  retry.textContent = 'Reintentar conexión';
  retry.onclick = () => location.reload();
  content.append(retry);
  await new Promise(() => {});
}
finishLoading();
const items = shared.data.items;
const areas = shared.data.scopes.filter((x) => !x.parent).map((x) => ({ ...x, active: true }));
const serviceSectors = shared.data.scopes
  .filter((x) => x.parent === 'servicio')
  .map((x) => ({ ...x, id: x.id.split(':').at(-1) }));
const garzonZones = shared.data.scopes
  .filter((x) => x.parent === 'servicio:garzones')
  .map((x) => ({ ...x, id: x.id.split(':').at(-1) }));
import { showSummaryTransition } from './summary-transition.js';
import { nextWorkIndex, isOutOfStockCount, feedbackToneForCount } from './work-selection.js';

// Los datos locales anteriores no se leen ni se migran automáticamente.

const appContent = document.querySelector('#app-content');

const progressText = document.querySelector('#progress-text');

const progressBar = document.querySelector('#progress-bar');

const partialProgressBar = document.querySelector('#progress-bar-partial');

const headerBackButton = document.querySelector('#header-back-to-categories');

const summaryState = createSummaryState();
let returnToSummary = false;
let navigatingItem = false;

const params = new URLSearchParams(window.location.search);
const summaryEntry = params.get('summary') === '1';
const fromSupervision = summaryEntry && params.get('from') === 'supervision';
const requestedScope = [params.get('area'), params.get('sector'), params.get('zone')]
  .filter(Boolean)
  .join(':');
const entryScope = homeScope(shared.data.scopes);
const canonical = canonicalScope(requestedScope, shared.data.scopes);
if (!summaryEntry && canonical && canonical !== requestedScope) {
  const target = new URL(scopeURL(canonical), location.origin);
  for (const [key, value] of params) {
    if (!['area', 'sector', 'zone'].includes(key)) target.searchParams.append(key, value);
  }
  location.replace(target);
  await new Promise(() => {});
}
const forbiddenScope = requestedScope && !shared.data.scopes.some((s) => s.id === requestedScope);
const selectedArea = areas.find((area) => area.id === params.get('area'));
const selectedSector =
  selectedArea?.id === 'servicio'
    ? serviceSectors.find((sector) => sector.id === params.get('sector'))
    : null;
const selectedZone =
  selectedSector?.id === 'garzones'
    ? garzonZones.find((zone) => zone.id === params.get('zone'))
    : null;
const scopeKey = [selectedArea?.id, selectedSector?.id, selectedZone?.id].filter(Boolean).join(':');
const isGarzonZone = selectedSector?.id === 'garzones' && Boolean(selectedZone);
const defaultView = isGarzonZone ? 'count' : 'categories';

function getAreaName(areaId) {
  if (areaId === 'servicio' && selectedSector) {
    return selectedZone ? `${selectedSector.name} · ${selectedZone.name}` : selectedSector.name;
  }
  return areas.find((area) => area.id === areaId)?.name || areaId;
}

function getCountCategory(item) {
  return item.countCategory || item.category || 'Sin categoría';
}

const activeItems = items
  .filter(
    (item) =>
      item.active &&
      item.areaId === selectedArea?.id &&
      (selectedArea?.id !== 'servicio' ||
        (summaryEntry && !selectedSector) ||
        item.sectorId === selectedSector?.id) &&
      (selectedSector?.id !== 'garzones' ||
        (summaryEntry && !selectedZone) ||
        item.zoneId === selectedZone?.id),
  )
  .sort((a, b) => a.order - b.order);

let storageWarning = false;

let sessionNeedsSave = false;

let session = createSession();
const viewContextKey = `inventory-view:${shared.user.id}:${shared.cycleId}:${scopeKey}`;
// A refresh resumes the same authorized item; entering an area afresh keeps its chooser.
try {
  const navigation = performance.getEntriesByType('navigation')[0]?.type;
  const previous = JSON.parse(sessionStorage.getItem(viewContextKey) || 'null');
  if (
    !summaryEntry &&
    ['reload', 'back_forward'].includes(navigation) &&
    previous?.view === 'count'
  ) {
    const index = activeItems.findIndex((item) => item.id === previous.itemId);
    if (index >= 0) {
      session.currentIndex = index;
      session.view = 'count';
    }
  }
} catch {
  /* Presentation storage is optional; drafts remain separately scoped. */
}
if (summaryEntry) session.view = 'summary';
const summaryContextKey = `inventory-summary-context:${shared.user.id}:${shared.cycleId}:${scopeKey}`;
try {
  const context = JSON.parse(sessionStorage.getItem(summaryContextKey) || 'null');
  sessionStorage.removeItem(summaryContextKey);
  if (context && ['pending', 'partial', 'counted'].includes(context.status)) {
    summaryState.status = context.status;
    summaryState.open = new Set(context.open || []);
    summaryState.pages = new Map(context.pages || []);
    summaryState.scroll = Number(context.scroll) || 0;
    summaryState.animated = true;
    session.view = 'summary';
  }
} catch {
  /* UI context is optional; authoritative data and drafts remain separate. */
}
session.id = shared.cycleId;
session.counts = Object.fromEntries(shared.data.counts.map((x) => [x.itemId, x]));
shared.onRecord = (record, itemId) => {
  // A delayed sync page must not replace a newer accepted response in memory.
  const previous = session.counts[itemId];
  if (record && previous && record.version < previous.version) return;
  if (record) session.counts[itemId] = record;
  else delete session.counts[itemId];
  updateProgress();
};
shared.onRender = () => render();
shared.onPermissions = () => {
  // Rebuild the authorized projection; preserve summary presentation separately from data.
  if (session.view === 'summary') {
    try {
      sessionStorage.setItem(
        summaryContextKey,
        JSON.stringify({
          status: summaryState.status,
          open: [...summaryState.open],
          pages: [...summaryState.pages],
          scroll: window.scrollY,
        }),
      );
    } catch {
      /* A storage limit must not block permission revalidation. */
    }
  }
  location.reload();
};

let feedbackMessage = '';
let feedbackTone = 'counted';

// ============================================================
// SESIÓN
// ============================================================

function createSession() {
  return {
    schemaVersion: 3,

    id: createId(),

    date: new Date().toISOString(),

    startedAt: new Date().toISOString(),

    currentIndex: 0,

    scopeKey,

    view: defaultView,

    counts: {},
  };
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}`;
}

function saveSession() {
  try {
    sessionStorage.setItem(
      viewContextKey,
      JSON.stringify({ view: session.view, itemId: getCurrentItem()?.id }),
    );
  } catch {
    /* Do not block counting if presentation storage is unavailable. */
  }
  return true;
}

// ============================================================
// UTILIDADES
// ============================================================

function getCurrentItem() {
  return activeItems[session.currentIndex];
}

function getCategoryGroups() {
  const groups = [];

  const groupsByName = new Map();

  for (const item of activeItems) {
    const category = getCountCategory(item);

    let group = groupsByName.get(category);

    if (!group) {
      group = {
        name: category,
        order: Number.isInteger(item.countCategoryOrder) ? item.countCategoryOrder : groups.length,
        items: [],
      };

      groupsByName.set(category, group);

      groups.push(group);
    }

    group.items.push(item);
  }

  return groups.sort((a, b) => a.order - b.order);
}

function getCategoryStats(categoryItems) {
  let counted = 0;

  let partial = 0;

  for (const item of categoryItems) {
    const count = getCount(item.id);

    if (count.status === 'counted') {
      counted++;
    }

    if (count.status === 'partial') {
      partial++;
    }
  }

  const total = categoryItems.length;

  return {
    total,

    counted,

    partial,

    countedPercentage: total === 0 ? 0 : Math.round((counted / total) * 100),

    partialPercentage: total === 0 ? 0 : Math.round((partial / total) * 100),
  };
}

function getCategoryItems(category) {
  return activeItems.filter((item) => getCountCategory(item) === category);
}

function getCount(itemId) {
  return (
    session.counts[itemId] || {
      itemId,

      quantity: null,

      unit: null,

      status: 'pending',

      note: '',

      countedAt: null,
    }
  );
}

function getStats() {
  const total = activeItems.length;

  let pending = 0;

  let partial = 0;

  let counted = 0;

  for (const item of activeItems) {
    const count = getCount(item.id);

    switch (count.status) {
      case 'partial':
        partial++;

        break;

      case 'counted':
        counted++;

        break;

      case 'pending':

      default:
        pending++;

        break;
    }
  }

  const processed = partial + counted;

  return {
    total,

    pending,

    partial,

    counted,

    processed,
  };
}

// ============================================================
// HTML SEGURO
// ============================================================

// ============================================================
// CANTIDADES
// ============================================================

function parseQuantity(value) {
  const normalized = String(value).trim().replace(/\s/g, '').replace(',', '.');

  if (!normalized) {
    return null;
  }

  if (!/^\d*\.?\d+$/.test(normalized)) {
    return NaN;
  }

  const number = Number(normalized);

  if (Number.isNaN(number) || number < 0) {
    return NaN;
  }

  return number;
}

function formatQuantity(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '';
  }

  return new Intl.NumberFormat('es-CL', {
    useGrouping: false,
    maximumFractionDigits: 3,
  }).format(Number(value));
}

// ============================================================
// ESTADOS
// ============================================================

function getStatusIcon(status, outOfStock = false) {
  if (status === 'counted' && outOfStock) return '🟢';

  switch (status) {
    case 'counted':
      return '🟢';

    case 'partial':
      return '🟡';

    case 'pending':

    default:
      return '🔴';
  }
}

function getStatusLabel(status, outOfStock = false) {
  if (status === 'counted' && outOfStock) return 'Sin stock';

  switch (status) {
    case 'counted':
      return 'Contado';

    case 'partial':
      return 'Avance';

    case 'pending':

    default:
      return 'Pendiente';
  }
}

// ============================================================
// REGISTRO DE CONTEO
// ============================================================

async function saveCurrentAs(status, { outOfStock = false } = {}) {
  const item = getCurrentItem();

  if (!item) {
    return;
  }

  const quantityInput = document.querySelector('#quantity');

  const noteInput = document.querySelector('#note');

  const quantity = outOfStock ? 0 : quantityInput ? parseQuantity(quantityInput.value) : null;

  const note = noteInput ? noteInput.value.trim() : '';

  if (quantity === null || Number.isNaN(quantity)) {
    showFeedback('Ingresa una cantidad válida.');

    quantityInput?.focus();

    return;
  }

  if (navigatingItem || !(await shared.save(item, quantity, status, note, outOfStock))) return;

  const message = outOfStock
    ? 'Sin stock guardado.'
    : status === 'counted'
      ? 'Conteo guardado.'
      : 'Avance guardado.';
  showToast(message, feedbackToneForCount(status, outOfStock));
  feedbackMessage = '';
  navigatingItem = true;
  try {
    await transitionItem(goToNextItem);
  } finally {
    navigatingItem = false;
  }
}

// ============================================================
// NAVEGACIÓN
// ============================================================

function openItem(index) {
  if (!Number.isInteger(index) || index < 0 || index >= activeItems.length) {
    return;
  }

  session.currentIndex = index;

  session.view = 'count';

  saveSession();

  render();
  window.scrollTo(0, 0);
}

function goToPreviousItem() {
  const item = getCurrentItem();

  if (!item) {
    return;
  }

  const categoryItems = getNavigationItems(item);

  const categoryIndex = categoryItems.indexOf(item);

  if (categoryIndex <= 0) {
    return;
  }

  openItem(activeItems.indexOf(categoryItems[categoryIndex - 1]));
}

function goToNextItem() {
  const item = getCurrentItem();

  if (!item) {
    return;
  }

  // Los parciales cuentan como procesados.
  // Al guardar el último pendiente,
  // el inventario queda completo
  // y se abre directamente el resumen.

  if (getStats().pending === 0) {
    openSummary();

    return;
  }

  const categoryItems = getNavigationItems(item);

  const categoryIndex = categoryItems.indexOf(item);

  if (categoryIndex < categoryItems.length - 1) {
    openItem(activeItems.indexOf(categoryItems[categoryIndex + 1]));

    return;
  }

  if (isGarzonZone || returnToSummary) {
    openSummary();
  } else {
    openCategories();
  }
}

function openCategory(category) {
  const categoryItems = getCategoryItems(category);

  if (categoryItems.length === 0) {
    return;
  }

  session.currentIndex = activeItems.indexOf(
    categoryItems[nextWorkIndex(categoryItems, session.counts)],
  );

  session.view = 'count';

  saveSession();

  render();
  window.scrollTo(0, 0);
  document.querySelector('#open-item-drawer')?.click();
}

function openCategories() {
  session.view = defaultView;

  saveSession();

  render();
  window.scrollTo(0, 0);
}

function openSummary() {
  const savedFeedback = feedbackMessage;
  const savedTone = feedbackTone;
  feedbackMessage = '';
  feedbackTone = 'counted';

  session.view = 'summary';

  saveSession();

  render();
  window.scrollTo(0, 0);

  if (savedFeedback) showToast(savedFeedback, savedTone);

  showSummaryTransition(appContent, {
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  });
}

// ============================================================
// NAVEGACIÓN DEL CONTEO
// ============================================================

function getNavigationItems(item) {
  const candidates = isGarzonZone ? activeItems : getCategoryItems(getCountCategory(item));
  return summaryEntry
    ? candidates.filter((candidate) => candidate.locationId === item.locationId)
    : candidates;
}

// ============================================================
// PROGRESO
// ============================================================

function updateProgress() {
  const stats = getStats();

  const countedPercentage = stats.total === 0 ? 0 : (stats.counted / stats.total) * 100;

  const partialPercentage = stats.total === 0 ? 0 : (stats.partial / stats.total) * 100;

  progressText.textContent = `${stats.counted} / ${stats.total} contados`;

  progressBar.style.width = `${countedPercentage}%`;

  partialProgressBar.style.left = `${countedPercentage}%`;

  partialProgressBar.style.width = `${partialPercentage}%`;
}

// ============================================================
// RENDER PRINCIPAL
// ============================================================

function render() {
  if (forbiddenScope && items.length) {
    appContent.innerHTML = '<p>No tienes acceso a este ámbito.</p><a href="/">Ir a mi inicio</a>';
    headerBackButton.hidden = true;
    document.querySelector('#progress-bar-container').hidden = true;
    progressText.hidden = true;
    return;
  }
  // Only animate intentional view/product changes, never background refreshes.
  const transitionKey = [scopeKey, session.view, session.currentIndex].join(':');
  reveal(appContent, transitionKey);
  if (!items.length) {
    appContent.textContent = 'No tienes áreas asignadas. Contacta al administrador';
    document.querySelector('#progress-bar-container').hidden = true;
    progressText.hidden = true;
    return;
  }

  updateProgress();

  const pageTitle = document.querySelector('#page-title');
  if (pageTitle) {
    pageTitle.textContent = selectedZone
      ? `Garzones · ${selectedZone.name}`
      : selectedSector?.name || selectedArea?.name || 'Inventario';
  }
  headerBackButton.hidden =
    !fromSupervision &&
    (!selectedArea || (scopeKey === entryScope && session.view === 'categories'));

  const choosingScope =
    !summaryEntry &&
    (!selectedArea ||
      (selectedArea.id === 'servicio' && !selectedSector) ||
      (selectedSector?.id === 'garzones' && !selectedZone));
  const showSearch = !choosingScope && activeItems.length > 0 && session.view !== 'summary';
  document.querySelector('#header-open-item-drawer').hidden = !showSearch;
  document.querySelector('.app-title-row').classList.toggle('has-search', showSearch);
  const isSummary = !choosingScope && session.view === 'summary';
  document.querySelector('.app-header').classList.toggle('is-summary', isSummary);
  document.querySelector('#progress-bar-container').hidden = choosingScope || isSummary;
  progressText.hidden = choosingScope || isSummary;

  if (summaryEntry && selectedArea && session.view === 'summary') {
    renderSummary();
  } else if (!selectedArea) {
    renderScopeChooser(
      'Selecciona un área',
      areas
        .filter((area) => area.active)
        .sort((a, b) => a.order - b.order)
        .map((area) => ({
          name: area.name,
          url: `?area=${encodeURIComponent(area.id)}`,
        })),
    );
  } else if (!summaryEntry && selectedArea.id === 'servicio' && !selectedSector) {
    renderScopeChooser(
      '',
      serviceSectors.map((sector) => ({
        name: sector.name,
        url: `?area=servicio&sector=${encodeURIComponent(sector.id)}`,
      })),
    );
  } else if (!summaryEntry && selectedSector?.id === 'garzones' && !selectedZone) {
    renderScopeChooser(
      'Zonas',
      garzonZones.map((zone) => ({
        name: zone.name,
        url: `?area=servicio&sector=garzones&zone=${encodeURIComponent(zone.id)}`,
        items: items.filter(
          (item) =>
            item.active &&
            item.areaId === 'servicio' &&
            item.sectorId === 'garzones' &&
            item.zoneId === zone.id,
        ),
      })),
    );
  } else if (session.view === 'summary') {
    renderSummary();
  } else if (activeItems.length === 0) {
    renderEmptyState();
  } else if (session.view === 'categories' && !isGarzonZone) {
    renderCategories();
  } else {
    renderCurrentItem();
  }

  updateStorageWarning();
  scheduleFeedbackDismissal();
}

function updateStorageWarning() {
  const existing = appContent.querySelector('#storage-warning');

  if (!storageWarning) {
    existing?.remove();

    return;
  }

  const warning = existing || document.createElement('p');

  warning.id = 'storage-warning';

  warning.className = 'feedback feedback-error';

  warning.setAttribute('aria-live', 'polite');

  warning.textContent =
    'No se pudieron guardar los cambios en este dispositivo. Permanecerán disponibles mientras esta página esté abierta.';

  if (!existing) {
    appContent.prepend(warning);
  }
}

// ============================================================
// SELECCIÓN DE SECTOR Y ZONA
// ============================================================

function renderScopeChooser(title, options) {
  const hasProgress = options.some((option) => option.items);
  appContent.innerHTML = `
      <section class="categories-view scope-view ${hasProgress ? 'scope-view-zones' : ''}">
        ${title ? `<div class="categories-heading"><h2>${escapeHtml(title)}</h2></div>` : ''}
        <div class="category-grid">
          ${options
            .map((option) => {
              const stats = option.items ? getCategoryStats(option.items) : null;
              const partialText = stats?.partial
                ? ` · ${stats.partial} ${stats.partial === 1 ? 'avance' : 'avances'}`
                : '';
              return `
            <a class="category-card scope-card" href="${escapeHtml(inventoryURL(option.url, shared.cycleId))}"
              ${stats ? `aria-label="${escapeHtml(option.name)}: ${stats.counted} de ${stats.total} contados${partialText}"` : ''}>
              <span class="category-card-title">${escapeHtml(option.name)}</span>
              ${
                stats
                  ? `
                <span class="category-card-progress">${stats.counted} / ${stats.total} contados${partialText}</span>
                <span class="category-progress-bar" aria-hidden="true">
                  <span class="category-progress-value" style="width: ${stats.countedPercentage}%"></span>
                  <span class="category-progress-partial" style="left: ${stats.countedPercentage}%; width: ${stats.partialPercentage}%"></span>
                </span>`
                  : ''
              }
            </a>
          `;
            })
            .join('')}
        </div>
      </section>`;
}

// ============================================================
// CATEGORÍAS
// ============================================================

function renderCategories() {
  const categoryGroups = getCategoryGroups();

  const currentFeedback = feedbackMessage;

  const currentTone = feedbackTone;

  feedbackMessage = '';
  feedbackTone = 'counted';

  const categoryCards = categoryGroups
    .map((group, index) => {
      const stats = getCategoryStats(group.items);

      const partialText =
        stats.partial > 0
          ? ` · ${stats.partial} ${stats.partial === 1 ? 'avance' : 'avances'}`
          : '';

      const progressLabel = `${stats.counted} de ${stats.total} contados${partialText}`;

      return `
            <button
              class="category-card"
              type="button"
              data-category-index="${index}"
              aria-label="${escapeHtml(group.name)}: ${escapeHtml(progressLabel)}"
            >

              <span
                class="category-card-title"
              >
                ${escapeHtml(group.name)}
              </span>


              <span
                class="category-card-progress"
              >
                ${stats.counted}
                /
                ${stats.total}
                contados
                ${partialText}
              </span>


              <span
                class="category-progress-bar"
                aria-hidden="true"
              >

                <span
                  class="category-progress-value"
                  style="width: ${stats.countedPercentage}%"
                ></span>


                <span
                  class="category-progress-partial"
                  style="
                    left: ${stats.countedPercentage}%;
                    width: ${stats.partialPercentage}%;
                  "
                ></span>

              </span>

            </button>
          `;
    })
    .join('');

  appContent.innerHTML = `

    <section class="categories-view">

      <div class="category-grid">
        ${categoryCards}
      </div>

      ${renderItemDrawer(null)}


      <button
        id="open-summary"
        class="button button-ghost"
        type="button"
      >
        Ver Resumen
      </button>


      ${
        currentFeedback
          ? `
            <p
              class="feedback feedback-toast feedback-toast-${currentTone}"
              role="status"
            >
              ${escapeHtml(currentFeedback)}
            </p>
          `
          : ''
      }

    </section>
  `;

  setupCategoryEvents(categoryGroups);
  setupItemDrawerEvents();
}

function setupCategoryEvents(categoryGroups) {
  document.querySelectorAll('.category-card').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.categoryIndex);

      const group = categoryGroups[index];

      if (group) {
        openCategory(group.name);
      }
    });
  });

  document.querySelector('#open-summary').addEventListener('click', openSummary);
}

// ============================================================
// VISTA DE CONTEO
// ============================================================

const openItemDrawerGroups = new Set();

function renderItemDrawerList(currentItemId) {
  const groups = new Map();

  activeItems.forEach((item, index) => {
    const category = isGarzonZone ? '' : getCountCategory(item);
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category).push({ item, index });
  });

  return [...groups]
    .map(
      ([category, groupItems]) => `
      ${
        category
          ? `<details class="item-drawer-group" data-item-group data-category="${escapeHtml(category)}" ${groupItems.some(({ item }) => item.id === currentItemId) ? 'open' : ''}>
            <summary class="item-drawer-group-toggle">${escapeHtml(category)}</summary>`
          : '<section class="item-drawer-group" data-item-group>'
      }
        ${groupItems
          .map(({ item, index }) => {
            const count = getCount(item.id);
            const status = count.status;
            const outOfStock = isOutOfStockCount(count);
            const isCurrent = item.id === currentItemId;
            return `
              <button
                class="item-drawer-link${isCurrent ? ' is-current' : ''}${outOfStock ? ' is-out-of-stock' : ''}"
                type="button"
                data-item-index="${index}"
                ${isCurrent ? 'aria-current="true"' : ''}
              >
                <span class="item-drawer-status status-dot-${outOfStock ? 'out-of-stock' : status}" aria-hidden="true"></span>
                <span class="item-drawer-name">${escapeHtml(item.name)}</span>
                <span class="item-drawer-state">${getStatusLabel(status, outOfStock)}</span>
              </button>`;
          })
          .join('')}
      ${category ? '</details>' : '</section>'}`,
    )
    .join('');
}

function renderItemDrawer(currentItemId) {
  return `
      <div id="item-drawer" class="item-drawer" aria-hidden="true" inert>
        <button class="item-drawer-backdrop" type="button" tabindex="-1" aria-label="Cerrar listado de ítems"></button>
        <aside class="item-drawer-panel" role="dialog" aria-modal="true" aria-label="Listado de ítems" tabindex="-1">
          <div class="item-drawer-controls">
            <input id="item-drawer-search" class="item-drawer-search" type="search" placeholder="Buscar producto" aria-label="Buscar producto" autocomplete="off">
            <button id="close-item-drawer" class="item-drawer-close" type="button" aria-label="Cerrar listado"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 5l14 14M19 5 5 19"/></svg></button>
          </div>
          <div class="item-drawer-list" id="item-drawer-list">
            ${renderItemDrawerList(currentItemId)}
          </div>
          <p id="item-drawer-empty" class="item-drawer-empty" hidden>No encontramos productos con ese nombre.</p>
        </aside>
      </div>`;
}

function renderCurrentItem() {
  const item = getCurrentItem();

  if (!item) {
    return;
  }

  const count = getCount(item.id);

  const categoryItems = getNavigationItems(item);

  const categoryIndex = categoryItems.indexOf(item);

  const isLastItem = categoryIndex === categoryItems.length - 1;

  const safeName = escapeHtml(item.name);

  const safeCategory = escapeHtml(getCountCategory(item));

  const safeArea = escapeHtml(getAreaName(item.areaId));

  const safeUnit = escapeHtml(item.unit);

  const safeNote = escapeHtml(count.note || '');

  const quantityValue = count.quantity === null ? '' : formatQuantity(count.quantity);

  const statusIcon = getStatusIcon(count.status, isOutOfStockCount(count));

  const statusLabel = getStatusLabel(count.status, isOutOfStockCount(count));

  const currentFeedback = feedbackMessage;

  const currentTone = feedbackTone;

  feedbackMessage = '';
  feedbackTone = 'counted';

  appContent.innerHTML = `

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

        <button
          id="next-item"
          class="button button-ghost"
          type="button"
        >
          ${isLastItem ? (isGarzonZone ? 'Resumen →' : 'Categorías →') : 'Siguiente →'}
        </button>
      </div>

      ${renderItemDrawer(item.id)}


      <article class="item-card">


        <div class="item-header">


          <div class="item-heading">

            <span class="item-category">
              ${isGarzonZone ? safeArea : `${safeCategory} · ${safeArea}`}
            </span>


            <h2>
              ${safeName}
            </h2>

          </div>


          <span
            class="
              status-badge
              status-${isOutOfStockCount(count) ? 'out-of-stock' : count.status}
            "
          >
            ${statusIcon}
            ${statusLabel}
          </span>

        </div>


        <div class="field">

          <label for="quantity">
            Cantidad (${safeUnit})
          </label>


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
          >


        </div>


        <div class="field">

          <label for="note">
            Nota
          </label>


          <textarea
            id="note"
            rows="3"
            maxlength="300"
            placeholder="Opcional"
          >${safeNote}</textarea>

        </div>


      </article>


      <div class="count-actions">

        <button
          id="save-out-of-stock"
          class="button button-out-of-stock"
          type="button"
        >
          Sin stock
        </button>

        <button
          id="save-partial"
          class="button button-secondary"
          type="button"
        >
          Avance
        </button>


        <button
          id="save-counted"
          class="button button-primary"
          type="button"
        >
          Listo
        </button>


      </div>


      <div class="summary-navigation">
        <button
          id="open-summary"
          class="button button-ghost"
          type="button"
        >
          Ir a Resumen
        </button>
      </div>


      ${
        currentFeedback
          ? `
            <p
              class="feedback feedback-toast feedback-toast-${currentTone}"
              role="status"
            >
              ${escapeHtml(currentFeedback)}
            </p>
          `
          : ''
      }


    </section>
  `;

  setupCurrentItemEvents();
  shared.mount(item, count);
  updateKeyboardActions();
}

// ============================================================
// EVENTOS DEL CONTEO
// ============================================================

let countViewportHeight = window.innerHeight;
let lastItemDrawerTrigger = null;

function setupItemDrawerEvents() {
  const drawer = document.querySelector('#item-drawer');
  const search = document.querySelector('#item-drawer-search');

  document.querySelectorAll('#open-item-drawer, #header-open-item-drawer').forEach((trigger) => {
    if (trigger.hidden) return;
    trigger.onclick = () => {
      lastItemDrawerTrigger = trigger;
      const current = drawer.querySelector('.item-drawer-link.is-current');
      const currentGroup = current?.closest('details.item-drawer-group');
      openItemDrawerGroups.clear();
      if (currentGroup) openItemDrawerGroups.add(currentGroup.dataset.category);
      search.value = '';
      search.dispatchEvent(new Event('input'));
      drawer.classList.add('is-open');
      drawer.inert = false;
      drawer.setAttribute('aria-hidden', 'false');
      trigger.setAttribute('aria-expanded', 'true');
      document.body.classList.add('item-drawer-open');
      if (trigger.id === 'header-open-item-drawer') {
        search.focus({ preventScroll: true });
      } else {
        drawer.querySelector('.item-drawer-panel').focus({ preventScroll: true });
      }

      if (current) {
        const list = drawer.querySelector('.item-drawer-list');
        const itemTop =
          current.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
        list.scrollTop = Math.max(0, itemTop - 62);
      } else {
        drawer.querySelector('.item-drawer-list').scrollTop = 0;
      }
    };
  });

  drawer.querySelector('.item-drawer-backdrop').addEventListener('click', closeItemDrawer);
  drawer.querySelector('#close-item-drawer').addEventListener('click', closeItemDrawer);

  drawer.querySelectorAll('.item-drawer-link').forEach((button) => {
    button.addEventListener('click', () => {
      closeItemDrawer(false);
      openItem(Number(button.dataset.itemIndex));
    });
  });

  drawer.querySelectorAll('.item-drawer-group-toggle').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const group = toggle.parentElement;
      if (group.open) {
        openItemDrawerGroups.delete(group.dataset.category);
      } else {
        openItemDrawerGroups.add(group.dataset.category);
      }
    });
  });

  search.addEventListener('input', () => {
    const query = search.value
      .trim()
      .toLocaleLowerCase('es-CL')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    let visible = 0;

    drawer.querySelectorAll('[data-item-group]').forEach((group) => {
      let groupVisible = 0;
      group.querySelectorAll('.item-drawer-link').forEach((button) => {
        const name = button
          .querySelector('.item-drawer-name')
          .textContent.toLocaleLowerCase('es-CL')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        button.hidden = !name.includes(query);
        if (!button.hidden) groupVisible++;
      });
      group.hidden = groupVisible === 0;
      if (group.tagName === 'DETAILS') {
        group.open = query ? groupVisible > 0 : openItemDrawerGroups.has(group.dataset.category);
      }
      visible += groupVisible;
    });

    drawer.querySelector('#item-drawer-empty').hidden = visible !== 0;
  });
}

function setupCurrentItemEvents() {
  setupItemDrawerEvents();

  document
    .querySelector('#save-out-of-stock')
    .addEventListener('click', () => saveCurrentAs('counted', { outOfStock: true }));

  document.querySelector('#save-partial').addEventListener('click', () => saveCurrentAs('partial'));

  document.querySelector('#save-counted').addEventListener('click', () => saveCurrentAs('counted'));

  document.querySelector('#previous-item').addEventListener('click', goToPreviousItem);

  document.querySelector('#next-item').addEventListener('click', goToNextItem);

  document.querySelector('#open-summary').addEventListener('click', openSummary);
}

function closeItemDrawer(restoreFocus = true) {
  const drawer = document.querySelector('#item-drawer');
  if (!drawer?.classList.contains('is-open')) return;

  drawer.classList.remove('is-open');
  drawer.inert = true;
  drawer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('item-drawer-open');

  const trigger = lastItemDrawerTrigger;
  trigger?.setAttribute('aria-expanded', 'false');
  if (restoreFocus) trigger?.focus();
  lastItemDrawerTrigger = null;
}

// ============================================================
// RESUMEN
// ============================================================

function renderSummary() {
  renderSummaryView(appContent, {
    items: activeItems,
    getCount,
    category: getCountCategory,
    location: (item) => shared.locationName(item),
    state: summaryState,
    onItem: (index) => {
      returnToSummary = true;
      openItem(index);
    },
  });
}

function scheduleFeedbackDismissal() {}

function showToast(message, tone = 'counted') {
  showNotice(message, tone);
}

function showFeedback(message) {
  if (appContent.querySelector('.count-view')) showToast(message, 'error');
}

// ============================================================
// ESTADO VACÍO
// ============================================================

function renderEmptyState() {
  appContent.innerHTML = `

    <section class="empty-state">

      <h2>
        No hay productos activos
      </h2>


      <p>

        Los productos inactivos se gestionan desde el Panel de supervisión.

      </p>

    </section>

  `;
}

// ============================================================
// MODAL
// ============================================================

function setupModalEvents() {
  headerBackButton.addEventListener('click', () => {
    if (session.view === 'summary' && fromSupervision) {
      history.back();
      return;
    }
    if (session.view === 'count' && returnToSummary) {
      returnToSummary = false;
      openSummary();
      return;
    }

    switch (session.view) {
      case 'count':
        if (isGarzonZone) {
          window.location.href = inventoryURL('?area=servicio&sector=garzones', shared.cycleId);
        } else {
          openCategories();
        }

        break;

      case 'summary':
        openCategories();

        break;

      case 'categories':

      default:
        if (selectedZone) {
          window.location.href = inventoryURL('?area=servicio&sector=garzones', shared.cycleId);
        } else if (selectedSector) {
          window.location.href = inventoryURL('?area=servicio', shared.cycleId);
        } else {
          window.location.href = inventoryURL('../../', shared.cycleId);
        }
        break;
    }
  });

  document.addEventListener('keydown', (event) => {
    const drawer = document.querySelector('#item-drawer.is-open');

    if (event.key === 'Escape') {
      if (drawer) {
        closeItemDrawer();
      }
    }

    if (event.key === 'Tab' && drawer) {
      const panel = drawer.querySelector('.item-drawer-panel');
      const focusable = [
        ...drawer.querySelectorAll(
          "button:not([hidden]):not([tabindex='-1']), input:not([hidden]), summary",
        ),
      ].filter((element) => !element.closest('[hidden]') && element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === panel)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
}

// ============================================================
// INICIO
// ============================================================

setupModalEvents();

if (sessionNeedsSave) {
  saveSession();
}

render();
// Choose an item before counting when entering a zone or resuming the count view.
if (session.view === 'count') document.querySelector('#open-item-drawer')?.click();
shared.poll();

if (Object.keys(shared.drafts.all()).length) shared.state('Cambios pendientes');

// Keep the three count actions inside the visible area while a mobile keyboard is open.
// The same controls remain mounted, so tapping them never discards the current draft.
function updateKeyboardActions() {
  const actions = document.querySelector('.count-actions');
  if (!actions) return;
  const viewport = window.visualViewport;
  const editing = document.activeElement?.matches('#quantity, #note');
  if (!editing) countViewportHeight = window.innerHeight;
  const keyboard =
    viewport &&
    editing &&
    Math.max(countViewportHeight, window.innerHeight) - viewport.height > 100 &&
    viewport.scale <= 1.05;
  actions.classList.toggle('above-keyboard', Boolean(keyboard));
  const view = actions.closest('.count-view');
  if (keyboard)
    view.style.setProperty(
      '--keyboard-space',
      `${Math.max(countViewportHeight, window.innerHeight) - viewport.height + actions.offsetHeight + 24}px`,
    );
  else view.style.removeProperty('--keyboard-space');
  if (keyboard)
    actions.style.top = `${Math.max(viewport.offsetTop, viewport.offsetTop + viewport.height - actions.offsetHeight - 8)}px`;
  else actions.style.removeProperty('top');
  if (keyboard) {
    const field = document.activeElement;
    const overlap = field.getBoundingClientRect().bottom - actions.getBoundingClientRect().top + 12;
    if (overlap > 0) window.scrollBy({ top: overlap, behavior: 'instant' });
  }
}
window.visualViewport?.addEventListener('resize', updateKeyboardActions);
window.visualViewport?.addEventListener('scroll', updateKeyboardActions);
document.addEventListener('focusin', updateKeyboardActions);
document.addEventListener('focusout', () => requestAnimationFrame(updateKeyboardActions));
document.addEventListener('pointerdown', (event) => {
  // Keep the dock in place between touch-down and click; the accepted save
  // controls subsequent navigation and keyboard dismissal.
  if (event.target.closest('.count-actions.above-keyboard button')) event.preventDefault();
});
