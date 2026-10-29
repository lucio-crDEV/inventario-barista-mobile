import { html, setHTML, joinHTML } from '/shared/html.js';
import { api, loginRedirect } from '/shared/client.js';

const date = (value) =>
  new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value?.endsWith('Z') ? value : value + 'Z'),
  );
const rootPath = (id) => '/api/admin/export-snapshots/' + encodeURIComponent(id);

export function mountExports(parent, user) {
  const section = document.createElement('section');
  section.className = 'account-card export-card';
  setHTML(
    section,
    html`<h2>Exportar Excel</h2>
      <form class="export-form">
        <label
          >Inventario finalizado<select name="cycle" required aria-label="Inventario finalizado">
            <option value="">Cargando…</option>
          </select></label
        ><button class="button button-primary" type="submit" disabled>Revisar Excel</button>
      </form>
      <p class="export-feedback" role="status" aria-live="polite"></p>
      <div class="export-review"></div>
      <details class="export-history">
        <summary>Copias anteriores</summary>
        <div></div>
      </details>`,
  );
  parent.append(section);
  const form = section.querySelector('form'),
    select = form.elements.cycle,
    prepare = form.querySelector('button');
  const feedback = section.querySelector('.export-feedback'),
    review = section.querySelector('.export-review');
  const history = section.querySelector('.export-history > div');
  let cycles = [],
    capture,
    job,
    command,
    busy = false,
    epoch = 0,
    timer,
    polls = 0,
    nextCursor;
  function say(text, error = false) {
    feedback.textContent = text;
    feedback.dataset.tone = error ? 'error' : '';
    feedback.setAttribute('role', error ? 'alert' : 'status');
  }
  function handle(error) {
    if (
      error.status === 401 ||
      ['PASSWORD_CHANGE_REQUIRED', 'IDENTITY_CHANGED'].includes(error.code)
    )
      loginRedirect();
    else say(error.message || 'No pudimos conectar. Vuelve a intentarlo.', true);
  }
  function locked(value) {
    busy = value;
    select.disabled = value;
    prepare.disabled = value || !select.value;
    for (const button of review.querySelectorAll('button'))
      button.disabled = value || button.dataset.unavailable === 'true';
    section.setAttribute('aria-busy', String(value));
  }
  function reset() {
    epoch++;
    clearTimeout(timer);
    polls = 0;
    capture = null;
    job = null;
    review.replaceChildren();
    say('');
  }
  select.onchange = () => {
    reset();
    command = null;
    prepare.disabled = !select.value;
  };
  async function loadCycles() {
    const result = await api('/api/cycles');
    cycles = result.cycles.filter(
      (c) =>
        c.lifecycle === 'active' &&
        c.state === 'closed' &&
        !c.scopeStates.some((s) => s.state !== 'closed'),
    );
    setHTML(
      select,
      cycles.length
        ? joinHTML(cycles.map((c) => html`<option value="${c.id}">${c.name}</option>`))
        : html`<option value="">Sin inventarios finalizados</option>`,
    );
    const requested = new URLSearchParams(location.search).get('inventory');
    if (cycles.some((c) => c.id === requested)) select.value = requested;
    prepare.disabled = !select.value;
  }
  async function loadHistory() {
    const result = await api('/api/admin/exports');
    setHTML(
      history,
      result.snapshots.length
        ? joinHTML(
            result.snapshots.map(
              (s) =>
                html`<button type="button" class="export-history-item" data-snapshot="${s.id}">
                  <span
                    >${s.cycle_name || cycles.find((c) => c.id === s.cycle_id)?.name || 'Inventario'}<small
                      >${date(s.created_at)}</small
                    ></span
                  ><span aria-hidden="true">›</span>
                </button>`,
            ),
          )
        : html`<p class="field-hint">Aún no hay copias.</p>`,
    );
    nextCursor = result.nextCursor;
    if (nextCursor) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'button';
      more.textContent = 'Ver más';
      more.onclick = async () => {
        more.disabled = true;
        try {
          const page = await api('/api/admin/exports?cursor=' + encodeURIComponent(nextCursor));
          for (const s of page.snapshots) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'export-history-item';
            button.dataset.snapshot = s.id;
            setHTML(
              button,
              html`<span
                  >${s.cycle_name || cycles.find((c) => c.id === s.cycle_id)?.name || 'Inventario'}<small
                    >${date(s.created_at)}</small
                  ></span
                ><span aria-hidden="true">›</span>`,
            );
            more.before(button);
          }
          nextCursor = page.nextCursor;
          if (!nextCursor) more.remove();
        } catch (error) {
          handle(error);
        } finally {
          more.disabled = false;
        }
      };
      history.append(more);
    }
  }

  history.onclick = (event) => {
    const id = event.target.closest('[data-snapshot]')?.dataset.snapshot;
    if (id && !busy) {
      reset();
      openCapture(id).catch(handle);
    }
  };
  function render() {
    if (!capture) return;
    const summary = capture.review.summary,
      blocked = !capture.review.ready;
    const issues = joinHTML(
      capture.review.blockers.map(
        (b) =>
          html`<li>
            ${b.name}<small
              >${{ UNMAPPED_ITEM: 'Sin destino en el libro', CONVERSION_REQUIRED: 'Equivalencia por confirmar', EXPORT_UNIT_REQUIRED: 'Unidad de salida por confirmar' }[b.code] || 'Revisar referencia'}${b.sheet ? ' · ' + (b.sheet + ' ' + b.cell) : ''}</small
            >
          </li>`,
      ),
    );
    setHTML(
      review,
      html`<div class="export-totals">
          <span><strong>${summary.numeric}</strong> con conteo</span
          ><span><strong>${summary.blank}</strong> en blanco</span>
        </div>
        <p class="field-hint">Captura del ${date(capture.capturedAt)}</p>
        ${
          blocked
            ? html`<p class="export-warning">
                  ${summary.blockers}
                  ${summary.blockers === 1 ? 'producto requiere' : 'productos requieren'} revisión
                  antes de generar.
                </p>
                <details>
                  <summary>Ver productos</summary>
                  <ul class="export-issues">
                    ${issues}
                  </ul>
                </details>`
            : ''
        }${summary.partial ? html`<p class="export-warning">${summary.partial} ${summary.partial === 1 ? 'celda suma' : 'celdas suman'} solo ubicaciones terminadas.</p>` : ''}${summary.roundedToZero ? html`<p class="export-warning">${summary.roundedToZero} ${summary.roundedToZero === 1 ? 'cantidad redondeada' : 'cantidades redondeadas'} a cero.</p>` : ''}
        <div class="export-actions">
          ${!blocked ? html`<button type="button" class="button button-primary" data-action="${job?.state === 'ready' ? 'download' : job?.state === 'queued' || job?.state === 'generating' ? 'check' : 'generate'}" ${job?.state === 'failed' && !job.retryable ? html`disabled data-unavailable="true"` : ''}>${job?.state === 'ready' ? 'Descargar Excel' : job?.state === 'queued' || job?.state === 'generating' ? 'Comprobar' : job?.state === 'failed' ? (job.retryable ? 'Reintentar generación' : 'Generación no disponible') : 'Generar Excel'}</button>` : ''}
        </div>`,
    );
    const action = review.querySelector('[data-action]');
    if (action) action.onclick = () => runAction(action.dataset.action).catch(handle);
  }
  async function openCapture(id) {
    const current = epoch;
    locked(true);
    say('Revisando…');
    try {
      const result = await api(rootPath(id));
      if (current !== epoch) return;
      capture = result;
      render();
      say('');
      try {
        job = await api(rootPath(id) + '/artifact');
      } catch (error) {
        if (error.status !== 503) throw error;
      }
      if (current !== epoch) return;
      render();
      schedule(current);
      if (job?.state === 'failed')
        say(
          job.retryable
            ? 'No se completó. Puedes reintentar.'
            : 'No se pudo generar. Contacta al administrador.',
          true,
        );
    } finally {
      if (current === epoch) locked(false);
    }
  }
  function schedule(current) {
    clearTimeout(timer);
    if (!['queued', 'generating'].includes(job?.state)) return;
    say('Generando en el servidor…');
    if (document.hidden || polls >= 20) {
      say('La generación continúa. Puedes comprobar su estado.');
      return;
    }
    timer = setTimeout(async () => {
      if (current !== epoch || busy || document.hidden) return;
      polls++;
      try {
        await check(current);
      } catch (error) {
        handle(error);
      }
    }, 1500);
  }
  async function check(current = epoch) {
    const result = await api(rootPath(capture.snapshotId) + '/artifact');
    if (current !== epoch) return;
    job = result;
    render();
    if (job.state === 'ready') say('Excel listo. Tu copia quedó guardada.');
    else if (job.state === 'failed')
      say(
        job.retryable
          ? 'No se completó. Puedes reintentar.'
          : 'No se pudo generar. Contacta al administrador.',
        true,
      );
    else schedule(current);
  }
  async function runAction(action) {
    if (busy) return;
    locked(true);
    const current = epoch;
    try {
      if (action === 'generate') {
        job = await api(rootPath(capture.snapshotId) + '/generate', {});
        if (current !== epoch) return;
        render();
        polls = 0;
        schedule(current);
        if (job.state === 'ready') say('Excel listo. Tu copia quedó guardada.');
      } else if (action === 'check') {
        polls = 0;
        await check(current);
      } else {
        say('Descargando…');
        const response = await fetch(rootPath(capture.snapshotId) + '/file', {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: AbortSignal.timeout(30000),
          headers: { 'X-Inventory-User': user.id },
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw Object.assign(Error(data.message || 'No pudimos descargar el archivo.'), data, {
            status: response.status,
          });
        }
        if (!response.headers.get('content-type')?.includes('spreadsheetml'))
          throw Error('La descarga no está disponible.');
        const blob = await response.blob();
        if (sessionStorage.getItem('inventory-user') !== user.id)
          throw Object.assign(Error('La cuenta cambió.'), { code: 'IDENTITY_CHANGED' });
        const url = URL.createObjectURL(blob),
          link = document.createElement('a');
        link.href = url;
        link.download =
          response.headers.get('content-disposition')?.match(/filename="([a-zA-Z0-9_.-]+)"/)?.[1] ||
          'inventario.xlsx';
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        say('Descarga iniciada.');
      }
    } finally {
      if (current === epoch) locked(false);
    }
  }
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (busy || !select.value) return;
    reset();
    locked(true);
    say('Preparando revisión…');
    const cycle = cycles.find((c) => c.id === select.value);
    const key = `inventory-export-command:${user.id}:${cycle.id}:${cycle.revision}:${cycle.completion_revision}`;
    try {
      if (!command) {
        const saved = sessionStorage.getItem(key);
        command = saved
          ? JSON.parse(saved)
          : {
              id: crypto.randomUUID(),
              cycleId: cycle.id,
              expectedRevision: cycle.revision,
              expectedCompletionRevision: cycle.completion_revision,
            };
        sessionStorage.setItem(key, JSON.stringify(command));
      }
      const result = await api('/api/admin/export-snapshots', command);
      sessionStorage.removeItem(key);
      command = null;
      await openCapture(result.snapshotId);
      await loadHistory();
    } catch (error) {
      handle(error);
      if (['EXPORT_SOURCE_CHANGED', 'INVENTORY_NOT_FINALIZED'].includes(error.code)) {
        command = null;
        sessionStorage.removeItem(key);
        await loadCycles().catch(handle);
      }
    } finally {
      locked(false);
    }
  };
  Promise.all([loadCycles(), loadHistory()]).catch((error) => {
    handle(error);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button';
    button.textContent = 'Reintentar';
    button.onclick = () => {
      button.remove();
      say('');
      Promise.all([loadCycles(), loadHistory()]).catch(handle);
    };
    feedback.after(button);
  });
}
