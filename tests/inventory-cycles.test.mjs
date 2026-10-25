import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import worker from '../worker/index.js';
import {sqliteDB} from './shared/sqlite-adapter.mjs';
const origin='https://example.test';
function setup(){
 const db=sqliteDB(10),users={};
 for(const role of ['admin','service_lead','worker']){
  const id=randomUUID(),token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(token).digest('hex');
  db.sqlite.prepare('INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES(?,?,?,?,?,0)').run(id,id,role,'!hash',role);
  db.sqlite.prepare('INSERT INTO sessions VALUES(?,?,unixepoch()+3600)').run(hash,id);users[role]={id,token,hash};
 }
 db.sqlite.prepare("INSERT INTO grants VALUES(?,'servicio:barra')").run(users.worker.id);
 const env={DB:db,APP_ENV:'production',APP_ORIGIN:origin,ACTIVE_CATALOG_VERSION:'inventory-v2-2026-10-21'};
 const call=async(role,path,b)=>{const u=users[role],r=await worker.fetch(new Request(origin+path,{method:b?'POST':'GET',headers:{Cookie:`__Host-inventory_session=${u.token}`,...(b?{Origin:origin,'Content-Type':'application/json','X-Inventory-User':u.id}:{})},...(b?{body:JSON.stringify(b)}:{})}),env,{});return {status:r.status,data:await r.json()};};
 const create=(extra={})=>({id:randomUUID(),kind:'create',cycleId:randomUUID(),name:'Inventario de prueba',type:'weekly',period:'2026-10-25',...extra});
 return {db,env,users,call,create};
}
const command='/api/admin/cycles/command';
async function confirmed(f,b){const r=await f.call('admin',command,b);return r.data.code==='CONFIRMATION_REQUIRED'?f.call('admin',command,{...b,confirmWarnings:true,confirmationRevision:r.data.confirmationRevision}):r;}
await test('cycles: empty initialized catalog, admin authorization, preparation, activation and defaults',async()=>{
 const f=setup();try{
  assert.deepEqual((await f.call('admin','/api/cycles')).data.cycles,[]);
  assert.equal((await f.call('admin','/api/bootstrap')).data.cycle,null);
  assert.equal((await f.call('worker',command,f.create())).status,403);
  assert.equal((await f.call('service_lead',command,f.create())).status,403);
  const a=f.create({activate:false});const created=await f.call('admin',command,a);assert.equal(created.status,200,JSON.stringify(created));assert.equal(created.data.cycle.lifecycle,'prepared');assert.equal(created.data.cycle.state,'review');
  assert.equal((await f.call('admin','/api/cycles')).data.defaultCycleId,null);
  assert.equal((await f.call('worker','/api/cycles')).data.cycles.length,0);
  assert.equal((await f.call('worker','/api/bootstrap')).data.cycle,null);
  assert.deepEqual(await f.call('admin',command,a),created);
  const activated=await f.call('admin',command,{id:randomUUID(),kind:'activate',cycleId:a.cycleId,expectedRevision:1});assert.equal(activated.status,200,JSON.stringify(activated));assert.equal(activated.data.cycle.state,'open');const openingDay=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());assert.equal(activated.data.cycle.name,openingDay.split('-').reverse().join('/'));assert.equal(activated.data.cycle.period,openingDay);
  assert.equal((await f.call('worker','/api/bootstrap')).data.cycle.id,a.cycleId);
  const lead=await f.call('service_lead','/api/bootstrap');assert.ok(lead.data.items.every(i=>i.areaId==='servicio'));
  assert.deepEqual(f.db.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{f.db.sqlite.close();}
});
await test('cycles: conflict warning is atomic, calendar periods overlap, confirmation expires on concurrent changes',async()=>{
 const f=setup();try{
  const a=f.create();assert.equal((await f.call('admin',command,a)).status,200);
  const b=f.create({period:'2026-10-21'});const warning=await f.call('admin',command,b);assert.equal(warning.status,409);assert.deepEqual(warning.data.warnings.map(w=>w.code),['OTHER_ACTIVE','DUPLICATE_PERIOD']);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM cycles').get().n,1);
  const c=f.create({activate:false,period:'2026-11-05'});assert.equal((await f.call('admin',command,c)).status,200);
  const stale=await f.call('admin',command,{...b,confirmWarnings:true,confirmationRevision:warning.data.confirmationRevision});assert.equal(stale.data.code,'CONFIRMATION_CHANGED');
  const confirmedBody={...b,confirmWarnings:true,confirmationRevision:stale.data.confirmationRevision};const accepted=await f.call('admin',command,confirmedBody);assert.equal(accepted.status,200,JSON.stringify(accepted));assert.deepEqual(await f.call('admin',command,confirmedBody),accepted);
  assert.equal((await f.call('admin',command,{...confirmedBody,name:'Otro'})).data.code,'ID_REUSED');
  assert.equal((await f.call('admin','/api/cycles')).data.defaultCycleId,b.cycleId);
  f.db.sqlite.exec("UPDATE cycles SET state='closed' WHERE lifecycle='active'");
  assert.equal((await f.call('admin','/api/cycles')).data.defaultCycleId,b.cycleId);
 }finally{f.db.sqlite.close();}
});
await test('cycles: archive preserves count/history, blocks writes, supports replay and hides archived navigation',async()=>{
 const f=setup();try{
  const a=f.create();await f.call('admin',command,a);
  const i=f.db.sqlite.prepare("SELECT * FROM catalog_items WHERE location_id='servicio:barra' AND unit!='' LIMIT 1").get();
  const count={id:randomUUID(),cycleId:a.cycleId,itemId:i.id,locationId:i.location_id,expectedVersion:0,action:'direct',quantity:3,unit:i.unit,status:'counted',note:'',outOfStock:false};
  assert.equal((await f.call('worker','/api/count',count)).status,200);
  const del={id:randomUUID(),kind:'delete',cycleId:a.cycleId,expectedRevision:1};assert.equal((await f.call('admin',command,del)).data.code,'DELETE_CONFIRMATION_REQUIRED');
  const accepted=await f.call('admin',command,{...del,confirm:true});assert.equal(accepted.status,200);assert.deepEqual(await f.call('admin',command,{...del,confirm:true}),accepted);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM counts').get().n,1);assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM history').get().n,1);
  assert.equal((await f.call('worker','/api/count',{...count,id:randomUUID(),expectedVersion:1})).data.code,'CYCLE_CLOSED');
  assert.equal((await f.call('worker','/api/count',count)).status,200);
  assert.equal((await f.call('worker','/api/bootstrap?cycle='+a.cycleId)).data.cycle,null);
  assert.equal((await f.call('admin','/api/cycles')).data.cycles.length,0);
  assert.equal((await f.call('admin','/api/cycles?includeDeleted=1')).data.cycles.length,1);
  assert.equal((await f.call('service_lead','/api/cycles?includeDeleted=1')).data.cycles.length,0);
 }finally{f.db.sqlite.close();}
});
await test('cycles: SQL-time role/revision revocation aborts command with no partial data or audit',async()=>{
 const f=setup();try{
  f.db.sqlite.prepare("INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES('other-admin','other-admin','Other','!hash','admin',0)").run();
  const prepare=f.db.prepare.bind(f.db);f.db.prepare=sql=>{const st=prepare(sql);if(sql.startsWith('INSERT INTO inventory_cycle_commands')){const run=st.run.bind(st);st.run=()=>{f.db.sqlite.prepare("UPDATE users SET role='worker',revision=revision+1 WHERE id=?").run(f.users.admin.id);return run();};}return st;};
  const r=await f.call('admin',command,f.create());assert.equal(r.status,403);assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM cycles').get().n,0);assert.equal(f.db.sqlite.prepare("SELECT count(*) n FROM admin_audit WHERE action LIKE 'inventory-cycle-%'").get().n,0);
 }finally{f.db.sqlite.close();}
});
await test('cycles: legacy reopen needs reason plus current warning confirmation, prepared/deleted cannot bypass lifecycle',async()=>{
 const f=setup();try{
  const a=f.create(),b=f.create({period:'2026-11-01'});await f.call('admin',command,a);await confirmed(f,b);
  f.db.sqlite.prepare("UPDATE cycles SET state='review' WHERE id=?").run(a.cycleId);
  const reopen={id:randomUUID(),kind:'state',cycleId:a.cycleId,expectedRevision:1,scope:'',state:'open',reason:'Revisar conteos',confirm:true};
  const first=await f.call('admin','/api/admin/supervision/command',reopen);assert.equal(first.data.code,'CONFIRMATION_REQUIRED',JSON.stringify(first));
  const body={...reopen,confirmWarnings:true,confirmationRevision:first.data.confirmationRevision};const done=await f.call('admin','/api/admin/supervision/command',body);assert.equal(done.status,200,JSON.stringify(done));assert.deepEqual(await f.call('admin','/api/admin/supervision/command',body),done);
  const prepared=f.create({activate:false,period:'2026-12-01'});await f.call('admin',command,prepared);
  const forbidden=await f.call('admin','/api/admin/supervision/command',{...reopen,id:randomUUID(),cycleId:prepared.cycleId,confirmWarnings:true,confirmationRevision:(await f.call('admin','/api/cycles')).data.confirmationRevision});assert.equal(forbidden.data.code,'CYCLE_CLOSED');
 }finally{f.db.sqlite.close();}
});
await test('cycles: competing activation between request read and insert requires a fresh server warning',async()=>{
 const f=setup();try{
  const prepare=f.db.prepare.bind(f.db);let injected=false;
  f.db.prepare=sql=>{const st=prepare(sql);if(sql.startsWith('INSERT INTO inventory_cycle_commands')&&!injected){const run=st.run.bind(st);st.run=()=>{injected=true;f.db.sqlite.prepare("INSERT INTO cycles(id,name,catalog_version,state,type,period,lifecycle) VALUES('concurrent','Concurrent','inventory-v2-2026-10-21','open','weekly','2026-10-20','active')").run();return run();};}return st;};
  const b=f.create(),r=await f.call('admin',command,b);assert.equal(r.data.code,'CONFIRMATION_REQUIRED');assert.deepEqual(r.data.warnings.map(w=>w.code),['OTHER_ACTIVE','DUPLICATE_PERIOD']);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM inventory_cycle_commands').get().n,0);
  assert.equal(f.db.sqlite.prepare("SELECT count(*) n FROM admin_audit WHERE action LIKE 'inventory-cycle-%'").get().n,0);
  assert.equal((await f.call('admin',command,{...b,confirmWarnings:true,confirmationRevision:r.data.confirmationRevision})).status,200);
 }finally{f.db.sqlite.close();}
});
await test('cycles: monthly duplicates, invalid dates, stale archive and revoked retry preserve accepted intent',async()=>{
 const f=setup();try{
  assert.equal((await f.call('admin',command,f.create({period:'2026-02-30'}))).status,400);
  const a=f.create({type:'month_end',period:'2026-10-31',activate:false});assert.equal((await f.call('admin',command,a)).status,200);
  const warning=await f.call('admin',command,f.create({type:'both',period:'2026-10-01',activate:false}));assert.deepEqual(warning.data.warnings.map(w=>w.code),['DUPLICATE_PERIOD']);
  const stale={id:randomUUID(),kind:'delete',cycleId:a.cycleId,expectedRevision:99,confirm:true};assert.equal((await f.call('admin',command,stale)).data.code,'CYCLE_CHANGED');assert.equal(f.db.sqlite.prepare('SELECT lifecycle FROM cycles WHERE id=?').get(a.cycleId).lifecycle,'prepared');
  const prepared={id:randomUUID(),kind:'activate',cycleId:a.cycleId,expectedRevision:1};const result=await f.call('admin',command,prepared);assert.equal(result.status,200);
  f.db.sqlite.prepare('DELETE FROM sessions WHERE user_id=?').run(f.users.admin.id);
  assert.equal((await f.call('admin',command,prepared)).status,401);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM inventory_cycle_commands').get().n,2);
 }finally{f.db.sqlite.close();}
});
await test('cycles: readiness fails closed when an atomic lifecycle guard is missing',async()=>{
 const f=setup();try{
  f.db.sqlite.exec('DROP TRIGGER guard_inventory_cycle');
  const result=await f.call('admin',command,f.create());assert.equal(result.status,503);assert.equal(result.data.code,'NOT_INITIALIZED');assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM cycles').get().n,0);
 }finally{f.db.sqlite.close();}
});
await test('cycles: forbidden finalized Service reopen never discloses another active-cycle warning',async()=>{
 const f=setup();try{
  const a=f.create(),b=f.create({period:'2026-11-01'});await f.call('admin',command,a);await confirmed(f,b);
  f.db.sqlite.prepare("UPDATE cycles SET state='closed' WHERE id=?").run(a.cycleId);
  const body={id:randomUUID(),kind:'state',cycleId:a.cycleId,expectedRevision:1,scope:'servicio',state:'open',reason:'Revisar conteos',confirm:true};
  const r=await f.call('service_lead','/api/admin/supervision/command',body);assert.equal(r.status,403);assert.equal(r.data.code,'ADMIN_REOPEN_REQUIRED');assert.equal(r.data.warnings,undefined);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM supervision_commands').get().n,0);
 }finally{f.db.sqlite.close();}
});
await test('cycles: permission revocation at SQL time precedes archived-cycle rejection',async()=>{
 const f=setup();try{
  const a=f.create();await f.call('admin',command,a);await f.call('admin',command,{id:randomUUID(),kind:'delete',cycleId:a.cycleId,expectedRevision:1,confirm:true});
  const i=f.db.sqlite.prepare("SELECT * FROM catalog_items WHERE location_id='servicio:barra' AND unit!='' LIMIT 1").get();
  const count={id:randomUUID(),cycleId:a.cycleId,itemId:i.id,locationId:i.location_id,expectedVersion:0,action:'direct',quantity:3,unit:i.unit,status:'counted',note:'',outOfStock:false};
  const prepare=f.db.prepare.bind(f.db);f.db.prepare=sql=>{const st=prepare(sql);if(sql.startsWith('INSERT INTO operations')){const run=st.run.bind(st);st.run=()=>{f.db.sqlite.prepare('DELETE FROM grants WHERE user_id=?').run(f.users.worker.id);return run();};}return st;};
  const r=await f.call('worker','/api/count',count);assert.equal(r.status,403);assert.equal(r.data.code,'FORBIDDEN');assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM operations').get().n,0);
 }finally{f.db.sqlite.close();}
});
