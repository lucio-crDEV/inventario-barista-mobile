import {readinessSQL,fastReadinessSQL} from './readiness.js';
import {cyclesEnabled,cycleSchemaSQL} from './inventory-cycles.js';
const legacyUntil=new WeakMap();
export const runtimeSchemaSQL=`SELECT group_concat(type||':'||name||':'||coalesce(sql,''),'|') FROM (SELECT type,name,sql FROM sqlite_schema WHERE substr(name,1,4)!='_cf_' AND substr(name,1,7)!='sqlite_' ORDER BY type,name)`;
export const runtimeReadinessSQL=`SELECT 1 ready,1 modern,c.version catalog_version,r.users_metadata_revision
 FROM runtime_contract r
 JOIN catalog_integrity c ON c.version=coalesce(nullif(?1,''),(SELECT catalog_version FROM cycles WHERE id=?2),r.catalog_version)
 WHERE r.id=1 AND r.schema_signature=(${runtimeSchemaSQL}) AND c.expected_count>0 AND c.row_count=c.expected_count
 AND c.expected_count=CASE c.version WHEN 'inventory-v2-2026-10-21' THEN 1227 WHEN 'inventory-v3-2026-10-22' THEN 1268 ELSE 0 END
 AND EXISTS(SELECT 1 FROM users WHERE role='admin' AND active=1 AND deleted_at IS NULL)`;
export async function deploymentState(db,env,identity=db,path='/api/me') {
 if((legacyUntil.get(identity)||0)<=Date.now()) {
  try {
   const row=await db.prepare(runtimeReadinessSQL).bind(env.ACTIVE_CATALOG_VERSION||'',env.ACTIVE_CYCLE_ID||'').first();
   if(!row)throw Object.assign(Error('Deployment contract not ready'),{status:503,code:'NOT_INITIALIZED'});
   return {modern:true,catalogVersion:row.catalog_version,metadataRevision:row.users_metadata_revision,fast:true};
  } catch(error) {
   if(!/no such table: (?:runtime_contract|catalog_integrity)/i.test(error.message))throw error;
   // Older fixtures/installations remain compatible, but never cache identity,
   // readiness or permissions. Retry discovery after a bounded migration window.
   legacyUntil.set(identity,Date.now()+60000);
  }
 }
 const modern=await cyclesEnabled(db);
 const catalogVersion=modern?(env.ACTIVE_CATALOG_VERSION||(env.ACTIVE_CYCLE_ID?(await db.prepare('SELECT catalog_version FROM cycles WHERE id=?').bind(env.ACTIVE_CYCLE_ID).first())?.catalog_version:null)||(await db.prepare("SELECT version FROM catalog_items WHERE version IN ('inventory-v3-2026-10-22','inventory-v2-2026-10-21') ORDER BY version DESC LIMIT 1").first())?.version):null;
 let sql=['/api/login','/api/me','/api/status','/api/bootstrap'].includes(path)?readinessSQL:fastReadinessSQL;
 if(modern)sql=sql.replace('FROM cycles c WHERE c.id=?','FROM (SELECT ? catalog_version) c WHERE 1=1')+cycleSchemaSQL;
 const ready=await db.prepare(sql).bind(modern?catalogVersion:(env.ACTIVE_CYCLE_ID||'')).first();
 if(!ready)throw Object.assign(Error('Deployment contract not ready'),{status:503,code:'NOT_INITIALIZED'});
 return {modern,catalogVersion,metadataRevision:0,fast:false};
}
