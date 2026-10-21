import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
mkdirSync(".wrangler", { recursive: true });
const file = ".wrangler/fixtures.bootstrap.sql";
try {
  writeFileSync(
    file,
    execFileSync(process.execPath, ["scripts/bootstrap.mjs", "--fixtures"]),
    { mode: 0o600 },
  );
  execFileSync(
    "node_modules/.bin/wrangler",
    ["d1", "execute", "DB", "--local", "--env", "local", "--file", file],
    { stdio: "inherit" },
  );
} finally {
  try {
    unlinkSync(file);
  } catch {}
}
