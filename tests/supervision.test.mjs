import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import worker from '../worker/index.js';
import {sqliteDB} from './shared/sqlite-adapter.mjs';
const origin='https://example.test';
function setup(through=7){
 const db=sqliteDB(through),tag=randomUUID();const identities={};
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
await test('3B: area activity retains counts, blocks new writes, preserves accepted retries and persists across cycles',async()=>{
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
  const other=f.db.sqlite.prepare("SELECT active FROM supervision_items WHERE cycle_id='other' AND id=? AND location_id=?").get(i.id,i.location_id);assert.equal(other.active,0);
  assert.equal((await f.call('admin',base+'/command',f.command('activation',i,{active:true}))).status,200);
  assert.equal(f.record(i).quantity,4);
 }finally{f.db.sqlite.close();}
});
await test('3B: strict close and review; Service reopens independently with reason and closes again',async()=>{
 const f=setup(),s=f.item('servicio:barra'),k=f.item('cocina');try{
  // Fixture: only two active items, to exercise full closure without inventing quantities for the catalog.
  f.db.sqlite.exec("INSERT INTO item_activity(area_id,item_id,active,changed_at,inactive_since) SELECT area_id,id,0,datetime('now'),datetime('now') FROM supervision_items WHERE cycle_id='test'");
  for(const i of [s,k])f.db.sqlite.prepare("UPDATE item_activity SET active=1,inactive_since=NULL WHERE item_id=? AND area_id=?").run(i.id,JSON.parse(i.data).areaId);
  assert.equal((await f.call('admin','/api/count',f.count(k))).status,200);
  assert.equal((await f.call('worker','/api/count',f.count(s,{status:'partial'}))).status,200);
  assert.equal((await f.call('admin',base+'/command',f.command('state',null,{scope:'',state:'review'}))).status,200);
  assert.equal((await f.call('worker','/api/count',f.count(s))).data.code,'CYCLE_CLOSED');
  assert.equal((await f.call('admin',base+'/command',f.command('state',null,{scope:'',state:'closed',acknowledgeDrafts:true}))).data.code,'PENDING_ITEMS');
  assert.equal((await f.call('lead',base+'/command',f.command('rectify',s,{quantity:0,status:'counted',note:'Cero verificado',outOfStock:true}))).status,200);
  assert.equal((await f.call('admin',base+'/command',f.command('state',null,{scope:'',state:'closed',acknowledgeDrafts:true}))).status,200);
  assert.equal((await f.call('lead',base+'/command',f.command('state',null,{scope:'',state:'open'}))).status,403);
  assert.equal((await f.call('lead',base+'/command',f.command('state',null,{scope:'servicio',state:'open',reason:''}))).status,400);
  assert.equal((await f.call('lead',base+'/command',f.command('state',null,{scope:'servicio',state:'open'}))).status,403);
  assert.equal((await f.call('admin',base+'/command',f.command('state',null,{scope:'servicio',state:'open'}))).status,200);
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
  const grouped=await f.call('lead',base+'/history?cycle=test&author='+f.identities.worker.id);assert.equal(grouped.data.items.length,1);assert.equal(grouped.data.items[0].counts.counts,55);
  const first=await f.call('lead',base+'/history?cycle=test&item='+encodeURIComponent(i.id)+'&location='+encodeURIComponent(i.location_id));assert.equal(first.data.history.length,50);
  const second=await f.call('lead',base+'/history?cycle=test&item='+encodeURIComponent(i.id)+'&location='+encodeURIComponent(i.location_id)+'&cursor='+first.data.nextCursor);assert.equal(second.data.history.length,5);assert.ok(!first.data.history.some(a=>second.data.history.some(b=>a.seq===b.seq)));
  assert.equal((await f.call('lead',base+'/history?cycle=other')).data.items.length,0);
  f.db.sqlite.prepare('UPDATE users SET name=? WHERE id=?').run('Renombrado',f.identities.worker.id);
  const h=await f.call('lead',base+'/history?cycle=test&item='+encodeURIComponent(i.id)+'&location='+encodeURIComponent(i.location_id));assert.equal(h.data.history.length,50);assert.equal(h.data.history[0].after.authorName,'worker');
 }finally{f.db.sqlite.close();}
});
await test('3B revision: optional motives, manager review reopening, admin-only final reopening and accepted retries',async()=>{
 const f=setup(),i=f.item('servicio:barra');try{
  const review=f.command('state',null,{scope:'servicio',state:'review',reason:undefined});
  assert.equal((await f.call('lead',base+'/command',review)).status,200);
  assert.equal((await f.call('lead',base+'/command',f.command('rectify',i,{quantity:2,status:'counted',note:'',outOfStock:false,reason:undefined}))).status,200);
  assert.equal((await f.call('lead',base+'/command',f.command('annul',i,{reason:undefined}))).status,200);
  const reopen=f.command('state',null,{scope:'servicio',state:'open'});
  const accepted=await f.call('lead',base+'/command',reopen);assert.equal(accepted.status,200);
  f.db.sqlite.exec("UPDATE cycles SET state='closed',revision=revision+1 WHERE id='test'; DELETE FROM cycle_scope_states");
  assert.deepEqual(await f.call('lead',base+'/command',reopen),accepted,'Accepted operation may be recovered after finalization');
  const next=f.command('state',null,{scope:'servicio',state:'open'});
  assert.equal((await f.call('lead',base+'/command',next)).data.code,'ADMIN_REOPEN_REQUIRED');
  assert.equal((await f.call('admin',base+'/command',{...next,id:randomUUID(),reason:''})).status,400);
  assert.equal((await f.call('admin',base+'/command',{...next,id:randomUUID()})).status,200);
  assert.equal((await f.call('lead',base+'/command',f.command('state',null,{scope:'servicio',state:'review',reason:undefined}))).status,200);
  assert.equal(f.db.sqlite.prepare('SELECT reason FROM supervision_commands WHERE id=?').get(review.id).reason,'');
 }finally{f.db.sqlite.close();}
});
await test('3B revision: per-area activity has cross-cycle CAS, immutable counts/catalog, dated activity events and no false zero',async()=>{
 const f=setup(),i=f.item('servicio:barra');try{
  const original=f.db.sqlite.prepare('SELECT data FROM catalog_items WHERE version=? AND id=? AND location_id=?').get('inventory-v2-2026-10-21',i.id,i.location_id).data;
  assert.equal((await f.call('worker','/api/count',f.count(i))).status,200);
  const before=f.record(i),otherRevision=f.db.sqlite.prepare("SELECT revision FROM cycles WHERE id='other'").get().revision;
  const staleOther={...f.command('activation',i,{active:true,reason:undefined,expectedActivityRevision:0}),cycleId:'other',expectedRevision:otherRevision,expectedVersion:0};
  assert.equal((await f.call('admin',base+'/command',f.command('activation',i,{active:false,reason:undefined,expectedActivityRevision:0}))).status,200);
  assert.equal((await f.call('admin',base+'/command',staleOther)).data.code,'CYCLE_CHANGED');
  const projected=(await f.call('admin',base+'/items?cycle=other&item='+encodeURIComponent(i.id))).data.items[0];
  assert.equal(projected.active,false);assert.equal(projected.activityRevision,1);assert.ok(Number.isFinite(Date.parse(projected.inactiveSince)));
  assert.equal((await f.call('admin',base+'/command',f.command('activation',i,{active:true,reason:undefined,expectedActivityRevision:0}))).data.code,'ACTIVITY_CHANGED');
  assert.equal((await f.call('admin',base+'/command',f.command('activation',i,{active:true,reason:undefined,expectedActivityRevision:1}))).status,200);
  assert.deepEqual(f.record(i),before);
  const events=f.db.sqlite.prepare('SELECT * FROM item_activity_events ORDER BY seq').all();assert.deepEqual(events.map(x=>x.active),[0,1]);assert.ok(events.every(x=>x.area_id==='servicio'&&x.user_id===f.identities.admin.id&&Number.isFinite(Date.parse(x.created_at))));
  assert.equal(f.db.sqlite.prepare('SELECT inactive_since FROM item_activity WHERE item_id=?').get(i.id).inactive_since,null);
  assert.equal(f.db.sqlite.prepare('SELECT data FROM catalog_items WHERE version=? AND id=? AND location_id=?').get('inventory-v2-2026-10-21',i.id,i.location_id).data,original);
  assert.deepEqual(f.db.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{f.db.sqlite.close();}
});
await test('3B revision: grouped category filters include matching products, preserve full detail and paginate movements by role',async()=>{
 const f=setup(),a=f.item('servicio:barra'),b=f.item('servicio:mercadito');try{
  assert.equal((await f.call('worker','/api/count',f.count(a))).status,200);
  assert.equal((await f.call('worker','/api/count',f.count(a,{action:'add',quantity:3}))).status,200);
  assert.equal((await f.call('lead',base+'/command',f.command('rectify',a,{quantity:8,status:'counted',note:'Private manager note',outOfStock:false,reason:'Private managerial reason'}))).status,200);
  assert.equal((await f.call('lead',base+'/command',f.command('rectify',b,{quantity:2,status:'counted',note:'',outOfStock:false}))).status,200);
  assert.equal((await f.call('lead',base+'/command',f.command('annul',b))).status,200);
  const group=async category=>(await f.call('lead',base+'/history?cycle=test&category='+category)).data.items;
  assert.deepEqual((await group('count')).map(x=>x.itemId),[a.id]);
  assert.deepEqual(new Set((await group('correction')).map(x=>x.itemId)),new Set([a.id,b.id]));
  assert.deepEqual((await group('annul')).map(x=>x.itemId),[b.id]);
  const detail=(await f.call('lead',base+'/history?cycle=test&category=annul&item='+encodeURIComponent(a.id)+'&location='+encodeURIComponent(a.location_id))).data.history;
  assert.deepEqual(detail.map(x=>x.action),['rectify','add','direct']);assert.equal(detail[1].entered.quantity,3);assert.equal(detail[1].before.quantity,4);assert.equal(detail[1].after.quantity,7);
  for(let n=0;n<55;n++)assert.equal((await f.call('worker','/api/count',f.count(a,{action:'add',quantity:1}))).status,200);
  const path='/api/history?cycle=test&item='+encodeURIComponent(a.id)+'&location='+encodeURIComponent(a.location_id);
  const minimal=(await f.call('worker',path)).data;assert.equal(minimal.history.length,10);assert.equal(minimal.nextCursor,null);
  for(const row of minimal.history)assert.deepEqual(Object.keys(row).sort(),['authorName','createdAt','quantity','status','unit']);
  const full=(await f.call('lead',path)).data;assert.equal(full.history.length,50);assert.ok(full.nextCursor);
  const older=(await f.call('lead',path+'&cursor='+full.nextCursor)).data;assert.equal(older.history.length,8);assert.ok(older.history.some(x=>x.reason==='Private managerial reason'));assert.ok(!full.history.some(x=>older.history.some(y=>x.seq===y.seq)));
  assert.equal((await f.call('worker','/api/history?cycle=test&item='+encodeURIComponent(b.id)+'&location='+encodeURIComponent(b.location_id))).status,403);
 }finally{f.db.sqlite.close();}
});
await test('3B revision: migration of populated 0006 retains accepted fingerprints, results and exact catalogue; lead retry survives stronger guard',async()=>{
 const f=setup(6),i=f.item('servicio:barra');try{
  const op=f.count(i),countKeys=['id','cycleId','itemId','locationId','expectedVersion','action','quantity','unit','status','note','outOfStock'];
  const fingerprint=createHash('sha256').update(JSON.stringify(countKeys.map(k=>op[k]))).digest('hex');
  f.db.sqlite.prepare('INSERT INTO operations(id,fingerprint,user_id,session_hash,cycle_id,item_id,location_id,expected_version,action,q,unit,status,note,out_of_stock) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(op.id,fingerprint,f.identities.worker.id,f.identities.worker.hash,'test',i.id,i.location_id,0,'direct',4000,i.unit,'counted','',0);
  f.db.sqlite.exec("UPDATE cycles SET state='closed' WHERE id='test'");
  const b=f.command('state',null,{scope:'servicio',state:'open'}),keys=['id','cycleId','expectedRevision','kind','itemId','locationId','expectedVersion','quantity','status','note','outOfStock','active','scope','state','reason','confirm','acknowledgeDrafts'];
  const hash=createHash('sha256').update(JSON.stringify(keys.map(k=>b[k]??null))).digest('hex');
  f.db.sqlite.prepare('INSERT INTO supervision_commands(id,fingerprint,user_id,session_hash,user_revision,cycle_id,expected_revision,kind,new_state,scope_id,reason) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(b.id,hash,f.identities.lead.id,f.identities.lead.hash,1,'test',b.expectedRevision,'state','open','servicio',b.reason);
  // Legacy states with no timestamp are retained as an explicitly unknown baseline.
  f.db.sqlite.prepare('INSERT INTO cycle_item_states VALUES(?,?,?,0)').run('test',i.id,i.location_id);
  const snapshots={};for(const table of ['counts','operations','history','admin_audit','catalog_items'])snapshots[table]=JSON.stringify(f.db.sqlite.prepare('SELECT * FROM '+table).all());
  const previousResult=f.db.sqlite.prepare('SELECT result FROM supervision_commands WHERE id=?').get(b.id).result;
  f.db.migrate(7,7);
  for(const [table,snapshot]of Object.entries(snapshots))assert.equal(JSON.stringify(f.db.sqlite.prepare('SELECT * FROM '+table).all()),snapshot,table+' preserved');
  assert.equal(f.db.sqlite.prepare('SELECT result FROM supervision_commands WHERE id=?').get(b.id).result,previousResult);
  f.db.sqlite.exec("UPDATE cycles SET state='closed'; DELETE FROM cycle_scope_states");
  assert.equal((await f.call('lead',base+'/command',b)).status,200);
  assert.equal((await f.call('worker','/api/count',op)).status,200);
  assert.equal((await f.call('lead',base+'/command',f.command('state',null,{scope:'servicio',state:'open'}))).status,403);
  assert.equal(f.db.sqlite.prepare('SELECT active FROM item_activity WHERE item_id=?').get(i.id).active,0);
  assert.deepEqual(f.db.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{f.db.sqlite.close();}
});
await test('3B revision: group pagination bounds products independently of their movement counts',async()=>{
 const f=setup();try{
  const items=f.db.sqlite.prepare("SELECT * FROM catalog_items WHERE version='inventory-v2-2026-10-21' AND location_id='servicio:barra' AND unit!='' AND json_extract(data,'$.active')=1 LIMIT 55").all();assert.equal(items.length,55);
  for(const i of items)assert.equal((await f.call('worker','/api/count',f.count(i))).status,200);
  const first=(await f.call('lead',base+'/history?cycle=test&category=count')).data;assert.equal(first.items.length,50);assert.ok(first.nextCursor);
  const second=(await f.call('lead',base+'/history?cycle=test&category=count&cursor='+first.nextCursor)).data;assert.equal(second.items.length,5);assert.equal(second.nextCursor,null);
  const identities=[...first.items,...second.items].map(x=>x.itemId+'|'+x.locationId);assert.equal(new Set(identities).size,55);
 }finally{f.db.sqlite.close();}
});
await test('3B revision: product history role projection is revalidated at SQL time',async()=>{
 const f=setup(),i=f.item('servicio:barra');try{
  assert.equal((await f.call('lead',base+'/command',f.command('rectify',i,{quantity:3,status:'counted',note:'private text',outOfStock:false,reason:'private reason'}))).status,200);
  f.db.sqlite.prepare('INSERT INTO grants VALUES(?,?)').run(f.identities.lead.id,i.location_id);
  const prepare=f.db.prepare.bind(f.db);
  f.db.prepare=sql=>{const st=prepare(sql);if(sql.includes('SELECT h.*,u.name author_name')){const all=st.all.bind(st);st.all=async()=>{f.db.sqlite.prepare("UPDATE users SET role='worker',revision=revision+1 WHERE id=?").run(f.identities.lead.id);return all();};}return st;};
  const response=await f.call('lead','/api/history?cycle=test&item='+encodeURIComponent(i.id)+'&location='+encodeURIComponent(i.location_id));
  assert.equal(response.status,200);assert.deepEqual(response.data.history,[]);assert.ok(!JSON.stringify(response).includes('private'));
 }finally{f.db.sqlite.close();}
});
await test('3B revision: legacy migration prefers activation chronology over cycle creation and preserves event rowids',async()=>{
 const f=setup(6),i=f.item('servicio:barra');try{
  const sql=f.db.sqlite.prepare("INSERT INTO supervision_commands(rowid,id,fingerprint,user_id,session_hash,user_revision,cycle_id,expected_revision,kind,item_id,location_id,active,reason,created_at) VALUES(?,?,?,?,?,1,?,?,'activation',?,?,?,'Legacy activity',?)");
  const insert=(row,cycle,rev,active,time)=>sql.run(row,randomUUID(),'legacy-'+row,f.identities.admin.id,f.identities.admin.hash,cycle,rev,i.id,i.location_id,active,time);
  insert(3,'test',1,0,'2026-10-20T12:00:00.000Z');
  insert(7,'other',1,1,'2026-10-21T12:00:00.000Z');
  insert(12,'test',2,0,'2026-10-22T12:00:00.000Z');
  f.db.migrate(7,7);
  assert.equal(f.db.sqlite.prepare('SELECT active FROM item_activity WHERE item_id=?').get(i.id).active,0);
  assert.deepEqual(f.db.sqlite.prepare('SELECT rowid FROM supervision_commands ORDER BY rowid').all().map(x=>x.rowid),[3,7,12]);
  const events=(await f.call('admin',base+'/events?cycle=test')).data.events;assert.equal(events[0].authorName,'admin');assert.equal(events[0].seq,12);
 }finally{f.db.sqlite.close();}
});
await test('Finalization 0012: explicit pending acknowledgment preserves unknowns, partials and confirmed zero; audited and idempotent',async()=>{
 const f=setup(12),zero=f.item('cocina'),partial=f.item('servicio:barra');try{
  assert.equal((await f.call('admin','/api/count',f.count(zero,{quantity:0}))).status,200);
  assert.equal((await f.call('worker','/api/count',f.count(partial,{quantity:2,status:'partial'}))).status,200);
  assert.equal((await f.call('admin',base+'/command',f.command('state',null,{scope:'',state:'review',reason:''}))).status,200);
  const cmd=f.command('state',null,{scope:'',state:'closed',reason:''});
  const first=await f.call('admin',base+'/command',cmd);assert.equal(first.data.code,'PENDING_ITEMS');assert.equal(first.data.completion.partial,1);assert.ok(first.data.completion.pending>0);
  const acceptedCmd={...cmd,allowIncomplete:true,completionRevision:first.data.completionRevision};
  const accepted=await f.call('admin',base+'/command',acceptedCmd);assert.equal(accepted.status,200,JSON.stringify(accepted));assert.equal(accepted.data.completion.partial,1);assert.equal(accepted.data.completion.uncompletedAsBlank,true);
  assert.deepEqual(await f.call('admin',base+'/command',acceptedCmd),accepted);assert.equal(f.record(zero).quantity,0);assert.equal(f.record(partial).quantity,2);assert.equal(f.record(partial).status,'partial');
  assert.equal(f.db.sqlite.prepare("SELECT count(*) n FROM counts WHERE cycle_id='test'").get().n,2);
  const audit=JSON.parse(f.db.sqlite.prepare("SELECT detail FROM admin_audit WHERE action='inventory-state' ORDER BY rowid DESC LIMIT 1").get().detail);assert.equal(audit.allowIncomplete,1);assert.equal(audit.completion.partial,1);
  assert.equal((await f.call('admin',base+'/command',{...acceptedCmd,completionRevision:acceptedCmd.completionRevision+1})).data.code,'ID_REUSED');
 }finally{f.db.sqlite.close();}
});
await test('Finalization 0012: a changed count invalidates acknowledgment at SQL time; Service-only roles remain scoped',async()=>{
 const f=setup(12),item=f.item('servicio:barra');try{
  assert.equal((await f.call('lead',base+'/command',f.command('state',null,{scope:'servicio',state:'review',reason:''}))).status,200);
  const cmd=f.command('state',null,{scope:'servicio',state:'closed',reason:''});const warning=await f.call('lead',base+'/command',cmd);
  assert.equal(warning.data.code,'PENDING_ITEMS');
  const allow={...cmd,allowIncomplete:true,completionRevision:warning.data.completionRevision};
  const prepare=f.db.prepare.bind(f.db);let raced=false;f.db.prepare=sql=>{const st=prepare(sql);if(sql.startsWith('INSERT INTO supervision_commands')&&!raced){const run=st.run.bind(st);st.run=()=>{raced=true;f.db.sqlite.prepare("INSERT INTO counts(cycle_id,item_id,location_id,q,unit,status,note,out_of_stock,author,version,updated_at) VALUES('test',?,?,1000,?,'partial','',0,?,1,datetime('now'))").run(item.id,item.location_id,item.unit,f.identities.worker.id);return run();};}return st;};
  const changed=await f.call('lead',base+'/command',allow);assert.equal(changed.data.code,'COMPLETION_CHANGED',JSON.stringify(changed));assert.equal(changed.data.completion.partial,1);assert.notEqual(changed.data.completionRevision,allow.completionRevision);
  assert.equal((await f.call('lead',base+'/command',{...allow,completionRevision:changed.data.completionRevision})).status,200);
  assert.equal(f.db.sqlite.prepare("SELECT state FROM cycles WHERE id='test'").get().state,'open');
  assert.equal((await f.call('lead',base+'/command',f.command('state',null,{scope:'',state:'closed',allowIncomplete:true,completionRevision:1}))).status,403);
  assert.equal((await f.call('worker',base+'/command',allow)).status,403);
 }finally{f.db.sqlite.close();}
});
await test('Finalization migration preserves accepted results/fingerprints and original records',async()=>{
 const f=setup(11);try{
  const cmd=f.command('state',null,{scope:'',state:'review',reason:''});const accepted=await f.call('admin',base+'/command',cmd);assert.equal(accepted.status,200);
  const before=f.db.sqlite.prepare('SELECT fingerprint,result FROM supervision_commands WHERE id=?').get(cmd.id);
  f.db.migrate(12,12);
  assert.deepEqual(await f.call('admin',base+'/command',cmd),accepted);
  assert.deepEqual(f.db.sqlite.prepare('SELECT fingerprint,result FROM supervision_commands WHERE id=?').get(cmd.id),before);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM counts').get().n,0);
  assert.equal(f.db.sqlite.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(f.db.sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{f.db.sqlite.close();}
});
