import { mkdir, rm, cp } from "node:fs/promises";
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
  await cp(path, `dist/${path}`, { recursive: true });
