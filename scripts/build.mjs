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
