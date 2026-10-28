import { parseArgs } from 'node:util';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const { values: v } = parseArgs({
  options: {
    origin: { type: 'string', default: 'https://inventario-login.pages.dev' },
    local: { type: 'boolean' },
  },
});
const origin = new URL(v.origin);
if (
  origin.username ||
  origin.password ||
  origin.search ||
  origin.hash ||
  origin.pathname !== '/' ||
  (!v.local && origin.protocol !== 'https:') ||
  (v.local && !['127.0.0.1', 'localhost'].includes(origin.hostname))
)
  throw Error('Se requiere un origen HTTPS sin credenciales; --local permite únicamente loopback.');
const paths = [
  ['/', 200, 'home-loading'],
  ['/pages/cuenta/', 200, 'loading-account'],
  ['/shared/loading.js', 200, 'export function loading'],
  ...[
    '/api/me',
    '/api/bootstrap',
    '/api/navigation',
    '/api/sync?cursor=0',
    '/api/summary',
    '/api/history',
  ].map((p) => [p, 401, 'SESSION_REQUIRED']),
  ...[
    '/data/inventario/items/catalogo-excel.js',
    '/migrations/0001_core.sql',
    '/scripts/bootstrap.mjs',
    '/_worker.js',
    '/inventarios_og/11_10-INVENTARIO-totalizado.xlsx',
    '/.backups/',
    '/sources/',
  ].map((p) => [p, 404, 'NOT_FOUND']),
];
const directory = mkdtempSync(join(tmpdir(), 'inventory-public-read-')),
  checks = [];
try {
  for (const [path, status, marker] of paths) {
    const body = join(directory, 'body'),
      headers = join(directory, 'headers');
    const result = execFileSync(
      'curl',
      [
        '--silent',
        '--show-error',
        '--max-time',
        '20',
        '--dump-header',
        headers,
        '--output',
        body,
        '--write-out',
        '%{http_code}',
        origin.origin + path,
      ],
      { encoding: 'utf8' },
    );
    const h = readFileSync(headers, 'utf8').toLowerCase(),
      text = readFileSync(body, 'utf8');
    checks.push({
      path,
      status: Number(result),
      expected: status,
      passed: Number(result) === status && text.includes(marker),
      securityHeaders:
        h.includes('x-content-type-options: nosniff') &&
        h.includes('x-frame-options: deny') &&
        h.includes("frame-ancestors 'none'"),
      ...(path.startsWith('/api/')
        ? {
            json: h.includes('content-type: application/json'),
            noStore: h.includes('cache-control: no-store'),
          }
        : {}),
    });
  }
  const report = {
    origin: origin.origin,
    authenticated: false,
    mutatingRequests: 0,
    checks,
    routingPassed: checks.every((c) => c.passed && c.json !== false && c.noStore !== false),
    securityHeadersPassed: checks.every((c) => c.securityHeaders),
  };
  report.passed = report.routingPassed && report.securityHeadersPassed;
  writeFileSync(
    v.local ? 'docs/publico-local-3a.json' : 'docs/publico-3a.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
} finally {
  rmSync(directory, { recursive: true, force: true });
}
