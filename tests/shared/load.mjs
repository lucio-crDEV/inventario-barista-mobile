import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { Client, database, record, operation, cycleId } from "./helpers.mjs";
const db = database();
const telemetryBefore = db.prepare("SELECT coalesce(sum(observations),0) n FROM activity_hourly").get().n;
const pagesBefore = db.prepare("PRAGMA page_count").get().page_count;
db.exec("DELETE FROM attempts");
const start = performance.now(),
  times = [],
  statuses = {};
let requests = 0;
function measured(r) {
  times.push(r.ms);
  statuses[r.status] = (statuses[r.status] || 0) + 1;
  requests++;
  return r;
}
const clients = Array.from({ length: 15 }, () => new Client());
await Promise.all(
  clients.map(async (c, i) => measured(await c.login("carga" + (i + 1)))),
);
const boot = await Promise.all(
  clients.map(async (c) => {
    const r = measured(await c.request("/api/bootstrap"));
    assert.equal(r.status, 200);
    return r.data;
  }),
);
const items = boot[0].items.slice(40, 55);
assert.equal(items.length, 15);
let versions = await Promise.all(
  clients.map(async (c, i) => (await record(c, items[i]))?.version || 0),
);
const before = db.prepare("SELECT count(*) n FROM operations").get().n;
await Promise.all(
  clients.map(async (c, i) => {
    for (let round = 1; round <= 10; round++) {
      const op = operation(items[i], round + i / 100, {
        expectedVersion: versions[i],
        note: `Cliente ${i + 1}, ronda ${round}`,
        status: round === 10 ? "counted" : "partial",
      });
      const accepted = measured(await c.request("/api/count", op));
      assert.equal(accepted.status, 200);
      versions[i] = accepted.data.record.version;
      const retry = measured(await c.request("/api/count", op));
      assert.deepEqual(retry.data, accepted.data);
      const sync = measured(
        await c.request(`/api/sync?cycle=${cycleId}&cursor=${boot[i].cursor}`),
      );
      assert.equal(sync.status, 200);
      await new Promise((r) => setTimeout(r, 50));
    }
  }),
);
const admin = new Client();
measured(await admin.login("admin-prueba"));
const all = await admin.boot();
const contested = items[0],
  base = await record(admin, contested);
const race = await Promise.all(
  clients.map((c) =>
    c.save(contested, 1, { action: "add", expectedVersion: base.version }),
  ),
);
race.forEach(measured);
assert.equal(race.filter((r) => r.status === 200).length, 1);
assert.equal(race.filter((r) => r.status === 409).length, 14);
const final = await Promise.all(clients.map((c, i) => record(c, items[i])));
assert.equal(final[0].quantity, 11);
for (let i = 1; i < 15; i++) assert.equal(final[i].quantity, 10 + i / 100);
const ops = db.prepare("SELECT count(*) n FROM operations").get().n - before;
assert.equal(ops, 151);
assert.equal(
  db
    .prepare(
      "SELECT (SELECT count(*) FROM operations)-(SELECT count(*) FROM history) n",
    )
    .get().n,
  0,
);
assert.equal(
  db
    .prepare(
      "SELECT count(*) n FROM operations o JOIN history h ON h.operation_id=o.id WHERE o.result!=h.after_record",
    )
    .get().n,
  0,
);
times.sort((a, b) => a - b);
const pct = (p) => Math.round(times[Math.floor((times.length - 1) * p)]);
const report = {
  environment:
    "Workers/workerd + D1 local; no garantiza capacidad de producción",
  clients: 15,
  rounds: 10,
  durationMs: Math.round(performance.now() - start),
  measuredRequests: requests,
  totalRequestsIncludingVerification: Client.requests,
  statuses,
  expectedConflicts: 14,
  unexpectedErrors: 0,
  acceptedWrites: ops,
  duplicateRetries: 150,
  localStorage: {
    telemetryObservations: db.prepare("SELECT coalesce(sum(observations),0) n FROM activity_hourly").get().n - telemetryBefore,
    pageGrowth: db.prepare("PRAGMA page_count").get().page_count - pagesBefore,
    pageSizeBytes: db.prepare("PRAGMA page_size").get().page_size,
    cloudflareCpuAndBilledRows: "Not measurable from this local simulation",
  },
  latencyMs: { p50: pct(0.5), p95: pct(0.95), max: Math.round(times.at(-1)) },
  consistency:
    "151 operaciones aceptadas, historial y resultados coincidentes; cantidades finales verificadas",
  note: "Duración incluye ingresos bcrypt. Medidas incluyen login/bootstrap/guardar/reintento/sync/race; lecturas auxiliares de verificación no se contabilizan.",
};
await writeFile(
  "docs/carga-local-3b.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
db.close();
