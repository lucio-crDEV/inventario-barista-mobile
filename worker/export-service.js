import {buildExportPlan} from './export-plan.js';
import {generateExcel} from './excel-generator.js';
import {digest} from './session.js';
/** Internal 4C operation. Call only with an authorized immutable snapshot.
 * Kept out of Pages request routing: compression belongs in a private job.
 */
export async function generateSnapshotExcel({snapshot,payload,sha256,templateBytes}) {
 if(typeof payload!=='string'||typeof sha256!=='string'||await digest(payload)!==sha256)
  throw Object.assign(Error('EXPORT_SNAPSHOT_HASH_MISMATCH'),{code:'EXPORT_SNAPSHOT_HASH_MISMATCH'});
 const source=JSON.parse(payload);
 if(JSON.stringify(snapshot)!==JSON.stringify(source))
  throw Object.assign(Error('EXPORT_SNAPSHOT_MISMATCH'),{code:'EXPORT_SNAPSHOT_MISMATCH'});
 const plan=buildExportPlan(source);
 if(!plan.ready)throw Object.assign(Error('EXPORT_DATA_UNRESOLVED'),{code:'EXPORT_DATA_UNRESOLVED',
  blockers:plan.blockers,summary:plan.summary});
 const generated=await generateExcel({templateBytes,cells:plan.cells,recalculate:plan.recalculateOnOpen});
 return {...generated,snapshotId:source.id,snapshotSha256:sha256,policyId:plan.policyId,review:{
  summary:plan.summary,partialCells:plan.partialCells,roundedToZero:plan.roundedToZero}};
}
