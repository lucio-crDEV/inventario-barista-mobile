import { readCommand, submitCommand } from './supervision-command.js';
import { api, dialog, escapeHtml as esc } from './client.js';
import { loading, historyLoading } from './loading.js';
import { absoluteTime, relativeTime, historyDay, movementLabel } from './history-display.js';

export async function openProductHistory(inventory, item) {
  const managerial = ['admin', 'service_lead'].includes(inventory.user.role),
    cycle = inventory.cycleId;
  const el = dialog(
    'Historial del producto',
    `<p class="history-product">${esc(item.name)} · ${esc(inventory.locationName(item))}</p><div class="history-content">${historyLoading()}</div><div class="dialog-actions"><button type="button" data-close>Cerrar</button>${managerial ? '<button type="button" data-annul class="button-danger" hidden>Anular conteo</button>' : ''}</div>`,
  );
  el.querySelector('[data-close]').onclick = () => el.close();
  const body = el.querySelector('.history-content'),
    finish = loading(body);
  let cursor = null,
    history = [];
  const path = inventory.recordURL('/api/history', item);
  function render() {
    if (!el.open) return;
    if (!history.length) {
      body.innerHTML = '<p class="history-empty">Sin movimientos.</p>';
      return;
    }
    if (!managerial) {
      body.innerHTML = `<ol class="history-list history-minimal">${history.map((h) => `<li><strong>${esc(h.authorName)}</strong><time datetime="${esc(h.createdAt)}" title="${esc(absoluteTime(h.createdAt))}" aria-label="${esc(absoluteTime(h.createdAt))}">${esc(relativeTime(h.createdAt))}</time><span>${h.quantity === null ? 'Pendiente' : `${esc(h.quantity)} ${esc(h.unit || item.unit)}`}</span></li>`).join('')}</ol>`;
      return;
    }
    let day = '';
    const rows = [...history]
      .sort((a, b) => a.seq - b.seq)
      .map((h) => {
        const date = historyDay(h.createdAt),
          heading = date === day ? '' : `<h3 class="history-day">${esc(date)}</h3>`;
        day = date;
        return `${heading}<article class="history-movement"><div><strong>${esc(movementLabel(h, item.unit))} · ${esc(h.authorName || h.after?.authorName)}</strong><time datetime="${esc(h.createdAt)}">${esc(new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(h.createdAt)))}</time></div><p>Antes: ${h.before?.quantity === null || h.before?.quantity === undefined ? 'sin conteo' : esc(h.before.quantity)} / Después: ${h.after?.status === 'pending' ? 'pendiente' : esc(h.after?.quantity) + ' ' + esc(item.unit || '')}</p>${h.reason ? `<p class="history-note">${esc(h.reason)}</p>` : ''}${h.after?.note ? `<p class="history-note">${esc(h.after.note)}</p>` : ''}</article>`;
      })
      .join('');
    body.innerHTML =
      rows +
      (cursor
        ? '<button type="button" data-more class="button button-ghost">Ver movimientos anteriores</button>'
        : '');
    body.querySelector('[data-more]')?.addEventListener('click', () => load(cursor));
  }
  async function load(before) {
    try {
      const result = await api(path + (before ? '&cursor=' + encodeURIComponent(before) : ''));
      if (!el.open) return;
      history.push(...result.history);
      cursor = result.nextCursor;
      render();
    } catch (error) {
      if (el.open) body.textContent = error.message;
      inventory.handleError(error);
    } finally {
      finish();
    }
  }
  await load();
  if (managerial && el.open) {
    try {
      const snapshot = await api('/api/admin/supervision?cycle=' + encodeURIComponent(cycle));
      const current = await api(inventory.recordURL('/api/record', item));
      if (!el.open) return;
      const record = current.record,
        scopeState =
          snapshot.cycle.scopeStates?.find(
            (s) => item.locationId === s.scope_id || item.locationId.startsWith(s.scope_id + ':'),
          )?.state || snapshot.cycle.state;
      const button = el.querySelector('[data-annul]');
      button.hidden = !record || record.status === 'pending' || scopeState === 'closed';
      button.onclick = () =>
        confirmAnnul(inventory, item, snapshot.cycle.revision, record, () => {
          button.hidden = true;
          history = [];
          load();
        });
    } catch (error) {
      if (el.open) {
        const info = document.createElement('p');
        info.className = 'history-error';
        info.textContent = 'No se pudieron comprobar las acciones disponibles. ' + error.message;
        body.prepend(info);
      }
    }
  }
}

function confirmAnnul(inventory, item, revision, record, refresh) {
  let saved = readCommand(inventory.user.id);
  if (
    saved &&
    (saved.kind !== 'annul' ||
      saved.cycleId !== inventory.cycleId ||
      saved.itemId !== item.id ||
      saved.locationId !== item.locationId)
  ) {
    const notice = dialog(
      'Cambio pendiente',
      '<p>Resuelve el cambio pendiente en el Panel de supervisión antes de anular otro producto.</p><button type="button">Cerrar</button>',
    );
    notice.querySelector('button').onclick = () => notice.close();
    return;
  }
  const el = dialog(
    'Anular conteo',
    `<p>${esc(item.name)} · ${esc(inventory.locationName(item))}</p><p>Este producto pasará de ${record.status === 'partial' ? 'avance' : 'contado'} a pendiente.</p><label>Motivo (opcional)<textarea name="reason" maxlength="500" placeholder="Por ejemplo: producto contado por error"></textarea></label><p data-result role="status"></p><div class="dialog-actions"><button type="button" data-cancel>Cancelar</button><button type="button" data-confirm class="button-danger">${saved ? 'Reintentar anulación pendiente' : 'Anular conteo'}</button></div>`,
  );
  el.querySelector('h2').after(el.querySelector('[data-result]'));
  const reason = el.querySelector('textarea');
  reason.readOnly = !!saved;
  if (saved) reason.value = saved.reason || '';
  el.querySelector('[data-cancel]').onclick = () => el.close();
  el.querySelector('[data-confirm]').onclick = async () => {
    const payload = saved || {
      id: crypto.randomUUID(),
      cycleId: inventory.cycleId,
      expectedRevision: revision,
      kind: 'annul',
      itemId: item.id,
      locationId: item.locationId,
      expectedVersion: record.version,
      reason: reason.value.trim(),
      confirm: true,
    };
    const result = el.querySelector('[data-result]'),
      button = el.querySelector('[data-confirm]');
    saved = payload;
    button.disabled = true;
    reason.readOnly = true;
    try {
      await submitCommand(inventory.user.id, payload);
      if (el.open) el.close();
      await inventory.sync().catch(() => {});
      refresh();
    } catch (error) {
      saved = readCommand(inventory.user.id);
      if (el.open) {
        result.textContent = error.message;
        button.disabled = false;
        button.textContent = saved ? 'Reintentar anulación pendiente' : 'Revisar anulación';
        reason.readOnly = !!saved;
      }
      inventory.handleError(error);
    }
  };
}
