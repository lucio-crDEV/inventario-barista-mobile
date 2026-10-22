import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Client,
  database,
  resetLocal,
  operation,
  record,
  urlFor,
  updateUser,
  resetPassword,
  password,
} from "./helpers.mjs";
const db = database();
resetLocal(db);
const admin = new Client(),
  a = new Client(),
  b = new Client(),
  k = new Client();
await admin.login("admin-prueba");
await a.login("ana");
await b.login("bruno");
await k.login("cocina");
const all = await admin.boot(),
  bar = (await a.boot()).items,
  cook = (await k.boot()).items;
await test("Autenticación, cookies y control de origen", async () => {
  const bad = new Client();
  assert.equal(
    (
      await bad.request("/api/login", {
        username: "no-existe",
        password: "incorrecta",
      })
    ).status,
    401,
  );
  const wrong = await bad.request("/api/login", {
    username: "ana",
    password: "incorrecta",
  });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.data.code, "INVALID_LOGIN");
  const r = await a.login("ana");
  assert.match(r.headers.get("set-cookie"), /HttpOnly/);
  assert.match(r.headers.get("set-cookie"), /SameSite=Strict/);
  assert.equal(
    (
      await a.request("/api/count", operation(bar[0]), {
        Origin: "https://ajeno.test",
      })
    ).status,
    403,
  );
  assert.equal((await bad.request("/api/bootstrap")).status, 401);
});
await test("Jerarquía, múltiples ámbitos, sin asignaciones, administrador y endpoints aislados", async () => {
  const none = new Client();
  await none.login("sin-areas");
  const empty = await none.boot();
  assert.equal(empty.items.length, 0);
  assert.equal(empty.scopes.length, 0);
  assert.equal(empty.counts.length, 0);
  assert.equal(empty.cycle, null);
  assert.ok(bar.length > 0 && bar.every((x) => x.sectorId === "barra"));
  assert.ok(cook.every((x) => x.areaId === "cocina"));
  assert.equal(all.items.length, 1268);
  const multi = new Client(),
    terra = new Client(),
    gar = new Client();
  await multi.login("multiple");
  await terra.login("terraza");
  await gar.login("garzones");
  assert.deepEqual(
    new Set((await multi.boot()).items.map((x) => x.sectorId)),
    new Set(["barra", "armado-linea-coperia"]),
  );
  assert.ok((await terra.boot()).items.every((x) => x.zoneId === "terraza"));
  assert.equal((await terra.boot()).items.length, 16);
  assert.equal((await gar.boot()).items.length, 48);
  assert.deepEqual((await terra.boot()).scopes.map((s) => s.id).sort(), [
    "servicio",
    "servicio:garzones",
    "servicio:garzones:terraza",
  ]);
  for (const c of [a, none]) {
    for (const path of ["/api/record", "/api/history"])
      assert.equal((await c.request(urlFor(path, cook[0]))).status, 403);
    assert.equal((await c.save(cook[0])).status, 403);
    assert.equal((await c.request("/api/summary?scope=cocina")).status, 403);
    assert.equal(
      (
        await c.request("/api/search?q=" + encodeURIComponent(cook[0].name))
      ).data.items.some((x) => x.areaId === "cocina"),
      false,
    );
    assert.equal(
      (await c.request("/api/sync?cursor=0")).data.changes.length,
      0,
    );
  }
  assert.equal((await a.request("/api/admin/users")).status, 403);
  const staticData = await fetch(
    "http://127.0.0.1:8790/data/inventario/items/catalogo-excel.js",
  );
  assert.equal(staticData.status, 404);
  assert.ok(!("exportRow" in bar[0]));
});
await test("Primer guardado, propio sin diálogo, ajeno y 4+3=7 con reintento seguro", async () => {
  const x = bar[0];
  let r = await a.save(x, 4, { note: "Nota Ana", status: "partial" });
  assert.equal(r.status, 200);
  assert.equal(r.data.record.version, 1);
  r = await a.save(x, 4, {
    expectedVersion: 1,
    status: "partial",
    note: "Nota propia",
  });
  assert.equal(r.status, 200);
  r = await b.save(x, 3, { expectedVersion: 2 });
  assert.equal(r.status, 409);
  assert.equal(r.data.code, "FOREIGN_RECORD");
  const op = operation(x, 3, {
    expectedVersion: 2,
    action: "add",
    note: "Aporte Bruno",
  });
  const sum = await b.request("/api/count", op);
  assert.equal(sum.status, 200);
  assert.equal(sum.data.record.quantity, 7);
  assert.equal(sum.data.record.status, "partial");
  assert.match(sum.data.record.note, /Nota propia/);
  assert.match(sum.data.record.note, /Bruno.*Aporte Bruno/s);
  assert.equal(sum.data.record.authorId, b.user.id);
  const replay = await b.request("/api/count", op);
  assert.deepEqual(replay.data, sum.data);
  assert.equal(
    (await b.request("/api/count", { ...op, quantity: 8 })).data.code,
    "ID_REUSED",
  );
  const own = await b.save(x, 9, { expectedVersion: 3 });
  assert.equal(own.status, 200);
  assert.deepEqual((await b.request("/api/count", op)).data, sum.data);
  assert.equal(
    (await record(a, x)).quantity,
    9,
    "reintento antiguo no restaura 7",
  );
  const history = await a.request(urlFor("/api/history", x));
  assert.equal(history.data.history.length, 4);
  assert.equal(history.data.history.at(-1).before_record, null);
});
await test("Sobrescribir reemplaza 4 por 3; estados, cero y Sin stock", async () => {
  const x = bar[1];
  assert.equal((await a.save(x, 4)).status, 200);
  const r = await b.save(x, 3, {
    action: "overwrite",
    expectedVersion: 1,
    note: "Total nuevo",
  });
  assert.equal(r.data.record.quantity, 3);
  assert.equal(r.data.record.status, "counted");
  assert.equal(
    (
      await a.save(x, 0, {
        action: "add",
        expectedVersion: 2,
        outOfStock: true,
      })
    ).data.code,
    "INVALID_ZERO",
  );
  const zero = await a.save(x, 0, {
    action: "overwrite",
    expectedVersion: 2,
    outOfStock: true,
  });
  assert.equal(zero.data.record.outOfStock, true);
  const sum = await b.save(x, 1.125, { action: "add", expectedVersion: 3 });
  assert.equal(sum.data.record.quantity, 1.125);
  assert.equal(sum.data.record.outOfStock, false);
  assert.equal(sum.data.record.status, "counted");
  const normal = await b.save(x, 0, { expectedVersion: 4 });
  assert.equal(normal.data.record.outOfStock, false);
  assert.equal(
    (await a.save(x, 1.0001, { action: "overwrite", expectedVersion: 5 }))
      .status,
    400,
  );
  assert.equal((await a.save(x, -1)).status, 400);
  assert.equal(
    (
      await a.save(x, 2, {
        action: "overwrite",
        expectedVersion: 5,
        unit: "unidad-falsa",
      })
    ).data.code,
    "INVALID_ITEM_UNIT",
  );
});
await test("Versiones confirmadas, dos sumas y dos primeros guardados concurrentes", async () => {
  const x = bar[2];
  await a.save(x, 4);
  const [r, s] = await Promise.all([
    a.save(x, 3, { action: "add", expectedVersion: 1 }),
    b.save(x, 3, { action: "add", expectedVersion: 1 }),
  ]);
  assert.deepEqual([r.status, s.status].sort(), [200, 409]);
  assert.equal((await record(a, x)).quantity, 7);
  const stale = await a.save(x, 3, { action: "overwrite", expectedVersion: 1 });
  assert.equal(stale.data.code, "STALE");
  const y = bar[3];
  const first = await Promise.all([a.save(y, 4), b.save(y, 3)]);
  assert.deepEqual(first.map((x) => x.status).sort(), [200, 409]);
  const z = bar[4];
  const op = operation(z, 4);
  const doubles = await Promise.all([
    a.request("/api/count", op),
    a.request("/api/count", op),
  ]);
  assert.ok(doubles.every((x) => x.status === 200));
  assert.equal((await record(a, z)).version, 1);
  const own = await a.save(z, 6, { expectedVersion: 1 });
  assert.equal(own.status, 200);
  const late = await a.save(z, 5, { expectedVersion: 1 });
  assert.equal(late.data.code, "STALE");
  assert.equal((await record(a, z)).quantity, 6);
});
await test("Permisos otorgados y retirados en sesión activa, reintento y confirmación revocados", async () => {
  const n = new Client();
  await n.login("sin-areas");
  assert.equal(
    (await updateUser(admin, "sin-areas", { grants: ["cocina"] })).status,
    200,
  );
  assert.equal((await n.boot()).items.length, cook.length);
  const x = cook[2];
  const op = operation(x, 4);
  assert.equal((await n.request("/api/count", op)).status, 200);
  assert.equal(
    (await updateUser(admin, "sin-areas", { grants: [] })).status,
    200,
  );
  assert.equal((await n.boot()).items.length, 0);
  assert.equal((await n.request("/api/count", op)).status, 403);
  assert.equal(
    (await n.save(x, 3, { action: "add", expectedVersion: 1 })).status,
    403,
  );
  assert.equal((await n.request(urlFor("/api/history", x))).status, 403);
  assert.equal((await n.request("/api/sync?cursor=0")).data.changes.length, 0);
});
await test("Cambio, restablecimiento obligatorio, desactivación, revocación e identidad estable", async () => {
  const username = "test-" + Date.now();
  let r = await admin.request("/api/admin/users", {
    username,
    name: "Temporal",
    role: "worker",
    password,
  });
  assert.equal(r.status, 201);
  const id = r.data.id;
  const c = new Client();
  await c.login(username);
  assert.equal(
    (await c.request("/api/bootstrap")).data.code,
    "PASSWORD_CHANGE_REQUIRED",
  );
  assert.equal(
    (
      await c.request("/api/password", {
        currentPassword: password,
        newPassword: "Nueva-personal-2026",
      })
    ).status,
    200,
  );
  assert.equal((await c.request("/api/me")).status, 401);
  await c.login(username, "Nueva-personal-2026");
  assert.equal(c.user.id, id);
  assert.equal((await c.boot()).items.length, 0);
  assert.equal(
    (await resetPassword(admin, id, password))
      .status,
    200,
  );
  assert.equal((await c.request("/api/me")).status, 401);
  await c.login(username);
  assert.equal(c.user.mustChange, true);
  await c.request("/api/password", {
    currentPassword: password,
    newPassword: "Otra-personal-2026",
  });
  await c.login(username, "Otra-personal-2026");
  assert.equal(
    (
      await updateUser(admin, username, {
        active: false,
      })
    ).status,
    200,
  );
  assert.equal((await c.request("/api/me")).status, 401);
  assert.equal(
    (
      await c.request("/api/login", {
        username,
        password: "Otra-personal-2026",
      })
    ).status,
    401,
  );
});
await test("Último administrador protegido y auditoría sin contraseñas", async () => {
  assert.equal(
    (await updateUser(admin, "admin-prueba", { active: false })).data.code,
    "LAST_ADMIN",
  );
  assert.equal(
    (await updateUser(admin, "admin-prueba", { role: "worker" })).data.code,
    "LAST_ADMIN",
  );
  assert.throws(
    () => db.prepare("DELETE FROM users WHERE username=?").run("admin-prueba"),
    /LAST_ADMIN/,
  );
  const audit = db.prepare("SELECT * FROM admin_audit").all();
  assert.ok(audit.length);
  assert.ok(
    audit.every(
      (x) => !x.detail.includes(password) && !x.detail.includes("$2b$"),
    ),
  );
});
await test("Ciclo cerrado, ubicaciones independientes, error atómico y consistencia final", async () => {
  const x = bar[5];
  await a.save(x, 4);
  db.exec("UPDATE cycles SET state='closed'");
  assert.equal(
    (await a.save(x, 3, { expectedVersion: 1 })).data.code,
    "CYCLE_CLOSED",
  );
  assert.equal(
    (await b.save(x, 3, { expectedVersion: 1, action: "add" })).data.code,
    "CYCLE_CLOSED",
  );
  assert.equal(
    (await b.save(x, 3, { expectedVersion: 1, action: "overwrite" })).data.code,
    "CYCLE_CLOSED",
  );
  db.exec("UPDATE cycles SET state='open'");
  const multi = new Client();
  await multi.login("multiple");
  const m = await multi.boot();
  const armado = m.items.find((x) => x.sectorId === "armado-linea-coperia");
  assert.equal((await multi.save(armado, 3)).status, 200);
  assert.equal((await record(a, x)).quantity, 4);
  const y = bar[6],
    op = operation(y, 4);
  db.exec(
    "CREATE TRIGGER test_failure BEFORE UPDATE OF after_record ON history BEGIN SELECT RAISE(ABORT,'INJECTED_FAILURE'); END",
  );
  try {
    assert.equal((await a.request("/api/count", op)).status, 500);
    assert.equal(await record(a, y), null);
    assert.equal(
      db.prepare("SELECT count(*) n FROM operations WHERE id=?").get(op.id).n,
      0,
    );
    assert.equal(
      db
        .prepare("SELECT count(*) n FROM history WHERE operation_id=?")
        .get(op.id).n,
      0,
    );
  } finally {
    db.exec("DROP TRIGGER test_failure");
  }
  assert.equal((await a.request("/api/count", op)).status, 200);
  const totals = db
    .prepare(
      "SELECT (SELECT count(*) FROM operations) ops,(SELECT count(*) FROM history) hist",
    )
    .get();
  assert.equal(totals.ops, totals.hist);
  assert.equal(
    db
      .prepare(
        "SELECT count(*) n FROM counts c WHERE c.version != (SELECT count(*) FROM history h WHERE h.cycle_id=c.cycle_id AND h.item_id=c.item_id AND h.location_id=c.location_id)",
      )
      .get().n,
    0,
  );
});

await test("Herencia de Servicio, precisión de suma y ubicaciones del mismo producto", async () => {
  const n = new Client();
  await n.login("sin-areas");
  await updateUser(admin, "sin-areas", { grants: ["servicio"] });
  const service = await n.boot();
  assert.ok(
    service.items.length > 0 &&
      service.items.every((x) => x.areaId === "servicio"),
  );
  assert.ok(service.scopes.some((x) => x.id === "servicio:garzones:privada"));
  await updateUser(admin, "sin-areas", { grants: [] });
  const x = bar[8];
  await a.save(x, 0.1);
  const sum = await b.save(x, 0.2, {
    expectedVersion: 1,
    action: "add",
    status: "partial",
  });
  assert.equal(sum.data.record.quantity, 0.3);
  assert.equal(sum.data.record.status, "partial");
  const zones = all.items.filter((x) => x.sectorId === "garzones");
  const one = zones.find((x) => x.zoneId === "privada");
  const two = zones.find((x) => x.zoneId === "terraza" && x.name === one.name);
  assert.equal((await admin.save(one, 4)).status, 200);
  assert.equal((await admin.save(two, 3)).status, 200);
  assert.equal((await record(admin, one)).quantity, 4);
  assert.equal((await record(admin, two)).quantity, 3);
  const reuse = operation(x, 6, { expectedVersion: 0, action: "overwrite" });
  assert.equal((await a.request("/api/count", reuse)).status, 409);
  assert.equal(
    (
      await a.request("/api/count", {
        ...reuse,
        id: crypto.randomUUID(),
        expectedVersion: 2,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await a.request("/api/count", operation(bar[9]), {
        "X-Inventory-User": b.user.id,
      })
    ).data.code,
    "IDENTITY_CHANGED",
  );
  assert.equal(await record(a, bar[9]), null);
});
await test("Limitación repetida y errores de ingreso genéricos", async () => {
  const c = new Client();
  let r;
  for (let i = 0; i < 11; i++)
    r = await c.request("/api/login", {
      username: "ausente-cuota",
      password: "incorrecta",
    });
  assert.equal(r.status, 429);
});
db.close();
