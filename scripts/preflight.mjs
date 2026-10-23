import { parseArgs } from "node:util";
import { localDatabase, wrangler } from "./operations/storage.mjs";
import { readinessSQL } from "../worker/readiness.js";
const { values: v } = parseArgs({ options: {
  local: { type: "boolean" }, remote: { type: "boolean" }, state: { type: "string" },
  config: { type: "string" }, cycle: { type: "string" },
} });
if (!!v.local === !!v.remote || !v.cycle || !/^[a-zA-Z0-9_-]{1,100}$/.test(v.cycle) || (v.remote && (!v.config || v.state)))
  throw Error("Use --local --state STATE --cycle ID, or explicitly --remote --config CONFIG --cycle ID. Read-only.");
const runtime = v.local ? localDatabase(v.state || ".wrangler/state") : { args: ["--remote", "--config", v.config], close() {} };
try {
  const sql = readinessSQL.replace("?", `'${v.cycle}'`);
  const raw = wrangler(["execute", "DB", ...runtime.args, "--command", sql, "--json"]);
  const results = JSON.parse(raw);
  if (!results.some(r => r.results?.some(row => row.ready === 1))) throw Error("Schema/catalog/cycle/admin contract not ready. Do not publish.");
  console.log(JSON.stringify({ ready: true, readOnly: true, cycle: v.cycle, schemaContract: "operation-ux-0007", telemetryRequired: false, note: "Verify effective Pages bindings/origin/environment separately; this does not authenticate or certify remote CPU." }));
} finally { runtime.close(); }
