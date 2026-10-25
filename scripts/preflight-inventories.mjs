// Read-only deployment verification for inventory lifecycle0008 + aggregates0009.
// It never applies migrations, creates cycles, or modifies application records.
import { parseArgs } from 'node:util';
import { localDatabase, wrangler } from './operations/storage.mjs';
import { readinessSQL } from '../worker/readiness.js';
import { cycleSchemaSQL } from '../worker/inventory-cycles.js';
const {values:v}=parseArgs({options:{local:{type:'boolean'},remote:{type:'boolean'},state:{type:'string'},config:{type:'string'},cycle:{type:'string'},catalog:{type:'string'}}});
if(!!v.local===!!v.remote||!v.cycle||!/^[-a-zA-Z0-9_]{1,150}$/.test(v.cycle)||(v.remote&&(!v.config||v.state))||(v.catalog&&!/^[-a-zA-Z0-9_]{1,150}$/.test(v.catalog)))
 throw Error('Use --local --state STATE --cycle ID [--catalog VERSION], or explicitly --remote --config CONFIG --cycle ID [--catalog VERSION]. Read-only.');
const requiredColumns={
 cycles:['id','name','catalog_version','state','revision','type','period','lifecycle','created_at','activated_at','deleted_at'],
 inventory_cycle_commands:['id','fingerprint','user_id','session_hash','user_revision','kind','cycle_id','expected_revision','name','type','period','catalog_version','activate','confirm_warnings','confirmation_revision','confirmed_delete','result','created_at'],
 cycle_registry:['id','revision'],
 supervision_commands:['expected_activity_revision','confirm_warnings','confirmation_revision'],
 usage_daily:['day','route','method','status_class','requests','elapsed_ms','slow_requests'],
};
const literals=values=>values.map(value=>`'${value}'`).join(',');
const schemaChecks=Object.entries(requiredColumns).map(([table,columns])=>`AND (SELECT count(*) FROM pragma_table_info('${table}') WHERE name IN(${literals(columns)}))=${columns.length}`).join('\n');
const sql=readinessSQL.replace('?',`'${v.cycle}'`)+cycleSchemaSQL+`\n${schemaChecks}
 AND EXISTS(SELECT 1 FROM sqlite_schema WHERE type='trigger' AND name='apply_inventory_cycle' AND instr(sql,'name=CASE WHEN')>0)
 AND EXISTS(SELECT 1 FROM cycle_registry WHERE id=1 AND revision>=1)
 AND EXISTS(SELECT 1 FROM sqlite_schema WHERE type='table' AND name='usage_daily')
 AND (SELECT count(*) FROM pragma_table_info('usage_daily') WHERE pk>0 AND name IN('day','route','method','status_class'))=4
 ${v.catalog?`AND c.catalog_version='${v.catalog}'`:''}`;
const runtime=v.local?localDatabase(v.state||'.wrangler/state'):{args:['--remote','--config',v.config],close(){}};
try {
 const results=JSON.parse(wrangler(['execute','DB',...runtime.args,'--command',sql,'--json']));
 if(!results.some(result=>result.results?.some(row=>row.ready===1)))throw Error('Inventory0008/metrics0009 schema, configured cycle, catalog or admin contract missing. Do not publish. No data was changed.');
 console.log(JSON.stringify({ready:true,readOnly:true,environment:v.local?'local':'remote',cycle:v.cycle,...(v.catalog?{catalog:v.catalog}:{}),schemaContract:'inventory-cycles-0008+usage-daily-0009+opening-date-0010',lifecycleTriggers:11,metricsCollectionVerified:false,note:'Checks schema availability only. Metrics collection still requires METRICS_ENABLED=1. Verify effective bindings, origin and environment separately.'}));
}finally{runtime.close();}
