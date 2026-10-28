import { parseArgs } from 'node:util';
import { mkdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  localDatabase,
  verifiedBackup,
  wrangler,
  privateDestination,
} from './operations/storage.mjs';
const { values: v } = parseArgs({
  options: { directory: { type: 'string' }, state: { type: 'string' } },
});
if (!v.directory || !v.state)
  throw Error(
    'Usa --directory RESPALDO --state NUEVA_CARPETA_LOCAL. Este comando nunca restaura una base remota.',
  );
const { sql } = verifiedBackup(v.directory),
  state = privateDestination(v.state, '.wrangler');
if (existsSync(state))
  throw Error('El destino debe ser nuevo. No se sobrescribe ninguna base existente.');
mkdirSync(dirname(state), { recursive: true });
mkdirSync(state, { mode: 0o700 });
const db = localDatabase(state);
const temporary = mkdtempSync(join(tmpdir(), 'inventory-restore-sql-'));
try {
  const ordered = join(temporary, 'ordered.sql');
  // Parse only; never execute the source SQL in Python or alter the backup/hash.
  execFileSync('python3', [resolve('scripts/operations/order-restore.py'), sql, ordered], {
    stdio: 'pipe',
  });
  wrangler(['execute', 'DB', ...db.args, '--file', ordered]);
  // Recovery must never revive a session that was revoked after the snapshot.
  wrangler([
    'execute',
    'DB',
    ...db.args,
    '--command',
    "DELETE FROM sessions; INSERT INTO admin_audit(actor,target,action,detail) VALUES('offline-restore','database','restore','{\"sessionsRevoked\":true}');",
  ]);
  console.log(
    `Restauración local completada, sesiones revocadas: ${state}. Verifica integridad y permisos antes de usarla.`,
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
  db.close();
}
