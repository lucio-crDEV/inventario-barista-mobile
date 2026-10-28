import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,writeFile,readFile,rm,stat,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import worker from '../worker/index.js';
import {sqliteDB} from './shared/sqlite-adapter.mjs';
import {generateSnapshotExcel} from '../worker/export-service.js';
import {buildExportPlan} from '../worker/export-plan.js';
import {excelTemplate} from '../data/inventario/export-template.js';
const origin='https://pipeline.test';
const root=new URL('../',import.meta.url);
async function envelope() {
 const db=sqliteDB(14),id=randomUUID(),token='e'.repeat(64),hash=createHash('sha256').update(token).digest('hex');
 try{
  db.sqlite.prepare('INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES(?,?,?,? ,?,0)').run(id,'pipeline-'+id,'Synthetic','!','admin');
  db.sqlite.prepare('INSERT INTO sessions VALUES(?,?,unixepoch()+3600)').run(hash,id);
  db.sqlite.exec("INSERT INTO cycles(id,name,catalog_version,state) VALUES('pipeline','Synthetic','inventory-v3-2026-10-22','open')");
  const item=db.sqlite.prepare("SELECT * FROM catalog_items WHERE version='inventory-v3-2026-10-22' AND location_id='cocina' AND json_extract(data,'$.exportRow')=74").get();
  db.sqlite.prepare("INSERT INTO counts(cycle_id,item_id,location_id,q,unit,status,note,out_of_stock,author,version,updated_at) VALUES('pipeline',?,?,17500,?,'counted','',0,?,1,'now')").run(item.id,item.location_id,item.unit,id);
  db.sqlite.exec("UPDATE cycles SET state='closed',revision=revision+1 WHERE id='pipeline'");
  const cycle=db.sqlite.prepare("SELECT * FROM cycles WHERE id='pipeline'").get();
  const command={id:randomUUID(),cycleId:'pipeline',expectedRevision:cycle.revision,expectedCompletionRevision:cycle.completion_revision};
  const response=await worker.fetch(new Request(origin+'/api/admin/export-snapshots',{method:'POST',headers:{Cookie:'__Host-inventory_session='+token,Origin:origin,'Content-Type':'application/json','X-Inventory-User':id},body:JSON.stringify(command)}),
   {DB:db,APP_ENV:'production',APP_ORIGIN:origin,ACTIVE_CYCLE_ID:'pipeline'},{});
  assert.equal(response.status,200);
  const {snapshotId}=await response.json();
  const captured=await worker.fetch(new Request(origin+'/api/admin/export-snapshots/'+snapshotId+'?include=source',{headers:{Cookie:'__Host-inventory_session='+token}}),
   {DB:db,APP_ENV:'production',APP_ORIGIN:origin,ACTIVE_CYCLE_ID:'pipeline'},{});
  assert.equal(captured.status,200);
  return captured.json();
 }finally{db.sqlite.close();}
}
test('A real captured snapshot generates the independently verified Excel and matches every planned value',async()=>{
 const source=await envelope(),templateBytes=new Uint8Array(await readFile(new URL('../'+excelTemplate.path,import.meta.url)));
 const made=await generateSnapshotExcel({...source,templateBytes});
 assert.equal(made.snapshotId,source.snapshotId);assert.equal(made.snapshotSha256,source.sha256);
 assert.equal(made.review.summary.numeric,1);assert.equal(made.review.summary.blank,1150);
 const directory=await mkdtemp(join(tmpdir(),'inventory-excel-pipeline-'));
 try{
  const output=join(directory,'copy.xlsx'),plan=join(directory,'plan.json');
  await writeFile(output,made.bytes);await writeFile(plan,JSON.stringify(buildExportPlan(source.snapshot).cells));
  const check=spawnSync('python3',['scripts/verify-excel-template.py','--candidate',output],{cwd:root,encoding:'utf8'});
  assert.equal(check.status,0,check.stderr);
  const values=spawnSync('python3',['-c',
   "import json,sys,zipfile,xml.etree.ElementTree as E\nns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}\nparts={'principal':3,'cocina':4,'servicio':5,'panaderia':7,'pasteleria':8}\nwith zipfile.ZipFile(sys.argv[1]) as z:\n sheets={name:{c.attrib['r']:c for c in E.fromstring(z.read('xl/worksheets/sheet'+str(n)+'.xml')).findall('s:sheetData/s:row/s:c',ns)} for name,n in parts.items()}\n for p in json.load(open(sys.argv[2])):\n  c=sheets[p['sheet']][p['cell']];v=c.find('s:v',ns)\n  assert (None if v is None else v.text)==p['value'],p\n  assert c.find('s:f',ns) is None,p\n assert sheets['cocina']['C74'].find('s:v',ns).text=='17.5'\n",output,plan],{cwd:root,encoding:'utf8'});
  assert.equal(values.status,0,values.stderr);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('The generator rejects mismatched snapshots, payload tampering and unresolved operational data',async()=>{
 const source=await envelope(),templateBytes=new Uint8Array(await readFile(new URL('../'+excelTemplate.path,import.meta.url)));
 await assert.rejects(generateSnapshotExcel({...source,payload:source.payload+' ',templateBytes}),/EXPORT_SNAPSHOT_HASH_MISMATCH/);
 await assert.rejects(generateSnapshotExcel({...source,snapshot:{...source.snapshot,id:'forged'},templateBytes}),/EXPORT_SNAPSHOT_MISMATCH/);
 const snapshot=structuredClone(source.snapshot),unmapped=snapshot.items.find(i=>i.exportRow===null);
 unmapped.active=true;unmapped.record={q:1000,unit:unmapped.unit,status:'counted',voided:0,version:1};
 const payload=JSON.stringify(snapshot),sha256=createHash('sha256').update(payload).digest('hex');
 await assert.rejects(generateSnapshotExcel({snapshot,payload,sha256,templateBytes}),error=>error.code==='EXPORT_DATA_UNRESOLVED'&&error.blockers.some(b=>b.code==='UNMAPPED_ITEM'));
});
test('Local generation publishes an owner-only new file atomically and refuses overwrite or original target',async()=>{
 const source=await envelope(),directory=await mkdtemp(join(tmpdir(),'inventory-excel-cli-'));
 try{
  const input=join(directory,'private.json'),output=join(directory,'copy.xlsx');
  await writeFile(input,JSON.stringify(source),{mode:0o600});
  const run=target=>spawnSync(process.execPath,['scripts/export-excel.mjs','--snapshot',input,'--output',target],{cwd:root,encoding:'utf8'});
  const generated=run(output);assert.equal(generated.status,0,generated.stderr);
  assert.equal((await stat(output)).mode&0o777,0o600);
  const before=await readFile(output);assert.notEqual(run(output).status,0);
  assert.deepEqual(await readFile(output),before);
  assert.notEqual(run(excelTemplate.path).status,0);
  assert.ok(!(await readdir(directory)).some(name=>name.includes('.tmp-')));
 }finally{await rm(directory,{recursive:true,force:true});}
});
