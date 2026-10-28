import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdir, rm, readFile, writeFile, realpath, lstat } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';

let commit = process.env.CF_PAGES_COMMIT_SHA;
if (!commit)
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {}
export const appVersion =
  (/^[a-f0-9]{7,40}$/.test(commit || '') ? commit.slice(0, 12) : 'local') +
  '.' +
  new Date()
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14);

const root = resolve('.');
const require = createRequire(import.meta.url);
const vitalsRoot = await realpath(resolve(dirname(require.resolve('web-vitals')), '..'));
const pages = [
  ['home', 'index.html'],
  ['inventory', 'pages/inventario/index.html'],
  ['account', 'pages/cuenta/index.html'],
  ['admin', 'pages/admin/index.html'],
  ['supervision', 'pages/admin/supervision.html'],
];
// Explicit public source allowlist. A new import cannot silently publish a private
// catalog, workbook, server module or synced reference, even through a symlink.
async function publicSource(path) {
  const local = relative(root, path).split(sep).join('/');
  if (
    !/^(?:theme\.(?:js|css)|shared\/[\w.-]+\.(?:js|css)|pages\/(?:inventario|cuenta|admin)\/[\w.-]+\.(?:html|js|css)|index\.html)$/.test(
      local,
    )
  )
    throw Error(`Source outside public allowlist: ${local}`);
  let current = root;
  for (const part of local.split('/')) {
    current = resolve(current, part);
    if ((await lstat(current)).isSymbolicLink()) throw Error(`Public source symlink: ${local}`);
  }
}
function sourceURL(url, html) {
  if (/^(?:[a-z]+:|\/\/)/i.test(url) || /[?#]/.test(url))
    throw Error(`Unsupported public asset URL: ${url}`);
  return url.startsWith('/') ? resolve(root, '.' + url) : resolve(dirname(resolve(html)), url);
}
const documents = [];
const entryPoints = { theme: 'theme.js' };
for (const [name, path] of pages) {
  await publicSource(resolve(path));
  const html = await readFile(path, 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi)];
  const styles = [
    ...html.matchAll(
      /<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*\bhref=["']([^"']+)["'][^>]*>/gi,
    ),
  ];
  const module = scripts.find((match) => /\btype=["']module["']/.test(match[0]));
  if (
    scripts.length !== 2 ||
    !module ||
    scripts.some(
      (match) => match !== module && sourceURL(match[1], path) !== resolve('theme.js'),
    ) ||
    !styles.length
  )
    throw Error(`Review public page entries: ${path}`);
  entryPoints[name] = sourceURL(module[1], path);
  entryPoints[`${name}-styles`] = `page-css:${name}`;
  documents.push({ name, path, html, scripts, styles, module });
}
const result = await build({
  entryPoints,
  outdir: 'dist/assets',
  entryNames: '[name]-[hash]',
  chunkNames: 'shared-[hash]',
  bundle: true,
  splitting: true,
  minify: true,
  format: 'esm',
  target: 'es2022',
  legalComments: 'none',
  metafile: true,
  write: false,
  plugins: [
    {
      name: 'public-sources',
      setup(builder) {
        builder.onResolve({ filter: /^page-css:/ }, (args) => ({
          path: args.path.slice(9),
          namespace: 'page-css',
        }));
        builder.onLoad({ filter: /.*/, namespace: 'page-css' }, (args) => {
          const page = documents.find((page) => page.name === args.path);
          return {
            contents: page.styles
              .map(
                (match) =>
                  `@import ${JSON.stringify('/' + relative(root, sourceURL(match[1], page.path)).split(sep).join('/'))};`,
              )
              .join('\n'),
            loader: 'css',
            resolveDir: root,
          };
        });
        builder.onResolve({ filter: /^\// }, (args) => ({
          path: args.kind === 'entry-point' ? args.path : resolve(root, '.' + args.path),
        }));
        builder.onResolve({ filter: /^\.\/telemetry-config\.js$/ }, (args) =>
          args.importer === resolve('shared/telemetry-client.js')
            ? { path: resolve('shared/telemetry-config.js') }
            : undefined,
        );
        builder.onLoad({ filter: /.*/, namespace: 'file' }, async (args) => {
          if (args.path === resolve('shared/telemetry-config.js'))
            return {
              contents: `export const APP_VERSION=${JSON.stringify(appVersion)};\nexport const CLIENT_METRICS_ENABLED=true;\n`,
              loader: 'js',
            };
          const actual = await realpath(args.path);
          // Only the existing measurement dependency may enter the browser bundle.
          if (actual.startsWith(vitalsRoot + sep)) return;
          await publicSource(args.path);
        });
      },
    },
  ],
});
const outputs = result.metafile.outputs;
function entryOutput(entry) {
  const output = Object.keys(outputs).find((path) => outputs[path].entryPoint === entry);
  if (!output) throw Error(`Missing bundled entry: ${entry}`);
  return output;
}
const themeOutput = entryOutput('theme.js');
if (outputs[themeOutput].imports.length || outputs[themeOutput].exports.length)
  throw Error('Theme bootstrap must remain a standalone classic script.');
function importsFor(path, found = new Set()) {
  for (const imported of outputs[path].imports) {
    if (imported.external) throw Error(`External public import: ${imported.path}`);
    if (imported.kind === 'import-statement' && !found.has(imported.path)) {
      found.add(imported.path);
      importsFor(imported.path, found);
    }
  }
  return [...found].sort();
}
await rm('dist', { recursive: true, force: true });
await mkdir('dist/assets', { recursive: true });
for (const file of result.outputFiles) await writeFile(file.path, file.contents);
const publicURL = (path) => '/' + relative('dist', path).split(sep).join('/');
for (const page of documents) {
  const script = entryOutput(relative(root, entryPoints[page.name]).split(sep).join('/'));
  const css = entryOutput(`page-css:${page.name}`);
  let html = page.html;
  for (const match of page.scripts)
    html = html.replace(
      match[0],
      match === page.module
        ? `<script type="module" src="${publicURL(script)}"></script>`
        : // Keep the classic, parser-blocking theme bootstrap before CSS to avoid a flash.
          `<script src="${publicURL(entryOutput('theme.js'))}"></script>`,
    );
  for (const [index, match] of page.styles.entries())
    html = html.replace(match[0], index ? '' : `<link rel="stylesheet" href="${publicURL(css)}">`);
  const preload = importsFor(script)
    .map((path) => `  <link rel="modulepreload" href="${publicURL(path)}">`)
    .join('\n');
  html = html.replace(/<\/head>/i, `${preload}\n</head>`);
  await mkdir(dirname(`dist/${page.path}`), { recursive: true });
  await writeFile(`dist/${page.path}`, html);
}
// Both Workers static assets and Pages honor this file. Only content-hashed files
// receive immutable caching; HTML is revalidated and still passes authorization.
await writeFile(
  'dist/_headers',
  `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: same-origin
  X-Frame-Options: DENY
  Cache-Control: public, max-age=0, must-revalidate
/assets/*
  Cache-Control: public, max-age=31536000, immutable
`,
);
console.log(
  `Browser: ${result.outputFiles.length} recursos minificados con hash; 5 páginas empaquetadas.`,
);
