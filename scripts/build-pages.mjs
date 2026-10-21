import "./build.mjs";
import { build } from "esbuild";
import { writeFile } from "node:fs/promises";
// Pages advanced mode runs the same authorization and atomic D1 implementation.
await build({
  entryPoints: ["worker/index.js"],
  outfile: "dist/_worker.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  legalComments: "eof",
});
await writeFile(
  "dist/_routes.json",
  JSON.stringify({ version: 1, include: ["/*"], exclude: [] }, null, 2) + "\n",
);
console.log(
  "Pages: dist/_worker.js preparado; todas las rutas pasan por autorización.",
);
