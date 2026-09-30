import { items } from "./data/items.js";

const STORAGE_KEY =
  "inventario-barra-session-v2";

const appContent =
  document.querySelector("#app-content");

const progressText =
  document.querySelector("#progress-text");

const progressBar =
  document.querySelector("#progress-bar");

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
    schemaVersion: 2,

    id: createId(),

    date: new Date().toISOString(),

    startedAt: new Date().toISOString(),

    currentIndex: 0,

    view: "count",

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
      parsed.schemaVersion !== 2 ||
      !parsed.counts
    ) {
      return createSession();
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

  const percentage =
    total === 0
      ? 0
      : Math.round(
          (processed / total) * 100
        );

  return {
    total,
    pending,
    partial,
    counted,
    processed,
    percentage
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


  if (status === "counted") {

    feedbackMessage =
      "Conteo guardado.";

    goToNextItem();

    return;
  }


  feedbackMessage =
    "Avance guardado como parcial.";

  render();
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

  if (
    session.currentIndex <= 0
  ) {
    return;
  }

  session.currentIndex--;

  session.view =
    "count";

  saveSession();

  render();
}


function goToNextItem() {

  if (
    session.currentIndex <
    activeItems.length - 1
  ) {

    session.currentIndex++;

    session.view =
      "count";

    saveSession();

    render();

    return;
  }


  session.view =
    "summary";

  saveSession();

  render();
}


function openSummary() {

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

  progressText.textContent =
    `${stats.processed} / ${stats.total} procesados`;

  progressBar.style.width =
    `${stats.percentage}%`;
}


// ============================================================
// RENDER PRINCIPAL
// ============================================================

function render() {

  updateProgress();


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


  renderCurrentItem();
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


  const currentNumber =
    session.currentIndex + 1;


  const selectorOptions =
    activeItems
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
          index ===
          session.currentIndex
            ? "selected"
            : "";

        return `
          <option
            value="${index}"
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

  const safeArea =
    escapeHtml(item.area);

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

        <div class="item-position">
          Ítem ${currentNumber}
          de ${activeItems.length}
        </div>

        <select
          id="item-selector"
          class="item-selector"
          aria-label="Seleccionar ítem"
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
          ${session.currentIndex === 0 ? "disabled" : ""}
        >
          ← Anterior
        </button>


        <button
          id="open-summary"
          class="button button-ghost"
          type="button"
        >
          Resumen
        </button>


        <button
          id="next-item"
          class="button button-ghost"
          type="button"
        >
          Siguiente →
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
            📛 Pendientes
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
              📛 Pendientes
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