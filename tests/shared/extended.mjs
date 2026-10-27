import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Client,
  injectFixtureSchema,
  database,
  operation,
  record,
  updateUser,
  resetPassword,
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
  let me = await a.request("/api/me");
  assert.equal((await a.request("/api/profile", { name: "Ana nombre nuevo", expectedRevision: me.data.user.revision })).status,200);
  try {
    const latest = await record(a, x);
    assert.equal(latest.authorId, a.user.id);
    assert.equal(latest.authorName, "Ana nombre nuevo");
    r = await a.save(x, 3, { expectedVersion: latest.version });
    assert.equal(r.status, 200);
    const h = await a.request(urlFor("/api/history", x));
    assert.ok(h.data.history.every(row => Object.keys(row).sort().join(",") === ["authorName","createdAt","quantity","status","unit"].sort().join(",")));
    assert.ok(
      h.data.history.some(
        (row) => row.authorName === "Ana ficticia",
      ),
    );
  } finally {
    me = await a.request("/api/me");
    await a.request("/api/profile", { name: "Ana ficticia", expectedRevision: me.data.user.revision });
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
  injectFixtureSchema(db,
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
    injectFixtureSchema(db,"DROP TRIGGER test_ignore_session");
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
await test("Ocho caracteres: alta, ingreso, cambio y restablecimiento; siete se rechazan sin revocar sesión", async () => {
  const username = "clave8-" + Date.now();
  const payload = { username, name: "Ensayo mínimo ocho", role: "worker", password: "Clave-0", grants: ["servicio:barra"] };
  assert.equal((await admin.request("/api/admin/users", payload)).status, 400);
  const created = await admin.request("/api/admin/users", { ...payload, password: "Clave-08" });
  assert.equal(created.status, 201);
  const person = new Client();
  await person.login(username, "Clave-08");
  assert.equal(person.user.mustChange, true);
  assert.equal((await person.request("/api/password", { currentPassword: "Clave-08", newPassword: "Nueva-0" })).status, 400);
  assert.equal((await person.request("/api/password", { currentPassword: "Clave-08", newPassword: "Nueva-08" })).status, 200);
  assert.equal((await person.request("/api/me")).status, 401);
  await person.login(username, "Nueva-08");
  const path = `/api/admin/users/${created.data.id}/password`;
  assert.equal((await resetPassword(admin, created.data.id, "Reset-0")).status, 400);
  assert.equal((await person.request("/api/me")).status, 200);
  assert.equal((await resetPassword(admin, created.data.id, "Reset-08")).status, 200);
  assert.equal((await person.request("/api/me")).status, 401);
  await person.login(username, "Reset-08");
  assert.equal(person.user.mustChange, true);
});
db.close();
