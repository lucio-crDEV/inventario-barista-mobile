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
  }
});
