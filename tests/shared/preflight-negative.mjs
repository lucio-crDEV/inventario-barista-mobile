import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { database } from "./helpers.mjs";
const db = database();
const args = ["scripts/preflight.mjs", "--local", "--state", ".wrangler/test-state", "--cycle"];
assert.throws(() => execFileSync(process.execPath, [...args, "wrong-cycle"], { stdio: "pipe" }));
db.exec("ALTER TABLE activity_hourly RENAME TO activity_hold");
try { assert.throws(() => execFileSync(process.execPath, [...args, "prueba-compartida"], { stdio: "pipe" })); }
finally { db.exec("ALTER TABLE activity_hold RENAME TO activity_hourly"); db.close(); }
console.log("PASS preflight rejects wrong cycle and missing 0005 without writes");
