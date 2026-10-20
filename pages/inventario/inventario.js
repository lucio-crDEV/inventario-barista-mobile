import { areas, serviceSectors, garzonZones } from "../../data/inventario/areas.js";
import { items } from "../../data/inventario/items/index.js";
import { showSummaryTransition } from "./summary-transition.js";
import { nextWorkIndex, isOutOfStockCount, feedbackToneForCount } from "./work-selection.js";


const STORAGE_KEY =
    "inventario-session-v2";


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


const params = new URLSearchParams(window.location.search);
const selectedArea = areas.find(area => area.id === params.get("area"));
const selectedSector = selectedArea?.id === "servicio"
    ? serviceSectors.find(sector => sector.id === params.get("sector"))
    : null;
const selectedZone = selectedSector?.id === "garzones"
    ? garzonZones.find(zone => zone.id === params.get("zone"))
    : null;
const scopeKey = [selectedArea?.id, selectedSector?.id, selectedZone?.id]
    .filter(Boolean).join(":");
const isGarzonZone = selectedSector?.id === "garzones" && Boolean(selectedZone);
const defaultView = isGarzonZone ? "count" : "categories";

function getAreaName(areaId) {
    if (areaId === "servicio" && selectedSector) {
        return selectedZone
            ? `${selectedSector.name} · ${selectedZone.name}`
            : selectedSector.name;
    }
    return areas.find(area => area.id === areaId)?.name || areaId;
}

function getCountCategory(item) {
    return item.countCategory || item.category || "Sin categoría";
}

const activeItems = items
    .filter(item => item.active
        && item.areaId === selectedArea?.id
        && (selectedArea?.id !== "servicio" || item.sectorId === selectedSector?.id)
        && (selectedSector?.id !== "garzones" || item.zoneId === selectedZone?.id))
    .sort((a, b) => a.order - b.order);


let storageWarning = false;

let sessionNeedsSave = false;


let session =
    loadSession();


let feedbackMessage = "";
let feedbackTone = "counted";
let feedbackDismissTimer;
let feedbackRemoveTimer;
let newSessionReturnFocus = null;


// ============================================================
// SESIÓN
// ============================================================

function createSession() {

    return {
        schemaVersion: 3,

        id: createId(),

        date:
            new Date().toISOString(),

        startedAt:
            new Date().toISOString(),

        currentIndex: 0,

        scopeKey,

        view: defaultView,

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

    let saved;

    try {

        saved =
            localStorage.getItem(STORAGE_KEY);


        if (!saved) {

            return createSession();
        }


    } catch (error) {

        console.error(
            "No se pudo cargar la sesión:",
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
            "No se pudo interpretar la sesión:",
            error
        );

        sessionNeedsSave = true;

        return createSession();
    }


    if (
        !isPlainObject(parsed) ||
        ![2, 3].includes(parsed.schemaVersion)
    ) {

        sessionNeedsSave = true;

        return createSession();
    }


    const originalSchemaVersion =
        parsed.schemaVersion;


    const normalized = {
        ...createSession(),
        ...parsed,
        schemaVersion: 3
    };


    if (
        originalSchemaVersion === 2 &&
        normalized.view === "count"
    ) {

        normalized.view = "categories";
    }


    if (
        typeof normalized.id !== "string" ||
        normalized.id.length === 0
    ) {

        normalized.id = createId();
    }


    if (!isValidDateString(normalized.date)) {

        normalized.date = new Date().toISOString();
    }


    if (!isValidDateString(normalized.startedAt)) {

        normalized.startedAt = normalized.date;
    }


    if (
        !Number.isInteger(normalized.currentIndex)
    ) {

        normalized.currentIndex = 0;
    }


    normalized.currentIndex = Math.min(
        Math.max(normalized.currentIndex, 0),
        Math.max(activeItems.length - 1, 0)
    );


    if (
        ![
            "categories",
            "count",
            "summary"
        ].includes(normalized.view)
    ) {

        normalized.view = defaultView;
    }

    if (isGarzonZone && normalized.view === "categories") {
        normalized.view = "count";
    }

    if (typeof normalized.responsible !== "string") {

        normalized.responsible = "";
    }


    normalized.counts =
        normalizeCounts(normalized.counts);

    if (normalized.scopeKey !== scopeKey) {
        normalized.scopeKey = scopeKey;
        normalized.currentIndex = isGarzonZone
            ? nextWorkIndex(activeItems, normalized.counts)
            : 0;
        normalized.view = defaultView;
    }

    sessionNeedsSave =
        originalSchemaVersion !== 3 ||
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


function isValidDateString(value) {

    return typeof value === "string" &&
        !Number.isNaN(Date.parse(value));
}


function normalizeCounts(counts) {

    if (!isPlainObject(counts)) {

        return {};
    }


    const catalogItemsById = new Map(
        items.map(item => [item.id, item])
    );

    const normalizedCounts = {};


    for (const [itemId, rawCount] of Object.entries(counts)) {

        const item = catalogItemsById.get(itemId);


        if (!item || !isPlainObject(rawCount)) {

            continue;
        }


        const count = {
            ...rawCount
        };

        const validStatus = [
            "pending",
            "partial",
            "counted"
        ].includes(count.status);

        if (!validStatus) {

            count.status = "pending";
        }


        if (
            count.quantity !== null &&
            (
                typeof count.quantity !== "number" ||
                !Number.isFinite(count.quantity) ||
                count.quantity < 0
            )
        ) {

            count.quantity = null;
        }


        if (
            ["partial", "counted"].includes(count.status) &&
            count.quantity === null
        ) {

            count.status = "pending";
        }

        count.outOfStock = isOutOfStockCount(count);


        if (typeof count.note !== "string") {

            count.note = "";
        }


        if (item.id === "chai-polvo" &&
            count.unit?.toLowerCase() === "gr" &&
            typeof count.quantity === "number") {
            count.quantity /= 1000;
            count.unit = "KG";
        }

        if (typeof count.unit !== "string") {
            count.unit = item.unit;
        }


        if (
            count.countedAt !== null &&
            typeof count.countedAt !== "string"
        ) {

            count.countedAt = null;
        }


        count.itemId = itemId;

        normalizedCounts[itemId] = count;
    }


    return normalizedCounts;
}


function saveSession() {

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
            "No se pudo guardar la sesión:",
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

function getCurrentItem() {

    return activeItems[
        session.currentIndex
    ];
}


function getCategoryGroups() {

    const groups = [];

    const groupsByName =
        new Map();


    for (
        const item of activeItems
    ) {

        const category =
            getCountCategory(item);

        let group =
            groupsByName.get(
                category
            );


        if (!group) {

            group = {
                name: category,
                order: Number.isInteger(item.countCategoryOrder)
                    ? item.countCategoryOrder
                    : groups.length,
                items: []
            };


            groupsByName.set(
                category,
                group
            );


            groups.push(group);
        }


        group.items.push(item);
    }


    return groups.sort((a, b) => a.order - b.order);
}


function getCategoryStats(
    categoryItems
) {

    let counted = 0;

    let partial = 0;


    for (
        const item of categoryItems
    ) {

        const count =
            getCount(item.id);


        if (
            count.status === "counted"
        ) {

            counted++;
        }


        if (
            count.status === "partial"
        ) {

            partial++;
        }
    }


    const total =
        categoryItems.length;


    return {

        total,

        counted,

        partial,

        countedPercentage:
            total === 0
                ? 0
                : Math.round(
                    (counted / total) * 100
                ),

        partialPercentage:
            total === 0
                ? 0
                : Math.round(
                    (partial / total) * 100
                )
    };
}


function getCategoryItems(
    category
) {

    return activeItems.filter(
        item =>
            getCountCategory(item) === category
    );
}


function getCount(itemId) {

    return (
        session.counts[itemId] || {
            itemId,

            quantity: null,

            unit: null,

            status: "pending",

            note: "",

            countedAt: null
        }
    );
}


function getStats() {

    const total =
        activeItems.length;


    let pending = 0;

    let partial = 0;

    let counted = 0;


    for (
        const item of activeItems
    ) {

        const count =
            getCount(item.id);


        switch (
        count.status
        ) {

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
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
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


    if (
        !/^\d*\.?\d+$/.test(
            normalized
        )
    ) {

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
        Number.isNaN(
            Number(value)
        )
    ) {

        return "";
    }


    return new Intl.NumberFormat(
        "es-CL",
        {
            useGrouping: false,
            maximumFractionDigits: 3
        }
    ).format(
        Number(value)
    );
}


// ============================================================
// ESTADOS
// ============================================================

function getStatusIcon(status, outOfStock = false) {

    if (status === "counted" && outOfStock) return "🟢";

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


function getStatusLabel(status, outOfStock = false) {

    if (status === "counted" && outOfStock) return "Sin stock";

    switch (status) {

        case "counted":

            return "Contado";


        case "partial":

            return "Avance";


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
    note,
    outOfStock = false
}) {

    session.counts[item.id] = {

        sessionId:
            session.id,

        itemId:
            item.id,

        quantity,

        unit:
            item.unit,

        status,

        outOfStock,

        note,

        countedAt:
            new Date().toISOString()
    };


    saveSession();
}


// ============================================================
// GUARDAR ACTUAL
// ============================================================

function saveCurrentAs(status, { outOfStock = false } = {}) {

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
        outOfStock ? 0 : quantityInput
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
            "Ingresa una cantidad válida."
        );


        quantityInput?.focus();

        return;
    }


    registerCount({

        item,

        quantity,

        status,

        note,

        outOfStock
    });


    feedbackMessage =
        outOfStock
            ? "Sin stock guardado."
            : status === "counted"
            ? "Conteo guardado."
            : "Avance guardado.";

    feedbackTone = feedbackToneForCount(status, outOfStock);


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
    window.scrollTo(0, 0);
}


function goToPreviousItem() {

    const item =
        getCurrentItem();


    if (!item) {

        return;
    }


    const categoryItems =
        getNavigationItems(item);


    const categoryIndex =
        categoryItems.indexOf(
            item
        );


    if (
        categoryIndex <= 0
    ) {

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

    const item =
        getCurrentItem();


    if (!item) {

        return;
    }


    // Los parciales cuentan como procesados.
    // Al guardar el último pendiente,
    // el inventario queda completo
    // y se abre directamente el resumen.

    if (
        getStats().pending === 0
    ) {

        openSummary();

        return;
    }


    const categoryItems =
        getNavigationItems(item);


    const categoryIndex =
        categoryItems.indexOf(
            item
        );


    if (
        categoryIndex <
        categoryItems.length - 1
    ) {

        openItem(
            activeItems.indexOf(
                categoryItems[
                categoryIndex + 1
                ]
            )
        );


        return;
    }


    if (isGarzonZone) {
        openSummary();
    } else {
        openCategories();
    }
}


function openCategory(
    category
) {

    const categoryItems =
        getCategoryItems(
            category
        );


    if (
        categoryItems.length === 0
    ) {

        return;
    }


    session.currentIndex =
        activeItems.indexOf(
            categoryItems[nextWorkIndex(categoryItems, session.counts)]
        );


    session.view =
        "count";


    saveSession();

    render();
    window.scrollTo(0, 0);
}


function openCategories() {

    session.view =
        defaultView;


    saveSession();

    render();
    window.scrollTo(0, 0);
}


function openSummary() {

    const savedFeedback = feedbackMessage;
    const savedTone = feedbackTone;
    feedbackMessage = "";
    feedbackTone = "counted";


    session.view =
        "summary";


    saveSession();

    render();
    window.scrollTo(0, 0);

    if (savedFeedback) showToast(savedFeedback, savedTone);

    showSummaryTransition(appContent, {
        reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    });
}


// ============================================================
// NUEVO INVENTARIO
// ============================================================

function openNewSessionConfirmation() {

    newSessionReturnFocus = document.activeElement;

    confirmModal.hidden =
        false;


    document.body.classList.add(
        "modal-open"
    );


    cancelNewSessionButton.focus();
}


function closeNewSessionConfirmation(restoreFocus = true) {

    confirmModal.hidden =
        true;


    document.body.classList.remove(
        "modal-open"
    );

    if (restoreFocus && newSessionReturnFocus?.isConnected) {
        newSessionReturnFocus.focus();
    }
    newSessionReturnFocus = null;
}


function startNewSession() {

    closeNewSessionConfirmation(false);


    try {

        localStorage.removeItem(
            STORAGE_KEY
        );

    } catch (error) {

        console.error(
            "No se pudo limpiar la sesión anterior:",
            error
        );

        storageWarning = true;
    }


    session =
        createSession();


    saveSession();


    feedbackMessage = "";
    feedbackTone = "counted";


    render();
}


function getNavigationItems(item) {
    return isGarzonZone ? activeItems : getCategoryItems(getCountCategory(item));
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
            : (
                stats.counted /
                stats.total
            ) * 100;


    const partialPercentage =
        stats.total === 0
            ? 0
            : (
                stats.partial /
                stats.total
            ) * 100;


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

    const pageTitle = document.querySelector("#page-title");
    if (pageTitle) {
        pageTitle.textContent = selectedZone
            ? `Garzones · ${selectedZone.name}`
            : selectedSector?.name || selectedArea?.name || "Inventario";
    }
    headerBackButton.hidden = !selectedArea;

    const choosingScope = !selectedArea ||
        (selectedArea.id === "servicio" && !selectedSector) ||
        (selectedSector?.id === "garzones" && !selectedZone);
    const showSearch = !choosingScope && activeItems.length > 0 &&
        session.view === "categories";
    document.querySelector("#header-open-item-drawer").hidden = !showSearch;
    document.querySelector(".app-title-row").classList.toggle("has-search", showSearch);
    document.querySelector("#progress-bar-container").hidden = choosingScope;
    progressText.hidden = choosingScope;

    if (!selectedArea) {
        renderScopeChooser("Selecciona un área", areas
            .filter(area => area.active)
            .sort((a, b) => a.order - b.order)
            .map(area => ({
                name: area.name,
                url: `?area=${encodeURIComponent(area.id)}`
            })));
    } else if (selectedArea.id === "servicio" && !selectedSector) {
        renderScopeChooser("", serviceSectors.map(sector => ({
            name: sector.name,
            url: `?area=servicio&sector=${encodeURIComponent(sector.id)}`
        })));
    } else if (selectedSector?.id === "garzones" && !selectedZone) {
        renderScopeChooser("Zonas", garzonZones.map(zone => ({
            name: zone.name,
            url: `?area=servicio&sector=garzones&zone=${encodeURIComponent(zone.id)}`,
            items: items.filter(item => item.active && item.areaId === "servicio"
                && item.sectorId === "garzones" && item.zoneId === zone.id)
        })));
    } else if (activeItems.length === 0) {

        renderEmptyState();

    } else if (session.view === "summary") {

        renderSummary();

    } else if (session.view === "categories" && !isGarzonZone) {

        renderCategories();

    } else {

        renderCurrentItem();
    }


    updateStorageWarning();
    scheduleFeedbackDismissal();
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
        "feedback feedback-error";

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


// ============================================================
// SELECCIÓN DE SECTOR Y ZONA
// ============================================================

function renderScopeChooser(title, options) {
    const hasProgress = options.some(option => option.items);
    appContent.innerHTML = `
      <section class="categories-view scope-view ${hasProgress ? "scope-view-zones" : ""}">
        ${title ? `<div class="categories-heading"><h2>${escapeHtml(title)}</h2></div>` : ""}
        <div class="category-grid">
          ${options.map(option => {
            const stats = option.items ? getCategoryStats(option.items) : null;
            const partialText = stats?.partial
                ? ` · ${stats.partial} ${stats.partial === 1 ? "avance" : "avances"}`
                : "";
            return `
            <a class="category-card scope-card" href="${option.url}"
              ${stats ? `aria-label="${escapeHtml(option.name)}: ${stats.counted} de ${stats.total} contados${partialText}"` : ""}>
              <span class="category-card-title">${escapeHtml(option.name)}</span>
              ${stats ? `
                <span class="category-card-progress">${stats.counted} / ${stats.total} contados${partialText}</span>
                <span class="category-progress-bar" aria-hidden="true">
                  <span class="category-progress-value" style="width: ${stats.countedPercentage}%"></span>
                  <span class="category-progress-partial" style="left: ${stats.countedPercentage}%; width: ${stats.partialPercentage}%"></span>
                </span>` : ""}
            </a>
          `;}).join("")}
        </div>
      </section>`;
}

// ============================================================
// CATEGORÍAS
// ============================================================

function renderCategories() {

    const categoryGroups =
        getCategoryGroups();


    const currentFeedback =
        feedbackMessage;

    const currentTone = feedbackTone;


    feedbackMessage = "";
    feedbackTone = "counted";


    const categoryCards =
        categoryGroups
            .map(
                (group, index) => {

                    const stats =
                        getCategoryStats(
                            group.items
                        );


                    const partialText =
                        stats.partial > 0
                            ? ` · ${stats.partial} ${stats.partial === 1
                                ? "avance"
                                : "avances"
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
                    )}: ${escapeHtml(
                        progressLabel
                    )}"
            >

              <span
                class="category-card-title"
              >
                ${escapeHtml(
                        group.name
                    )}
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
                }
            )
            .join("");


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


      ${currentFeedback
            ? `
            <p
              class="feedback feedback-toast feedback-toast-${currentTone}"
              role="status"
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


    setupCategoryEvents(
        categoryGroups
    );
    setupItemDrawerEvents();
}


function setupCategoryEvents(
    categoryGroups
) {

    document
        .querySelectorAll(
            ".category-card"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const index =
                            Number(
                                button.dataset.categoryIndex
                            );


                        const group =
                            categoryGroups[
                            index
                            ];


                        if (group) {

                            openCategory(
                                group.name
                            );
                        }

                    }
                );

            }
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
// VISTA DE CONTEO
// ============================================================

const openItemDrawerGroups = new Set();

function renderItemDrawerList(currentItemId) {
    const groups = new Map();

    activeItems.forEach((item, index) => {
        const category = isGarzonZone ? "" : getCountCategory(item);
        if (!groups.has(category)) {
            groups.set(category, []);
        }
        groups.get(category).push({ item, index });
    });

    return [...groups].map(([category, groupItems]) => `
      ${category
        ? `<details class="item-drawer-group" data-item-group data-category="${escapeHtml(category)}" ${groupItems.some(({ item }) => item.id === currentItemId) ? "open" : ""}>
            <summary class="item-drawer-group-toggle">${escapeHtml(category)}</summary>`
        : '<section class="item-drawer-group" data-item-group>'}
        ${groupItems.map(({ item, index }) => {
            const count = getCount(item.id);
            const status = count.status;
            const outOfStock = isOutOfStockCount(count);
            const isCurrent = item.id === currentItemId;
            return `
              <button
                class="item-drawer-link${isCurrent ? " is-current" : ""}${outOfStock ? " is-out-of-stock" : ""}"
                type="button"
                data-item-index="${index}"
                ${isCurrent ? 'aria-current="true"' : ""}
              >
                <span class="item-drawer-status status-dot-${outOfStock ? "out-of-stock" : status}" aria-hidden="true"></span>
                <span class="item-drawer-name">${escapeHtml(item.name)}</span>
                <span class="item-drawer-state">${getStatusLabel(status, outOfStock)}</span>
              </button>`;
        }).join("")}
      ${category ? "</details>" : "</section>"}`).join("");
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

    const item =
        getCurrentItem();


    if (!item) {

        return;
    }


    const count =
        getCount(
            item.id
        );


    const categoryItems =
        getNavigationItems(item);


    const categoryIndex =
        categoryItems.indexOf(
            item
        );


    const isLastItem =
        categoryIndex ===
        categoryItems.length - 1;


    const safeName =
        escapeHtml(
            item.name
        );


    const safeCategory =
        escapeHtml(
            getCountCategory(item)
        );


    const safeArea =
        escapeHtml(
            getAreaName(item.areaId)
        );


    const safeUnit =
        escapeHtml(
            item.unit
        );


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
            count.status,
            isOutOfStockCount(count)
        );


    const statusLabel =
        getStatusLabel(
            count.status,
            isOutOfStockCount(count)
        );


    const currentFeedback =
        feedbackMessage;

    const currentTone = feedbackTone;


    feedbackMessage = "";
    feedbackTone = "counted";


    appContent.innerHTML = `

    <section class="count-view">


      <div class="item-navigation-top" role="group" aria-label="Navegación de ítems">
        <button
          id="previous-item"
          class="button button-ghost"
          type="button"
          ${categoryIndex === 0 ? "disabled" : ""}
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
          ${isLastItem
            ? isGarzonZone ? "Resumen →" : "Categorías →"
            : "Siguiente →"
        }
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
              status-${isOutOfStockCount(count) ? "out-of-stock" : count.status}
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
          Guardar avance
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


      ${currentFeedback
            ? `
            <p
              class="feedback feedback-toast feedback-toast-${currentTone}"
              role="status"
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

let lastItemDrawerTrigger = null;

function setupItemDrawerEvents() {

    const drawer = document.querySelector("#item-drawer");
    const search = document.querySelector("#item-drawer-search");

    document.querySelectorAll("#open-item-drawer, #header-open-item-drawer")
        .forEach(trigger => {
            if (trigger.hidden) return;
            trigger.onclick = () => {
                lastItemDrawerTrigger = trigger;
                const current = drawer.querySelector(".item-drawer-link.is-current");
                const currentGroup = current?.closest("details.item-drawer-group");
                openItemDrawerGroups.clear();
                if (currentGroup) openItemDrawerGroups.add(currentGroup.dataset.category);
                search.value = "";
                search.dispatchEvent(new Event("input"));
                drawer.classList.add("is-open");
                drawer.inert = false;
                drawer.setAttribute("aria-hidden", "false");
                trigger.setAttribute("aria-expanded", "true");
                document.body.classList.add("item-drawer-open");
                if (trigger.id === "header-open-item-drawer") {
                    search.focus({ preventScroll: true });
                } else {
                    drawer.querySelector(".item-drawer-panel").focus({ preventScroll: true });
                }

                if (current) {
                    const list = drawer.querySelector(".item-drawer-list");
                    const itemTop = current.getBoundingClientRect().top
                        - list.getBoundingClientRect().top + list.scrollTop;
                    list.scrollTop = Math.max(0, itemTop - 62);
                } else {
                    drawer.querySelector(".item-drawer-list").scrollTop = 0;
                }
            };
        });

    drawer.querySelector(".item-drawer-backdrop")
        .addEventListener("click", closeItemDrawer);
    drawer.querySelector("#close-item-drawer")
        .addEventListener("click", closeItemDrawer);

    drawer.querySelectorAll(".item-drawer-link").forEach(button => {
        button.addEventListener("click", () => {
            closeItemDrawer(false);
            openItem(Number(button.dataset.itemIndex));
        });
    });

    drawer.querySelectorAll(".item-drawer-group-toggle").forEach(toggle => {
        toggle.addEventListener("click", () => {
            const group = toggle.parentElement;
            if (group.open) {
                openItemDrawerGroups.delete(group.dataset.category);
            } else {
                openItemDrawerGroups.add(group.dataset.category);
            }
        });
    });

    search.addEventListener("input", () => {
        const query = search.value.trim().toLocaleLowerCase("es-CL")
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        let visible = 0;

        drawer.querySelectorAll("[data-item-group]").forEach(group => {
            let groupVisible = 0;
            group.querySelectorAll(".item-drawer-link").forEach(button => {
                const name = button.querySelector(".item-drawer-name").textContent
                    .toLocaleLowerCase("es-CL").normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "");
                button.hidden = !name.includes(query);
                if (!button.hidden) groupVisible++;
            });
            group.hidden = groupVisible === 0;
            if (group.tagName === "DETAILS") {
                group.open = query
                    ? groupVisible > 0
                    : openItemDrawerGroups.has(group.dataset.category);
            }
            visible += groupVisible;
        });

        drawer.querySelector("#item-drawer-empty").hidden = visible !== 0;
    });
}

function setupCurrentItemEvents() {
    setupItemDrawerEvents();

    document.querySelector("#save-out-of-stock").addEventListener(
        "click",
        () => saveCurrentAs("counted", { outOfStock: true })
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


function closeItemDrawer(restoreFocus = true) {
    const drawer = document.querySelector("#item-drawer");
    if (!drawer?.classList.contains("is-open")) return;

    drawer.classList.remove("is-open");
    drawer.inert = true;
    drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("item-drawer-open");

    const trigger = lastItemDrawerTrigger;
    trigger?.setAttribute("aria-expanded", "false");
    if (restoreFocus) trigger?.focus();
    lastItemDrawerTrigger = null;
}


// ============================================================
// RESUMEN
// ============================================================

function renderSummary() {

    const stats =
        getStats();

    const completionPercent =
        stats.total ? Math.round(stats.counted / stats.total * 100) : 0;


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
            : "Revisa pendientes, avances y productos contados.";


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


      <div class="summary-overview" aria-label="${completionPercent}% del inventario contabilizado">
        <div class="summary-overview-ring" style="--completion: ${completionPercent}%" aria-hidden="true">
          <span>${completionPercent}%</span>
        </div>
        <div class="summary-overview-copy">
          <strong>Avance del área</strong>
          <span>${stats.counted} de ${stats.total} ítems contabilizados</span>
          <span class="summary-overview-track" aria-hidden="true"><span style="width: ${completionPercent}%"></span></span>
        </div>
      </div>


      <div class="stats-grid">


        <button
          class="stat-card stat-pending"
          type="button"
          data-summary-section="pending"
          aria-controls="summary-pending"
          aria-expanded="false"
        >

          <strong>
            ${stats.pending}
          </strong>


          <span class="summary-label"><span class="summary-label-icon" aria-hidden="true">🔴</span>Pendientes</span>

        </button>


        <button
          class="stat-card stat-partial"
          type="button"
          data-summary-section="partial"
          aria-controls="summary-partial"
          aria-expanded="false"
        >

          <strong>
            ${stats.partial}
          </strong>


          <span class="summary-label"><span class="summary-label-icon" aria-hidden="true">🟡</span>Avance</span>

        </button>


        <button
          class="stat-card stat-counted"
          type="button"
          data-summary-section="counted"
          aria-controls="summary-counted"
          aria-expanded="false"
        >

          <strong>
            ${stats.counted}
          </strong>


          <span class="summary-label"><span class="summary-label-icon" aria-hidden="true">🟢</span>Contados</span>

        </button>


      </div>


      <section class="accordion-list">


        <details
          id="summary-pending"
          class="accordion"
        >

          <summary>

            <span class="summary-label"><span class="summary-label-icon" aria-hidden="true">🔴</span>Pendientes</span>


            <span class="section-count">
              ${pendingItems.length}
            </span>

          </summary>


          <div class="accordion-content">

            ${renderSummaryRows(
        pendingItems
    )
        }

          </div>

        </details>


        <details
          id="summary-partial"
          class="accordion"
        >

          <summary>

            <span class="summary-label"><span class="summary-label-icon" aria-hidden="true">🟡</span>Avance</span>


            <span class="section-count">
              ${partialItems.length}
            </span>

          </summary>


          <div class="accordion-content">

            ${renderSummaryRows(
            partialItems
        )
        }

          </div>

        </details>


        <details
          id="summary-counted"
          class="accordion"
        >

          <summary>

            <span class="summary-label"><span class="summary-label-icon" aria-hidden="true">🟢</span>Contados</span>


            <span class="section-count">
              ${countedItems.length}
            </span>

          </summary>


          <div class="accordion-content">

            ${renderSummaryRows(
            countedItems
        )
        }

          </div>

        </details>


      </section>


      <section class="responsible-section">

        <div class="section-heading field">

          <label for="responsible">
            Nombre de quien realiza y envía el inventario.
          </label>


          <input
            id="responsible"
            type="text"
            autocomplete="name"
            maxlength="80"
            placeholder="Nombre"
            value="${escapeHtml(
            session.responsible || ""
        )}"
          >

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
          Enviar
        </button>


        <button
          id="summary-back-to-categories"
          class="button button-ghost"
          type="button"
        >
          ${isGarzonZone ? "Volver a los ítems" : "Ver categorías"}
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

function getItemsByStatus(
    status
) {

    return activeItems.filter(
        item =>
            getCount(
                item.id
            ).status === status
    );
}


function renderSummaryRows(
    summaryItems
) {

    if (
        summaryItems.length === 0
    ) {

        return `
      <p class="summary-empty">
        Ninguno
      </p>
    `;
    }


    return summaryItems
        .map(item => {

            const count =
                getCount(
                    item.id
                );


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
                    )}${isOutOfStockCount(count) ? " · Sin stock" : ""}`;

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
          class="summary-item-button${isOutOfStockCount(count) ? " is-out-of-stock" : ""}"
          type="button"
          data-item-index="${activeItems.indexOf(
                item
            )}"
        >

          <span class="summary-item-main">

            <strong>

              ${getStatusIcon(
                count.status,
                isOutOfStockCount(count)
            )}

              ${escapeHtml(
                item.name
            )}

            </strong>


            <small>

              ${escapeHtml(
                getCountCategory(item)
            )}

              ·

              ${escapeHtml(
                getAreaName(item.areaId)
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
            ".stat-card[data-summary-section]"
        )
        .forEach(
            card => {

                const section =
                    document.getElementById(
                        card.getAttribute(
                            "aria-controls"
                        )
                    );


                if (!section) {

                    return;
                }


                card.addEventListener(
                    "click",
                    () => {

                        section.open =
                            !section.open;


                        card.setAttribute(
                            "aria-expanded",
                            String(
                                section.open
                            )
                        );
                    }
                );


                section.addEventListener(
                    "toggle",
                    () => {

                        card.setAttribute(
                            "aria-expanded",
                            String(
                                section.open
                            )
                        );
                    }
                );

            }
        );


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
        .forEach(
            button => {

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

            }
        );


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
        session.responsible
            .trim()
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
        ).toLocaleDateString(
            "es-CL"
        );


    const responsible =
        session.responsible.trim();


    const lines = [

        "INVENTARIO",

        `Fecha: ${date}`,

        `Responsable: ${responsible}`,

        "",

        `Pendientes: ${stats.pending}`,

        `Avances: ${stats.partial}`,

        `Contados: ${stats.counted}`,

        `Progreso: ${stats.processed}/${stats.total}`,

        "",

        "DETALLE"
    ];


    for (
        const item of activeItems
    ) {

        const count =
            getCount(
                item.id
            );


        let line =
            `- ${item.name}: `;


        switch (
        count.status
        ) {

            case "counted":

                line +=
                    `${formatQuantity(
                        count.quantity
                    )} ${item.unit}${isOutOfStockCount(count) ? " (SIN STOCK)" : ""}`;

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


    return lines.join(
        "\n"
    );
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
            "Resumen copiado."
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
                "Inventario",

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


function scheduleFeedbackDismissal() {
    clearTimeout(feedbackDismissTimer);
    clearTimeout(feedbackRemoveTimer);
    const toast = appContent.querySelector(".feedback-toast");
    if (toast) {
        toast.classList.remove("is-leaving");
        feedbackDismissTimer = setTimeout(() => {
            if (!toast.isConnected) return;
            if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
                toast.remove();
                return;
            }
            toast.classList.add("is-leaving");
            feedbackRemoveTimer = setTimeout(() => toast.remove(), 360);
        }, 4000);
    }
}


function showToast(message, tone = "counted") {
    let feedback = appContent.querySelector(".feedback-toast");
    if (!feedback) {
        feedback = document.createElement("p");
        appContent.prepend(feedback);
    }
    feedback.className = `feedback feedback-toast feedback-toast-${tone}`;
    feedback.setAttribute("role", tone === "error" ? "alert" : "status");
    feedback.textContent = message;
    feedback.style.animation = "none";
    feedback.offsetHeight;
    feedback.style.removeProperty("animation");
    scheduleFeedbackDismissal();
}


function showFeedback(message) {
    if (appContent.querySelector(".count-view")) showToast(message, "error");
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
          data/inventario/items/
        </code>.

      </p>

    </section>

  `;
}


// ============================================================
// MODAL
// ============================================================

function setupModalEvents() {

    headerBackButton.addEventListener(
        "click",
        () => {

            switch (session.view) {

                case "count":

                    if (isGarzonZone) {
                        window.location.href = "?area=servicio&sector=garzones";
                    } else {
                        openCategories();
                    }

                    break;


                case "summary":

                    openCategories();

                    break;


                case "categories":

                default:
                    if (selectedZone) {
                        window.location.href = "?area=servicio&sector=garzones";
                    } else if (selectedSector) {
                        window.location.href = "?area=servicio";
                    } else {
                        window.location.href = "../../";
                    }
                    break;

            }

        }
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


    document.addEventListener("keydown", event => {
        const drawer = document.querySelector("#item-drawer.is-open");

        if (event.key === "Escape") {
            if (drawer) {
                closeItemDrawer();
            } else if (!confirmModal.hidden) {
                closeNewSessionConfirmation();
            }
        }

        if (event.key === "Tab" && drawer) {
            const panel = drawer.querySelector(".item-drawer-panel");
            const focusable = [...drawer.querySelectorAll("button:not([hidden]):not([tabindex='-1']), input:not([hidden]), summary")]
                .filter(element => !element.closest("[hidden]") && element.getClientRects().length > 0);
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }

        if (event.key === "Tab" && !confirmModal.hidden) {
            if (event.shiftKey && document.activeElement === cancelNewSessionButton) {
                event.preventDefault();
                confirmNewSessionButton.focus();
            } else if (!event.shiftKey && document.activeElement === confirmNewSessionButton) {
                event.preventDefault();
                cancelNewSessionButton.focus();
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
