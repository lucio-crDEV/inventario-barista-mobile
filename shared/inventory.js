import { cacheRealtimeRecords } from './offline-cache.js';
import { html, setHTML } from './html.js';
import { startRealtime } from './realtime.js';
import { startPolling } from './polling.js';
import { openProductHistory } from './product-history.js';
import { pendingButton } from './loading.js';
import { describeCountValue } from './count-display.js';
import {
  api,
  authenticated,
  identityBar,
  setSync,
  draftsFor,
  dialog,
  loginRedirect,
} from './client.js';
export class SharedInventory {
  static async create(cycle) {
    const query = new URLSearchParams();
    if (cycle) query.set('cycle', cycle);
    const area = new URLSearchParams(location.search).get('area');
    if (area) query.set('area', area);
    const data = await authenticated('/api/bootstrap?' + query);
    const inventory = new SharedInventory(data.user, data);
    identityBar(
      data.user,
      async () => {
        await inventory.sync({ manual: true });
        return inventory.pendingState();
      },
      data.scopes,
    );
    inventory.state(inventory.pendingState());
    return inventory;
  }
  constructor(user, data) {
    this.user = user;
    this.area = new URLSearchParams(location.search).get('area') || '';
    this.data = data;
    const cycleKey = `inventory-cycle:${user.id}`;
    // A revoked user receives no cycle data. Retain only their previously known
    // opaque cycle ID so that isolated drafts still have a visible notice.
    this.cycleId = data.cycle?.id || sessionStorage.getItem(cycleKey) || '';
    if (data.cycle?.id) sessionStorage.setItem(cycleKey, data.cycle.id);
    this.drafts = draftsFor(user.id, this.cycleId);
    this.cursor = data.cursor;
    this.resetRecordVersions();
    this.busy = false;
    this.editVersion = 0;
    this.modal = null;
    this.lastSyncAt = 0;
  }
  resetRecordVersions() {
    this.visibleItems = new Set(
      this.data.items.map((item) => JSON.stringify([item.id, item.locationId])),
    );
    this.recordVersions = new Map(
      this.data.counts.map((record) => [
        JSON.stringify([record.itemId, record.locationId]),
        record.version,
      ]),
    );
  }
  acceptRecord(record, itemId = record?.itemId) {
    if (!record) return false;
    const key = JSON.stringify([itemId, record.locationId]);
    if (
      !this.visibleItems.has(key) ||
      !Number.isSafeInteger(record.version) ||
      record.version <= (this.recordVersions.get(key) ?? -1)
    )
      return false;
    this.recordVersions.set(key, record.version);
    const index = this.data.counts.findIndex(
      (old) => old.itemId === itemId && old.locationId === record.locationId,
    );
    if (index < 0) this.data.counts.push(record);
    else this.data.counts[index] = record;
    this.onRecord?.(record, itemId);
    return true;
  }
  renderSyncedRecords(changed) {
    // A push changes counts/progress, never a live field, draft or dialog.
    if (
      changed &&
      !this.modal &&
      !document.querySelector('#quantity') &&
      !this.busy &&
      !document.querySelector('.item-drawer.is-open') &&
      !document.activeElement?.matches('input,textarea,select')
    )
      this.onRender?.();
  }
  async catchup(throughCursor) {
    if (this.syncing) await this.syncing;
    return this.sync({ force: true, drain: true, throughCursor });
  }
  async realtimeRecords(frame) {
    const valid =
      frame &&
      frame.cycleId === this.cycleId &&
      Number.isSafeInteger(frame.fromCursor) &&
      frame.fromCursor >= 0 &&
      Number.isSafeInteger(frame.toCursor) &&
      frame.toCursor > frame.fromCursor &&
      Array.isArray(frame.records) &&
      frame.records.length <= 250 &&
      frame.records.every(
        (record) =>
          record &&
          typeof record.itemId === 'string' &&
          typeof record.locationId === 'string' &&
          Number.isSafeInteger(record.version) &&
          record.version >= 0,
      );
    if (!valid) {
      await this.catchup();
      return;
    }
    if (this.syncing) await this.syncing;
    if (frame.toCursor <= this.cursor) return;
    if (frame.fromCursor > this.cursor) {
      await this.catchup(frame.toCursor);
      return;
    }
    const changed = frame.records.filter((record) => this.acceptRecord(record));
    this.cursor = Math.max(this.cursor, frame.toCursor);
    await cacheRealtimeRecords({
      cycleId: this.cycleId,
      records: changed,
      cursor: this.cursor,
      userId: this.user.id,
      revision: this.user.revision,
    });
    this.renderSyncedRecords(changed.length);
  }
  state(text) {
    setSync(text);
  }
  pendingState() {
    return Object.keys(this.drafts.all()).length ? 'Cambios pendientes' : 'Sincronizado';
  }
  draft(item) {
    return this.drafts.get(item.id);
  }
  scopeState(item) {
    return (
      this.data.cycle?.scopeStates?.find(
        (s) => item.locationId === s.scope_id || item.locationId.startsWith(s.scope_id + ':'),
      )?.state || this.data.cycle?.state
    );
  }
  capture(item, quantity, note, status = 'partial', outOfStock = false) {
    const old = this.draft(item);
    if (this.scopeState(item) !== 'open') return old;
    if (old?.operation) return old;
    const value = {
      quantity,
      note,
      status,
      outOfStock,
      baseVersion: old?.baseVersion ?? this.editVersion,
    };
    try {
      this.drafts.set(item.id, value);
      this.state('Pendiente de enviar');
    } catch {
      this.state(
        'No se pudo guardar el borrador en este dispositivo. Conserva esta pantalla abierta.',
      );
    }
    return value;
  }
  mount(item, count) {
    this.editVersion = count.version || 0;
    const state = this.scopeState(item);
    if (state !== 'open') {
      const banner = document.createElement('p');
      banner.className = 'pending-draft';
      banner.textContent =
        'Inventario en revisión o cerrado. Se conservan tus borradores; los cambios se gestionan desde Supervisión.';
      document.querySelector('#quantity')?.closest('.field')?.before(banner);
    }
    const d = this.draft(item),
      q = document.querySelector('#quantity'),
      n = document.querySelector('#note');
    if (d) {
      q.value = d.quantity ?? '';
      n.value = d.note || '';
      this.state('Cambios pendientes');
    }
    for (const field of [q, n])
      field?.addEventListener('input', () => this.capture(item, q.value, n.value));
    const info = document.createElement('p');
    info.className = 'pending-draft';
    info.textContent = count.version ? `Registrado por ${count.authorName}.` : '';
    if (info.textContent) q?.closest('.field')?.before(info);
    const controls = document.createElement('div');
    setHTML(
      controls,
      html`<button type="button" class="button button-ghost" id="record-history">
          Ver historial de este producto</button
        >${
          d?.operation
            ? html`<button type="button" class="button button-secondary" id="retry-operation">
                Reintentar envío pendiente
              </button>`
            : ''
        }`,
    );
    if (info.isConnected) info.after(controls);
    else q?.closest('.field')?.before(controls);
    controls.querySelector('#record-history').onclick = () => openProductHistory(this, item);
    this.pendingUI(item);
    controls.querySelector('#retry-operation')?.addEventListener('click', async () => {
      if (await this.save(item, d.quantity, d.status, d.note, d.outOfStock)) this.onRender?.();
    });
  }
  locationName(item) {
    return this.data.scopes
      .filter((s) => item.locationId === s.id || item.locationId.startsWith(s.id + ':'))
      .map((s) => s.name)
      .join(' / ');
  }
  pendingUI(item) {
    const pending = this.draft(item)?.operation;
    const locked = this.scopeState(item) !== 'open';
    for (const field of document.querySelectorAll('#quantity,#note')) {
      field.readOnly = !!pending || locked;
      field.disabled = locked;
    }
    for (const button of document.querySelectorAll(
      '#save-out-of-stock,#save-partial,#save-counted',
    ))
      button.disabled = locked || !!pending;
    let retry = document.querySelector('#retry-operation');
    if (pending && !retry && !this.busy) {
      retry = document.createElement('button');
      retry.id = 'retry-operation';
      retry.type = 'button';
      retry.className = 'button button-secondary';
      retry.textContent = 'Reintentar envío pendiente';
      document.querySelector('#quantity')?.closest('.field')?.before(retry);
      retry.onclick = async () => {
        const d = this.draft(item);
        if (d && (await this.save(item, d.quantity, d.status, d.note, d.outOfStock)))
          this.onRender?.();
      };
    }
    if (!pending) retry?.remove();
  }
  recordURL(path, item) {
    return `${path}?cycle=${encodeURIComponent(this.cycleId)}&item=${encodeURIComponent(item.id)}&location=${encodeURIComponent(item.locationId)}`;
  }
  operation(item, d, action = 'direct', version = d.baseVersion) {
    return {
      id: crypto.randomUUID(),
      cycleId: this.cycleId,
      itemId: item.id,
      locationId: item.locationId,
      expectedVersion: version,
      action,
      quantity: Number(String(d.quantity).replace(',', '.')),
      unit: item.unit || '',
      status: d.status,
      note: d.note,
      outOfStock: d.outOfStock,
    };
  }
  async save(item, quantity, status, note, outOfStock) {
    if (this.busy) return false;
    const state = this.scopeState(item);
    if (state && state !== 'open' && !this.draft(item)?.operation) {
      this.state('Inventario en revisión o cerrado. Borrador conservado.');
      return false;
    }
    const old = this.draft(item);
    let d = old?.operation
      ? old
      : {
          quantity,
          status,
          note,
          outOfStock,
          baseVersion: old?.baseVersion ?? this.editVersion,
        };
    let op = d.operation || this.operation(item, d);
    try {
      this.drafts.set(item.id, { ...d, operation: op });
    } catch {
      this.state('No se envió: no se pudo conservar el borrador en este dispositivo.');
      return false;
    }
    return this.send(item, d, op, !!old?.operation);
  }
  async send(item, d, op, revalidate = false) {
    this.busy = true;
    this.state('Pendiente de enviar · guardando…');
    this.pendingUI(item);
    const buttons = [
      ...document.querySelectorAll(
        '#app-content button, #header-back-to-categories, #header-open-item-drawer, dialog[open] button',
      ),
    ];
    const active = buttons.includes(document.activeElement)
      ? document.activeElement
      : document.querySelector('#retry-operation') ||
        document.querySelector(
          op.outOfStock
            ? '#save-out-of-stock'
            : op.status === 'partial'
              ? '#save-partial'
              : '#save-counted',
        );
    const disabled = buttons.map((button) => [button, button.disabled]);
    const restore = pendingButton(active, 'Guardando…');
    for (const button of buttons) button.disabled = true;
    try {
      const accepted = await api('/api/count', op);
      // A new acknowledgement already contains the accepted record. An uncertain
      // retry can return an old snapshot, so only retries require a fresh read.
      const record = revalidate
        ? (await api(this.recordURL('/api/record', item))).record
        : accepted.record;
      this.acceptRecord(record, item.id);
      this.drafts.remove(item.id);
      this.modal?.close();
      this.modal = null;
      this.state(
        Object.keys(this.drafts.all()).length
          ? 'Pendiente de enviar · hay otros borradores'
          : 'Sincronizado',
      );
      return true;
    } catch (e) {
      if (e.status === 409 && ['STALE', 'FOREIGN_RECORD'].includes(e.code)) {
        this.drafts.set(item.id, { ...d, operation: undefined });
        this.acceptRecord(e.current, item.id);
        if (e.current?.authorId !== this.user.id && e.current && e.current.status !== 'pending') {
          this.resolve(item, d, e.current);
        } else {
          this.drafts.set(item.id, {
            ...d,
            operation: undefined,
            baseVersion: e.current?.version || 0,
          });
          this.modal?.close();
          this.modal = null;
          this.state(
            'El conteo cambió. Conservamos tu borrador; revisa el último registro antes de guardar.',
          );
        }
      } else if (e.status === 403) {
        this.modal?.close();
        this.state('Tu acceso cambió. Conservamos tus cambios pendientes.');
        await this.refreshPermissions();
      } else if (e.status && e.status < 500) {
        this.drafts.set(item.id, { ...d, operation: undefined });
        this.handleError(e);
      } else this.handleError(e);
      return false;
    } finally {
      restore();
      for (const [button, wasDisabled] of disabled) button.disabled = wasDisabled;
      this.busy = false;
      this.pendingUI(item);
    }
  }
  handleError(e) {
    if (e.status === 401 || e.code === 'IDENTITY_CHANGED') {
      this.modal?.close();
      loginRedirect();
    } else this.state(e.status ? e.message : 'Sin conexión. Reintenta el envío.');
  }
  resolve(item, d, current) {
    this.modal?.close();
    const label = (r) => describeCountValue(r, item.unit);
    const proposed = { ...d, quantity: Number(String(d.quantity).replace(',', '.')) };
    const total = Math.round((current.quantity + proposed.quantity) * 1000) / 1000;
    const canAdd = !d.outOfStock && !!item.unit;
    const state = (r) => (r.status === 'partial' ? 'Avance' : 'Contado');
    const el = dialog(
      '¿Cómo guardar tu conteo?',
      html`<p class="resolution-product"><strong>${item.name}</strong><small>${this.locationName(item)}</small></p>
        <div class="resolution-values">
          <div><span>Actual · ${current.authorName}</span><strong>${label(current)}</strong><small>${state(current)}</small></div>
          <div><span>Tu conteo</span><strong>${label(proposed)}</strong><small>${state(d)}</small></div>
        </div>
        ${current.note || d.note ? html`<details class="resolution-notes"><summary>Ver notas</summary>${current.note ? html`<p><strong>Actual</strong><br />${current.note}</p>` : ''}${d.note ? html`<p><strong>Tu nota</strong><br />${d.note}</p>` : ''}</details>` : ''}
        <div class="resolution-options">
          <button type="button" id="choose-add" ${!canAdd ? 'disabled' : ''}><span>Sumar</span><small>${canAdd ? `${current.quantity} + ${proposed.quantity} = ${total} ${item.unit}` : 'No disponible'}${canAdd && (current.status === 'partial' || d.status === 'partial') ? ' · Avance' : ''}</small></button>
          <button type="button" id="choose-overwrite"><span>Reemplazar</span><small>${label(proposed)}</small>${current.note && current.note !== d.note ? html`<small>Reemplaza también la nota</small>` : ''}</button>
        </div>
        <p class="resolution-feedback" role="status" hidden></p>
        ${d.outOfStock ? html`<p class="resolution-hint">Para guardar sin stock, elige Reemplazar.</p>` : !item.unit ? html`<p class="resolution-hint">Falta confirmar la unidad para sumar.</p>` : ''}
        <div class="resolution-footer"><button type="button" id="discard">Descartar cambio</button><button type="button" id="keep-draft">Volver</button></div>`,
    );
    el.classList.add('resolution-dialog');
    this.modal = el;
    el.addEventListener('close', () => {
      if (this.modal === el) this.modal = null;
    });
    el.querySelector('#discard').onclick = async () => {
      if (this.busy || this.draft(item)?.operation) return;
      this.busy = true;
      const buttons = [...el.querySelectorAll('button')];
      const disabled = buttons.map((button) => [button, button.disabled]);
      const restore = pendingButton(el.querySelector('#discard'), 'Descartando…');
      for (const button of buttons) button.disabled = true;
      try {
        const { record } = await api(this.recordURL('/api/record', item));
        if (!el.open) return;
        this.acceptRecord(record, item.id);
        this.drafts.remove(item.id);
        el.close();
        this.modal = null;
        this.state(
          Object.keys(this.drafts.all()).length
            ? 'Cambio descartado · otros borradores pendientes de enviar'
            : 'Sincronizado · cambio descartado',
        );
        this.onRender?.();
      } catch (e) {
        this.handleError(e);
      } finally {
        restore();
        for (const [button, wasDisabled] of disabled) button.disabled = wasDisabled;
        this.busy = false;
      }
    };
    const choose = async (action) => {
      if (this.busy || (action === 'add' && !canAdd)) return;
      const pending = this.draft(item)?.operation;
      if (pending && pending.action !== action) return;
      const op = pending || this.operation(item, d, action, current.version);
      try {
        this.drafts.set(item.id, { ...d, operation: op });
      } catch {
        this.state('No se envió: no se pudo conservar el borrador en este dispositivo.');
        return;
      }
      if (await this.send(item, d, op, !!pending)) this.onRender?.();
      else if (this.modal === el && this.draft(item)?.operation) {
        const feedback = el.querySelector('.resolution-feedback');
        feedback.hidden = false;
        feedback.textContent = 'No pudimos confirmar el envío. Reintenta sin duplicarlo.';
        const options = el.querySelector('.resolution-options');
        setHTML(
          options,
          html`<button type="button" id="retry-resolution">Reintentar envío</button>`,
        );
        options.querySelector('button').onclick = () => choose(action);
        el.querySelector('#discard').disabled = true;
      }
    };
    el.querySelector('#choose-add').onclick = () => choose('add');
    el.querySelector('#choose-overwrite').onclick = () => choose('overwrite');
    el.querySelector('#keep-draft').onclick = () => {
      el.close();
      this.modal = null;
    };
    el.addEventListener('cancel', () => {
      this.modal = null;
    });
    el.querySelector('#discard').focus();
  }
  async refreshPermissions() {
    const data = await api(
      '/api/bootstrap?cycle=' +
        encodeURIComponent(this.cycleId) +
        (this.area ? '&area=' + encodeURIComponent(this.area) : ''),
    );
    if (data.user.id !== this.user.id) {
      loginRedirect();
      return;
    }
    this.modal?.close();
    this.data = data;
    this.cursor = data.cursor;
    this.resetRecordVersions();
    this.onPermissions?.(data);
  }
  sync({ manual = false, force = false, drain = false, throughCursor } = {}) {
    // Manual refresh and polling share one in-flight read. Neither sends drafts.
    if (this.syncing) return this.syncing;
    if (Date.now() < (this.retrySyncAt || 0))
      return Promise.reject(
        Object.assign(Error('Espera antes de volver a sincronizar. Borrador conservado.'), {
          status: 429,
        }),
      );
    // A recent accepted poll already performed this read; do not ask D1 again.
    if (manual && !force && Date.now() - this.lastSyncAt < 5000) return Promise.resolve();
    this.syncing = (async () => {
      try {
        let pages = 0;
        do {
          const before = this.cursor;
          const r = await api(
            `/api/sync?cycle=${encodeURIComponent(this.cycleId)}&cursor=${before}`,
          );
          if (r.user.id !== this.user.id) {
            loginRedirect();
            return;
          }
          if (
            r.user.revision !== this.user.revision ||
            (r.cycleRevision !== undefined && r.cycleRevision !== this.data.cycle?.revision)
          ) {
            const pending = Object.keys(this.drafts.all()).length > 0;
            // Keep drafts under the old identity; never replay them after a permission change.
            this.state(
              pending
                ? 'Tus accesos cambiaron. Conservamos tus cambios pendientes.'
                : 'Tus accesos cambiaron.',
            );
            await this.refreshPermissions();
            this.user = r.user;
            return;
          }
          let changed = false;
          for (const record of r.changes) changed = this.acceptRecord(record) || changed;
          this.cursor = Math.max(this.cursor, r.cursor);
          this.lastSyncAt = Date.now();
          this.syncFailures = 0;
          this.retrySyncAt = 0;
          this.renderSyncedRecords(changed);
          if (!(drain && r.changes.length === 250)) break;
          if (this.cursor <= before || ++pages >= 20)
            throw Error('La sincronización continúa. Vuelve a comprobar.');
        } while (true);
        // This trusted WS head predates this complete HTTP catch-up. Covering
        // journal gaps from other cycles/scopes cannot skip an authorized count.
        if (Number.isSafeInteger(throughCursor)) {
          this.cursor = Math.max(this.cursor, throughCursor);
          await cacheRealtimeRecords({
            cycleId: this.cycleId,
            records: [],
            cursor: this.cursor,
            userId: this.user.id,
            revision: this.user.revision,
          });
        }
      } catch (e) {
        this.syncFailures = Math.min(6, (this.syncFailures || 0) + 1);
        this.retrySyncAt =
          Date.now() + Math.max(e.retryAfter || 0, Math.min(60, 2 ** this.syncFailures)) * 1000;
        this.handleError(e);
        throw e;
      } finally {
        this.syncing = null;
      }
    })();
    return this.syncing;
  }
  poll() {
    this.realtime?.stop();
    this.pollTick?.stop();
    // sync presents failures and keeps drafts isolated. The scheduler handles
    // visibility and overlap without changing the accepted cursor.
    // A disconnected socket falls back every 30s; healthy sockets suppress polls.
    // Manual refresh keeps its existing 30s user cooldown.
    this.pollTick = startPolling(() => this.sync({ force: true }), {
      interval: this.data.realtime ? 30000 : 5000,
    });
    this.realtime = startRealtime({
      enabled: this.data.realtime,
      cycleId: this.cycleId,
      polling: this.pollTick,
      onChange: (type, message) =>
        this.catchup(
          type === 'ready' && message?.cycleId === this.cycleId ? message.cursor : undefined,
        ),
      onRecords: (frame) => this.realtimeRecords(frame),
    });
    return this.pollTick;
  }
}
