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
    const button = document.querySelector("[data-theme-toggle]");
    if (button) {
      const label = dark ? "Activar modo claro" : "Activar modo oscuro";
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
      button.querySelector("[aria-hidden]").textContent = dark ? "☀" : "☾";
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? "#1b1b1b" : "#f5f5f5";
  }

  applyTheme(savedTheme());

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(savedTheme());
    document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
      const next = root.dataset.theme === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // El cambio visual funciona aunque el navegador no permita guardarlo.
      }
      applyTheme(next);
    });
  });

  window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY) applyTheme(savedTheme());
  });
})();
