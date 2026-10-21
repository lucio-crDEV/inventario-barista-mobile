import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Client,
  database,
  operation,
  record,
  updateUser,
  urlFor,
} from "./helpers.mjs";
const db = database();
db.exec("DELETE FROM attempts");
const admin = new Client(),
  a = new Client(),
  b = new Client();
await admin.login("admin-prueba");
await a.login("ana");
await b.login("bruno");
const bar = (await a.boot()).items,
  all = (await admin.boot()).items;
await test("Identidad histórica estable al renombrar y propio actualizado sin diálogo", async () => {
  const x = bar[70];
  let prior = await record(a, x);
  let r = await a.save(x, 4, {
    expectedVersion: prior?.version || 0,
    action: prior ? "overwrite" : "direct",
    note: "Original Ana",
  });
  assert.equal(r.status, 200);
  await updateUser(admin, "ana", { name: "Ana nombre nuevo" });
  try {
    const latest = await record(a, x);
    assert.equal(latest.authorId, a.user.id);
    assert.equal(latest.authorName, "Ana nombre nuevo");
    r = await a.save(x, 3, { expectedVersion: latest.version });
    assert.equal(r.status, 200);
    const h = await a.request(urlFor("/api/history", x));
    assert.ok(h.data.history.every((row) => row.user_id === a.user.id));
    assert.ok(
      h.data.history.some(
        (row) => row.after_record.authorName === "Ana ficticia",
      ),
    );
  } finally {
    await updateUser(admin, "ana", { name: "Ana ficticia" });
  }
});
await test("Dos dispositivos propios: el segundo recibe obsolescencia y no restaura un total anterior", async () => {
  const second = new Client();
  await second.login("ana");
  const x = bar[71],
    before = await record(a, x),
    v = before?.version || 0;
  const out = await Promise.all([
    a.save(x, 4, { expectedVersion: v }),
    second.save(x, 3, { expectedVersion: v }),
  ]);
  assert.deepEqual(out.map((r) => r.status).sort(), [200, 409]);
  const current = await record(a, x);
  assert.ok([3, 4].includes(current.quantity));
  assert.equal(out.find((r) => r.status === 409).data.code, "STALE");
});
await test("Suma parcial/parcial, unidad desconocida, máximo y sincronización filtrada", async () => {
  const x = bar[72],
    prev = await record(a, x);
  let r = await a.save(x, 4, {
    expectedVersion: prev?.version || 0,
    action: prev ? "overwrite" : "direct",
    status: "partial",
  });
  r = await b.save(x, 3, {
    expectedVersion: r.data.record.version,
    action: "add",
    status: "partial",
  });
  assert.equal(r.data.record.quantity, 7);
  assert.equal(r.data.record.status, "partial");
  const unknown = all.find((x) => !x.unit);
  assert.ok(unknown);
  let missing = await record(admin, unknown);
  r = await admin.save(unknown, 1, {
    expectedVersion: missing?.version || 0,
    action: missing ? "overwrite" : "direct",
  });
  assert.equal(r.status, 200);
  const sum = await admin.save(unknown, 1, {
    expectedVersion: r.data.record.version,
    action: "add",
  });
  assert.equal(sum.data.code, "INVALID_ITEM_UNIT");
  const huge = bar[73],
    old = await record(a, huge);
  r = await a.save(huge, 1000000, {
    expectedVersion: old?.version || 0,
    action: old ? "overwrite" : "direct",
  });
  const rejected = operation(huge, 0.001, {
    action: "add",
    expectedVersion: r.data.record.version,
  });
  assert.equal(
    (await b.request("/api/count", rejected)).data.code,
    "QUANTITY_LIMIT",
  );
  assert.equal(
    db.prepare("SELECT count(*) n FROM operations WHERE id=?").get(rejected.id)
      .n,
    0,
  );
  const sync = await a.request("/api/sync?cursor=0");
  assert.ok(sync.data.changes.every((c) => c.locationId === "servicio:barra"));
});
await test("Sesión caducada y carrera al crear sesión no producen acceso ni cookie de éxito", async () => {
  const c = new Client();
  await c.login("multiple");
  db.prepare("UPDATE sessions SET expires=unixepoch()-1 WHERE user_id=?").run(
    c.user.id,
  );
  assert.equal((await c.request("/api/me")).status, 401);
  db.exec(
    "CREATE TRIGGER test_ignore_session BEFORE INSERT ON sessions BEGIN SELECT RAISE(IGNORE); END",
  );
  try {
    const response = await c.request("/api/login", {
      username: "multiple",
      password: "Solo-pruebas-2026",
    });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("set-cookie"), null);
  } finally {
    db.exec("DROP TRIGGER test_ignore_session");
  }
});
await test("Desactivar una cuenta revoca dos dispositivos y reactivar no restaura sus sesiones", async () => {
  const first = new Client(),
    second = new Client();
  await first.login("multiple");
  await second.login("multiple");
  try {
    await updateUser(admin, "multiple", { active: false });
    assert.equal((await first.request("/api/me")).status, 401);
    assert.equal((await second.request("/api/me")).status, 401);
  } finally {
    await updateUser(admin, "multiple", { active: true });
  }
  assert.equal((await first.request("/api/me")).status, 401);
});
db.close();
