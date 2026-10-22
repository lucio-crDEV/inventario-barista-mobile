import assert from "node:assert/strict";
import { Client, database } from "./helpers.mjs";
const db = database();
db.exec("DELETE FROM attempts");
const worker = new Client(), lead = new Client(), admin = new Client();
await worker.login("ana"); await lead.login("jefa-servicio"); await admin.login("admin-prueba");
for (const c of [worker, lead]) assert.equal((await c.request("/api/admin/metrics")).status, 403);
let response = await admin.request("/api/admin/metrics");
assert.equal(response.status, 200); assert.equal(response.data.sampled, true);
assert.ok(response.data.hourly.every(x => !("actor" in x) && !("target" in x)));
db.prepare("INSERT INTO attempts VALUES(?,CAST(unixepoch()/900 AS INTEGER),10) ON CONFLICT(key) DO UPDATE SET n=10,window=excluded.window").run("admin-password:" + admin.user.id);
const beforeUsers = db.prepare("SELECT count(*) n FROM users").get().n;
const costly = await admin.request("/api/admin/users", { username: "must-not-create", name: "Quota fixture", role: "worker", password: "Solo-pruebas-2026" });
assert.equal(costly.status, 429); assert.equal(costly.headers.get("retry-after"), "900");
assert.equal(db.prepare("SELECT count(*) n FROM users").get().n, beforeUsers);
db.prepare("DELETE FROM attempts WHERE key=?").run("admin-password:" + admin.user.id);
// Authenticated cost limiting is separate from NAT/IP login limits.
const statuses = [];
for (let i = 0; i < 65; i++) statuses.push((await worker.request("/api/bootstrap")).status);
assert.ok(statuses.includes(429));
assert.ok(statuses.every(x => [200, 429].includes(x)));
assert.equal((await worker.request("/api/logout", {})).status, 200);
// An observability outage must not affect an otherwise accepted write.
const client = new Client(); await client.login("bruno");
const data = await client.boot();
const item = data.items[100];
const previous = await client.request(`/api/record?item=${encodeURIComponent(item.id)}&location=${encodeURIComponent(item.locationId)}`);
db.exec("ALTER TABLE activity_hourly RENAME TO activity_unavailable");
try {
  const saved = await client.save(item, 2, { action: previous.data.record ? "overwrite" : "direct", expectedVersion: previous.data.record?.version || 0 });
  assert.equal(saved.status, 200);
  assert.ok(saved.headers.get("x-request-id"));
} finally { db.exec("ALTER TABLE activity_unavailable RENAME TO activity_hourly"); }
assert.equal(db.prepare("SELECT count(*) n FROM operations o JOIN history h ON h.operation_id=o.id WHERE o.result!=h.after_record").get().n, 0);
console.log(JSON.stringify({ checks: ["Worker and service lead denied global metrics", "Admin bounded metrics allowed", "Burst receives 429; logout remains usable", "Accepted count survives missing telemetry table", "Operation/history results remain consistent"] }));
db.close();
