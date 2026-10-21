import {
  api,
  requireUser,
  identityBar,
  setSync,
  draftsFor,
  dialog,
  escapeHtml as esc,
  loginRedirect,
} from "./client.js";
export class SharedInventory {
  static async create() {
    const user = await requireUser();
    identityBar(user);
    const data = await api("/api/bootstrap");
    return new SharedInventory(user, data);
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
  }
  state(text) {
    setSync(text);
  }
  draft(item) {
    return this.drafts.get(item.id);
  }
  capture(item, quantity, note, status = "partial", outOfStock = false) {
    const old = this.draft(item);
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
    const d = this.draft(item),
      q = document.querySelector("#quantity"),
      n = document.querySelector("#note");
    if (d) {
      q.value = d.quantity ?? "";
      n.value = d.note || "";
      this.state("Pendiente de enviar · borrador recuperado");
    }
    for (const field of [q, n])
      field?.addEventListener("input", () =>
        this.capture(item, q.value, n.value),
      );
    const info = document.createElement("p");
    info.className = "pending-draft";
    info.textContent = count.version
      ? `Último registro: ${count.authorName} · versión ${count.version}. ${count.note ? "Notas conservadas abajo." : ""}`
      : "Sin conteo vigente. El cero solo se confirma al guardar.";
    q?.closest(".field")?.before(info);
    const controls = document.createElement("div");
    controls.innerHTML =
      '<button type="button" class="button button-ghost" id="record-history">Ver historial de este producto</button>' +
      (d?.operation
        ? '<button type="button" class="button button-secondary" id="retry-operation">Reintentar envío pendiente</button>'
        : "");
    info.after(controls);
    controls.querySelector("#record-history").onclick = async () => {
      try {
        const r = await api(this.recordURL("/api/history", item));
        const el = dialog(
          "Historial del producto",
          `<p>${esc(item.name)} · ${esc(this.locationName(item))}</p>${r.history.map((h) => `<p>${esc(h.created_at)} · ${esc(h.after_record.authorName)} · ${esc(h.action)} · ${esc(h.before_record?.quantity ?? "Sin conteo")} → ${esc(h.after_record.quantity)} ${esc(item.unit)} · ${esc(h.after_record.status)}</p><p>${esc(h.after_record.note)}</p>`).join("") || "<p>Sin movimientos.</p>"}<button type="button">Cerrar</button>`,
        );
        el.querySelector("button").onclick = () => el.close();
      } catch (e) {
        this.handleError(e);
      }
    };
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
    for (const field of document.querySelectorAll("#quantity,#note"))
      field.readOnly = !!pending;
    let retry = document.querySelector("#retry-operation");
    if (pending && !retry) {
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
    return this.send(item, d, op);
  }
  async send(item, d, op) {
    this.busy = true;
    this.state("Pendiente de enviar");
    try {
      await api("/api/count", op);
      // An idempotent retry returns its historical result. Read current state afterwards.
      const { record } = await api(this.recordURL("/api/record", item));
      this.onRecord?.(record, item.id);
      this.drafts.remove(item.id);
      this.modal?.close();
      this.modal = null;
      this.state(Object.keys(this.drafts.all()).length
        ? "Pendiente de enviar · hay otros borradores"
        : "Sincronizado");
      return true;
    } catch (e) {
      if (e.status === 409 && ["STALE", "FOREIGN_RECORD"].includes(e.code)) {
        this.drafts.set(item.id, { ...d, operation: undefined });
        this.onRecord?.(e.current, item.id);
        if (e.current?.authorId !== this.user.id && e.current) {
          this.resolve(item, d, e.current);
        } else {
          this.drafts.set(item.id, {
            ...d,
            operation: undefined,
            baseVersion: e.current?.version || 0,
          });
          this.state(
            `Edición obsoleta · vigente ${e.current?.quantity ?? "sin conteo"} ${item.unit}, versión ${e.current?.version || 0}. Borrador conservado. Revisa y vuelve a guardar.`,
          );
        }
      } else if (e.status === 403) {
        this.modal?.close();
        this.state("Acceso retirado · borrador aislado conservado");
        await this.refreshPermissions();
      } else if (e.status && e.status < 500) {
        this.drafts.set(item.id, { ...d, operation: undefined });
        this.handleError(e);
      } else this.handleError(e);
      return false;
    } finally {
      this.busy = false;
      this.pendingUI(item);
    }
  }
  handleError(e) {
    if (e.status === 401 || e.code === "IDENTITY_CHANGED") {
      this.modal?.close();
      loginRedirect();
    } else this.state(`${e.message || "Sin conexión"} · borrador conservado`);
  }
  resolve(item, d, current) {
    this.modal?.close();
    const label = (r) =>
      !r
        ? "Sin conteo"
        : r.outOfStock
          ? "Sin stock · cero confirmado"
          : `${r.quantity} ${item.unit || "(unidad pendiente)"}${r.quantity === 0 ? " · cero confirmado" : ""}`;
    const el = dialog(
      "Revisar registro de otra persona",
      `<p><strong>${esc(item.name)}</strong> · ${esc(this.locationName(item))}</p><p>Último autor: ${esc(current.authorName)} · versión ${current.version}</p><table><thead><tr><th>Dato</th><th>Vigente</th><th>Tu propuesta</th></tr></thead><tbody><tr><th>Cantidad</th><td>${esc(label(current))}</td><td>${esc(label({ ...d, quantity: Number(d.quantity) }))}</td></tr><tr><th>Estado</th><td>${current.status === "partial" ? "Avance" : "Contado"}</td><td>${d.status === "partial" ? "Avance" : "Contado"}</td></tr><tr><th>Nota</th><td>${esc(current.note || "Sin nota")}</td><td>${esc(d.note || "Sin nota")}</td></tr></tbody></table><button type="button" id="discard">Descartar mi cambio</button><button type="button" id="choose-add" ${d.outOfStock || !item.unit ? "disabled" : ""}>Sumar mi cantidad</button><button type="button" id="choose-overwrite">Sobrescribir</button>${d.outOfStock ? "<p>Sin stock no es un aporte sumable. Para confirmar cero utiliza Sobrescribir.</p>" : ""}<p id="result-preview" role="status"></p><button type="button" id="confirm-choice" hidden>Confirmar resultado</button><button type="button" id="keep-draft">Volver y conservar borrador</button>`,
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
        this.state(Object.keys(this.drafts.all()).length
          ? "Cambio descartado · otros borradores pendientes de enviar"
          : "Sincronizado · cambio descartado");
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
  poll() {
    let running = false;
    const tick = async () => {
      if (document.hidden || running) return;
      running = true;
      try {
        const r = await api(
          `/api/sync?cycle=${encodeURIComponent(this.cycleId)}&cursor=${this.cursor}`,
        );
        if (r.user.id !== this.user.id) {
          loginRedirect();
          return;
        }
        if (r.user.revision !== this.user.revision) {
          const pending = Object.keys(this.drafts.all()).length > 0;
          // Keep drafts under the old identity; never replay them after a permission change.
          this.state(
            pending
              ? "Tus accesos cambiaron. Hay borradores aislados conservados."
              : "Tus accesos cambiaron.",
          );
          await this.refreshPermissions();
          this.user = r.user;
          return;
        }
        for (const record of r.changes) this.onRecord?.(record, record.itemId);
        this.cursor = r.cursor;
        if (!this.modal && !document.querySelector("#quantity") && !this.busy)
          this.onRender?.();
      } catch (e) {
        this.handleError(e);
      } finally {
        running = false;
      }
    };
    this.timer = setInterval(tick, 5000);
    document.addEventListener("visibilitychange", tick);
    return tick;
  }
}
