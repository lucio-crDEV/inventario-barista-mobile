import { catalogCardinalities as cardinalities } from '../shared/deployment-domain.js';
import { excelRows } from '../data/inventario/items/catalogo-excel.js';
import { excelTemplate } from '../data/inventario/export-template.js';

export const exportPolicy = Object.freeze({
  id:'stock-v1-3dp-recalc-on-open',decimals:3,partial:'sum-counted',
  excludeInactive:true,recalculateOnOpen:true,
});
const normalize = value => String(value || '').trim().toUpperCase();
const key = (sheet,cell) => sheet+':'+cell;
const referenceRows = new Map(Object.entries(excelRows).flatMap(([sheet,rows]) =>
  rows.map(row=>[key(sheet,'C'+row[0]),row])));
const problem = code => { throw Object.assign(Error(code),{code}); };
function gcd(a,b) { while(b) [a,b]=[b,a%b]; return a; }
function add(a,b) {
  const factor=gcd(a[1],b[1]);
  return [a[0]*(b[1]/factor)+b[0]*(a[1]/factor),a[1]*(b[1]/factor)];
}
function decimal([numerator,denominator]) {
  const scaled=numerator*1000n,whole=scaled/denominator;
  const rounded=whole+(2n*(scaled%denominator)>=denominator?1n:0n);
  const tail=(rounded%1000n).toString().padStart(3,'0').replace(/0+$/,'');
  return (rounded/1000n).toString()+(tail?'.'+tail:'');
}
function conversion(item) {
  const from=normalize(item.unit),to=normalize(item.exportUnit);
  if(!from||!to) return null;
  let divisor;
  if(from===to) divisor=1;
  else if(['G','GR'].includes(from)&&to==='KG') divisor=1000;
  else if(from==='CC'&&to==='UN'&&/syrup esencia/i.test(item.name)) divisor=750;
  else return null;
  // SQLite's JSON serialization can shorten an existing binary float. Units
  // choose the approved rational; the stored factor must still agree.
  if(typeof item.toExportFactor!=='number'||!Number.isFinite(item.toExportFactor)||
    Math.abs(item.toExportFactor-1/divisor)>1e-15) return null;
  return BigInt(divisor);
}
export function buildExportPlan(snapshot) {
  if(!snapshot||snapshot.schema!==1||snapshot.cycle?.state!=='closed'||
    snapshot.cycle.lifecycle!=='active') problem('INVALID_EXPORT_SNAPSHOT');
  if(snapshot.template?.id!==excelTemplate.id||snapshot.template.sha256!==excelTemplate.sha256)
    problem('TEMPLATE_MISMATCH');
  const policy=snapshot.policy;
  const accepted=['stock-v1-3dp-preserve-calc','stock-v1-3dp-recalc-on-open'];
  if(!policy||!accepted.includes(policy.id)||policy.decimals!==3||policy.partial!=='sum-counted'||
    policy.excludeInactive!==true||policy.recalculateOnOpen!==(policy.id==='stock-v1-3dp-recalc-on-open'))
    problem('EXPORT_POLICY_UNSUPPORTED');
  if(!Array.isArray(snapshot.items)||snapshot.items.length!==cardinalities[snapshot.cycle.catalogVersion])
    problem('SNAPSHOT_CATALOG_MISMATCH');
  const groups=new Map([...referenceRows].map(([ref])=>[ref,{sum:[0n,1n],counted:0,pending:0,excluded:0,sources:0}]));
  const identities=new Set(),blockers=[];
  const issue=(code,item)=>blockers.push({code,itemId:item.id,locationId:item.locationId,
    name:item.name,sheet:item.exportSheet,cell:item.exportRow?'C'+item.exportRow:null});
  for(const item of snapshot.items) {
    if(typeof item.id!=='string'||!item.id||typeof item.locationId!=='string'||!item.locationId||
      identities.has(item.id+'\0'+item.locationId)||typeof item.active!=='boolean')
      problem('SNAPSHOT_ITEM_INVALID');
    identities.add(item.id+'\0'+item.locationId);
    const record=item.record;
    if(record!==null&&(typeof record!=='object'||!Number.isSafeInteger(record.q)||record.q<0||record.q>1000000000||
      !['counted','partial'].includes(record.status)||![0,1].includes(record.voided)||
      !Number.isSafeInteger(record.version)||record.version<1||record.unit!==item.unit))
      problem('SNAPSHOT_RECORD_INVALID');
    const counted=item.active&&record&&record.voided===0&&record.status==='counted';
    if(item.exportSheet===null&&item.exportRow===null) {
      if(counted) issue('UNMAPPED_ITEM',item);
      continue;
    }
    const ref=key(item.exportSheet,'C'+item.exportRow),source=referenceRows.get(ref),group=groups.get(ref);
    if(!group||!Number.isSafeInteger(item.exportRow)||
      (item.justoId??null)!==(source[1]??null)||(item.exportUnit??null)!==(source[3]??null))
      problem('SNAPSHOT_REFERENCE_MISMATCH');
    group.sources++;
    if(!item.active) {group.excluded++;continue;}
    if(!counted) {group.pending++;continue;}
    const divisor=conversion(item);
    if(divisor===null) {issue(item.exportUnit?'CONVERSION_REQUIRED':'EXPORT_UNIT_REQUIRED',item);continue;}
    group.sum=add(group.sum,[BigInt(record.q),1000n*divisor]);
    group.counted++;
  }
  const cells=[],partialCells=[],roundedToZero=[];
  for(const [ref,group] of groups) {
    if(group.sources===0) problem('SNAPSHOT_DESTINATION_MISSING');
    const separator=ref.indexOf(':'),sheet=ref.slice(0,separator),cell=ref.slice(separator+1);
    const value=group.counted?decimal(group.sum):null;
    cells.push({sheet,cell,value});
    if(group.counted&&group.pending) partialCells.push({sheet,cell,counted:group.counted,pending:group.pending,excluded:group.excluded});
    if(value==='0'&&group.sum[0]>0n) roundedToZero.push({sheet,cell});
  }
  return {snapshotId:snapshot.id,templateId:excelTemplate.id,policyId:policy.id,
    recalculateOnOpen:policy.recalculateOnOpen,ready:blockers.length===0,cells,
    blockers,partialCells,roundedToZero,
    summary:{destinations:cells.length,numeric:cells.filter(c=>c.value!==null).length,
      blank:cells.filter(c=>c.value===null).length,partial:partialCells.length,
      blockers:blockers.length,roundedToZero:roundedToZero.length}};
}
