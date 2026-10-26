import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
let commit=process.env.CF_PAGES_COMMIT_SHA;
if(!commit)try{commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
export const appVersion=(/^[a-f0-9]{7,40}$/.test(commit||'')?commit.slice(0,12):'local')+'.'+new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14);
import { mkdir, rm, cp } from "node:fs/promises";
import { lstatSync } from "node:fs";
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
// Explicit public allowlist: no sources, workbooks, docs, server or full catalog.
for (const path of [
  "index.html",
  "theme.css",
  "theme.js",
  "shared",
  "pages/inventario",
  "pages/cuenta",
  "pages/admin",
])
  await cp(path, `dist/${path}`, {
    recursive: true,
    filter: (source) => !source.split(/[\\/]/).some(p => p.startsWith(".")) &&
      !lstatSync(source).isSymbolicLink() &&
      (lstatSync(source).isDirectory() || /\.(?:html|css|js)$/.test(source)),
  });

await writeFile('dist/shared/telemetry-config.js',`export const APP_VERSION=${JSON.stringify(appVersion)};\nexport const CLIENT_METRICS_ENABLED=true;\n`);
await build({entryPoints:['shared/telemetry-client.js'],outfile:'dist/shared/telemetry-client.js',bundle:true,format:'esm',target:'es2022',external:['./telemetry-config.js'],legalComments:'eof'});
