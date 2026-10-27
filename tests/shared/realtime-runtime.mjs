// Local provider-runtime test: synthetic D1 only, outbound traffic always blocked.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(resolve('package.json'));
const {Miniflare,convertV4MiniflareOptions}=require('miniflare'),{build}=require('esbuild'),WebSocket=require('ws');
const source=`
import {InventoryRealtime as Native} from ${JSON.stringify(resolve('operations/realtime-worker/entry.js'))};
export class RuntimeTest extends Native {
 constructor(ctx,env){
  const stats={reads:0,fail:false,race:false};
  const instrument=db=>({withSession:(...args)=>instrument(db.withSession(...args)),prepare(sql){
   const wrap=statement=>({bind(...params){return wrap(statement.bind(...params));},async first(...args){stats.reads++;if(stats.fail)throw Error('Synthetic D1 failure');const value=await statement.first(...args);if(stats.race&&sql.includes('access_revision')){stats.race=false;await env.DB.prepare("INSERT INTO history VALUES(3,'a','servicio:barra')").run();}return value;},async all(...args){stats.reads++;if(stats.fail)throw Error('Synthetic D1 failure');return statement.all(...args);}});
   return wrap(db.prepare(sql));
  }});
  super(ctx,{...env,DB:instrument(env.DB)});this.stats=stats;this.testContext=ctx;
 }
 async fetch(request){
  const path=new URL(request.url).pathname;
  if(path==='/__stats')return Response.json({...this.stats,sockets:this.testContext.getWebSockets().filter(s=>s.readyState===1).length,alarm:await this.testContext.storage.getAlarm()});
  if(path==='/__alarm'){await this.alarm();return Response.json({ok:true});}
  if(path==='/__fail'){this.stats.fail=(await request.json()).enabled;return Response.json({ok:true});}
  if(path==='/__race'){this.stats.race=true;return Response.json({ok:true});}
  return super.fetch(request);
 }
}
export default {fetch(request,env){if(new URL(request.url).pathname==='/connect')return env.REALTIME.get(env.REALTIME.idFromName('inventory')).fetch(request);return new Response('Not found',{status:404});}};
`;
const bundle=await build({stdin:{contents:source,resolveDir:resolve('.')},bundle:true,write:false,format:'esm',target:'es2022',external:['cloudflare:workers']});
let outbound=0;
const mf=new Miniflare(convertV4MiniflareOptions({telemetry:{enabled:false},modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-01',
 d1Databases:{DB:'realtime-runtime-synthetic'},durableObjects:{REALTIME:{className:'RuntimeTest',useSQLite:true}},
 outboundService:async()=>{outbound++;throw Error('Network prohibited in realtime runtime test');}}));
const wait=async condition=>{const deadline=Date.now()+6000;while(!condition()){if(Date.now()>deadline)throw Error('Timed out waiting for realtime runtime event');await new Promise(resolve=>setTimeout(resolve,10));}};
const peers=[];let accessRevision=1;
try{
 assert.equal((await mf.dispatchFetch('http://localhost/')).status,404);
 const db=await mf.getD1Database('DB');
 await db.exec('CREATE TABLE history(seq INTEGER PRIMARY KEY,cycle_id TEXT,location_id TEXT); CREATE TABLE runtime_contract(id INTEGER PRIMARY KEY,users_metadata_revision INTEGER); INSERT INTO runtime_contract VALUES(1,1); CREATE TABLE cycle_registry(id INTEGER PRIMARY KEY,revision INTEGER); INSERT INTO cycle_registry VALUES(1,1);');
 const namespace=await mf.getDurableObjectNamespace('REALTIME'),stub=namespace.get(namespace.idFromName('inventory'));
 const stats=async()=>await(await stub.fetch('https://realtime.internal/__stats')).json();
 const invoke=async(path,data)=>{const response=await stub.fetch('https://realtime.internal/'+path,{method:'POST',...(data?{body:JSON.stringify(data)}:{})});assert.equal(response.status,200);};
 async function connect(cycleId='a',scopeIds=['servicio:barra']){
  const auth={userId:'synthetic-user',revision:1,accessRevision,expires:Math.floor(Date.now()/1000)+600,cycleId,scopeIds};
  const url=new URL('/connect',await mf.ready);url.protocol='ws:';
  const ws=new WebSocket(url,{closeTimeout:100,headers:{'X-Inventory-Context':JSON.stringify(auth)}});
  const peer={ws,messages:[],code:null};peers.push(peer);
  ws.on('upgrade',response=>assert.equal(response.statusCode,101));
  ws.on('message',data=>{const message=JSON.parse(data.toString());assert.deepEqual(Object.keys(message),['type']);peer.messages.push(message.type);});
  ws.on('close',code=>{peer.code=code;});ws.on('error',error=>{throw error;});
  await wait(()=>peer.messages.includes('ready'));return peer;
 }
 assert.equal((await stub.fetch('https://realtime.internal/connect',{headers:{Upgrade:'websocket'}})).status,403);
 const initial=await Promise.all(Array.from({length:30},(_,i)=>connect(i===3?'':i===2?'b':'a',i===1?['cocina']:['servicio:barra'])));
 assert.equal((await stats()).reads,1,'thirty simultaneous initial subscribers share one D1 snapshot');
 assert.equal((await stats()).sockets,30);
 await db.prepare("INSERT INTO history VALUES(1,'a','servicio:barra')").run();
 await wait(()=>initial[0].messages.includes('changed')); // Real scheduled alarm, not a mocked timer.
 assert.equal(initial[1].messages.includes('changed'),false);assert.equal(initial[2].messages.includes('changed'),false);assert.equal(initial[3].messages.includes('changed'),false);
 const afterChange=await stats();assert.equal(afterChange.reads,3,'one control + one bounded journal read shared by thirty peers');
 const beforeIdle=afterChange.reads;await invoke('__alarm');assert.equal((await stats()).reads,beforeIdle+1);
 const beforePing=(await stats()).reads;initial[0].ws.send(JSON.stringify({type:'ping'}));await wait(()=>initial[0].messages.includes('pong'));assert.equal((await stats()).reads,beforePing,'heartbeats never query D1');
 await db.prepare('UPDATE cycle_registry SET revision=revision+1').run();await invoke('__alarm');await wait(()=>initial.every(peer=>peer.messages.includes('refresh')));
 await db.prepare('UPDATE runtime_contract SET users_metadata_revision=users_metadata_revision+1').run();await invoke('__alarm');await wait(()=>initial.every(peer=>peer.code===4001));
 accessRevision=2;
 const stale={userId:'synthetic-user',revision:1,accessRevision:1,expires:Math.floor(Date.now()/1000)+600,cycleId:'a',scopeIds:['servicio:barra']};
 assert.equal((await stub.fetch('https://realtime.internal/connect',{headers:{Upgrade:'websocket','X-Inventory-Context':JSON.stringify(stale)}})).status,403,'revocation committed between API preflight and first initialization rejects stale context');
 await db.prepare('UPDATE runtime_contract SET users_metadata_revision=3').run();stale.accessRevision=2;
 assert.equal((await stub.fetch('https://realtime.internal/connect',{headers:{Upgrade:'websocket','X-Inventory-Context':JSON.stringify(stale)}})).status,403,'an idle rejected context never pins an obsolete cached access revision');
 accessRevision=3;
 const emptyReads=(await stats()).reads;await invoke('__alarm');assert.equal((await stats()).reads,emptyReads);assert.equal((await stats()).alarm,null);
 const race=await connect();await db.prepare("INSERT INTO history VALUES(2,'b','servicio:barra')").run();await invoke('__race');await invoke('__alarm');assert.equal(race.messages.filter(t=>t==='changed').length,0,'future authorized entry is outside the snapshot cursor');
 await invoke('__alarm');await wait(()=>race.messages.includes('changed'));assert.equal(race.messages.filter(t=>t==='changed').length,1);
 await invoke('__fail',{enabled:true});await invoke('__alarm');await wait(()=>race.code===1011);await invoke('__fail',{enabled:false});
 const overflow=await connect();await db.exec('INSERT INTO history(seq,cycle_id,location_id) VALUES '+Array.from({length:1001},(_,i)=>`(${i+4},'a','servicio:barra')`).join(','));await invoke('__alarm');await wait(()=>overflow.code===1012);
 const finalStats=await stats(),finalReads=finalStats.reads;await invoke('__alarm');assert.equal((await stats()).reads,finalReads);assert.equal((await stats()).alarm,null);assert.equal(outbound,0);
 console.log(JSON.stringify({pass:true,runtime:'local workerd + SQLite Durable Object + synthetic D1 + native WebSocket',peers:30,initialD1Reads:1,changedSweepD1Reads:2,idleSweepD1Reads:1,heartbeatD1Reads:0,emptySweepD1Reads:0,scopeAndCycleIsolation:true,snapshotUpperBound:true,authClose:4001,failureClose:1011,overflowClose:1012,outboundRequests:outbound,localClientCloseTimeoutMs:100,productionCPUCertified:false}));
}finally{for(const peer of peers)try{peer.ws.close();}catch{}await mf.dispose();}
