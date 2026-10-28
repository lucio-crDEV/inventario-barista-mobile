import { body,fail,json } from './http.js';
import { actorSQL } from './authorization.js';
import { digest } from './session.js';
import { excelTemplate } from '../data/inventario/export-template.js';
import { exportPolicy,buildExportPlan } from './export-plan.js';
export const exportSchemaSQL = " AND (SELECT count(*) FROM sqlite_schema WHERE type='index' AND name IN('export_snapshots_cycle','export_commands_actor_time'))=2 AND (SELECT count(*) FROM sqlite_schema WHERE type='table' AND name IN('export_snapshots','export_snapshot_commands','export_snapshot_chunks'))=3 AND (SELECT count(*) FROM sqlite_schema WHERE type='trigger' AND name IN('export_snapshot_immutable_update','export_snapshot_immutable_delete','guard_export_snapshot','apply_export_snapshot','export_snapshot_insert','export_chunk_insert','export_chunk_immutable_update','export_chunk_immutable_delete'))=8 AND (SELECT count(*) FROM pragma_table_info('export_snapshots') WHERE name IN('command_id','template_sha256','completion_revision','policy_id'))=4";
export const exportDiscoverySQL = "SELECT count(*) n FROM sqlite_schema WHERE type='table' AND name IN('export_snapshots','export_snapshot_commands','export_snapshot_chunks')";
const administrator = 'WITH actor AS ('+actorSQL('u',['admin'])+') ';
const idPattern=/^[-a-zA-Z0-9]{16,80}$/;
export async function loadExportSnapshot(db,hash,id) {
  const row=await db.prepare(administrator+"SELECT (SELECT group_concat(content,'') FROM (SELECT content FROM export_snapshot_chunks WHERE snapshot_id=s.id ORDER BY part)) payload FROM export_snapshots s WHERE s.id=?2 AND EXISTS(SELECT 1 FROM actor)").bind(hash,id).first();
  if(!row) fail(404,'EXPORT_SNAPSHOT_NOT_FOUND','La captura no está disponible.');
  const snapshot=JSON.parse(row.payload),plan=buildExportPlan(snapshot);
  return {snapshot,plan,sha256:await digest(row.payload),payload:row.payload};
}
export async function exportSnapshotRequest(req,db,url,{u,hash}) {
  if(u.role!=='admin') fail(403,'ADMIN_REQUIRED','Solo un Administrador puede preparar la exportación.');
  if(!await db.prepare('SELECT 1 ready WHERE 1=1'+exportSchemaSQL).first())
    fail(503,'EXPORT_NOT_READY','La preparación de Excel todavía no está habilitada.');
  if(url.pathname==='/api/admin/export-snapshots'&&req.method==='POST') {
    const data=await body(req),keys=['id','cycleId','expectedRevision','expectedCompletionRevision'];
    if(Object.keys(data).length!==keys.length||Object.keys(data).some(k=>!keys.includes(k))||
      typeof data.id!=='string'||!idPattern.test(data.id)||typeof data.cycleId!=='string'||!data.cycleId||data.cycleId.length>150||
      !Number.isSafeInteger(data.expectedRevision)||data.expectedRevision<1||
      !Number.isSafeInteger(data.expectedCompletionRevision)||data.expectedCompletionRevision<1)
      fail(400,'INVALID_EXPORT_COMMAND','Actualiza el inventario antes de preparar el Excel.');
    const fingerprint=await digest(JSON.stringify(keys.map(k=>data[k])));
    try {
      await db.prepare('INSERT INTO export_snapshot_commands(id,fingerprint,user_id,session_hash,user_revision,cycle_id,expected_revision,expected_completion_revision,template_id,template_sha256,policy_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
        .bind(data.id,fingerprint,u.id,hash,u.revision,data.cycleId,data.expectedRevision,data.expectedCompletionRevision,excelTemplate.id,excelTemplate.sha256,exportPolicy.id).run();
    } catch(error) {
      const code=['FORBIDDEN','ID_REUSED','INVENTORY_NOT_FINALIZED','EXPORT_SOURCE_CHANGED','CATALOG_REQUIRED','EXPORT_POLICY_UNSUPPORTED','EXPORT_CAPTURE_FAILED','EXPORT_SNAPSHOT_TOO_LARGE','EXPORT_RATE_LIMIT'].find(code=>error.message.includes(code));
      if(code) fail(code==='FORBIDDEN'?403:code==='EXPORT_RATE_LIMIT'?429:409,code,({
        EXPORT_RATE_LIMIT:'Espera un minuto antes de preparar otra captura.',
        INVENTORY_NOT_FINALIZED:'Finaliza el inventario completo antes de exportar.',
        EXPORT_SOURCE_CHANGED:'El inventario cambió. Actualiza antes de preparar el Excel.',
      })[code]||'No se pudo preparar la captura del inventario.',code==='EXPORT_RATE_LIMIT'?{retryAfter:60}:{});
      throw error;
    }
    const row=await db.prepare(administrator+'SELECT result FROM export_snapshot_commands WHERE id=?2 AND user_id IN(SELECT id FROM actor)').bind(hash,data.id).first();
    if(!row) fail(403,'FORBIDDEN');
    return json(JSON.parse(row.result));
  }
  const match=url.pathname.match(/^\/api\/admin\/export-snapshots\/([-a-zA-Z0-9]{16,80})$/);
  if(match&&req.method==='GET') {
    const include=url.searchParams.get('include');
    if(include!==null&&include!=='source') fail(400,'INVALID_EXPORT_QUERY');
    const {snapshot,plan,sha256,payload}=await loadExportSnapshot(db,hash,match[1]);
    const {cells,...review}=plan;
    return json({snapshotId:snapshot.id,sha256,cycle:snapshot.cycle,capturedAt:snapshot.capturedAt,
      template:snapshot.template,policy:snapshot.policy,review,...(include==='source'?{snapshot,payload}: {})});
  }
  fail(404,'NOT_FOUND');
}
