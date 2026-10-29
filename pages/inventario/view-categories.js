import { html, joinHTML } from '../../shared/html.js';
export function categoriesView({
  categoryGroups,
  getCategoryStats,
  currentFeedback,
  currentTone,
  drawer,
}) {
  const categoryCards = joinHTML(
    categoryGroups.map((group, index) => {
      const stats = getCategoryStats(group.items);

      const partialText =
        stats.partial > 0
          ? ` · ${stats.partial} ${stats.partial === 1 ? 'avance' : 'avances'}`
          : '';

      const progressLabel = `${stats.counted} de ${stats.total} contados${partialText}`;

      return html`
        <button
          class="category-card"
          type="button"
          data-category-index="${index}"
          aria-label="${group.name}: ${progressLabel}"
        >
          <span class="category-card-title"> ${group.name} </span>

          <span class="category-card-progress">
            ${stats.counted} / ${stats.total} contados ${partialText}
          </span>

          <span class="category-progress-bar" aria-hidden="true">
            <span class="category-progress-value" style="width: ${stats.countedPercentage}%"></span>

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
    }),
  );

  return html`
    <section class="categories-view">
      <div class="category-grid">${categoryCards}</div>

      ${drawer}

      <button id="open-summary" class="button button-ghost" type="button">Ver Resumen</button>

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
