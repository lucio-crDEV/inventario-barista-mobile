import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readdirSync } from "node:fs";
export const origin = "http://127.0.0.1:8787";
export const password = "Solo-pruebas-2026";
export const cycleId = "prueba-compartida";
export function database() {
  const dir = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
  const file = readdirSync(dir).find(
    (x) => x.endsWith(".sqlite") && x !== "metadata.sqlite",
  );
  assert.ok(file, "D1 local debe inicializarse primero");
  const db = new DatabaseSync(`${dir}/${file}`);
  db.exec("PRAGMA busy_timeout=5000");
  return db;
}
export class Client {
  constructor() {
    this.cookie = "";
  }
  async request(path, body, headers = {}) {
    const start = performance.now();
    const response = await fetch(origin + path, {
      headers: {
        cookie: this.cookie,
        ...(path === "/api/count"
          ? { "X-Inventory-User": this.user?.id || "" }
          : {}),
        ...(body === undefined
          ? {}
          : { Origin: origin, "Content-Type": "application/json" }),
        ...headers,
      },
      ...(body === undefined
        ? {}
        : { method: "POST", body: JSON.stringify(body) }),
    });
    const cookie = response.headers.get("set-cookie");
    if (cookie) this.cookie = cookie.split(";")[0];
    const data = await response.json();
    return {
      status: response.status,
      data,
      headers: response.headers,
      ms: performance.now() - start,
    };
  }
  async login(username, p = password) {
    const r = await this.request("/api/login", { username, password: p });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    this.user = r.data.user;
    return r;
  }
  async boot() {
    const r = await this.request("/api/bootstrap");
    assert.equal(r.status, 200);
    return r.data;
  }
  async save(item, quantity = 4, options = {}) {
    return this.request("/api/count", operation(item, quantity, options));
  }
}
export function operation(item, quantity = 4, options = {}) {
  return {
    id: crypto.randomUUID(),
    cycleId,
    itemId: item.id,
    locationId: item.locationId,
    expectedVersion: 0,
    action: "direct",
    quantity,
    unit: item.unit || "",
    status: "counted",
    note: "",
    outOfStock: false,
    ...options,
  };
}
export const urlFor = (path, item) =>
  `${path}?cycle=${cycleId}&item=${encodeURIComponent(item.id)}&location=${encodeURIComponent(item.locationId)}`;
export async function record(c, item) {
  const r = await c.request(urlFor("/api/record", item));
  assert.equal(r.status, 200);
  return r.data.record;
}
export function resetLocal(db) {
  db.exec(
    "DELETE FROM history; DELETE FROM operations; DELETE FROM counts; DELETE FROM attempts; DELETE FROM grants WHERE user_id IN (SELECT id FROM users WHERE username='sin-areas'); UPDATE cycles SET state='open';",
  );
}
export async function updateUser(admin, user, changes) {
  const r = await admin.request("/api/admin/users");
  const u = r.data.users.find((x) => x.username === user);
  assert.ok(u);
  return admin.request("/api/admin/users/" + u.id, {
    name: u.name,
    active: u.active,
    role: u.role,
    grants: u.grants,
    ...changes,
  });
}
