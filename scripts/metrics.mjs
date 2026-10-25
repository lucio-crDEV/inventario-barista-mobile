// Operator-only aggregate export. No HTTP endpoint or additional app role.
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { localDatabase, wrangler } from './operations/storage.mjs';
const { values: v } = parseArgs({ options: { local: {type:'boolean'}, remote: {type:'boolean'}, state:{type:'string'}, config:{type:'string'} } });
if (!!v.local === !!v.remote || (v.remote && (!v.config || v.state))) throw Error('Selecciona --local [--state RUTA] o --remote --config CONFIG. Solo lectura.');
const db = v.local ? localDatabase(v.state || '.wrangler/state') : {args:['--remote','--config',resolve(v.config)], close(){}};
try {
 console.log(wrangler(['execute','DB',...db.args,'--json','--command',`SELECT day,route,method,status_class,requests,ROUND(1.0*elapsed_ms/requests,1) mean_wall_ms,slow_requests FROM usage_daily WHERE day >= date('now','-90 days') ORDER BY day DESC,requests DESC;`]));
} finally { db.close(); }
