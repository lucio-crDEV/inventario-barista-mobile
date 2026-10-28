import {test} from 'node:test';
import assert from 'node:assert/strict';
import {catalog} from '../worker/catalog.js';
import {excelTemplate} from '../data/inventario/export-template.js';
import {exportPolicy,buildExportPlan} from '../worker/export-plan.js';
function fixture() {
 return {schema:1,id:'synthetic-snapshot',cycle:{id:'synthetic',state:'closed',lifecycle:'active',catalogVersion:'inventory-v3-2026-10-22'},
  template:{id:excelTemplate.id,sha256:excelTemplate.sha256},policy:{...exportPolicy},
  items:catalog.map(item=>({id:item.id,locationId:item.locationId,name:item.name,unit:item.unit||'',
   justoId:item.justoId??null,exportSheet:item.exportSheet??null,exportRow:item.exportRow??null,
   exportUnit:item.exportUnit??null,toExportFactor:item.toExportFactor,active:item.active!==false,record:null}))};
}
const counted=(item,q,status='counted',voided=0)=>item.record={q,status,voided,version:1,unit:item.unit};
const destination=(snapshot,sheet,row)=>snapshot.items.filter(i=>i.exportSheet===sheet&&i.exportRow===row);
const value=(plan,sheet,row)=>plan.cells.find(c=>c.sheet===sheet&&c.cell==='C'+row).value;
test('The complete plan clears every original stock, preserves explicit zero and excludes partial/voided/inactive contributions',()=>{
 const f=fixture();
 const one=destination(f,'cocina',74)[0];counted(one,0);
 const pastry=destination(f,'pasteleria',3)[0];counted(pastry,0,'partial');
 const inactive=destination(f,'cocina',3)[0];counted(inactive,7000);inactive.active=false;
 const voided=destination(f,'panaderia',3)[0];counted(voided,8000,'counted',1);
 const plan=buildExportPlan(f);
 assert.equal(plan.ready,true);assert.equal(plan.cells.length,1151);
 assert.equal(value(plan,'cocina',74),'0');
 assert.equal(value(plan,'pasteleria',3),null);
 assert.equal(value(plan,'cocina',3),null);assert.equal(value(plan,'panaderia',3),null);
 assert.equal(plan.summary.blank,1150);
});
test('Service sums distinct counted physical locations once, warns about partial totals and excludes inactive previous counts',()=>{
 const f=fixture(),groups=new Map();
 for(const item of f.items.filter(i=>i.exportSheet==='servicio'&&i.exportRow&&i.exportUnit&&i.toExportFactor===1&&i.active)){
  const list=groups.get(item.exportRow)||[];list.push(item);groups.set(item.exportRow,list);
 }
 const sources=[...groups.values()].find(g=>g.length>=3),row=sources[0].exportRow;
 counted(sources[0],4000);counted(sources[1],3500);
 counted(sources[2],999000,'partial');
 let plan=buildExportPlan(f);assert.equal(value(plan,'servicio',row),'7.5');
 assert.ok(plan.partialCells.some(c=>c.cell==='C'+row&&c.counted===2));
 sources[1].active=false;plan=buildExportPlan(f);assert.equal(value(plan,'servicio',row),'4');
 sources[0].record.status='partial';plan=buildExportPlan(f);assert.equal(value(plan,'servicio',row),null);
});
test('Conversions use exact rational arithmetic and only round once after consolidation, including half-up and small positive values',()=>{
 const f=fixture();
 const syrup=f.items.find(i=>i.unit.toUpperCase()==='CC'&&i.toExportFactor&&Math.abs(i.toExportFactor-1/750)<1e-15);
 assert.ok(syrup);
 counted(syrup,375000);let plan=buildExportPlan(f);assert.equal(value(plan,syrup.exportSheet,syrup.exportRow),'0.5');
 counted(syrup,1);plan=buildExportPlan(f);assert.equal(value(plan,syrup.exportSheet,syrup.exportRow),'0');
 assert.ok(plan.roundedToZero.some(c=>c.cell==='C'+syrup.exportRow));
 const grams=f.items.find(i=>['G','GR'].includes(i.unit.toUpperCase())&&i.exportUnit?.toUpperCase()==='KG');
 assert.ok(grams);counted(grams,1500);plan=buildExportPlan(f);
 assert.equal(value(plan,grams.exportSheet,grams.exportRow),'0.002');
});
test('Counted unknown units, unresolved conversions and products without destinations block generation instead of disappearing',()=>{
 const f=fixture(),missing=f.items.find(i=>i.exportRow&&!i.exportUnit),
  conversion=f.items.find(i=>i.exportRow&&i.exportUnit&&i.toExportFactor===null),
  unmapped=f.items.find(i=>i.exportRow===null);
 for(const item of [missing,conversion,unmapped]){item.active=true;counted(item,1000);}
 const plan=buildExportPlan(f);assert.equal(plan.ready,false);
 assert.deepEqual(new Set(plan.blockers.map(p=>p.code)),new Set(['EXPORT_UNIT_REQUIRED','CONVERSION_REQUIRED','UNMAPPED_ITEM']));
 for(const item of [missing,conversion,unmapped])item.active=false;
 assert.equal(buildExportPlan(f).ready,true);
});
test('Invalid source shape, duplicate physical keys, changed references and unsupported policy fail closed',()=>{
 const f=fixture();f.items[0].record={q:NaN,status:'counted',voided:0,version:1,unit:f.items[0].unit};
 assert.throws(()=>buildExportPlan(f),/SNAPSHOT_RECORD_INVALID/);
 const duplicate=fixture();duplicate.items[1]={...duplicate.items[0]};
 assert.throws(()=>buildExportPlan(duplicate),/SNAPSHOT_ITEM_INVALID/);
 const ref=fixture();ref.items[0].exportUnit='UNAPPROVED';
 assert.throws(()=>buildExportPlan(ref),/SNAPSHOT_REFERENCE_MISMATCH/);
 const state=fixture();state.cycle.state='open';assert.throws(()=>buildExportPlan(state),/INVALID_EXPORT_SNAPSHOT/);
 const policy=fixture();policy.policy.decimals=6;assert.throws(()=>buildExportPlan(policy),/EXPORT_POLICY_UNSUPPORTED/);
});

test('Two sub-millith contributions round after the sum, never once per physical location',()=>{
 const f=fixture(),syrup=f.items.find(i=>i.unit.toUpperCase()==='CC'&&i.toExportFactor&&Math.abs(i.toExportFactor-1/750)<1e-15);
 const shared=f.items.find(item=>item.exportRow&&destination(f,item.exportSheet,item.exportRow).length>=2);
 const donor=destination(f,shared.exportSheet,shared.exportRow)[0];
 for(const field of ['exportSheet','exportRow','exportUnit','justoId'])donor[field]=syrup[field];
 const physical=[syrup,donor];
 // Synthetic physical measures exercise the approved CC-to-unit conversion
 // twice; all destination identifiers, reference units and rows remain real.
 for(const item of physical.slice(0,2)){
  item.active=true;item.unit='CC';item.name='Syrup Esencia';item.toExportFactor=1/750;
  counted(item,300);
 }
 const plan=buildExportPlan(f);
 assert.equal(value(plan,syrup.exportSheet,syrup.exportRow),'0.001');
});
