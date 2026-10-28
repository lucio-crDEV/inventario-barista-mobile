import { catalogCountSQL, catalogVersionsSQL } from '../shared/deployment-domain.js';
import { runtimeGuardSQL, runtimeContractVersion } from './deployment-contract.js';
import {readinessSQL,fastReadinessSQL} from './readiness.js';
import {cyclesEnabled,cycleSchemaSQL} from './inventory-cycles.js';
const legacyUntil=new WeakMap();
const legacyContractUntil=new WeakMap();
export const runtimeSchemaSQL=`SELECT group_concat(type||':'||name||':'||coalesce(sql,''),'|') FROM (SELECT type,name,sql FROM sqlite_schema WHERE substr(name,1,4)!='_cf_' AND substr(name,1,7)!='sqlite_' ORDER BY type,name)`;
export const legacyRuntimeReadinessSQL=`SELECT 1 ready,1 modern,c.version catalog_version,r.users_metadata_revision
 FROM runtime_contract r
 JOIN catalog_integrity c ON c.version=coalesce(nullif(?1,''),(SELECT catalog_version FROM cycles WHERE id=?2),r.catalog_version)
 WHERE r.id=1 AND r.schema_signature=(${runtimeSchemaSQL}) AND c.expected_count>0 AND c.row_count=c.expected_count
 AND c.expected_count=${catalogCountSQL('c.version')}
 AND EXISTS(SELECT 1 FROM users WHERE role='admin' AND active=1 AND deleted_at IS NULL)`;
// D1 rejects PRAGMA schema_version. Contract 15 uses cheap named capabilities
// every request and the exact sealed definitions in deployment preflight.
export const runtimeReadinessSQL=legacyRuntimeReadinessSQL.replace(
  `r.schema_signature=(${runtimeSchemaSQL})`, `r.contract_version=${runtimeContractVersion}`,
)+runtimeGuardSQL;
export async function deploymentState(db,env,identity=db,path='/api/me') {
 if((legacyUntil.get(identity)||0)<=Date.now()) {
  try {
   let row;
   const bindings=[env.ACTIVE_CATALOG_VERSION||'',env.ACTIVE_CYCLE_ID||''];
   if((legacyContractUntil.get(identity)||0)>Date.now()) {
    row=await db.prepare(legacyRuntimeReadinessSQL).bind(...bindings).first();
   } else {
    try { row=await db.prepare(runtimeReadinessSQL).bind(...bindings).first(); }
    catch(error) {
     if(!/no such column: (?:r\.)?contract_version\b/i.test(error.message))throw error;
     legacyContractUntil.set(identity,Date.now()+60000);
     row=await db.prepare(legacyRuntimeReadinessSQL).bind(...bindings).first();
    }
   }
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
 const catalogVersion=modern?(env.ACTIVE_CATALOG_VERSION||(env.ACTIVE_CYCLE_ID?(await db.prepare('SELECT catalog_version FROM cycles WHERE id=?').bind(env.ACTIVE_CYCLE_ID).first())?.catalog_version:null)||(await db.prepare(`SELECT version FROM catalog_items WHERE version IN (${catalogVersionsSQL}) ORDER BY version DESC LIMIT 1`).first())?.version):null;
 let sql=['/api/login','/api/me','/api/status','/api/bootstrap'].includes(path)?readinessSQL:fastReadinessSQL;
 if(modern)sql=sql.replace('FROM cycles c WHERE c.id=?','FROM (SELECT ? catalog_version) c WHERE 1=1')+cycleSchemaSQL;
 const ready=await db.prepare(sql).bind(modern?catalogVersion:(env.ACTIVE_CYCLE_ID||'')).first();
 if(!ready)throw Object.assign(Error('Deployment contract not ready'),{status:503,code:'NOT_INITIALIZED'});
 return {modern,catalogVersion,metadataRevision:0,fast:false};
}
