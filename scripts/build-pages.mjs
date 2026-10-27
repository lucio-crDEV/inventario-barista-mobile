import { appVersion } from "./build.mjs";
import { build } from "esbuild";
import { writeFile, readdir } from "node:fs/promises";
// Pages advanced mode runs the same authorization and atomic D1 implementation.
await build({
  entryPoints: ["worker/index.js"],
  outfile: "dist/_worker.js",
  bundle: true,
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  format: "esm",
  platform: "browser",
  target: "es2022",
  legalComments: "eof",
});
// Only exact, explicitly packaged JS/CSS assets bypass the API Worker. HTML,
// unknown paths and all APIs remain behind the existing routing/security guards.
const publicAssets=(await readdir('dist',{recursive:true})).filter(path=>/\.(?:js|css)$/.test(path)&&path!=='_worker.js').map(path=>'/'+path).sort();
if(publicAssets.length+1>100)throw Error('Pages route rule limit exceeded; review public asset packaging before publishing.');
await writeFile('dist/_routes.json',JSON.stringify({version:1,include:['/*'],exclude:publicAssets},null,2)+'\n');
await writeFile('dist/_headers',`/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: same-origin
  X-Frame-Options: DENY
  Cache-Control: public, max-age=0, must-revalidate
`);
console.log(`Pages: Worker preparado; ${publicAssets.length} recursos públicos exactos se sirven sin invocarlo.`);
