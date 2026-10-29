import { html, joinHTML } from '../../shared/html.js';
import { inventoryURL } from '../../shared/navigation.js';
export function scopeView({ title, options, getCategoryStats, cycleId }) {
  const hasProgress = options.some((option) => option.items);
  return html` <section class="categories-view scope-view ${hasProgress ? 'scope-view-zones' : ''}">
    ${title ? html`<div class="categories-heading"><h2>${title}</h2></div>` : ''}
    <div class="category-grid">
      ${joinHTML(
        options.map((option) => {
          const stats = option.items ? getCategoryStats(option.items) : null;
          const partialText = stats?.partial
            ? ` · ${stats.partial} ${stats.partial === 1 ? 'avance' : 'avances'}`
            : '';
          return html`
            <a
              class="category-card scope-card"
              href="${inventoryURL(option.url, cycleId)}"
              ${stats ? html`aria-label="${option.name}: ${stats.counted} de ${stats.total} contados${partialText}"` : ''}
            >
              <span class="category-card-title">${option.name}</span>
              ${
                stats
                  ? html` <span class="category-card-progress"
                        >${stats.counted} / ${stats.total} contados${partialText}</span
                      >
                      <span class="category-progress-bar" aria-hidden="true">
                        <span
                          class="category-progress-value"
                          style="width: ${stats.countedPercentage}%"
                        ></span>
                        <span
                          class="category-progress-partial"
                          style="left: ${stats.countedPercentage}%; width: ${stats.partialPercentage}%"
                        ></span>
                      </span>`
                  : ''
              }
            </a>
          `;
        }),
      )}
    </div>
  </section>`;
}
