import { parseArgs } from "node:util";
import { mkdirSync, writeFileSync, readFileSync, chmodSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import {
  localDatabase,
  wrangler,
  digest,
  privateDestination,
} from "./operations/storage.mjs";
const { values: v } = parseArgs({
  options: {
    local: { type: "boolean" },
    remote: { type: "boolean" },
    directory: { type: "string" },
    state: { type: "string" },
    config: { type: "string" },
  },
});
if (
  !!v.local === !!v.remote ||
  !v.directory ||
  (v.remote && (!v.config || v.state))
)
  throw Error(
    "Usa --local --directory NUEVA_CARPETA [--state RUTA], o --remote --config CONFIG --directory NUEVA_CARPETA.",
  );
const directory = privateDestination(v.directory, ".backups");
mkdirSync(dirname(directory), { recursive: true });
mkdirSync(directory, { mode: 0o700 }); // Never overwrite an earlier backup.
const output = join(directory, "database.sql");
writeFileSync(output, "", { flag: "wx", mode: 0o600 });
let db;
try {
  db = v.local
    ? localDatabase(v.state || ".wrangler/state")
    : { args: ["--remote", "--config", resolve(v.config)], close() {} };
  // Remote export may briefly block D1. It is only run when the operator invokes
  // this explicit command; no build, request handler or scheduler calls it.
  if (v.remote)
    console.log(
      "Exportando la D1 seleccionada: durante la exportación pueden pausarse las consultas.",
    );
  wrangler([
    "export",
    "DB",
    ...db.args,
    ...(v.remote ? ["--skip-confirmation"] : []),
    "--output",
    output,
  ]);
  chmodSync(output, 0o600);
  const bytes = readFileSync(output);
  if (!bytes.length)
    throw Error("No se generó SQL; no hay un respaldo válido.");
  writeFileSync(
    join(directory, "manifest.json"),
    JSON.stringify(
      {
        format: 1,
        createdAt: new Date().toISOString(),
        source: v.local ? "local" : "remote",
        bytes: bytes.length,
        sha256: digest(bytes),
      },
      null,
      2,
    ) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    `Respaldo privado preparado: ${directory}. Verifica su restauración antes de confiar en él.`,
  );
} finally {
  db?.close();
}
