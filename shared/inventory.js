import { openProductHistory } from "./product-history.js";
import { pendingButton } from "./loading.js";
import { describeCountValue } from "./count-display.js";
import {
  api,
  authenticated,
  identityBar,
  setSync,
  draftsFor,
  dialog,
  escapeHtml as esc,
  loginRedirect,
} from "./client.js";
export class SharedInventory {
  static async create(cycle) {
    const data = await authenticated("/api/bootstrap"+(cycle?"?cycle="+encodeURIComponent(cycle):""));
    const inventory = new SharedInventory(data.user, data);
    identityBar(data.user, async () => {
      await inventory.sync({ manual: true });
      return inventory.pendingState();
    });
    inventory.state(inventory.pendingState());
    return inventory;
  }
  constructor(user, data) {
    this.user = user;
    this.data = data;
    const cycleKey = `inventory-cycle:${user.id}`;
    // A revoked user receives no cycle data. Retain only their previously known
    // opaque cycle ID so that isolated drafts still have a visible notice.
    this.cycleId = data.cycle?.id || sessionStorage.getItem(cycleKey) || "";
    if (data.cycle?.id) sessionStorage.setItem(cycleKey, data.cycle.id);
    this.drafts = draftsFor(user.id, this.cycleId);
    this.cursor = data.cursor;
    this.busy = false;
    this.editVersion = 0;
    this.modal = null;
    this.lastSyncAt = 0;
  }
  state(text) {
    setSync(text);
  }
  pendingState() {
    return Object.keys(this.drafts.all()).length
      ? "Cambios pendientes"
      : "Sincronizado";
  }
  draft(item) {
    return this.drafts.get(item.id);
  }
  scopeState(item) {
    return this.data.cycle?.scopeStates?.find(s => item.locationId === s.scope_id || item.locationId.startsWith(s.scope_id + ":"))?.state || this.data.cycle?.state;
  }
  capture(item, quantity, note, status = "partial", outOfStock = false) {
    const old = this.draft(item);
    if (this.scopeState(item) !== "open") return old;
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
      this.state("Pendiente de enviar");
    } catch {
      this.state(
        "No se pudo guardar el borrador en este dispositivo. Conserva esta pantalla abierta.",
      );
    }
    return value;
  }
  mount(item, count) {
    this.editVersion = count.version || 0;
    const state=this.scopeState(item);
    if(state!=='open'){
      const banner=document.createElement('p');banner.className='pending-draft';banner.textContent='Inventario en revisión o cerrado. Se conservan tus borradores; los cambios se gestionan desde Supervisión.';
      document.querySelector('#quantity')?.closest('.field')?.before(banner);
    }
    const d = this.draft(item),
      q = document.querySelector("#quantity"),
      n = document.querySelector("#note");
    if (d) {
      q.value = d.quantity ?? "";
      n.value = d.note || "";
      this.state("Cambios pendientes");
    }
    for (const field of [q, n])
      field?.addEventListener("input", () =>
        this.capture(item, q.value, n.value),
      );
    const info = document.createElement("p");
    info.className = "pending-draft";
    info.textContent = count.version
      ? `Registrado por ${count.authorName}.`
      : "";
    if (info.textContent) q?.closest(".field")?.before(info);
    const controls = document.createElement("div");
    controls.innerHTML =
      '<button type="button" class="button button-ghost" id="record-history">Ver historial de este producto</button>' +
      (d?.operation
        ? '<button type="button" class="button button-secondary" id="retry-operation">Reintentar envío pendiente</button>'
        : "");
    if (info.isConnected) info.after(controls);
    else q?.closest(".field")?.before(controls);
    controls.querySelector("#record-history").onclick = () => openProductHistory(this,item);
    this.pendingUI(item);
    controls
      .querySelector("#retry-operation")
      ?.addEventListener("click", async () => {
        if (await this.save(item, d.quantity, d.status, d.note, d.outOfStock))
          this.onRender?.();
      });
  }
  locationName(item) {
    return this.data.scopes
      .filter(
        (s) =>
          item.locationId === s.id || item.locationId.startsWith(s.id + ":"),
      )
      .map((s) => s.name)
      .join(" / ");
  }
  pendingUI(item) {
    const pending = this.draft(item)?.operation;
    const locked = this.scopeState(item) !== "open";
    for (const field of document.querySelectorAll("#quantity,#note")) {
      field.readOnly = !!pending || locked;
      field.disabled = locked;
    }
    for (const button of document.querySelectorAll("#save-out-of-stock,#save-partial,#save-counted")) button.disabled = locked || !!pending;
    let retry = document.querySelector("#retry-operation");
    if (pending && !retry && !this.busy) {
      retry = document.createElement("button");
      retry.id = "retry-operation";
      retry.type = "button";
      retry.className = "button button-secondary";
      retry.textContent = "Reintentar envío pendiente";
      document.querySelector("#quantity")?.closest(".field")?.before(retry);
      retry.onclick = async () => {
        const d = this.draft(item);
        if (
          d &&
          (await this.save(item, d.quantity, d.status, d.note, d.outOfStock))
        )
          this.onRender?.();
      };
    }
    if (!pending) retry?.remove();
  }
  recordURL(path, item) {
    return `${path}?cycle=${encodeURIComponent(this.cycleId)}&item=${encodeURIComponent(item.id)}&location=${encodeURIComponent(item.locationId)}`;
  }
  operation(item, d, action = "direct", version = d.baseVersion) {
    return {
      id: crypto.randomUUID(),
      cycleId: this.cycleId,
      itemId: item.id,
      locationId: item.locationId,
      expectedVersion: version,
      action,
      quantity: Number(String(d.quantity).replace(",", ".")),
      unit: item.unit || "",
      status: d.status,
      note: d.note,
      outOfStock: d.outOfStock,
    };
  }
  async save(item, quantity, status, note, outOfStock) {
    if (this.busy) return false;
    const state=this.scopeState(item);
    if(state && state!=='open' && !this.draft(item)?.operation){this.state('Inventario en revisión o cerrado. Borrador conservado.');return false;}
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
      this.state(
        "No se envió: no se pudo conservar el borrador en este dispositivo.",
      );
      return false;
    }
    return this.send(item, d, op, !!old?.operation);
  }
  async send(item, d, op, revalidate = false) {
    this.busy = true;
    this.state("Pendiente de enviar · guardando…");
    this.pendingUI(item);
    const buttons = [
      ...document.querySelectorAll(
        "#app-content button, #header-back-to-categories, #header-open-item-drawer, dialog[open] button",
      ),
    ];
    const active = buttons.includes(document.activeElement)
      ? document.activeElement
      : document.querySelector(
          "#confirm-choice:not([hidden]), #retry-operation",
        ) ||
        document.querySelector(
          op.outOfStock
            ? "#save-out-of-stock"
            : op.status === "partial"
              ? "#save-partial"
              : "#save-counted",
        );
    const disabled = buttons.map((button) => [button, button.disabled]);
    const restore = pendingButton(active, "Guardando…");
    for (const button of buttons) button.disabled = true;
    try {
      const accepted = await api("/api/count", op);
      // A new acknowledgement already contains the accepted record. An uncertain
      // retry can return an old snapshot, so only retries require a fresh read.
      const record = revalidate
        ? (await api(this.recordURL("/api/record", item))).record
        : accepted.record;
      this.onRecord?.(record, item.id);
      this.drafts.remove(item.id);
      this.modal?.close();
      this.modal = null;
      this.state(
        Object.keys(this.drafts.all()).length
          ? "Pendiente de enviar · hay otros borradores"
          : "Sincronizado",
      );
      return true;
    } catch (e) {
      if (e.status === 409 && ["STALE", "FOREIGN_RECORD"].includes(e.code)) {
        this.drafts.set(item.id, { ...d, operation: undefined });
        this.onRecord?.(e.current, item.id);
        if (e.current?.authorId !== this.user.id && e.current && e.current.status !== "pending") {
          this.resolve(item, d, e.current);
        } else {
          this.drafts.set(item.id, {
            ...d,
            operation: undefined,
            baseVersion: e.current?.version || 0,
          });
          this.state(
            "El conteo cambió. Conservamos tu borrador; revisa el último registro antes de guardar.",
          );
        }
      } else if (e.status === 403) {
        this.modal?.close();
        this.state("Tu acceso cambió. Conservamos tus cambios pendientes.");
        await this.refreshPermissions();
      } else if (e.status && e.status < 500) {
        this.drafts.set(item.id, { ...d, operation: undefined });
        this.handleError(e);
      } else this.handleError(e);
      return false;
    } finally {
      restore();
      for (const [button, wasDisabled] of disabled)
        button.disabled = wasDisabled;
      this.busy = false;
      this.pendingUI(item);
    }
  }
  handleError(e) {
    if (e.status === 401 || e.code === "IDENTITY_CHANGED") {
      this.modal?.close();
      loginRedirect();
    } else this.state(e.status ? e.message : "Sin conexión. Reintenta el envío.");
  }
  resolve(item, d, current) {
    this.modal?.close();
    const label = (r) => describeCountValue(r, item.unit);
    const el = dialog(
      "Revisar registro de otra persona",
      `<p><strong>${esc(item.name)}</strong> · ${esc(this.locationName(item))}</p><p>Último autor: ${esc(current.authorName)} · versión ${current.version}</p><table><thead><tr><th>Dato</th><th>Vigente</th><th>Tu propuesta</th></tr></thead><tbody><tr><th>Cantidad</th><td>${esc(label(current))}</td><td>${esc(label({ ...d, quantity: Number(d.quantity) }))}</td></tr><tr><th>Estado</th><td>${current.status === "partial" ? "Avance" : "Contado"}</td><td>${d.status === "partial" ? "Avance" : "Contado"}</td></tr><tr><th>Nota</th><td>${esc(current.note || "Sin nota")}</td><td>${esc(d.note || "Sin nota")}</td></tr></tbody></table><button type="button" id="discard">Descartar mi cambio</button><button type="button" id="choose-add" ${d.outOfStock || !item.unit ? "disabled" : ""}>Sumar mi cantidad</button><button type="button" id="choose-overwrite">Sobrescribir</button>${d.outOfStock ? "<p>Sin stock no es un aporte sumable. Para confirmar cero utiliza Sobrescribir.</p>" : !item.unit ? "<p>La unidad está pendiente de confirmar. No se puede sumar.</p>" : ""}<p id="result-preview" role="status"></p><button type="button" id="confirm-choice" hidden>Confirmar resultado</button><button type="button" id="keep-draft">Volver y conservar borrador</button>`,
    );
    this.modal = el;
    let action = null;
    el.querySelector("#discard").onclick = async () => {
      try {
        const { record } = await api(this.recordURL("/api/record", item));
        this.onRecord?.(record, item.id);
        this.drafts.remove(item.id);
        el.close();
        this.modal = null;
        this.state(
          Object.keys(this.drafts.all()).length
            ? "Cambio descartado · otros borradores pendientes de enviar"
            : "Sincronizado · cambio descartado",
        );
        this.onRender?.();
      } catch (e) {
        this.handleError(e);
      }
    };
    const choose = (a) => {
      action = a;
      const total =
        Math.round((current.quantity + Number(d.quantity)) * 1000) / 1000;
      const status =
        a === "add" && (current.status === "partial" || d.status === "partial")
          ? "Avance"
          : d.status === "partial"
            ? "Avance"
            : "Contado";
      el.querySelector("#result-preview").textContent =
        a === "add"
          ? `${current.quantity} + ${Number(d.quantity)} = ${total} ${item.unit}. ${status}. Suma solo existencias que todavía no estén incluidas en el conteo actual. Se conservan las notas previas y se añade tu nota con tu nombre.`
          : `Resultado: ${label({ ...d, quantity: Number(d.quantity) })} · ${status}. Nota: ${d.note || "Sin nota"}. Reemplaza la versión ${current.version}.`;
      el.querySelector("#confirm-choice").hidden = false;
    };
    el.querySelector("#choose-add").onclick = () => choose("add");
    el.querySelector("#choose-overwrite").onclick = () => choose("overwrite");
    el.querySelector("#confirm-choice").onclick = async () => {
      if (!action || this.busy) return;
      const op = this.operation(item, d, action, current.version);
      try {
        this.drafts.set(item.id, { ...d, operation: op });
      } catch {
        this.state(
          "No se envió: no se pudo conservar el borrador en este dispositivo.",
        );
        return;
      }
      if (await this.send(item, d, op)) this.onRender?.();
    };
    el.querySelector("#keep-draft").onclick = () => {
      el.close();
      this.modal = null;
    };
    el.addEventListener("cancel", () => {
      this.modal = null;
    });
    el.querySelector("#discard").focus();
  }
  async refreshPermissions() {
    const data = await api(
      "/api/bootstrap?cycle=" + encodeURIComponent(this.cycleId),
    );
    if (data.user.id !== this.user.id) {
      loginRedirect();
      return;
    }
    this.modal?.close();
    this.data = data;
    this.onPermissions?.(data);
  }
  sync({ manual = false } = {}) {
    // Manual refresh and polling share one in-flight read. Neither sends drafts.
    if (this.syncing) return this.syncing;
    if (Date.now() < (this.retrySyncAt || 0))
      return Promise.reject(Object.assign(Error("Espera antes de volver a sincronizar. Borrador conservado."), { status: 429 }));
    // A recent accepted poll already performed this read; do not ask D1 again.
    if (manual && Date.now() - this.lastSyncAt < 5000)
      return Promise.resolve();
    this.syncing = (async () => {
      try {
        const r = await api(
          `/api/sync?cycle=${encodeURIComponent(this.cycleId)}&cursor=${this.cursor}`,
        );
        if (r.user.id !== this.user.id) {
          loginRedirect();
          return;
        }
        if (r.user.revision !== this.user.revision || (r.cycleRevision !== undefined && r.cycleRevision !== this.data.cycle?.revision)) {
          const pending = Object.keys(this.drafts.all()).length > 0;
          // Keep drafts under the old identity; never replay them after a permission change.
          this.state(
            pending
              ? "Tus accesos cambiaron. Conservamos tus cambios pendientes."
              : "Tus accesos cambiaron.",
          );
          await this.refreshPermissions();
          this.user = r.user;
          return;
        }
        for (const record of r.changes) this.onRecord?.(record, record.itemId);
        this.cursor = r.cursor;
        this.lastSyncAt = Date.now();
        this.syncFailures = 0;
        this.retrySyncAt = 0;
        if (
          r.changes.length &&
          !this.modal &&
          !document.querySelector("#quantity") &&
          !this.busy &&
          !document.querySelector(".item-drawer.is-open") &&
          !document.activeElement?.matches("input,textarea,select")
        )
          this.onRender?.();
      } catch (e) {
        this.syncFailures = Math.min(6, (this.syncFailures || 0) + 1);
        this.retrySyncAt = Date.now() + Math.max(e.retryAfter || 0, Math.min(60, 2 ** this.syncFailures)) * 1000;
        this.handleError(e);
        throw e;
      } finally {
        this.syncing = null;
      }
    })();
    return this.syncing;
  }
  poll() {
    const tick = async () => {
      if (document.hidden) return;
      // sync() already presents failures; background reads must not reject unhandled.
      await this.sync().catch(() => {});
    };
    this.timer = setInterval(tick, 5000);
    document.addEventListener("visibilitychange", tick);
    return tick;
  }
}
