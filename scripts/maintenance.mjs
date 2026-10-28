import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { localDatabase, wrangler } from './operations/storage.mjs';
import { reportSQL, cleanupSQL } from './operations/retention.mjs';
const { values: v } = parseArgs({
  options: {
    local: { type: 'boolean' },
    remote: { type: 'boolean' },
    apply: { type: 'boolean' },
    state: { type: 'string' },
    config: { type: 'string' },
  },
});
if (!!v.local === !!v.remote || (v.remote && (!v.config || v.state)))
  throw Error(
    'Selecciona --local [--state RUTA] o --remote --config CONFIG. Sin --apply solo se consulta.',
  );
const db = v.local
  ? localDatabase(v.state || '.wrangler/state')
  : { args: ['--remote', '--config', resolve(v.config)], close() {} };
try {
  const output = wrangler([
    'execute',
    'DB',
    ...db.args,
    '--json',
    '--command',
    v.apply ? cleanupSQL + '\n' + reportSQL : reportSQL,
  ]);
  const parsed = JSON.parse(output);
  console.log(
    JSON.stringify(
      {
        mode: v.apply ? 'cleanup' : 'read-only',
        remaining: parsed.at(-1)?.results?.[0],
      },
      null,
      2,
    ),
  );
} finally {
  db.close();
}
