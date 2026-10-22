import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import worker from "../worker/index.js";
import { allowRequest, routeName, observe } from "../worker/telemetry.js";
import { sqliteDB } from "./shared/sqlite-adapter.mjs";
const origin = "https://example.test";
function setup(through = 5) {
  const db = sqliteDB(through);
  db.sqlite.exec(`INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES('admin','admin','Admin','!hash','admin',0),('worker','worker','Worker','!hash','worker',0);
    INSERT INTO cycles VALUES('test','Test','inventory-v2-2026-10-21','open');`);
  return { DB: db, APP_ENV: "production", APP_ORIGIN: origin, ACTIVE_CYCLE_ID: "test" };
}
async function request(env, path = "/api/me", options = {}) {
  const tasks = [];
  const response = await worker.fetch(new Request(origin + path, options), env, { waitUntil(p) { tasks.push(p); } });
  await Promise.all(tasks);
  return response;
}
function session(env, id) {
  const raw = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  env.DB.sqlite.prepare("INSERT INTO sessions VALUES(?,?,unixepoch()+3600)").run(hash, id);
  return { cookie: `__Host-inventory_session=${raw}` };
}
await test("Old/incomplete schemas and incomplete or wrong catalog fail closed; migration preserves populated data", async () => {
  const env = setup(2);
  assert.equal((await request(env)).status, 503);
  env.DB.migrate(3, 3);
  assert.equal((await request(env)).status, 401); // Legacy cycle remains compatible.
  env.DB.migrate(4, 5);
  assert.equal(env.DB.sqlite.prepare("SELECT name FROM users WHERE id='worker'").get().name, "Worker");
  assert.deepEqual(env.DB.sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  env.DB.sqlite.exec("UPDATE cycles SET catalog_version='missing'");
  assert.equal((await request(env)).status, 503);
  env.DB.sqlite.exec("UPDATE cycles SET catalog_version='inventory-v3-2026-10-22'; DELETE FROM catalog_items WHERE version='inventory-v3-2026-10-22' AND rowid IN(SELECT rowid FROM catalog_items WHERE version='inventory-v3-2026-10-22' LIMIT 1)");
  assert.equal((await request(env)).status, 503);
  env.DB.sqlite.close();
});
await test("Missing safety trigger cannot masquerade as initialized", async () => {
  const env = setup(); env.DB.sqlite.exec("DROP TRIGGER accept_operation");
  const r = await request(env); assert.equal(r.status, 503);
  assert.equal((await r.json()).code, "NOT_INITIALIZED"); env.DB.sqlite.close();
});
await test("Streaming JSON is byte bounded, errors and logs exclude submitted secrets", async () => {
  const env = setup();
  const logs = [], original = console.log;
  console.log = value => logs.push(String(value));
  try {
    const r = await request(env, "/api/login?secret=NEVER-LOG-THIS", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", Cookie: "secret=NEVER-LOG-THIS", "User-Agent": "NEVER-LOG-THIS" }, body: JSON.stringify({ password: "NEVER-LOG-THIS" + "é".repeat(9000) }) });
    assert.equal(r.status, 413); assert.equal((await r.json()).code, "TOO_LARGE");
    assert.match(r.headers.get("X-Request-ID"), /^[a-f0-9-]{36}$/);
    assert.ok(logs.length); assert.ok(!logs.join("").includes("NEVER-LOG-THIS"));
    assert.ok(!JSON.stringify(env.DB.sqlite.prepare("SELECT * FROM activity_hourly").all()).includes("NEVER-LOG-THIS"));
  } finally { console.log = original; env.DB.sqlite.close(); }
});
await test("Admin-only metrics, worker denial and session revocation; optional telemetry failure does not break session", async () => {
  const env = setup();
  assert.equal((await request(env, "/api/admin/metrics", { headers: session(env, "worker") })).status, 403);
  const headers = session(env, "admin");
  const r = await request(env, "/api/admin/metrics", { headers });
  assert.equal(r.status, 200); assert.equal((await r.json()).sampled, true);
  env.DB.sqlite.exec("DROP TABLE activity_hourly");
  assert.equal((await request(env, "/api/me", { headers })).status, 200);
  env.DB.sqlite.exec("DELETE FROM sessions");
  assert.equal((await request(env, "/api/me", { headers })).status, 401); env.DB.sqlite.close();
});
await test("15 independent accounts fit limits; burst capped and recovers without IP-wide ban", () => {
  for (let i = 0; i < 15; i++) for (let n = 0; n < 100; n++) assert.ok(allowRequest(`normal-${i}`, "sync", 1000));
  for (let n = 0; n < 60; n++) assert.ok(allowRequest("burst", "bootstrap", 1000));
  assert.equal(allowRequest("burst", "bootstrap", 1000), false);
  assert.ok(allowRequest("other", "bootstrap", 1000)); assert.ok(allowRequest("burst", "bootstrap", 61000));
  assert.equal(routeName("/api/admin/users/aaaaaaaa-bbbb/password"), "admin-users");
  assert.equal(routeName("/api/admin/metrics"), "metrics"); assert.equal(routeName("/api/secret-in-path"), "unknown");
});
await test("Polling sampled without per-poll rows, accepted login counts preserved", async () => {
  const env = setup(); const time = Date.now();
  const event = { actor: "worker", route: "sync", status: 200 };
  for (let i = 0; i < 100; i++) await observe(env.DB, event, time);
  assert.equal(env.DB.sqlite.prepare("SELECT sum(observations) n FROM activity_hourly").get().n, 1);
  for (let i = 0; i < 2; i++) await observe(env.DB, { actor: "worker", route: "login", status: 200 }, time);
  assert.equal(env.DB.sqlite.prepare("SELECT observations FROM activity_hourly WHERE route='login'").get().observations, 2);
  env.DB.sqlite.close();
});
