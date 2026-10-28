import { appVersion } from './build.mjs';
import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
// Pages advanced mode runs the same authorization and atomic D1 implementation.
await build({
  entryPoints: ['worker/index.js'],
  outfile: 'dist/_worker.js',
  bundle: true,
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  legalComments: 'eof',
});
// Only the directory produced by the browser bundler bypasses the API Worker.
// HTML, unknown paths, private sources and APIs retain routing/security guards.
await writeFile('dist/_routes.json', JSON.stringify({ version: 1, include: ['/*'], exclude: ['/assets/*'] }, null, 2) + '\n');
console.log('Pages: Worker preparado; /assets/* se sirve sin invocarlo.');
