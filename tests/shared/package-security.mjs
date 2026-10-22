import assert from "node:assert/strict";
import { writeFileSync, symlinkSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
const files = ["shared/.private-test", "shared/secret-test.sql", "shared/source-test.js.map", "shared/unexpected-test.txt", "shared/link-test.js"];
try {
  for (const file of files.slice(0, -1)) writeFileSync(file, "INTERNAL-PACKAGE-SENTINEL");
  symlinkSync("../worker/password.js", files.at(-1));
  execFileSync(process.execPath, ["scripts/build-pages.mjs"], { stdio: "pipe" });
  const output = readdirSync("dist", { recursive: true });
  assert.ok(!output.some(p => /(?:private-test|secret-test|source-test|unexpected-test|link-test|\.DS_Store|\.map$)/.test(p)));
  for (const path of output.filter(p => /\.(?:js|html|css)$/.test(p))) assert.ok(!readFileSync(`dist/${path}`, "utf8").includes("INTERNAL-PACKAGE-SENTINEL"));
  assert.ok(output.includes("_worker.js")); assert.ok(output.includes("_routes.json"));
  console.log("PASS package allowlist excludes internal files, sourcemaps and symlinks; Pages worker/routes present");
} finally { for (const file of files) unlinkSync(file); }
