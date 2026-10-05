import { warehouseOrderItems } from "../../data/warehouse-order-items.js";


const STORAGE_KEY =
  "pedido-bodega-session-v1";


const zones = [
  "Barra",
  "Servicio / Linea / Armado",
  "Copería",
  "Bebidas y aguas",
  "Generales"
];


const activeItems =
  warehouseOrderItems
    .filter(item => item.active)
    .sort(
      (a, b) =>
        a.order - b.order
    );


const appContent =
  document.querySelector(
    "#app-content"
  );


const pageTitle =
  document.querySelector(
    "#page-title"
  );


const headerBack =
  document.querySelector(
    "#header-back"
  );


const globalSearch =
  document.querySelector(
    "#global-search"
  );


const clearSearchButton =
  document.querySelector(
    "#clear-search"
  );


const currentOrderButton =
  document.querySelector(
    "#current-order-button"
  );


const currentOrderCount =
  document.querySelector(
    "#current-order-count"
  );


let storageWarning = false;

let sessionNeedsSave = false;


let session =
  loadSession();


let currentView =
  session.view ||
  "zones";


let currentZone =
  session.zone ||
  null;


let searchTerm =
  session.searchTerm ||
  "";


// ============================================================
// SESIÓN
// ============================================================

function createSession() {

  return {
    schemaVersion: 1,

    id: createId(),

    date:
      new Date().toISOString(),

    view: "zones",

    zone: null,

    searchTerm: "",

    responsible: "",

    quantities: {}
  };
}


function createId() {

  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {

    return crypto.randomUUID();
  }


  return `pedido-${Date.now()}`;
}


function loadSession() {

  let saved;

  try {

    saved =
      localStorage.getItem(
        STORAGE_KEY
      );


    if (!saved) {

      return createSession();
    }


  } catch (error) {

    console.error(
      "No se pudo cargar el pedido:",
      error
    );

    storageWarning = true;

    return createSession();
  }


  let parsed;

  try {

    parsed = JSON.parse(saved);

  } catch (error) {

    console.error(
      "No se pudo interpretar el pedido:",
      error
    );

    sessionNeedsSave = true;

    return createSession();
  }


  if (
    !isPlainObject(parsed) ||
    parsed.schemaVersion !== 1
  ) {

    sessionNeedsSave = true;

    return createSession();
  }


  const normalized =
    normalizeSession(parsed);


  sessionNeedsSave =
    JSON.stringify(normalized) !==
    JSON.stringify(parsed);


  return normalized;
}


function isPlainObject(value) {

  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}


function normalizeSession(rawSession) {

  const normalized = {
    ...createSession(),
    ...rawSession,
    schemaVersion: 1
  };


  if (
    typeof normalized.id !== "string" ||
    normalized.id.length === 0
  ) {

    normalized.id = createId();
  }


  if (
    typeof normalized.date !== "string" ||
    Number.isNaN(Date.parse(normalized.date))
  ) {

    normalized.date = new Date().toISOString();
  }


  if (
    typeof normalized.responsible !== "string"
  ) {

    normalized.responsible = "";
  }


  if (typeof normalized.searchTerm !== "string") {

    normalized.searchTerm = "";
  }


  normalized.quantities =
    normalizeQuantities(rawSession.quantities);


  if (
    !["zones", "items", "summary"].includes(
      normalized.view
    )
  ) {

    normalized.view = "zones";
  }


  if (
    typeof normalized.zone !== "string" ||
    !zones.includes(normalized.zone)
  ) {

    normalized.zone = null;
  }


  if (
    normalized.view === "items" &&
    normalized.zone === null
  ) {

    normalized.view = "zones";
  }


  if (normalized.view === "zones") {

    normalized.zone = null;
  }


  return normalized;
}


function normalizeQuantities(quantities) {

  if (!isPlainObject(quantities)) {

    return {};
  }


  const catalogItemIds = new Set(
    warehouseOrderItems.map(item => item.id)
  );

  const normalized = {};


  for (const [itemId, quantity] of Object.entries(quantities)) {

    if (
      !catalogItemIds.has(itemId) ||
      typeof quantity !== "number" ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {

      continue;
    }


    const rounded =
      Math.round(quantity * 1000) / 1000;


    if (Number.isFinite(rounded) && rounded > 0) {

      normalized[itemId] = rounded;
    }
  }


  return normalized;
}


function updateStorageWarning() {

  const existing =
    appContent.querySelector(
      "#storage-warning"
    );


  if (!storageWarning) {

    existing?.remove();

    return;
  }


  const warning =
    existing ||
    document.createElement("p");


  warning.id = "storage-warning";

  warning.className =
    "warehouse-empty-state";

  warning.setAttribute(
    "role",
    "status"
  );

  warning.setAttribute(
    "aria-live",
    "polite"
  );

  warning.textContent =
    "No se pudieron guardar los cambios en este dispositivo. Permanecerán disponibles mientras esta página esté abierta.";


  if (!existing) {

    appContent.prepend(warning);
  }
}


function saveSession() {

  session.view =
    currentView;


  session.zone =
    currentZone;


  session.searchTerm =
    searchTerm;


  try {

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(session)
    );

    storageWarning = false;

    sessionNeedsSave = false;

    updateStorageWarning();

    return true;

  } catch (error) {

    console.error(
      "No se pudo guardar el pedido:",
      error
    );

    storageWarning = true;

    updateStorageWarning();

    return false;
  }
}


// ============================================================
// UTILIDADES
// ============================================================

function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function normalizeText(value) {

  return String(value)
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim();
}


function formatQuantity(value) {

  return new Intl.NumberFormat(
    "es-CL",
    {
      useGrouping: false,
      maximumFractionDigits: 3
    }
  ).format(
    Number(value) || 0
  );
}


function getQuantity(itemId) {

  const value =
    Number(
      session.quantities[itemId]
    );


  return Number.isFinite(value) &&
    value > 0
      ? value
      : 0;
}


function getSelectedItems() {

  return activeItems.filter(
    item =>
      getQuantity(item.id) > 0
  );
}


function getSelectedCount() {

  return getSelectedItems().length;
}


function getItemsForZone(zone) {

  return activeItems.filter(
    item =>
      item.zone === zone
  );
}


function getVisibleItems(
  itemsToFilter = activeItems
) {

  const normalizedSearch =
    normalizeText(searchTerm);


  if (!normalizedSearch) {

    return itemsToFilter;
  }


  return itemsToFilter.filter(
    item =>
      normalizeText(
        item.name
      ).includes(
        normalizedSearch
      )
  );
}


// ============================================================
// RENDER PRINCIPAL
// ============================================================

function render() {

  updateChrome();


  if (
    currentView === "summary"
  ) {

    renderSummary();

  } else if (
    currentView === "items" &&
    currentZone
  ) {

    renderZoneItems(
      currentZone
    );

  } else {

    currentView =
      "zones";


    currentZone =
      null;


    saveSession();

    renderZones();
  }


  updateStorageWarning();
}


// ============================================================
// CABECERA
// ============================================================

function updateChrome() {

  const selectedCount =
    getSelectedCount();


  currentOrderCount.textContent =
    selectedCount;


  if (
    currentView === "zones"
  ) {

    pageTitle.textContent =
      "Pedido a Bodega";


    headerBack.innerHTML = `
      <span aria-hidden="true">
        ←
      </span>
    `;


    globalSearch.hidden =
      false;


    globalSearch.value =
      searchTerm;


    clearSearchButton.hidden =
      searchTerm.length === 0;


    return;
  }


  if (
    currentView === "items"
  ) {

    pageTitle.textContent =
      currentZone ||
      "Pedido a Bodega";


    headerBack.innerHTML = `
      <span aria-hidden="true">
        ←
      </span>
    `;


    globalSearch.hidden =
      false;


    globalSearch.value =
      searchTerm;


    clearSearchButton.hidden =
      searchTerm.length === 0;


    return;
  }


  pageTitle.textContent =
    "Pedido actual";


  headerBack.innerHTML = `
    <span aria-hidden="true">
      ←
    </span>
  `;


  globalSearch.hidden =
    true;


  clearSearchButton.hidden =
    true;
}


// ============================================================
// ZONAS
// ============================================================

function renderZones() {

  const filtered =
    getVisibleItems(
      activeItems
    );


  const normalizedSearch =
    normalizeText(
      searchTerm
    );


  /*
   * ==========================================================
   * MODO BÚSQUEDA
   *
   * Cuando hay texto en el buscador, ocultamos completamente
   * las zonas y mostramos solamente los resultados.
   * Al limpiar el buscador, automáticamente vuelven las zonas.
   * ==========================================================
   */

  if (normalizedSearch) {

    appContent.innerHTML = `

      <section class="warehouse-view">

        <section class="warehouse-search-results">

          <div class="warehouse-section-heading">

            <h2>
              Resultados
            </h2>

            <span>
              ${filtered.length}
            </span>

          </div>


          ${renderCompactItemList(
            filtered,
            "global"
          )}

        </section>

      </section>
    `;


    bindQuantityButtons();

    return;
  }


  /*
   * ==========================================================
   * MODO NORMAL
   *
   * Sin búsqueda se muestran nuevamente todas las zonas.
   * ==========================================================
   */

  const cards =
    zones
      .map(zone => {

        const zoneItems =
          getItemsForZone(
            zone
          );


        const selected =
          zoneItems.filter(
            item =>
              getQuantity(
                item.id
              ) > 0
          ).length;


        const suffix =
          selected > 0
            ? ` · ${selected} seleccionados`
            : "";


        return `
          <button
            class="warehouse-zone-card"
            type="button"
            data-zone="${escapeHtml(zone)}"
          >

            <span class="warehouse-zone-card-title">
              ${escapeHtml(zone)}
            </span>

            <span class="warehouse-zone-card-meta">
              ${zoneItems.length} productos${suffix}
            </span>

          </button>
        `;
      })
      .join("");


  appContent.innerHTML = `

    <section class="warehouse-view">

      <div class="warehouse-zone-grid">
        ${cards}
      </div>

    </section>
  `;


  document
    .querySelectorAll(
      ".warehouse-zone-card"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            openZone(
              button.dataset.zone
            );

          }
        );

      }
    );


  bindQuantityButtons();
}


// ============================================================
// PRODUCTOS DE UNA ZONA
// ============================================================

function renderZoneItems(zone) {

  const zoneItems =
    getItemsForZone(
      zone
    );


  const visibleItems =
    getVisibleItems(
      zoneItems
    );


  const selectedCount =
    zoneItems.filter(
      item =>
        getQuantity(
          item.id
        ) > 0
    ).length;


  appContent.innerHTML = `

    <section class="warehouse-view">

      <div class="warehouse-zone-summary">

        <span>
          ${selectedCount}
          seleccionados
        </span>

      </div>


      ${renderCompactItemList(
        visibleItems,
        zone
      )}

    </section>
  `;


  bindQuantityButtons();
}


// ============================================================
// LISTA COMPACTA DE PRODUCTOS
// ============================================================

function renderCompactItemList(
  itemsToRender,
  context
) {

  if (
    itemsToRender.length === 0
  ) {

    return `
      <div class="warehouse-empty-state">
        No encontramos productos con esa búsqueda.
      </div>
    `;
  }


  return `
    <div
      class="warehouse-item-list"
      data-context="${escapeHtml(context)}"
    >

      ${itemsToRender
        .map(
          item =>
            renderCompactItem(item)
        )
        .join("")}

    </div>
  `;
}


function renderCompactItem(item) {

  const quantity =
    getQuantity(
      item.id
    );


  return `
    <article class="warehouse-item-row">

      <div class="warehouse-item-info">

        <strong>
          ${escapeHtml(item.name)}
        </strong>

        <span>
          ${escapeHtml(item.unit)}
        </span>

      </div>


      <div
        class="warehouse-quantity-controls"
        aria-label="Cantidad para ${escapeHtml(item.name)}"
      >

        <button
          class="warehouse-quantity-button"
          type="button"
          data-action="decrease"
          data-item-id="${escapeHtml(item.id)}"
          aria-label="Disminuir ${escapeHtml(item.name)}"
        >
          −
        </button>


        <button
          class="warehouse-quantity-value"
          type="button"
          data-action="edit"
          data-item-id="${escapeHtml(item.id)}"
          aria-label="Editar cantidad de ${escapeHtml(item.name)}"
        >
          ${formatQuantity(quantity)}
        </button>


        <button
          class="warehouse-quantity-button"
          type="button"
          data-action="increase"
          data-item-id="${escapeHtml(item.id)}"
          aria-label="Aumentar ${escapeHtml(item.name)}"
        >
          +
        </button>

      </div>

    </article>
  `;
}


// ============================================================
// CANTIDADES
// ============================================================

function bindQuantityButtons() {

  document
    .querySelectorAll(
      ".warehouse-quantity-controls button"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const item =
              activeItems.find(
                candidate =>
                  candidate.id ===
                  button.dataset.itemId
              );


            if (!item) {

              return;
            }


            switch (
              button.dataset.action
            ) {

              case "increase":

                setQuantity(
                  item.id,
                  getQuantity(
                    item.id
                  ) + 1
                );

                break;


              case "decrease":

                setQuantity(
                  item.id,
                  Math.max(
                    0,
                    getQuantity(
                      item.id
                    ) - 1
                  )
                );

                break;


              case "edit":

                editQuantity(
                  item
                );

                break;


              default:

                return;
            }


            render();

          }
        );

      }
    );
}


function setQuantity(
  itemId,
  quantity
) {

  const numericQuantity =
    Number(quantity);


  if (
    !Number.isFinite(
      numericQuantity
    ) ||
    numericQuantity <= 0
  ) {

    delete session.quantities[
      itemId
    ];

  } else {

    session.quantities[
      itemId
    ] =
      Math.round(
        numericQuantity * 1000
      ) / 1000;
  }


  saveSession();
}


function editQuantity(item) {

  const current =
    getQuantity(
      item.id
    );


  const input =
    window.prompt(
      `Cantidad para ${item.name} (${item.unit})`,
      current > 0
        ? String(current)
        : "1"
    );


  if (
    input === null
  ) {

    return;
  }


  const normalized =
    input
      .trim()
      .replace(",", ".");


  const quantity =
    Number(normalized);


  if (
    !Number.isFinite(quantity) ||
    quantity < 0
  ) {

    window.alert(
      "Ingresa una cantidad válida."
    );


    return;
  }


  setQuantity(
    item.id,
    quantity
  );
}


// ============================================================
// NAVEGACIÓN
// ============================================================

function openZone(zone) {

  if (
    !zones.includes(zone)
  ) {

    return;
  }


  currentView =
    "items";


  currentZone =
    zone;


  searchTerm =
    "";


  saveSession();

  render();


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


function openZones() {

  currentView =
    "zones";


  currentZone =
    null;


  searchTerm =
    "";


  saveSession();

  render();


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


function openSummary() {

  currentView =
    "summary";


  saveSession();

  render();


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


// ============================================================
// RESUMEN
// ============================================================

function getZoneGroupsWithSelectedItems() {

  return zones
    .map(
      zone => ({

        zone,

        items:
          getSelectedItems()
            .filter(
              item =>
                item.zone ===
                zone
            )

      })
    )
    .filter(
      group =>
        group.items.length > 0
    );
}


function renderSummary() {

  const selected =
    getSelectedItems();


  const groups =
    getZoneGroupsWithSelectedItems();


  const responsible =
    escapeHtml(
      session.responsible ||
      ""
    );


  const groupedHtml =
    groups.length === 0

      ? `
        <div class="warehouse-empty-state">
          Tu pedido todavía está vacío.
        </div>
      `

      : groups
          .map(
            group => `

              <section class="warehouse-summary-group">

                <div class="warehouse-section-heading">

                  <h2>
                    ${escapeHtml(
                      group.zone
                    )}
                  </h2>

                  <span>
                    ${group.items.length}
                  </span>

                </div>


                <div class="warehouse-summary-items">

                  ${group.items
                    .map(
                      item => `

                        <div class="warehouse-summary-row">

                          <div>

                            <strong>
                              ${escapeHtml(
                                item.name
                              )}
                            </strong>

                            <span>
                              ${escapeHtml(
                                item.unit
                              )}
                            </span>

                          </div>


                          <div class="warehouse-summary-quantity">

                            <button
                              type="button"
                              class="warehouse-summary-minus"
                              data-item-id="${escapeHtml(item.id)}"
                            >
                              −
                            </button>


                            <button
                              type="button"
                              class="warehouse-summary-edit"
                              data-item-id="${escapeHtml(item.id)}"
                            >
                              ${formatQuantity(
                                getQuantity(
                                  item.id
                                )
                              )}
                            </button>


                            <button
                              type="button"
                              class="warehouse-summary-plus"
                              data-item-id="${escapeHtml(item.id)}"
                            >
                              +
                            </button>

                          </div>

                        </div>

                      `
                    )
                    .join("")}

                </div>

              </section>

            `
          )
          .join("");


  appContent.innerHTML = `

    <section class="warehouse-view warehouse-summary-view">

      ${groupedHtml}


      <div class="warehouse-form-card">

        <label for="responsible">
          Responsable
        </label>


        <input
          id="responsible"
          type="text"
          autocomplete="name"
          placeholder="Nombre (Opcional)"
          value="${responsible}"
        >

      </div>


      <div class="warehouse-summary-actions">

        <button
          id="continue-order"
          class="
            warehouse-button
            warehouse-button-secondary
          "
          type="button"
        >
          Agregar más cosas
        </button>


        <button
          id="send-whatsapp"
          class="
            warehouse-button
            warehouse-button-primary
          "
          type="button"
          ${selected.length === 0 ? "disabled" : ""}
        >
          💬 Enviar por WhatsApp
        </button>

      </div>

    </section>
  `;


  setupSummaryEvents();
}


// ============================================================
// EVENTOS DEL RESUMEN
// ============================================================

function setupSummaryEvents() {

  const responsibleInput =
    document.querySelector(
      "#responsible"
    );


  responsibleInput.addEventListener(
    "input",
    () => {

      session.responsible =
        responsibleInput.value;


      saveSession();

    }
  );


  document
    .querySelector(
      "#continue-order"
    )
    .addEventListener(
      "click",
      openZones
    );


  document
    .querySelector(
      "#send-whatsapp"
    )
    .addEventListener(
      "click",
      sendWhatsApp
    );


  document
    .querySelectorAll(
      ".warehouse-summary-minus"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const itemId =
              button.dataset.itemId;


            setQuantity(
              itemId,
              Math.max(
                0,
                getQuantity(
                  itemId
                ) - 1
              )
            );


            render();

          }
        );

      }
    );


  document
    .querySelectorAll(
      ".warehouse-summary-plus"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const itemId =
              button.dataset.itemId;


            setQuantity(
              itemId,
              getQuantity(
                itemId
              ) + 1
            );


            render();

          }
        );

      }
    );


  document
    .querySelectorAll(
      ".warehouse-summary-edit"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const item =
              activeItems.find(
                candidate =>
                  candidate.id ===
                  button.dataset.itemId
              );


            if (!item) {

              return;
            }


            editQuantity(
              item
            );


            render();

          }
        );

      }
    );
}


// ============================================================
// WHATSAPP
// ============================================================

function buildWhatsAppMessage() {

  const groups =
    getZoneGroupsWithSelectedItems();


  const lines = [

    "📦 PEDIDO A BODEGA",

    ""

  ];


  const responsible =
    session.responsible.trim();


  if (responsible) {

    lines.push(
      `Responsable: ${responsible}`,
      ""
    );
  }


  groups.forEach(
    group => {

      lines.push(
        group.zone.toUpperCase()
      );


      group.items.forEach(
        item => {

          lines.push(
            `• ${item.name}: ${formatQuantity(
              getQuantity(
                item.id
              )
            )}`
          );

        }
      );


      lines.push("");

    }
  );


  lines.push(
    `Total: ${getSelectedCount()} ${
      getSelectedCount() === 1
        ? "producto"
        : "productos"
    }`
  );


  return lines.join(
    "\n"
  );
}


function sendWhatsApp() {

  const selected =
    getSelectedItems();


  if (
    selected.length === 0
  ) {

    return;
  }


  const text =
    buildWhatsAppMessage();


  const whatsappUrl =
    `https://wa.me/?text=${encodeURIComponent(
      text
    )}`;


  window.location.href =
    whatsappUrl;
}


// ============================================================
// BÚSQUEDA
// ============================================================

function setSearchTerm(
  value
) {

  searchTerm =
    value;


  globalSearch.value =
    searchTerm;


  clearSearchButton.hidden =
    searchTerm.length === 0;


  saveSession();

  render();
}


// ============================================================
// EVENTOS GLOBALES
// ============================================================

headerBack.addEventListener(
  "click",
  () => {

    if (
      currentView === "summary"
    ) {

      openZones();

      return;
    }


    if (
      currentView === "items"
    ) {

      openZones();

      return;
    }


    window.location.href =
      "../../";

  }
);


globalSearch.addEventListener(
  "input",
  event => {

    setSearchTerm(
      event.target.value
    );

  }
);


clearSearchButton.addEventListener(
  "click",
  () => {

    setSearchTerm("");

    globalSearch.focus();

  }
);


currentOrderButton.addEventListener(
  "click",
  openSummary
);


// ============================================================
// RECUPERAR SESIÓN AL VOLVER A LA PÁGINA
// ============================================================

window.addEventListener(
  "pageshow",
  () => {

    session =
      loadSession();


    currentView =
      session.view ||
      "zones";


    currentZone =
      session.zone ||
      null;


    searchTerm =
      session.searchTerm ||
      "";


    if (sessionNeedsSave) {

      saveSession();
    }


    render();

  }
);


// ============================================================
// INICIALIZACIÓN
// ============================================================

saveSession();

render();
