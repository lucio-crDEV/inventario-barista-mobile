import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../../worker/index.js";
await test("Producción sin DB, origen HTTPS o ciclo configurado rechaza sin fixtures", async () => {
  for (const env of [
    {},
    { APP_ENV: "production", APP_ORIGIN: "", ACTIVE_CYCLE_ID: "" },
    {
      APP_ENV: "production",
      APP_ORIGIN: "https://example.test",
      DB: {},
      ACTIVE_CYCLE_ID: "",
    },
    {
      APP_ENV: "production",
      APP_ORIGIN: "http://example.test",
      DB: {},
      ACTIVE_CYCLE_ID: "actual",
    },
  ]) {
    const r = await worker.fetch(
      new Request("http://example.test/api/login", {
        method: "POST",
        headers: {
          Origin: "http://example.test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "admin-prueba",
          password: "Solo-pruebas-2026",
        }),
      }),
      env,
    );
    assert.equal(r.status, 503);
    assert.equal(r.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(r.headers.get("X-Frame-Options"), "DENY");
    assert.ok(
      r.headers
        .get("Content-Security-Policy")
        .includes("frame-ancestors 'none'"),
    );
  }
});
await test("Esquema o ciclo sin inicializar devuelve 503 JSON sin datos de inventario", async () => {
  for (const broken of [true, false]) {
    const env = {
      APP_ENV: "production",
      APP_ORIGIN: "https://example.test",
      ACTIVE_CYCLE_ID: "piloto",
      DB: {
        prepare() {
          if (broken) throw Error("no such table: cycles");
          return {
            bind() {
              return { first: async () => null };
            },
          };
        },
      },
    };
    const r = await worker.fetch(
      new Request("https://example.test/api/me"),
      env,
    );
    assert.equal(r.status, 503);
    assert.equal(r.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(r.headers.get("X-Frame-Options"), "DENY");
    assert.ok(
      r.headers
        .get("Content-Security-Policy")
        .includes("frame-ancestors 'none'"),
    );
    const data = await r.json();
    assert.equal(data.code, "NOT_INITIALIZED");
    assert.ok(!("items" in data));
  }
});
