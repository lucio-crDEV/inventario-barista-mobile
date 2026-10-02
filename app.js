import { items } from "./data/items.js";

const STORAGE_KEY =
  "inventario-barra-session-v2";

const appContent =
  document.querySelector("#app-content");

const progressText =
  document.querySelector("#progress-text");

const progressBar =
  document.querySelector("#progress-bar");

const partialProgressBar =
  document.querySelector(
    "#progress-bar-partial"
  );

const headerBackButton =
  document.querySelector(
    "#header-back-to-categories"
  );

const confirmModal =
  document.querySelector("#confirm-modal");

const cancelNewSessionButton =
  document.querySelector("#cancel-new-session");

const confirmNewSessionButton =
  document.querySelector("#confirm-new-session");


const activeItems = items
  .filter(item => item.active)
  .sort((a, b) => a.order - b.order);


let session = loadSession();

let feedbackMessage = "";


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

    view: "categories",

    responsible: "",

    counts: {}
  };
}


function createId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}`;
}


function loadSession() {
  try {
    const saved =
      localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return createSession();
    }

    const parsed =
      JSON.parse(saved);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      ![2, 3].includes(parsed.schemaVersion) ||
      !parsed.counts
    ) {
      return createSession();
    }

    if (parsed.schemaVersion === 2) {

      parsed.schemaVersion = 3;

      if (parsed.view === "count") {
        parsed.view = "categories";
      }

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(parsed)
      );
    }


    if (
      !["categories", "count", "summary"]
        .includes(parsed.view)
    ) {
      parsed.view = "categories";
    }


    return parsed;

  } catch (error) {

    console.error(
      "No se pudo cargar la sesión:",
      error
    );

    return createSession();
  }
}


function saveSession() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(session)
  );
}


// ============================================================
// UTILIDADES
// ============================================================

function getCurrentItem() {
  return activeItems[
    session.currentIndex
  ];
}


function getCategoryGroups() {

  const groups = [];

  const groupsByName = new Map();


  for (const item of activeItems) {

    let group =
      groupsByName.get(
        item.category
      );


    if (!group) {

      group = {
        name: item.category,
        items: []
      };

      groupsByName.set(
        item.category,
        group
      );

      groups.push(group);
    }


    group.items.push(item);
  }


  return groups;
}


function getCategoryStats(categoryItems) {

  let counted = 0;

  let partial = 0;


  for (const item of categoryItems) {

    const count =
      getCount(item.id);


    if (count.status === "counted") {
      counted++;
    }

    if (count.status === "partial") {
      partial++;
    }
  }


  const total = categoryItems.length;


  return {
    total,
    counted,
    partial,
    percentage:
      total === 0
        ? 0
        : Math.round(
            (counted / total) * 100
          )
  };
}


function getCategoryItems(category) {
  return activeItems.filter(
    item =>
      item.category === category
  );
}


function getCount(itemId) {
  return session.counts[itemId] || {
    itemId,
    quantity: null,
    unit: null,
    status: "pending",
    note: "",
    countedAt: null
  };
}


function getStats() {
  const total =
    activeItems.length;

  let pending = 0;
  let partial = 0;
  let counted = 0;

  for (const item of activeItems) {

    const count =
      getCount(item.id);

    switch (count.status) {

      case "partial":
        partial++;
        break;

      case "counted":
        counted++;
        break;

      case "pending":
      default:
        pending++;
        break;
    }
  }

  const processed =
    partial + counted;

  return {
    total,
    pending,
    partial,
    counted,
    processed
  };
}


// ============================================================
// HTML SEGURO
// ============================================================

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// ============================================================
// CANTIDADES
// ============================================================

function parseQuantity(value) {
  const normalized =
    String(value)
      .trim()
      .replace(/\s/g, "")
      .replace(",", ".");

  if (!normalized) {
    return null;
  }

  if (!/^\d*\.?\d+$/.test(normalized)) {
    return NaN;
  }

  const number =
    Number(normalized);

  if (
    Number.isNaN(number) ||
    number < 0
  ) {
    return NaN;
  }

  return number;
}


function formatQuantity(value) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(Number(value))
  ) {
    return "";
  }

  return new Intl.NumberFormat(
    "es-CL",
    {
      useGrouping: false,
      maximumFractionDigits: 3
    }
  ).format(Number(value));
}


// ============================================================
// ESTADOS
// ============================================================

function getStatusIcon(status) {

  switch (status) {

    case "counted":
      return "🟢";

    case "partial":
      return "🟡";

    case "pending":
    default:
      return "🔴";
  }
}


function getStatusLabel(status) {

  switch (status) {

    case "counted":
      return "Contado";

    case "partial":
      return "Parcial";

    case "pending":
    default:
      return "Pendiente";
  }
}


// ============================================================
// REGISTRO DE CONTEO
// ============================================================

function registerCount({
  item,
  quantity,
  status,
  note
}) {

  session.counts[item.id] = {
    sessionId: session.id,

    itemId: item.id,

    quantity,

    unit: item.unit,

    status,

    note,

    countedAt:
      new Date().toISOString()
  };

  saveSession();
}


// ============================================================
// GUARDAR ACTUAL
// ============================================================

function saveCurrentAs(status) {

  const item =
    getCurrentItem();

  if (!item) {
    return;
  }

  const quantityInput =
    document.querySelector(
      "#quantity"
    );

  const noteInput =
    document.querySelector(
      "#note"
    );

  const quantity =
    quantityInput
      ? parseQuantity(
          quantityInput.value
        )
      : null;

  const note =
    noteInput
      ? noteInput.value.trim()
      : "";


  if (
    quantity === null ||
    Number.isNaN(quantity)
  ) {

    showFeedback(
      "Ingresa una cantidad válida. Puedes usar 1,4 o 1.4."
    );

    quantityInput?.focus();

    return;
  }


  registerCount({
    item,

    quantity,

    status,

    note
  });


  feedbackMessage =
    status === "counted"
      ? "Conteo guardado."
      : "Avance guardado como parcial.";

  goToNextItem();
}


// ============================================================
// NAVEGACIÓN
// ============================================================

function openItem(index) {

  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= activeItems.length
  ) {
    return;
  }

  session.currentIndex =
    index;

  session.view =
    "count";

  saveSession();

  render();
}


function goToPreviousItem() {

  const item = getCurrentItem();

  if (!item) {
    return;
  }

  const categoryItems =
    getCategoryItems(item.category);

  const categoryIndex =
    categoryItems.indexOf(item);


  if (categoryIndex <= 0) {
    return;
  }

  openItem(
    activeItems.indexOf(
      categoryItems[
        categoryIndex - 1
      ]
    )
  );
}


function goToNextItem() {

  const item = getCurrentItem();

  if (!item) {
    return;
  }

  // Los parciales cuentan como procesados. Al guardar el último pendiente,
  // el inventario queda completo y debe abrirse directamente el resumen.
  if (getStats().pending === 0) {
    openSummary();
    return;
  }

  const categoryItems =
    getCategoryItems(item.category);

  const categoryIndex =
    categoryItems.indexOf(item);


  if (categoryIndex < categoryItems.length - 1) {

    openItem(
      activeItems.indexOf(
        categoryItems[
          categoryIndex + 1
        ]
      )
    );

    return;
  }


  openCategories();
}


function openCategory(category) {

  const categoryItems =
    getCategoryItems(category);


  if (categoryItems.length === 0) {
    return;
  }

  session.currentIndex =
    activeItems.indexOf(
      categoryItems[0]
    );

  session.view =
    "count";

  saveSession();

  render();
}


function openCategories() {

  session.view =
    "categories";

  saveSession();

  render();
}


function openSummary() {

  feedbackMessage = "";

  session.view =
    "summary";

  saveSession();

  render();
}


// ============================================================
// NUEVO INVENTARIO
// ============================================================

function openNewSessionConfirmation() {

  confirmModal.hidden =
    false;

  document.body.classList.add(
    "modal-open"
  );

  confirmNewSessionButton.focus();
}


function closeNewSessionConfirmation() {

  confirmModal.hidden =
    true;

  document.body.classList.remove(
    "modal-open"
  );
}


function startNewSession() {

  closeNewSessionConfirmation();

  localStorage.removeItem(
    STORAGE_KEY
  );

  session =
    createSession();

  saveSession();

  feedbackMessage = "";

  render();
}


// ============================================================
// PROGRESO
// ============================================================

function updateProgress() {

  const stats =
    getStats();

  const countedPercentage =
    stats.total === 0
      ? 0
      : (stats.counted / stats.total) * 100;

  const partialPercentage =
    stats.total === 0
      ? 0
      : (stats.partial / stats.total) * 100;

  progressText.textContent =
    `${stats.counted} / ${stats.total} contados`;

  progressBar.style.width =
    `${countedPercentage}%`;

  partialProgressBar.style.left =
    `${countedPercentage}%`;

  partialProgressBar.style.width =
    `${partialPercentage}%`;
}


// ============================================================
// RENDER PRINCIPAL
// ============================================================

function render() {

  updateProgress();

  headerBackButton.hidden =
    session.view !== "count" ||
    activeItems.length === 0;


  if (activeItems.length === 0) {

    renderEmptyState();

    return;
  }


  if (
    session.view === "summary"
  ) {

    renderSummary();

    return;
  }


  if (
    session.view === "categories"
  ) {

    renderCategories();

    return;
  }


  renderCurrentItem();
}


// ============================================================
// CATEGORÍAS
// ============================================================

function renderCategories() {

  const categoryGroups =
    getCategoryGroups();

  const currentFeedback =
    feedbackMessage;

  feedbackMessage = "";


  const categoryCards =
    categoryGroups
      .map((group, index) => {

        const stats =
          getCategoryStats(group.items);

        const partialText =
          stats.partial > 0
            ? ` · ${stats.partial} ${
                stats.partial === 1
                  ? "parcial"
                  : "parciales"
              }`
            : "";

        const progressLabel =
          `${stats.counted} de ${stats.total} contados${partialText}`;


        return `
          <button
            class="category-card"
            type="button"
            data-category-index="${index}"
            aria-label="${escapeHtml(
              group.name
            )}: ${escapeHtml(progressLabel)}"
          >
            <span class="category-card-title">
              ${escapeHtml(group.name)}
            </span>

            <span class="category-card-progress">
              ${stats.counted} / ${stats.total} contados${partialText}
            </span>

            <span
              class="category-progress-bar"
              aria-hidden="true"
            >
              <span
                class="category-progress-value"
                style="width: ${stats.percentage}%"
              ></span>
            </span>
          </button>
        `;
      })
      .join("");


  appContent.innerHTML = `

    <section class="categories-view">

      <div class="categories-heading">
        <h2>
          Categorías
        </h2>

        <p>
          Elige una categoría para comenzar el conteo.
        </p>
      </div>


      <div class="category-grid">
        ${categoryCards}
      </div>


      <button
        id="open-summary"
        class="button button-ghost"
        type="button"
      >
        Ir a Resumen
      </button>


      ${
        currentFeedback
          ? `
            <p
              class="feedback feedback-success"
              aria-live="polite"
            >
              ${escapeHtml(currentFeedback)}
            </p>
          `
          : ""
      }

    </section>
  `;


  setupCategoryEvents(categoryGroups);
}


function setupCategoryEvents(categoryGroups) {

  document
    .querySelectorAll(
      ".category-card"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const index =
            Number(
              button.dataset.categoryIndex
            );

          const group =
            categoryGroups[index];


          if (group) {
            openCategory(group.name);
          }
        }
      );
    });


  document
    .querySelector(
      "#open-summary"
    )
    .addEventListener(
      "click",
      openSummary
    );
}


// ============================================================
// VISTA DE CONTEO
// ============================================================

function renderCurrentItem() {

  const item =
    getCurrentItem();

  if (!item) {
    return;
  }

  const count =
    getCount(item.id);


  const categoryItems =
    getCategoryItems(item.category);

  const categoryIndex =
    categoryItems.indexOf(item);

  const isLastItem =
    categoryIndex ===
    categoryItems.length - 1;


  const selectorOptions =
    categoryItems
      .map((optionItem, index) => {

        const optionCount =
          getCount(
            optionItem.id
          );

        const icon =
          getStatusIcon(
            optionCount.status
          );

        const selected =
          optionItem.id ===
          item.id
            ? "selected"
            : "";

        return `
          <option
            value="${activeItems.indexOf(
              optionItem
            )}"
            ${selected}
          >
            ${icon} ${index + 1}. ${escapeHtml(optionItem.name)}
          </option>
        `;
      })
      .join("");


  const safeName =
    escapeHtml(item.name);

  const safeCategory =
    escapeHtml(item.category);

  const safeArea = escapeHtml(item.area);

  const safeUnit =
    escapeHtml(item.unit);

  const safeNote =
    escapeHtml(
      count.note || ""
    );


  const quantityValue =
    count.quantity === null
      ? ""
      : formatQuantity(
          count.quantity
        );


  const statusIcon =
    getStatusIcon(
      count.status
    );

  const statusLabel =
    getStatusLabel(
      count.status
    );


  const currentFeedback =
    feedbackMessage;

  feedbackMessage = "";


  appContent.innerHTML = `

    <section class="count-view">


      <div class="item-navigation-top">

        <select
          id="item-selector"
          class="item-selector"
          aria-label="Seleccionar ítem de ${safeCategory}"
        >
          ${selectorOptions}
        </select>

      </div>


      <article class="item-card">


        <div class="item-header">

          <div class="item-heading">

            <span class="item-category">
              ${safeCategory}
            </span>

            <h2>
              ${safeName}
            </h2>

            <p class="item-area">
              ${safeArea}
            </p>

          </div>


          <span
            class="
              status-badge
              status-${count.status}
            "
          >
            ${statusIcon}
            ${statusLabel}
          </span>

        </div>


        <div class="field">

          <label for="quantity">
            Cantidad
          </label>

          <input
            id="quantity"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            placeholder="0"
            value="${quantityValue}"
          >

          <small>
            Unidad: ${safeUnit}
          </small>

        </div>


        <div class="field">

          <label for="note">
            Nota
          </label>

          <textarea
            id="note"
            rows="3"
            maxlength="300"
            placeholder="Observación opcional"
          >${safeNote}</textarea>

          <small>
            Máximo 300 caracteres
          </small>

        </div>


      </article>


      <div class="count-actions">

        <button
          id="save-partial"
          class="button button-secondary"
          type="button"
        >
          Guardar avance
        </button>

        <button
          id="save-counted"
          class="button button-primary"
          type="button"
        >
          Guardar como contado
        </button>

      </div>


      <div class="navigation-grid">

        <button
          id="previous-item"
          class="button button-ghost"
          type="button"
          ${categoryIndex === 0 ? "disabled" : ""}
        >
          ← Anterior
        </button>


        <button
          id="open-summary"
          class="button button-ghost"
          type="button"
        >
          Ir a Resumen
        </button>


        <button
          id="next-item"
          class="button button-ghost"
          type="button"
        >
          ${
            isLastItem
              ? "Categorías →"
              : "Siguiente →"
          }
        </button>

      </div>


      ${
        currentFeedback
          ? `
            <p
              class="feedback feedback-success"
              aria-live="polite"
            >
              ${escapeHtml(
                currentFeedback
              )}
            </p>
          `
          : ""
      }

    </section>
  `;


  setupCurrentItemEvents();
}


// ============================================================
// EVENTOS DEL CONTEO
// ============================================================

function setupCurrentItemEvents() {

  document
    .querySelector(
      "#item-selector"
    )
    .addEventListener(
      "change",
      event => {

        const index =
          Number(
            event.target.value
          );

        openItem(index);
      }
    );


  document
    .querySelector(
      "#save-partial"
    )
    .addEventListener(
      "click",
      () =>
        saveCurrentAs(
          "partial"
        )
    );


  document
    .querySelector(
      "#save-counted"
    )
    .addEventListener(
      "click",
      () =>
        saveCurrentAs(
          "counted"
        )
    );


  document
    .querySelector(
      "#previous-item"
    )
    .addEventListener(
      "click",
      goToPreviousItem
    );


  document
    .querySelector(
      "#next-item"
    )
    .addEventListener(
      "click",
      goToNextItem
    );


  document
    .querySelector(
      "#open-summary"
    )
    .addEventListener(
      "click",
      openSummary
    );
}


// ============================================================
// RESUMEN
// ============================================================

function renderSummary() {

  const stats =
    getStats();


  const isComplete =
    stats.pending === 0 &&
    stats.partial === 0;


  const title =
    isComplete
      ? "Inventario completo"
      : "Resumen del inventario";


  const subtitle =
    isComplete
      ? "Todos los ítems están contabilizados."
      : "Puedes tocar cualquier ítem para editarlo.";


  const pendingItems =
    getItemsByStatus(
      "pending"
    );

  const partialItems =
    getItemsByStatus(
      "partial"
    );

  const countedItems =
    getItemsByStatus(
      "counted"
    );


  appContent.innerHTML = `

    <section class="summary-view">


      <div class="summary-header">
        <div class="summary-title-row">

          <div>
            <h2>
              ${title}
            </h2>

            <p>
              ${subtitle}
            </p>
          </div>

        </div>

      </div>


      <div class="stats-grid">

        <div class="stat-card stat-pending">
          <strong>
            ${stats.pending}
          </strong>

          <span>
            🔴 Pendientes
          </span>
        </div>


        <div class="stat-card stat-partial">
          <strong>
            ${stats.partial}
          </strong>

          <span>
            ⚠️ Parciales
          </span>
        </div>


        <div class="stat-card stat-counted">
          <strong>
            ${stats.counted}
          </strong>

          <span>
            ✅ Contados
          </span>
        </div>

      </div>


      <section class="accordion-list">


        <details
          class="accordion"
          open
        >

          <summary>

            <span>
              🔴 Pendientes
            </span>

            <span class="section-count">
              ${pendingItems.length}
            </span>

          </summary>


          <div class="accordion-content">

            ${
              renderSummaryRows(
                pendingItems
              )
            }

          </div>

        </details>


        <details
          class="accordion"
          open
        >

          <summary>

            <span>
              ⚠️ Parciales
            </span>

            <span class="section-count">
              ${partialItems.length}
            </span>

          </summary>


          <div class="accordion-content">

            ${
              renderSummaryRows(
                partialItems
              )
            }

          </div>

        </details>


        <details class="accordion">

          <summary>

            <span>
              ✅ Contados
            </span>

            <span class="section-count">
              ${countedItems.length}
            </span>

          </summary>


          <div class="accordion-content">

            ${
              renderSummaryRows(
                countedItems
              )
            }

          </div>

        </details>


      </section>


      <section class="responsible-section">

        <div class="section-heading">

          <h3>
            Responsable
          </h3>

          <p>
            Nombre de quien realiza y envía el inventario.
          </p>

        </div>


        <div class="field">

          <label for="responsible">
            Nombre
          </label>

          <input
            id="responsible"
            type="text"
            autocomplete="name"
            maxlength="80"
            placeholder="Nombre del responsable"
            value="${escapeHtml(
              session.responsible || ""
            )}"
          >

          <small>
            Se incluirá como firma en el resumen compartido.
          </small>

        </div>

      </section>


      <div class="summary-actions">

        <button
          id="copy-summary"
          class="button button-primary"
          type="button"
          ${session.responsible.trim() ? "" : "disabled"}
        >
          Copiar resumen
        </button>


        <button
          id="share-summary"
          class="button button-secondary"
          type="button"
          ${session.responsible.trim() ? "" : "disabled"}
        >
          Compartir
        </button>


        <button
          id="summary-back-to-categories"
          class="button button-ghost"
          type="button"
        >
          Ver categorías
        </button>


        <button
          id="new-session"
          class="button button-ghost"
          type="button"
        >
          Nuevo inventario
        </button>

      </div>


      <p
        id="summary-feedback"
        class="feedback"
        aria-live="polite"
      ></p>


    </section>
  `;


  setupSummaryEvents();
}


// ============================================================
// DATOS DEL RESUMEN
// ============================================================

function getItemsByStatus(status) {

  return activeItems.filter(
    item =>
      getCount(item.id).status ===
      status
  );
}


function renderSummaryRows(
  summaryItems
) {

  if (summaryItems.length === 0) {

    return `
      <p class="summary-empty">
        Ninguno
      </p>
    `;
  }


  return summaryItems
    .map(item => {

      const count =
        getCount(item.id);


      let secondaryText =
        "";


      if (
        count.status ===
        "counted"
      ) {

        secondaryText =
          `${formatQuantity(
            count.quantity
          )} ${escapeHtml(
            item.unit
          )}`;

      } else if (
        count.status ===
        "partial"
      ) {

        secondaryText =
          `${formatQuantity(
            count.quantity
          )} ${escapeHtml(
            item.unit
          )} · avance`;

      } else {

        secondaryText =
          "Sin conteo";
      }


      return `
        <button
          class="summary-item-button"
          type="button"
          data-item-index="${activeItems.indexOf(item)}"
        >

          <span class="summary-item-main">

            <strong>
              ${getStatusIcon(
                count.status
              )}

              ${escapeHtml(
                item.name
              )}
            </strong>

            <small>
              ${escapeHtml(
                item.category
              )}
              ·
              ${escapeHtml(
                item.area
              )}
            </small>

          </span>


          <span class="summary-item-value">

            ${escapeHtml(
              secondaryText
            )}

            <span
              class="summary-arrow"
              aria-hidden="true"
            >
              →
            </span>

          </span>

        </button>
      `;
    })
    .join("");
}


// ============================================================
// EVENTOS DEL RESUMEN
// ============================================================

function setupSummaryEvents() {

  document
    .querySelector(
      "#summary-back-to-categories"
    )
    .addEventListener(
      "click",
      openCategories
    );

  document
    .querySelectorAll(
      ".summary-item-button"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const index =
            Number(
              button.dataset.itemIndex
            );

          openItem(index);
        }
      );
    });


  const responsibleInput =
    document.querySelector(
      "#responsible"
    );


  responsibleInput.addEventListener(
    "input",
    event => {

      session.responsible =
        event.target.value;

      saveSession();

      syncSummaryActionState();
    }
  );


  responsibleInput.addEventListener(
    "blur",
    event => {

      session.responsible =
        event.target.value.trim();

      saveSession();

      syncSummaryActionState();
    }
  );


  document
    .querySelector(
      "#copy-summary"
    )
    .addEventListener(
      "click",
      copySummary
    );


  document
    .querySelector(
      "#share-summary"
    )
    .addEventListener(
      "click",
      shareSummary
    );

  document
    .querySelector(
      "#new-session"
    )
    .addEventListener(
      "click",
      openNewSessionConfirmation
    );
}


function syncSummaryActionState() {

  const hasResponsible =
    session.responsible.trim()
      .length > 0;


  const copyButton =
    document.querySelector(
      "#copy-summary"
    );

  const shareButton =
    document.querySelector(
      "#share-summary"
    );


  if (copyButton) {
    copyButton.disabled =
      !hasResponsible;
  }


  if (shareButton) {
    shareButton.disabled =
      !hasResponsible;
  }
}


// ============================================================
// TEXTO DEL RESUMEN
// ============================================================

function generateSummaryText() {

  const stats =
    getStats();


  const date =
    new Date(
      session.date
    ).toLocaleString(
      "es-CL"
    );


  const responsible =
    session.responsible.trim();


  const lines = [

    "INVENTARIO BARRA",

    `Fecha: ${date}`,

    `Responsable: ${responsible}`,

    "",

    `Pendientes: ${stats.pending}`,

    `Parciales: ${stats.partial}`,

    `Contados: ${stats.counted}`,

    `Progreso: ${stats.processed}/${stats.total}`,

    "",

    "DETALLE"

  ];


  for (
    const item of activeItems
  ) {

    const count =
      getCount(item.id);


    let line =
      `- ${item.name}: `;


    switch (count.status) {

      case "counted":

        line +=
          `${formatQuantity(
            count.quantity
          )} ${item.unit}`;

        break;


      case "partial":

        line +=
          `${formatQuantity(
            count.quantity
          )} ${item.unit} (PARCIAL)`;

        break;


      case "pending":

      default:

        line +=
          "PENDIENTE";

        break;
    }


    if (count.note) {

      line +=
        ` — ${count.note}`;
    }


    lines.push(line);
  }


  return lines.join("\n");
}


// ============================================================
// COPIAR / COMPARTIR
// ============================================================

async function copySummary() {

  if (
    !session.responsible.trim()
  ) {
    showSummaryFeedback(
      "Ingresa el nombre del responsable antes de copiar."
    );

    return;
  }


  const text =
    generateSummaryText();


  try {

    await navigator.clipboard.writeText(
      text
    );


    showSummaryFeedback(
      "Resumen copiado al portapapeles."
    );

  } catch (error) {

    console.error(
      "No se pudo copiar:",
      error
    );


    showSummaryFeedback(
      "No se pudo copiar automáticamente."
    );
  }
}


async function shareSummary() {

  if (
    !session.responsible.trim()
  ) {
    showSummaryFeedback(
      "Ingresa el nombre del responsable antes de compartir."
    );

    return;
  }


  if (!navigator.share) {

    showSummaryFeedback(
      "La opción de compartir no está disponible en este dispositivo."
    );

    return;
  }


  const text =
    generateSummaryText();


  try {

    await navigator.share({

      title:
        "Inventario Barra",

      text
    });


    showSummaryFeedback(
      "Resumen compartido."
    );

  } catch (error) {

    if (
      error.name !==
      "AbortError"
    ) {

      console.error(
        "No se pudo compartir:",
        error
      );


      showSummaryFeedback(
        "No se pudo compartir el resumen."
      );
    }
  }
}


function showSummaryFeedback(
  message
) {

  const feedback =
    document.querySelector(
      "#summary-feedback"
    );

  if (!feedback) {
    return;
  }

  feedback.textContent =
    message;
}


function showFeedback(
  message
) {

  const feedback =
    document.querySelector(
      ".feedback"
    );


  if (feedback) {

    feedback.textContent =
      message;

    return;
  }


  const countView =
    document.querySelector(
      ".count-view"
    );


  if (!countView) {
    return;
  }


  const newFeedback =
    document.createElement(
      "p"
    );


  newFeedback.className =
    "feedback feedback-error";


  newFeedback.textContent =
    message;


  newFeedback.setAttribute(
    "aria-live",
    "polite"
  );


  countView.appendChild(
    newFeedback
  );
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
        Agrega productos activos en
        <code>
          data/items.js
        </code>.
      </p>

    </section>

  `;
}


// ============================================================
// MODAL
// ============================================================

function setupModalEvents() {

  headerBackButton
    .addEventListener(
      "click",
      openCategories
    );

  cancelNewSessionButton
    .addEventListener(
      "click",
      closeNewSessionConfirmation
    );


  confirmNewSessionButton
    .addEventListener(
      "click",
      startNewSession
    );


  confirmModal.addEventListener(
    "click",
    event => {

      if (
        event.target ===
        confirmModal
      ) {

        closeNewSessionConfirmation();
      }
    }
  );


  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Escape" &&
        !confirmModal.hidden
      ) {

        closeNewSessionConfirmation();
      }
    }
  );
}


// ============================================================
// INICIO
// ============================================================

setupModalEvents();

render();
