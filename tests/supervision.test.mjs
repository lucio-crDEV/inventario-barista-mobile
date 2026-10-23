import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import worker from '../worker/index.js';
import {sqliteDB} from './shared/sqlite-adapter.mjs';
const origin='https://example.test';
function setup(){
 const db=sqliteDB(),tag=randomUUID();const identities={};
 for(const [key,role] of [['admin','admin'],['lead','service_lead'],['worker','worker']]){
  const id=randomUUID(),token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(token).digest('hex');
  db.sqlite.prepare('INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES(?,?,?,?,?,0)').run(id,key+tag,key,'!hash',role);
  db.sqlite.prepare('INSERT INTO sessions VALUES(?,?,unixepoch()+3600)').run(hash,id);identities[key]={id,hash,token};
 }
 db.sqlite.exec("INSERT INTO cycles(id,name,catalog_version,state) VALUES('test','Test','inventory-v2-2026-10-21','open'),('other','Other','inventory-v2-2026-10-21','open')");
 db.sqlite.prepare("INSERT INTO grants VALUES(?,'servicio:barra')").run(identities.worker.id);
 const env={DB:db,APP_ENV:'production',APP_ORIGIN:origin,ACTIVE_CYCLE_ID:'test'};
 const item=location=>db.sqlite.prepare('SELECT * FROM catalog_items WHERE location_id=? AND unit!=\'\' LIMIT 1').get(location);
 const call=async(key,path,body)=>{
  const who=identities[key];const res=await worker.fetch(new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{Cookie:`__Host-inventory_session=${who.token}`,...(body===undefined?{}:{Origin:origin,'Content-Type':'application/json','X-Inventory-User':who.id})},...(body===undefined?{}:{body:JSON.stringify(body)})}),env,{});
  return {status:res.status,data:await res.json()};
 };
 const revision=()=>db.sqlite.prepare("SELECT revision FROM cycles WHERE id='test'").get().revision;
 const record=i=>{const r=db.sqlite.prepare("SELECT record FROM count_records WHERE cycle_id='test' AND item_id=? AND location_id=?").get(i.id,i.location_id);return r?JSON.parse(r.record):null;};
 const command=(kind,i,extra={})=>({id:randomUUID(),kind,cycleId:'test',expectedRevision:revision(),reason:'Revisión de prueba',confirm:true,...(i?{itemId:i.id,locationId:i.location_id,expectedVersion:record(i)?.version||0}:{}),...extra});
 const count=(i,extra={})=>({id:randomUUID(),cycleId:'test',itemId:i.id,locationId:i.location_id,expectedVersion:record(i)?.version||0,action:'direct',quantity:4,unit:i.unit,status:'counted',note:'',outOfStock:false,...extra});
 return {db,env,identities,item,call,revision,record,command,count};
}
const base='/api/admin/supervision';
await test('3B: supervisor read isolation, item pagination, invalid filters and worker denial',async()=>{
 const f=setup();try{
  for(const path of [base+'/cycles',base+'?cycle=test',base+'/items?cycle=test',base+'/history?cycle=test',base+'/events?cycle=test'])assert.equal((await f.call('worker',path)).status,403);
  const lead=await f.call('lead',base+'?cycle=test');assert.equal(lead.status,200);assert.ok(lead.data.groups.every(g=>g.areaId==='servicio'));assert.ok(lead.data.scopes.every(s=>s.id.startsWith('servicio')));
  assert.equal((await f.call('lead',base+'/items?cycle=test&scope=cocina')).status,403);
  const first=await f.call('admin',base+'/items?cycle=test');assert.equal(first.status,200);assert.equal(first.data.items.length,50);assert.ok(first.data.nextCursor);
  const second=await f.call('admin',base+'/items?cycle=test&cursor='+first.data.nextCursor);assert.ok(!first.data.items.some(a=>second.data.items.some(b=>a.id===b.id&&a.locationId===b.locationId)));
  assert.equal((await f.call('admin',base+'/items?cycle=test&cursor=-1')).status,400);
  assert.equal((await f.call('admin',base+'/history?cycle=test&from=not-a-date')).status,400);
 }finally{f.db.sqlite.close();}
});
await test('3B: rectify and annul are atomic, versioned and idempotent; annul remains pending with version',async()=>{
 const f=setup(),i=f.item('servicio:barra');try{
  assert.equal((await f.call('worker','/api/count',f.count(i))).status,200);
  const b=f.command('rectify',i,{quantity:7,status:'counted',note:'Nota corregida',outOfStock:false});
  const accepted=await f.call('lead',base+'/command',b);assert.equal(accepted.status,200,JSON.stringify(accepted));assert.equal(f.record(i).quantity,7);
  assert.deepEqual(await f.call('lead',base+'/command',b),accepted);
  assert.equal((await f.call('lead',base+'/command',{...b,quantity:8})).data.code,'ID_REUSED');
  const annul=f.command('annul',i);assert.equal((await f.call('lead',base+'/command',annul)).status,200);assert.equal(f.record(i).status,'pending');assert.equal(f.record(i).quantity,null);assert.equal(f.record(i).version,3);
  const sync=await f.call('worker','/api/sync?cycle=test&cursor=0');assert.equal(sync.data.changes.at(-1).status,'pending');
  assert.equal((await f.call('worker','/api/count',f.count(i))).status,200);assert.equal(f.record(i).version,4);
  const history=await f.call('lead',base+'/history?cycle=test&item='+i.id);assert.equal(history.data.history.find(h=>h.action==='annul').reason,annul.reason);assert.equal(history.data.history.length,4);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM operations o JOIN history h ON h.operation_id=o.id WHERE o.result!=h.after_record').get().n,0);
  assert.equal((await f.call('lead',base+'/command',f.command('rectify',f.item('cocina'),{quantity:1,status:'counted',note:'',outOfStock:false}))).status,403);
 }finally{f.db.sqlite.close();}
});
await test('3B: excluded items retain counts, block new writes, preserve accepted retries and other cycles',async()=>{
 const f=setup(),i=f.item('servicio:barra');try{
  const op=f.count(i);assert.equal((await f.call('worker','/api/count',op)).status,200);
  assert.equal((await f.call('lead',base+'/command',f.command('activation',i,{active:false}))).status,403);
  assert.equal((await f.call('admin',base+'/command',f.command('activation',i,{active:false}))).status,200);
  assert.equal(f.record(i).quantity,4);
  assert.equal((await f.call('worker','/api/summary?scope=servicio:barra')).data.counted,0);
  assert.ok(!(await f.call('worker','/api/search')).data.items.some(x=>x.id===i.id));
  const boot=await f.call('worker','/api/bootstrap');assert.equal(boot.data.items.find(x=>x.id===i.id).active,false);
  assert.equal((await f.call('worker','/api/count',f.count(i))).data.code,'ITEM_INACTIVE');
  assert.equal((await f.call('worker','/api/count',op)).status,200);
  const other=f.db.sqlite.prepare("SELECT active FROM supervision_items WHERE cycle_id='other' AND id=? AND location_id=?").get(i.id,i.location_id);assert.equal(other.active,1);
  assert.equal((await f.call('admin',base+'/command',f.command('activation',i,{active:true}))).status,200);
  assert.equal(f.record(i).quantity,4);
 }finally{f.db.sqlite.close();}
});
await test('3B: strict close and review; Service reopens independently with reason and closes again',async()=>{
 const f=setup(),s=f.item('servicio:barra'),k=f.item('cocina');try{
  // Fixture: only two active items, to exercise full closure without inventing quantities for the catalog.
  f.db.sqlite.exec("INSERT INTO cycle_item_states SELECT cycle_id,id,location_id,0 FROM supervision_items WHERE cycle_id='test'");
  for(const i of [s,k])f.db.sqlite.prepare("UPDATE cycle_item_states SET active=1 WHERE cycle_id='test' AND item_id=? AND location_id=?").run(i.id,i.location_id);
  assert.equal((await f.call('admin','/api/count',f.count(k))).status,200);
  assert.equal((await f.call('worker','/api/count',f.count(s,{status:'partial'}))).status,200);
  assert.equal((await f.call('admin',base+'/command',f.command('state',null,{scope:'',state:'review'}))).status,200);
  assert.equal((await f.call('worker','/api/count',f.count(s))).data.code,'CYCLE_CLOSED');
  assert.equal((await f.call('admin',base+'/command',f.command('state',null,{scope:'',state:'closed',acknowledgeDrafts:true}))).data.code,'PENDING_ITEMS');
  assert.equal((await f.call('lead',base+'/command',f.command('rectify',s,{quantity:0,status:'counted',note:'Cero verificado',outOfStock:true}))).status,200);
  assert.equal((await f.call('admin',base+'/command',f.command('state',null,{scope:'',state:'closed',acknowledgeDrafts:true}))).status,200);
  assert.equal((await f.call('lead',base+'/command',f.command('state',null,{scope:'',state:'open'}))).status,403);
  assert.equal((await f.call('lead',base+'/command',f.command('state',null,{scope:'servicio',state:'open',reason:''}))).status,400);
  assert.equal((await f.call('lead',base+'/command',f.command('state',null,{scope:'servicio',state:'open'}))).status,200);
  assert.equal((await f.call('worker','/api/bootstrap')).data.cycle.scopeStates.find(s=>s.scope_id==='servicio').state,'open');
  assert.equal((await f.call('admin','/api/count',f.count(k))).data.code,'CYCLE_CLOSED');
  assert.equal((await f.call('worker','/api/count',f.count(s,{action:'overwrite'}))).status,200);
  assert.equal((await f.call('lead',base+'/command',f.command('state',null,{scope:'servicio',state:'review'}))).status,200);
  assert.equal((await f.call('lead',base+'/command',f.command('state',null,{scope:'servicio',state:'closed',acknowledgeDrafts:true}))).status,200);
  assert.equal(f.db.sqlite.prepare("SELECT state FROM cycles WHERE id='test'").get().state,'closed');
  assert.equal((await f.call('worker','/api/count',f.count(s))).data.code,'CYCLE_CLOSED');
 }finally{f.db.sqlite.close();}
});
await test('3B: stale confirmations, revoked session and SQL-time role change cause no partial audit or data',async()=>{
 const f=setup(),i=f.item('servicio:barra');try{
  const old=f.command('rectify',i,{quantity:2,status:'counted',note:'',outOfStock:false});
  assert.equal((await f.call('worker','/api/count',f.count(i))).status,200);
  const before=f.db.sqlite.prepare('SELECT count(*) n FROM admin_audit').get().n;
  assert.equal((await f.call('admin',base+'/command',old)).data.code,'STALE');
  assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM admin_audit').get().n,before);
  const cmd=f.command('annul',i),prepare=f.db.prepare.bind(f.db);
  f.db.prepare=sql=>{const st=prepare(sql);if(sql.startsWith('INSERT INTO supervision_commands')){const run=st.run.bind(st);st.run=async()=>{f.db.sqlite.prepare("UPDATE users SET role='worker',revision=revision+1 WHERE id=?").run(f.identities.lead.id);return run();};}return st;};
  assert.equal((await f.call('lead',base+'/command',cmd)).status,403);
  assert.equal(f.record(i).quantity,4);assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM supervision_commands').get().n,0);
  f.db.sqlite.prepare('DELETE FROM sessions WHERE user_id=?').run(f.identities.admin.id);
  assert.equal((await f.call('admin',base+'/command',cmd)).status,401);
 }finally{f.db.sqlite.close();}
});
await test('3B: history cursor and stable author filters do not mix cycles or duplicate rows',async()=>{
 const f=setup(),i=f.item('servicio:barra');try{
  for(let n=0;n<55;n++)assert.equal((await f.call('worker','/api/count',f.count(i))).status,200);
  const first=await f.call('lead',base+'/history?cycle=test&author='+f.identities.worker.id);assert.equal(first.data.history.length,50);
  const second=await f.call('lead',base+'/history?cycle=test&cursor='+first.data.nextCursor);assert.equal(second.data.history.length,5);assert.ok(!first.data.history.some(a=>second.data.history.some(b=>a.seq===b.seq)));
  assert.equal((await f.call('lead',base+'/history?cycle=other')).data.history.length,0);
  f.db.sqlite.prepare('UPDATE users SET name=? WHERE id=?').run('Renombrado',f.identities.worker.id);
  const h=await f.call('lead',base+'/history?cycle=test&author='+f.identities.worker.id);assert.equal(h.data.history.length,50);assert.equal(h.data.history[0].after.authorName,'worker');
 }finally{f.db.sqlite.close();}
});
