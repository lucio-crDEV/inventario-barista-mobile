import { mkdtempSync, cpSync, rmSync, symlinkSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { execFileSync, spawn } from "node:child_process";
const source = resolve(".");
const scratch = join(tmpdir(), "inventory-codex-tests");
mkdirSync(scratch, { recursive: true });
const root = mkdtempSync(join(scratch, "inventory-security-"));
process.env.TMPDIR = scratch;
cpSync(source, root, { recursive: true, filter: p => {
  const relative = p.slice(source.length + 1);
  return !relative.split(/[\\/]/).some(x => ["node_modules", ".git", ".wrangler", ".backups", "dist", "sources", "inventarios_og", "archivos-externos", "test-results"].includes(x) || x.startsWith(".dev.vars") || x.startsWith(".env") || x === ".DS_Store");
} });
symlinkSync(join(source, "node_modules"), join(root, "node_modules"), "dir");
const report = { root, startedAt: new Date().toISOString(), runs: [] };
function run(script, args = [], env = {}) {
  const start = Date.now();
  try {
    const output = execFileSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8", env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"], timeout: 240000 });
    writeFileSync(join(root, `run-${report.runs.length}.log`), output);
    report.runs.push({ script, durationMs: Date.now() - start, passed: true });
    console.log("PASS", script, Date.now() - start);
  } catch (e) {
    writeFileSync(join(root, `run-${report.runs.length}.log`), String(e.stdout || "") + String(e.stderr || ""));
    report.runs.push({ script, durationMs: Date.now() - start, passed: false });
    console.log("FAIL", script, String(e.stdout || "") + String(e.stderr || ""));
  }
}
async function ready(url, options = {}) {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url, options)).status === 401) return; } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw Error("Local server did not become ready");
}
let server;
try {
  run("scripts/build-pages.mjs");
  run("scripts/prepare-tests.mjs");
  run("scripts/preflight.mjs", ["--local", "--state", ".wrangler/test-state", "--cycle", "prueba-compartida"]);
  run("tests/shared/preflight-negative.mjs");
  const baseline=join(root,".wrangler/test-baseline");
  cpSync(join(root,".wrangler/test-state"),baseline,{recursive:true});
  const logs = [];
  for (const script of ["integration", "extended", "users-service", "load", "sync", "backoff", "users-service-browser", "security-live", "supervision-live", "supervision-browser", "revision-browser", "ux", "refresh", "admin-layout", "browser", "views"]) {
    // Every suite starts from the same disposable D1 snapshot; persistent activity must not leak between suites.
    rmSync(join(root,".wrangler/test-state"),{recursive:true,force:true});
    cpSync(baseline,join(root,".wrangler/test-state"),{recursive:true});
    server = spawn(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "dev", "--env", "local", "--ip", "127.0.0.1", "--port", "8990", "--inspector-port", "9432", "--persist-to", ".wrangler/test-state", "--var", "APP_ORIGIN:http://127.0.0.1:8990"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    server.stdout.on("data", c => logs.push(c)); server.stderr.on("data", c => logs.push(c));
    await ready("http://127.0.0.1:8990/api/me");
    run(`tests/shared/${script}.mjs`, [], { INVENTORY_TEST_ORIGIN: "http://127.0.0.1:8990" });
    server.kill("SIGTERM");
    await new Promise(r => server.once("exit", r));
    server = null;
  }
  writeFileSync(join(root, "worker.log"), Buffer.concat(logs));
  server = null;
  run("tests/shared/migration-service.mjs");
  run("tests/shared/operations.mjs");
  run("tests/shared/package-security.mjs");
  server = spawn(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "pages", "dev", "dist", "--port", "8991", "--ip", "127.0.0.1", "--inspector-port", "9431", "--persist-to", ".wrangler/pages-test-state", "--d1", "DB=00000000-0000-0000-0000-000000000001", "--binding", "APP_ENV=production", "--binding", "APP_ORIGIN=https://127.0.0.1:8991", "--binding", "ACTIVE_CYCLE_ID=prueba-compartida", "--local-protocol", "https"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  const pagesLogs = [];
  server.stdout.on("data", c => pagesLogs.push(c)); server.stderr.on("data", c => pagesLogs.push(c));
  // Playwright uses ignoreHTTPSErrors only in its isolated local context.
  await new Promise(r => setTimeout(r, 4000));
  run("tests/shared/pages.mjs", [], { INVENTORY_PAGES_ORIGIN: "https://127.0.0.1:8991" });
  server.kill("SIGTERM");
  await new Promise(r => server.once("exit", r));
  writeFileSync(join(root, "pages.log"), Buffer.concat(pagesLogs));
  server = null;
} finally {
  server?.kill("SIGTERM");
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(root, "security-runs.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.runs.some(r => !r.passed)) process.exitCode = 1;
}
