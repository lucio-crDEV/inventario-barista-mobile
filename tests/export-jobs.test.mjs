import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {sqliteDB} from './shared/sqlite-adapter.mjs';
import {exportSnapshotRequest} from '../worker/export-snapshots.js';
import {exportJobRequest} from '../worker/export-jobs.js';
import publicWorker,{InventoryExport} from '../operations/export-worker/index.js';
import {excelTemplate} from '../data/inventario/export-template.js';

const bytes=new Uint8Array(await readFile(new URL('../'+excelTemplate.path,import.meta.url)));
const hash=createHash('sha256').update('synthetic-session').digest('hex');
class MemoryStorage {
 data=new Map();when=null;failReady=false;
 async get(key){return structuredClone(this.data.get(key));}
 async put(key,value){if(value.state==='ready'&&this.failReady){this.failReady=false;throw Error('synthetic persisted-state failure');}this.data.set(key,structuredClone(value));}
 async setAlarm(when){this.when=when;}
 async deleteAlarm(){this.when=null;}
}
class PrivateBucket {
 objects=new Map();puts=0;failPut=0;corrupt=false;afterGet=null;
 constructor(){this.objects.set('template/'+excelTemplate.sha256,{bytes,customMetadata:{}});}
 async get(key){
  const entry=this.objects.get(key);if(!entry)return null;
  const copy=entry.bytes.slice();await this.afterGet?.(key);
  return {size:copy.length,customMetadata:{...entry.customMetadata},body:new Blob([copy]).stream(),arrayBuffer:async()=>copy.buffer};
 }
 async put(key,value,options){
  this.puts++;if(this.failPut-->0)throw Error('synthetic R2 failure');
  if(options.onlyIf?.get('If-None-Match')==='*'&&this.objects.has(key))return null;
  const saved=value.slice();if(this.corrupt)saved[0]^=1;
  this.objects.set(key,{bytes:saved,customMetadata:{...options.customMetadata}});return {key};
 }
}
async function fixture({blocker=false}={}) {
 const db=sqliteDB(14),userId=randomUUID();
 db.sqlite.prepare("INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES(?,?,?,'!','admin',0)").run(userId,userId,'Synthetic admin');
 db.sqlite.prepare("INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES(?,?,?,'!','admin',0)").run(randomUUID(),'other-'+userId,'Synthetic second admin');
 db.sqlite.prepare('INSERT INTO sessions VALUES(?,?,unixepoch()+3600)').run(hash,userId);
 db.sqlite.exec("INSERT INTO cycles(id,name,catalog_version,state) VALUES('export-job','Synthetic export','inventory-v3-2026-10-22','open')");
 if(blocker){
  const item=db.sqlite.prepare("SELECT * FROM catalog_items WHERE version='inventory-v3-2026-10-22' AND location_id='cocina' AND json_extract(data,'$.exportRow')=74").get();
  db.sqlite.prepare("UPDATE catalog_items SET data=json_set(data,'$.toExportFactor',2) WHERE version=? AND id=? AND location_id=?").run(item.version,item.id,item.location_id);
  db.sqlite.prepare("INSERT INTO counts(cycle_id,item_id,location_id,q,unit,status,note,out_of_stock,author,version,updated_at) VALUES('export-job',?,?,1000,?,'counted','',0,?,1,'now')").run(item.id,item.location_id,item.unit,userId);
 }
 db.sqlite.exec("UPDATE cycles SET state='closed',revision=revision+1 WHERE id='export-job'");
 const u=db.sqlite.prepare('SELECT * FROM users WHERE id=?').get(userId),cycle=db.sqlite.prepare("SELECT * FROM cycles WHERE id='export-job'").get();
 const context={u,hash},capture=await exportSnapshotRequest(new Request('https://api.test/api/admin/export-snapshots',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:randomUUID(),cycleId:cycle.id,expectedRevision:cycle.revision,expectedCompletionRevision:cycle.completion_revision})}),db,new URL('https://api.test/api/admin/export-snapshots'),context);
 const snapshotId=(await capture.json()).snapshotId,storage=new MemoryStorage(),bucket=new PrivateBucket();
 const env={DB:db,EXPORT_FILES:bucket},ctx={storage};let object=new InventoryExport(ctx,env);
 const namespace={idFromName:name=>name,get:()=>({fetch:req=>object.fetch(req)})};
 const call=async(action,extra={})=>{
  const req=new Request('https://api.test/api/admin/export-snapshots/'+snapshotId+'/'+action,{method:action==='generate'?'POST':'GET',...(action==='generate'?{headers:{'Content-Type':'application/json'},body:JSON.stringify(extra)}:{})});
  return exportJobRequest(req,{DB:db,EXPORTS:namespace},new URL(req.url),context);
 };
 const internal=action=>object.fetch(new Request('https://exports.internal/'+action,{method:action==='generate'?'POST':'GET',headers:{'X-Inventory-Export-Context':JSON.stringify({snapshotId,userId,revision:u.revision,hash})}}));
 return {db,u,context,snapshotId,storage,bucket,call,internal,alarm:()=>object.alarm(),restart:()=>{object=new InventoryExport(ctx,env);},close:()=>db.sqlite.close()};
}
test('Simultaneous generation is idempotent; ready files redownload the same private artifact after restart',async()=>{
 const f=await fixture();try{
  assert.equal((await f.call('artifact')).status,200);
  assert.equal((await (await f.call('artifact')).json()).state,'not_started');
  assert.equal((await f.call('file')).status,409);
  const started=await Promise.all(Array.from({length:5},()=>f.call('generate')));
  assert.ok(started.every(r=>r.status===202));
  await Promise.all([f.alarm(),f.alarm()]);
  const state=await (await f.call('artifact')).json();assert.equal(state.state,'ready');assert.equal(state.attempts,1);assert.equal(f.bucket.puts,1);
  assert.equal(state.downloadUrl,'/api/admin/export-snapshots/'+f.snapshotId+'/file');
  const one=await f.call('file');assert.equal(one.headers.get('Cache-Control'),'no-store');assert.equal(one.headers.get('X-Content-Type-Options'),'nosniff');
  assert.match(one.headers.get('Content-Disposition'),/^attachment; filename="inventario-[-a-zA-Z0-9]+\.xlsx"$/);
  const first=new Uint8Array(await one.arrayBuffer());assert.equal(createHash('sha256').update(first).digest('hex'),state.sha256);
  // Underlying live data can reopen: the accepted immutable capture remains valid.
  f.db.sqlite.exec("UPDATE cycles SET state='open',revision=revision+1,lifecycle='deleted' WHERE id='export-job'");
  f.restart();assert.equal((await (await f.call('generate')).json()).state,'ready');await f.alarm();
  assert.deepEqual(new Uint8Array(await (await f.call('file')).arrayBuffer()),first);assert.equal(f.bucket.puts,1);
  // A terminated last attempt can recover an already committed candidate even
  // after its compression budget is exhausted; no new put is allowed.
  await f.storage.put('job',{...await f.storage.get('job'),state:'generating',attempts:3});
  f.restart();await f.alarm();assert.equal((await (await f.call('artifact')).json()).state,'ready');assert.equal(f.bucket.puts,1);
  assert.ok(!JSON.stringify([...f.storage.data]).includes(hash));assert.equal(f.storage.when,null);
 }finally{f.close();}
});
test('Private endpoints deny current session, role, password-change and revision revocation, including after R2 reads',async()=>{
 const f=await fixture();try{
  await f.call('generate');await f.alarm();
  const deny=async(sql,undo)=>{f.db.sqlite.exec(sql);for(const action of ['artifact','file','generate'])assert.equal((await f.internal(action)).status,403);await assert.rejects(f.call('artifact'),e=>e.code==='EXPORT_ACCESS_DENIED');f.db.sqlite.exec(undo);};
  await deny(`UPDATE users SET role='worker' WHERE id='${f.u.id}'`,`UPDATE users SET role='admin' WHERE id='${f.u.id}'`);
  await deny(`UPDATE users SET must_change=1 WHERE id='${f.u.id}'`,`UPDATE users SET must_change=0 WHERE id='${f.u.id}'`);
  await deny(`UPDATE users SET revision=revision+1 WHERE id='${f.u.id}'`,`UPDATE users SET revision=revision-1 WHERE id='${f.u.id}'`);
  f.bucket.afterGet=key=>{if(key.startsWith('exports/'))f.db.sqlite.prepare('DELETE FROM sessions WHERE hash=?').run(hash);};
  assert.equal((await f.internal('file')).status,403);
  assert.equal((await f.internal('generate')).status,403);
 }finally{f.close();}
});
test('Persisted job retries a transient private upload failure and recovers a committed artifact without rewriting it',async()=>{
 const f=await fixture();try{
  f.bucket.failPut=1;await f.call('generate');await f.alarm();
  let state=await (await f.call('artifact')).json();assert.equal(state.state,'queued');assert.equal(state.attempts,1);assert.ok(f.storage.when>Date.now());
  f.restart();f.storage.failReady=true;await f.alarm();
  state=await (await f.call('artifact')).json();assert.equal(state.state,'queued');assert.equal(state.attempts,2);
  f.restart();await f.alarm();state=await (await f.call('artifact')).json();assert.equal(state.state,'ready');assert.equal(state.attempts,3);assert.equal(f.bucket.puts,2);
 }finally{f.close();}
});
test('Attempts are bounded, and a corrupt put never publishes a ready file',async()=>{
 const f=await fixture();try{
  f.bucket.failPut=10;await f.call('generate');for(let i=0;i<5;i++)await f.alarm();
  const state=await (await f.call('artifact')).json();assert.equal(state.state,'failed');assert.equal(state.attempts,3);assert.equal(state.retryable,true);assert.equal(f.bucket.puts,3);assert.equal(f.storage.when,null);
  assert.equal((await f.call('file')).status,409);
  const tooSoon=await f.call('generate');assert.equal(tooSoon.status,429);assert.equal(tooSoon.headers.get('Retry-After'),'60');
  await f.storage.put('job',{...await f.storage.get('job'),failedAt:Date.now()-60001});f.bucket.failPut=0;
  assert.equal((await f.call('generate')).status,202);await f.alarm();assert.equal((await (await f.call('artifact')).json()).state,'ready');
 }finally{f.close();}
 const corrupt=await fixture();try{
  corrupt.bucket.corrupt=true;await corrupt.call('generate');await corrupt.alarm();
  const state=await (await corrupt.call('artifact')).json();assert.equal(state.state,'failed');assert.equal(state.code,'EXPORT_ARTIFACT_INTEGRITY');assert.equal((await corrupt.call('file')).status,409);
  assert.equal(state.retryable,false);assert.equal((await (await corrupt.call('generate')).json()).state,'failed');
 }finally{corrupt.close();}
});
test('Unresolved captured data blocks generation; revoked actor blocks an admitted job without retaining session secrets',async()=>{
 const f=await fixture({blocker:true});try{
  await f.call('generate');await f.alarm();const state=await (await f.call('artifact')).json();
  assert.equal(state.state,'failed');assert.equal(state.code,'EXPORT_DATA_UNRESOLVED');assert.equal(f.bucket.puts,0);
  assert.ok(!JSON.stringify(state).includes('itemId'));
 }finally{f.close();}
 const revoked=await fixture();try{
  await revoked.call('generate');revoked.db.sqlite.prepare('UPDATE users SET active=0 WHERE id=?').run(revoked.u.id);await revoked.alarm();
  assert.equal((await revoked.storage.get('job')).code,'EXPORT_ACCESS_REVOKED');assert.equal(revoked.bucket.puts,0);
  const replacement=revoked.db.sqlite.prepare('SELECT * FROM users WHERE active=1 AND role=\'admin\'').get();
  revoked.db.sqlite.prepare('DELETE FROM sessions WHERE hash=?').run(hash);revoked.db.sqlite.prepare('INSERT INTO sessions VALUES(?,?,unixepoch()+3600)').run(hash,replacement.id);
  await revoked.storage.put('job',{...await revoked.storage.get('job'),failedAt:Date.now()-60001});
  const request=new Request('https://api.test/api/admin/export-snapshots/'+revoked.snapshotId+'/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  const response=await exportJobRequest(request,{DB:revoked.db,EXPORTS:{idFromName:id=>id,get:()=>({fetch:async req=>{
   const ctx={storage:revoked.storage};return new InventoryExport(ctx,{DB:revoked.db,EXPORT_FILES:revoked.bucket}).fetch(req);
  }})}},new URL(request.url),{u:replacement,hash});
  assert.equal(response.status,202);revoked.restart();await revoked.alarm();
  assert.equal((await revoked.storage.get('job')).state,'ready');assert.equal((await revoked.storage.get('job')).userId,replacement.id);
 }finally{revoked.close();}
});
test('Pages forwards no stock payload, rejects injected cells, lists historical headers and has no public worker route',async()=>{
 const f=await fixture();try{
  await assert.rejects(f.call('generate',{cells:[]}),e=>e.code==='INVALID_EXPORT_COMMAND');
  const listURL=new URL('https://api.test/api/admin/exports');
  const list=await exportJobRequest(new Request(listURL),{DB:f.db},listURL,f.context);const data=await list.json();
  assert.equal(data.snapshots[0].id,f.snapshotId);assert.equal(data.snapshots[0].payload,undefined);assert.equal(data.snapshots[0].items,undefined);
  listURL.searchParams.set('cycle','export-job');assert.equal((await (await exportJobRequest(new Request(listURL),{DB:f.db},listURL,f.context)).json()).snapshots.length,1);
  listURL.searchParams.set('cursor','garbage');await assert.rejects(exportJobRequest(new Request(listURL),{DB:f.db},listURL,f.context),e=>e.code==='INVALID_EXPORT_QUERY');
  assert.equal((await publicWorker.fetch(new Request('https://public.test/generate'))).status,404);
  assert.equal((await f.internal('unknown')).status,404);
 }finally{f.close();}
});

test('Revocation racing the source query pauses recoverably instead of invalidating a valid snapshot',async()=>{
 const f=await fixture();try{
  await f.call('generate');
  const prepare=f.db.prepare.bind(f.db);let raced=false;
  f.db.prepare=sql=>{
   const statement=prepare(sql);
   if(sql.includes("SELECT group_concat(content,''")) {
    const first=statement.first.bind(statement);
    statement.first=async()=>{raced=true;f.db.sqlite.prepare('UPDATE users SET active=0 WHERE id=?').run(f.u.id);return first();};
   }
   return statement;
  };
  await f.alarm();assert.equal(raced,true);
  const job=await f.storage.get('job');assert.equal(job.state,'failed');assert.equal(job.code,'EXPORT_ACCESS_REVOKED');assert.equal(job.retryable,true);assert.equal(f.bucket.puts,0);
 }finally{f.close();}
});
test('Scheduled cleanup removes only old expired auth metadata and preserves current sessions and inventory',async()=>{
 const f=await fixture();try{
  f.db.sqlite.prepare("INSERT INTO sessions VALUES('expired-old',?,unixepoch()-172801),('expired-recent',?,unixepoch()-1)").run(f.u.id,f.u.id);
  f.db.sqlite.exec("INSERT INTO attempts VALUES('old',CAST((unixepoch()-172800)/900 AS INTEGER)-1,1),('current',CAST(unixepoch()/900 AS INTEGER),1)");
  const before=f.db.sqlite.prepare('SELECT count(*) n FROM export_snapshots').get().n,pending=[];
  publicWorker.scheduled(null,{DB:f.db},{waitUntil:work=>pending.push(work)});await Promise.all(pending);
  assert.equal(f.db.sqlite.prepare("SELECT count(*) n FROM sessions WHERE hash='expired-old'").get().n,0);
  assert.equal(f.db.sqlite.prepare("SELECT count(*) n FROM sessions WHERE hash='expired-recent'").get().n,1);
  assert.ok(f.db.sqlite.prepare('SELECT 1 FROM sessions WHERE hash=?').get(hash));
  assert.equal(f.db.sqlite.prepare("SELECT count(*) n FROM attempts WHERE key='old'").get().n,0);
  assert.equal(f.db.sqlite.prepare("SELECT count(*) n FROM attempts WHERE key='current'").get().n,1);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM export_snapshots').get().n,before);
 }finally{f.close();}
});
