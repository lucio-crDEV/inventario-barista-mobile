// Isolated local measurement. This does not measure Cloudflare CPU or start a server.
import { readFile } from 'node:fs/promises';
import { excelTemplate } from '../../data/inventario/export-template.js';
import { generateExcel } from '../../worker/excel-generator.js';
import { readZip, inflateEntry } from '../../worker/excel-zip.js';
const templateBytes = new Uint8Array(await readFile(new URL('../../' + excelTemplate.path, import.meta.url)));
const cells = Object.entries(excelTemplate.sheets).flatMap(([sheet, refs]) => refs.map((cell, index) => ({ sheet, cell, value: index % 3 === 0 ? null : index % 3 === 1 ? '0' : '12.345' })));
const started = performance.now(), cpu = process.cpuUsage();
const result = await generateExcel({ templateBytes, cells });
const used = process.cpuUsage(cpu);
console.log(JSON.stringify({ runtime: process.version, measurement: 'local Node process; not Cloudflare CPU',
  wallMs: Math.round((performance.now() - started) * 100) / 100,
  processCpuMs: Math.round((used.user + used.system) / 10) / 100,
  maxRssMiB: Math.round(process.resourceUsage().maxRSS / 1024 * 100) / 100,
  templateBytes: templateBytes.length, outputBytes: result.bytes.length,
  stockDestinations: cells.length, changedStockCells: result.changedStockCells,
  sha256: result.sha256, recalculateOnOpen: result.recalculateOnOpen }));

// The installed runtime runs this test and exits; no listener, binding to a remote
// service, persistent state, or outbound network request is involved.
const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
const { tmpdir } = await import('node:os');
const { join, resolve } = await import('node:path');
const { fileURLToPath } = await import('node:url');
const { spawnSync } = await import('node:child_process');
const { build } = await import('esbuild');
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const runtimeDir = await mkdtemp(join(tmpdir(), 'excel-generator-workerd-'));
const expectedParts = {};
for (const recalculate of [false, true]) {
  const generated = recalculate ? await generateExcel({ templateBytes, cells, recalculate }) : result;
  expectedParts[recalculate] = {};
  for (const entry of readZip(generated.bytes).entries) {
    expectedParts[recalculate][entry.name] = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await inflateEntry(entry))), byte => byte.toString(16).padStart(2, '0')).join('');
  }
}
try {
  const entry = `import { readZip, inflateEntry } from ${JSON.stringify(resolve(projectRoot, 'worker/excel-zip.js'))};
import { generateExcel } from ${JSON.stringify(resolve(projectRoot, 'worker/excel-generator.js'))};
import { excelTemplate } from ${JSON.stringify(resolve(projectRoot, 'data/inventario/export-template.js'))};
export default { async test(ctrl, env) {
  const cells = Object.entries(excelTemplate.sheets).flatMap(([sheet, refs]) => refs.map((cell, index) => ({ sheet, cell, value: index % 3 === 0 ? null : index % 3 === 1 ? '0' : '12.345' })));
  for (const recalculate of [false, true]) {
    const result = await generateExcel({ templateBytes: env.TEMPLATE, cells, recalculate });
    if (!(result.bytes instanceof Uint8Array) || result.bytes[0] !== 80 || result.bytes[1] !== 75 || result.recalculateOnOpen !== recalculate || result.templateSha256 !== excelTemplate.sha256 || result.sha256.length !== 64 || cells.length !== 1151) throw new Error('WORKERD_EXCEL_RESULT');
    const expected = ${JSON.stringify(expectedParts)}[recalculate];
    for (const part of readZip(result.bytes).entries) {
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await inflateEntry(part))), byte => byte.toString(16).padStart(2, '0')).join('');
      if (digest !== expected[part.name]) throw new Error('WORKERD_NODE_PART_DIFFERENCE: ' + part.name);
    }
    console.log(JSON.stringify({ runtime: 'isolated local workerd test', recalculate, outputBytes: result.bytes.length, changedStockCells: result.changedStockCells, sha256: result.sha256 }));
  }
} };`;
  await build({ stdin: { contents: entry, resolveDir: projectRoot, sourcefile: 'excel-runtime-test.mjs' }, bundle: true,
    format: 'esm', platform: 'browser', target: 'es2022', outfile: join(runtimeDir, 'worker.mjs') });
  await writeFile(join(runtimeDir, 'template.xlsx'), templateBytes);
  await writeFile(join(runtimeDir, 'config.capnp'), `using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (services = [(name = "excel", worker = (
 compatibilityDate = "2026-10-01",
 modules = [(name = "worker.mjs", esModule = embed "worker.mjs")],
 bindings = [(name = "TEMPLATE", data = embed "template.xlsx")]
))]);`);
  const runtime = spawnSync(resolve(projectRoot, 'node_modules/workerd/bin/workerd'), ['test', '-I', resolve(projectRoot, 'node_modules'), join(runtimeDir, 'config.capnp')],
    { cwd: projectRoot, encoding: 'utf8', timeout: 30000 });
  if (runtime.stdout) process.stdout.write(runtime.stdout);
  if (runtime.stderr) process.stderr.write(runtime.stderr);
  if (runtime.status !== 0) throw new Error('Isolated workerd Excel test failed: ' + (runtime.error?.message || runtime.status));
} finally { await rm(runtimeDir, { recursive: true, force: true }); }
