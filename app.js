/*
 * ============================================================
 * APLICACIÓN RAÍZ
 * ============================================================
 *
 * Este archivo contiene únicamente comportamiento global
 * de la aplicación.
 *
 * NO agregar aquí lógica específica de:
 * - Inventario
 * - Pedido a Bodega
 *
 * Cada módulo administra su propio HTML, CSS y JS.
 * ============================================================
 */


// ============================================================
// RUTAS DE MÓDULOS
// ============================================================

const MODULE_ROUTES = Object.freeze({

  inventario:
    "./pages/inventario/",

  pedido:
    "./pages/pedido/"

});


// ============================================================
// NAVEGACIÓN GLOBAL
// ============================================================

function setupModuleLinks() {

  const links =
    document.querySelectorAll(
      "[data-module]"
    );


  for (const link of links) {

    const moduleName =
      link.dataset.module;


    const route =
      MODULE_ROUTES[moduleName];


    if (!route) {

      console.warn(
        `Módulo no registrado: "${moduleName}"`
      );

      continue;
    }


    link.setAttribute(
      "href",
      route
    );

  }

}


// ============================================================
// INICIO
// ============================================================

function initApp() {

  setupModuleLinks();

}


initApp();