import assert from "node:assert/strict";
import { runtimeSchemaSQL } from "../../worker/runtime-readiness.js";
import { DatabaseSync } from "node:sqlite";
import { readdirSync } from "node:fs";
export const origin = process.env.INVENTORY_TEST_ORIGIN || "http://127.0.0.1:8790";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw Error("Tests require local loopback HTTP.");
export const password = "Solo-pruebas-2026";
export const cycleId = "prueba-compartida";
export function database() {
  const dir = ".wrangler/test-state/v3/d1/miniflare-D1DatabaseObject";
  const file = readdirSync(dir).find(
    (x) => x.endsWith(".sqlite") && x !== "metadata.sqlite",
  );
  assert.ok(file, "D1 local debe inicializarse primero");
  const db = new DatabaseSync(`${dir}/${file}`);
  db.exec("PRAGMA busy_timeout=5000");
  return db;
}
export class Client {
  static requests = 0;
  constructor() {
    this.cookie = "";
  }
  async request(path, body, headers = {}) {
    Client.requests++;
    const start = performance.now();
    const response = await fetch(origin + path, {
      headers: {
        cookie: this.cookie,
        ...(path === "/api/count" || path === "/api/profile" || path.startsWith("/api/admin/")
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
    username: u.username,
    expectedRevision: u.revision,
    active: u.active,
    role: u.role,
    grants: u.grants,
    ...changes,
  });
}
export async function resetPassword(admin, id, password) {
  const r = await admin.request("/api/admin/users");
  const target = r.data.users.find(u => u.id === id);
  assert.ok(target);
  return admin.request(`/api/admin/users/${id}/password`, { password, expectedRevision: target.revision });
}

// Test-only approval of deliberate failure-injection DDL in disposable SQLite.
// Production has no restamping endpoint; unexpected DDL still fails closed.
export function injectFixtureSchema(db,sql) {
  assert.ok(sql.startsWith('CREATE TRIGGER test_')||sql.startsWith('DROP TRIGGER test_'));
  db.exec(sql);
  if(db.prepare("SELECT 1 FROM sqlite_schema WHERE name='runtime_contract'").get())
    db.exec('UPDATE runtime_contract SET schema_signature=('+runtimeSchemaSQL+') WHERE id=1');
}
