// Read-only inspection of a checkpoint downloaded privately by the operator.
// No credentials, account access, public endpoint or third-party notification.
import { parseArgs } from 'node:util';
import { readFileSync, statSync } from 'node:fs';
import { isDue, INTERVAL_MS } from '../operations/backup-worker/index.js';
const { values } = parseArgs({ options: { checkpoint: { type: 'string' } } });
if (!values.checkpoint)
  throw Error(
    'Usa --checkpoint COPIA_PRIVADA_last-success.json. La ausencia de copia significa estado desconocido, nunca éxito.',
  );
if (statSync(values.checkpoint).size > 16384) throw Error('Checkpoint inválido');
const checkpoint = JSON.parse(readFileSync(values.checkpoint, 'utf8'));
const due = isDue(checkpoint);
console.log(
  JSON.stringify(
    {
      status: due ? 'due-or-stale' : 'current',
      lastSuccess: checkpoint.createdAt,
      nextDue: new Date(Date.parse(checkpoint.createdAt) + INTERVAL_MS).toISOString(),
      action: due
        ? 'Revisar ejecuciones privadas y ensayar recuperación; no se certifica una copia reciente.'
        : 'Comprobar también la última ejecución y el ensayo de recuperación.',
    },
    null,
    2,
  ),
);
process.exitCode = due ? 2 : 0;
