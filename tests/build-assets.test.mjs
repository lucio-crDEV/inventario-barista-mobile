import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

// Build an isolated fixture; tests never replace the developer's dist or sources.
const root = fileURLToPath(new URL('..', import.meta.url));
const fixture = await mkdtemp(join(tmpdir(), 'inventory-build-'));
after(() => rm(fixture, { recursive: true, force: true }));
for (const path of ['scripts', 'shared', 'pages/inventario', 'pages/cuenta', 'pages/admin', 'worker', 'data', 'index.html', 'theme.js', 'theme.css'])
  await cp(join(root, path), join(fixture, path), { recursive: true });
await symlink(await realpath(join(root, 'node_modules')), join(fixture, 'node_modules'));
const build = script => execFileSync(process.execPath, ['scripts/' + script], {
  cwd: fixture, env: { ...process.env, CF_PAGES_COMMIT_SHA: '0123456789abcdef' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
});
const read = path => readFile(join(fixture, path), 'utf8');
const pages = ['index.html', 'pages/inventario/index.html', 'pages/cuenta/index.html', 'pages/admin/index.html', 'pages/admin/supervision.html'];
const originalHTML = await Promise.all(pages.map(read));
build('build-pages.mjs');
const assets = await readdir(join(fixture, 'dist/assets'));

function htmlAssets(html) {
  return [...html.matchAll(/\b(?:src|href)="(\/assets\/[^" ]+)"/g)].map(match => match[1]);
}
async function moduleDependencies(path, seen = new Set()) {
  for (const match of (await read('dist' + path)).matchAll(/\b(?:from|import)\s*["'](\.[^"']+)["']/g)) {
    const dependency = new URL(match[1], 'https://test' + path).pathname;
    if (!seen.has(dependency)) { seen.add(dependency); await moduleDependencies(dependency, seen); }
  }
  return seen;
}

test('Pages packages only HTML and hashed browser assets, with constant-size routes and immutable caching', async () => {
  assert.deepEqual(JSON.parse(await read('dist/_routes.json')), { version: 1, include: ['/*'], exclude: ['/assets/*'] });
  assert.match(await read('dist/_headers'), /\/\*\n(?:[^\n]*\n)*?  Cache-Control: public, max-age=0, must-revalidate\n/);
  assert.match(await read('dist/_headers'), /\/assets\/\*\n  Cache-Control: public, max-age=31536000, immutable/);
  assert.ok(assets.length < 25);
  for (const asset of assets) assert.match(asset, /^[\w-]+-[A-Z0-9]{8}\.(?:js|css)$/);
  const all = (await readdir(join(fixture, 'dist'), { recursive: true })).filter(path => path.startsWith('assets/') || path === '_headers' || /\.[^/]+$/.test(path));
  assert.deepEqual(all.filter(path => !path.startsWith('assets/')).sort(), ['_headers', '_routes.json', '_worker.js', ...pages].sort());
  assert.ok(!all.some(path => /(?:sources|catalog|workbook|\.xlsx|\.map|migrations|docs)/i.test(path)));
  const browser = (await Promise.all(assets.map(path => read('dist/assets/' + path)))).join('\n');
  assert.ok(browser.includes('0123456789ab.'));
  assert.ok((await read('dist/_worker.js')).includes('0123456789ab.'));
  assert.ok(!browser.includes('node_modules/'));
  assert.ok(!browser.includes('sourceMappingURL'));
});

test('Each page requests one CSS and at most six JS files, preloading every shared dependency', async () => {
  for (const page of pages) {
    const html = await read('dist/' + page);
    const urls = new Set(htmlAssets(html));
    assert.equal([...urls].filter(url => url.endsWith('.css')).length, 1, page);
    assert.ok([...urls].filter(url => url.endsWith('.js')).length <= 6, page);
    assert.ok(!/\b(?:src|href)=["'](?:\.\/|\.\.\/|\/shared\/)[^"']+\.(?:js|css)/.test(html));
    for (const url of urls) assert.ok(assets.includes(url.slice('/assets/'.length)), url);
    const entry = html.match(/<script type="module" src="([^"]+)"/)[1];
    const dependencies = await moduleDependencies(entry);
    for (const dependency of dependencies) {
      assert.ok(urls.has(dependency), `${page}: preload ${dependency}`);
      assert.ok(html.includes(`<link rel="modulepreload" href="${dependency}">`));
    }
    assert.equal([...urls].filter(url => url.endsWith('.js')).length, dependencies.size + 2, page);
    assert.ok(!/@import|url\(/.test(await read('dist' + [...urls].find(url => url.endsWith('.css')))), 'no sequential CSS fetches');
  }
  assert.deepEqual(await Promise.all(pages.map(read)), originalHTML, 'native development HTML is unchanged');
});

test('Classic theme bootstrap applies saved dark mode synchronously before CSS without module dependencies', async () => {
  for (const page of pages) {
    const html = await read('dist/' + page);
    const themeTag = html.match(/<script src="(\/assets\/theme-[^"]+)"\s*><\/script>/);
    assert.ok(themeTag);
    assert.ok(html.indexOf(themeTag[0]) < html.indexOf('rel="stylesheet"'));
    const document = {
      documentElement: { dataset: {} }, querySelectorAll: () => [], querySelector: () => null, addEventListener() {},
    };
    runInNewContext(await read('dist' + themeTag[1]), { document, localStorage: { getItem: () => 'dark' }, window: { addEventListener() {} } });
    assert.equal(document.documentElement.dataset.theme, 'dark');
  }
});

test('Changed entry receives a new hash; unchanged theme and CSS retain reusable URLs in both build modes', async () => {
  const before = await read('dist/index.html');
  const home = await read('shared/home.js');
  await writeFile(join(fixture, 'shared/home.js'), home + '\nglobalThis.__build_test__="changed";\n');
  try {
    build('build.mjs');
    const html = await read('dist/index.html');
    assert.notEqual(html.match(/src="(\/assets\/home-[^"]+)"/)[1], before.match(/src="(\/assets\/home-[^"]+)"/)[1]);
    assert.equal(html.match(/src="(\/assets\/theme-[^"]+)"/)[1], before.match(/src="(\/assets\/theme-[^"]+)"/)[1]);
    assert.equal(html.match(/href="(\/assets\/home-styles-[^"]+)"/)[1], before.match(/href="(\/assets\/home-styles-[^"]+)"/)[1]);
    assert.ok(!(await readdir(join(fixture, 'dist'))).includes('_worker.js'), 'Worker dev uses source Worker and bundled static assets');
    assert.match(await read('dist/_headers'), /immutable/);
  } finally { await writeFile(join(fixture, 'shared/home.js'), home); }
});

test('Browser bundling rejects private JS, JSON and symlink imports before publishing them', async () => {
  const home = await read('shared/home.js');
  await mkdir(join(fixture, 'sources'), { recursive: true });
  await writeFile(join(fixture, 'sources/secret.js'), 'globalThis.PRIVATE_SENTINEL="never public";');
  await writeFile(join(fixture, 'sources/secret.json'), '{"private":"PRIVATE_SENTINEL"}');
  await symlink(join(fixture, 'sources/secret.js'), join(fixture, 'shared/secret.js'));
  try {
    for (const statement of [
      'import "../sources/secret.js";',
      'import secret from "../sources/secret.json";console.log(secret);',
      'import "./secret.js";',
    ]) {
      await writeFile(join(fixture, 'shared/home.js'), home + '\n' + statement);
      const result = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: fixture, encoding: 'utf8' });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Source outside public allowlist|Public source symlink/);
    }
    const existing = await readdir(join(fixture, 'dist/assets'));
    for (const path of existing) assert.ok(!(await read('dist/assets/' + path)).includes('PRIVATE_SENTINEL'));
  } finally { await writeFile(join(fixture, 'shared/home.js'), home); }
});
