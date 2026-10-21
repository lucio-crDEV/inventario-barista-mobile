(() => {
  const STORAGE_KEY = "inventario-theme";
  const root = document.documentElement;

  function savedTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;

    const dark = theme === "dark";
    for (const button of document.querySelectorAll("[data-theme-toggle]")) {
      const label = dark ? "Activar modo claro" : "Activar modo oscuro";
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
      button.setAttribute("aria-pressed", String(dark));
      const name = button.querySelector("[data-theme-name]");
      if (name) name.textContent = dark ? "Modo oscuro" : "Modo claro";
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? "#111315" : "#faf8f3";
  }

  applyTheme(savedTheme());

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(savedTheme());
    document.addEventListener("click", event => {
      const control = event.target.closest?.(".theme-toggle, [data-theme-toggle], .header-back-button, .header-search-button");
      // Los toques no dejan foco persistente; el teclado conserva su indicador.
      if (control && event.detail > 0) control.blur();
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest?.("[data-theme-toggle]")) return;
      const next = root.dataset.theme === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // El cambio visual funciona aunque el navegador no permita guardarlo.
      }
      applyTheme(next);
    });
  });

  document.addEventListener("inventory:theme-controls", () => applyTheme(savedTheme()));

  window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY) applyTheme(savedTheme());
  });
})();
