import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import worker from '../worker/index.js';
import {sqliteDB} from './shared/sqlite-adapter.mjs';
test('realtime bridge reauthorizes session, origin and cycle; forwards no cookies or client context',async()=>{
 const DB=sqliteDB(13),origin='https://realtime.test',token='e'.repeat(64),hash=createHash('sha256').update(token).digest('hex');
 try{
  DB.sqlite.exec("INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES('a','a','Admin','!','admin',0),('w','w','Worker','!','worker',0);INSERT INTO grants VALUES('w','servicio:barra');INSERT INTO cycles(id,name,catalog_version,state) VALUES('cycle','Cycle','inventory-v3-2026-10-22','open')");
  DB.sqlite.prepare('INSERT INTO sessions VALUES(?,?,unixepoch()+3600)').run(hash,'w');
  let forwards=0,context;
  const env={DB,APP_ENV:'production',APP_ORIGIN:origin,ACTIVE_CYCLE_ID:'cycle',REALTIME:{idFromName:name=>{assert.equal(name,'inventory');return 'private';},get:id=>({async fetch(req){forwards++;assert.equal(id,'private');assert.equal(req.url,'https://realtime.internal/connect');assert.equal(req.headers.get('cookie'),null);context=JSON.parse(req.headers.get('X-Inventory-Context'));return Response.json({accepted:true});}})}};
  const call=async({cycle='cycle',cookie=token,from=origin,upgrade='websocket'}={})=>worker.fetch(new Request(origin+'/api/realtime?cycle='+cycle,{headers:{Cookie:`__Host-inventory_session=${cookie}`,Origin:from,Upgrade:upgrade,'X-Inventory-Context':'forged-client-context'}}),env,{});
  assert.equal((await call({from:'https://other.test'})).status,403);
  assert.equal((await call({cookie:'f'.repeat(64)})).status,401);
  assert.equal((await call({upgrade:'invalid'})).status,426);
  assert.equal((await call({cycle:'missing'})).status,403);assert.equal(forwards,0);
  const accepted=await call();assert.equal(accepted.status,200);assert.equal(forwards,1);
  assert.equal(context.userId,'w');assert.equal(context.revision,1);assert.ok(context.accessRevision>0);assert.equal(context.cycleId,'cycle');assert.deepEqual(context.scopeIds,['servicio:barra']);assert.ok(context.expires>Date.now()/1000);
  assert.ok(accepted.headers.get('Content-Security-Policy').includes('wss://realtime.test'));
  DB.sqlite.prepare('DELETE FROM sessions WHERE hash=?').run(hash);
  assert.equal((await call()).status,401);assert.equal(forwards,1);
 }finally{DB.sqlite.close();}
});
