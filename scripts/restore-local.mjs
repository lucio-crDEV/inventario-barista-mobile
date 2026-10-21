import { parseArgs } from "node:util";
import { mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import {
  localDatabase,
  verifiedBackup,
  wrangler,
  privateDestination,
} from "./operations/storage.mjs";
const { values: v } = parseArgs({
  options: { directory: { type: "string" }, state: { type: "string" } },
});
if (!v.directory || !v.state)
  throw Error(
    "Usa --directory RESPALDO --state NUEVA_CARPETA_LOCAL. Este comando nunca restaura una base remota.",
  );
const { sql } = verifiedBackup(v.directory),
  state = privateDestination(v.state, ".wrangler");
if (existsSync(state))
  throw Error(
    "El destino debe ser nuevo. No se sobrescribe ninguna base existente.",
  );
mkdirSync(dirname(state), { recursive: true });
mkdirSync(state, { mode: 0o700 });
const db = localDatabase(state);
try {
  wrangler(["execute", "DB", ...db.args, "--file", sql]);
  // Recovery must never revive a session that was revoked after the snapshot.
  wrangler([
    "execute",
    "DB",
    ...db.args,
    "--command",
    "DELETE FROM sessions; INSERT INTO admin_audit(actor,target,action,detail) VALUES('offline-restore','database','restore','{\"sessionsRevoked\":true}');",
  ]);
  console.log(
    `Restauración local completada, sesiones revocadas: ${state}. Verifica integridad y permisos antes de usarla.`,
  );
} finally {
  db.close();
}
