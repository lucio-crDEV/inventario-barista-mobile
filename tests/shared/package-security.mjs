import assert from 'node:assert/strict';
import { writeFileSync, symlinkSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const files = [
  'shared/.private-test',
  'shared/secret-test.sql',
  'shared/source-test.js.map',
  'shared/unexpected-test.txt',
  'shared/link-test.js',
];
try {
  for (const file of files.slice(0, -1)) writeFileSync(file, 'INTERNAL-PACKAGE-SENTINEL');
  symlinkSync('../worker/password.js', files.at(-1));
  execFileSync(process.execPath, ['scripts/build-pages.mjs'], { stdio: 'pipe' });
  const output = readdirSync('dist', { recursive: true });
  assert.ok(
    !output.some((p) =>
      /(?:private-test|secret-test|source-test|unexpected-test|link-test|\.DS_Store|\.map$)/.test(
        p,
      ),
    ),
  );
  for (const path of output.filter((p) => /\.(?:js|html|css)$/.test(p)))
    assert.ok(!readFileSync(`dist/${path}`, 'utf8').includes('INTERNAL-PACKAGE-SENTINEL'));
  assert.ok(output.includes('_worker.js'));
  assert.ok(output.includes('_routes.json'));
  const routes = JSON.parse(readFileSync('dist/_routes.json', 'utf8'));
  assert.deepEqual(routes.include, ['/*']);
  assert.ok(routes.exclude.length > 0 && routes.exclude.length + 1 <= 100);
  assert.deepEqual(routes.exclude, ['/assets/*', '/offline-shells/*', '/service-worker.js']);
  assert.ok(output.includes('service-worker.js'));
  for (const path of output.filter((p) => p.startsWith('offline-shells/')))
    assert.match(path, /^offline-shells\/[a-z-]+-[a-f0-9]{16}\.html$/);
  for (const path of output.filter((p) => p.startsWith('assets/')))
    assert.match(path, /^assets\/[\w.-]+-[A-Z0-9]{8}\.(?:js|css)$/);
  for (const path of ['/api/me', '/pages/admin/', '/index.html', '/_worker.js', '/worker/index.js'])
    assert.ok(!routes.exclude.includes(path));
  const headers = readFileSync('dist/_headers', 'utf8');
  assert.ok(headers.includes('nosniff'));
  assert.ok(headers.includes('must-revalidate'));
  console.log(
    'PASS package allowlist and hashed public asset bypass; APIs/HTML/unknown paths still use Worker; static security/cache headers present',
  );
} finally {
  for (const file of files) unlinkSync(file);
}
