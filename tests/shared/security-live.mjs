import assert from "node:assert/strict";
import { Client, database } from "./helpers.mjs";
const db = database();
db.exec("DELETE FROM attempts");
const worker = new Client(), lead = new Client(), admin = new Client();
await worker.login("ana"); await lead.login("jefa-servicio"); await admin.login("admin-prueba");
for (const c of [worker, lead, admin]) {
  const response = await c.request("/api/admin/metrics");
  assert.equal(response.status, 403); assert.equal(response.data.code, "ROOT_NOT_ENABLED");
}
assert.equal(db.prepare("SELECT count(*) n FROM sqlite_schema WHERE name='activity_hourly'").get().n, 0);
// Root is a design only: an ordinary admin cannot select that role or change it through profile.
const escalation = await admin.request("/api/admin/users", { username: "root", name: "Escalation fixture", role: "root", password: "Solo-pruebas-2026" });
assert.equal(escalation.status, 400);
const ownRole = await admin.request("/api/profile", { name: "Admin", role: "root", expectedRevision: admin.user.revision });
assert.equal(ownRole.status, 400);
db.prepare("INSERT INTO attempts VALUES(?,CAST(unixepoch()/900 AS INTEGER),10) ON CONFLICT(key) DO UPDATE SET n=10,window=excluded.window").run("admin-password:" + admin.user.id);
const beforeUsers = db.prepare("SELECT count(*) n FROM users").get().n;
const costly = await admin.request("/api/admin/users", { username: "must-not-create", name: "Quota fixture", role: "worker", password: "Solo-pruebas-2026", grants: ["servicio:barra"] });
assert.equal(costly.status, 429); assert.equal(costly.headers.get("retry-after"), "900");
assert.equal(db.prepare("SELECT count(*) n FROM users").get().n, beforeUsers);
db.prepare("DELETE FROM attempts WHERE key=?").run("admin-password:" + admin.user.id);
// Authenticated cost limiting is separate from NAT/IP login limits.
const statuses = [], burstStarted = performance.now();
// A fixed minute window may reset during the burst. More than 2*60 requests
// within less than one minute must hit the limit even across that boundary.
for (let i = 0; i < 125; i++) statuses.push((await worker.request("/api/bootstrap")).status);
assert.ok(performance.now() - burstStarted < 60000, "Burst exceeded two fixed windows; timing cannot prove the limit");
assert.ok(statuses.includes(429));
assert.ok(statuses.every(x => [200, 429].includes(x)));
assert.equal((await worker.request("/api/logout", {})).status, 200);
// An observability outage must not affect an otherwise accepted write.
const client = new Client(); await client.login("bruno");
const data = await client.boot();
const item = data.items[100];
const previous = await client.request(`/api/record?item=${encodeURIComponent(item.id)}&location=${encodeURIComponent(item.locationId)}`);
const saved = await client.save(item, 2, { action: previous.data.record ? "overwrite" : "direct", expectedVersion: previous.data.record?.version || 0 });
assert.equal(saved.status, 200); assert.ok(saved.headers.get("x-request-id"));
assert.equal(db.prepare("SELECT count(*) n FROM operations o JOIN history h ON h.operation_id=o.id WHERE o.result!=h.after_record").get().n, 0);
console.log(JSON.stringify({ checks: ["All current roles denied technical metrics", "Root role escalation rejected", "Burst receives 429; logout remains usable", "Accepted count without telemetry schema", "Operation/history results remain consistent"] }));
db.close();
