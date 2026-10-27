// One private, SQLite-backed hibernating object per installation. It reads only
// indexed journal/control metadata; inventory data stays behind the API guards.
const INTERVAL=3000,MAX_SOCKETS=128;
const controlSQL=`SELECT coalesce((SELECT max(seq) FROM history),0) cursor,
 (SELECT users_metadata_revision FROM runtime_contract WHERE id=1) access_revision,
 (SELECT revision FROM cycle_registry WHERE id=1) registry_revision`;
export class InventoryRealtime {
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.running=null;this.initializing=null;}
 database(){return this.env.DB.withSession?this.env.DB.withSession('first-primary'):this.env.DB;}
 async fetch(req){
  if(new URL(req.url).pathname!=='/connect'||req.headers.get('upgrade')?.toLowerCase()!=='websocket')return new Response('Not found',{status:404});
  let auth;try{auth=JSON.parse(req.headers.get('X-Inventory-Context'));}catch{return new Response('Forbidden',{status:403});}
  if(!auth||typeof auth.userId!=='string'||auth.userId.length>150||!Number.isSafeInteger(auth.revision)||!Number.isSafeInteger(auth.accessRevision)||!Number.isSafeInteger(auth.expires)||auth.expires*1000<=Date.now()||typeof auth.cycleId!=='string'||auth.cycleId.length>150||!Array.isArray(auth.scopeIds)||auth.scopeIds.length>256||auth.scopeIds.some(s=>typeof s!=='string'||s.length>150))return new Response('Forbidden',{status:403});
  if(this.ctx.getWebSockets().length>=MAX_SOCKETS)return new Response('Busy',{status:503});
  // A returning first subscriber starts at the current journal head; its API
  // bootstrap/sync owns catch-up. Never replay an idle installation's history.
  let state;try { state=await this.initialize(); } catch { return new Response('Not ready',{status:503}); }
  if(state.access_revision!==auth.accessRevision)return new Response('Refresh access',{status:403});
  if(this.ctx.getWebSockets().length>=MAX_SOCKETS)return new Response('Busy',{status:503});
  const pair=new WebSocketPair(),client=pair[0],server=pair[1];
  this.ctx.acceptWebSocket(server);server.serializeAttachment(auth);
  server.send(JSON.stringify({type:'ready'}));
  if(await this.ctx.storage.getAlarm()===null)await this.ctx.storage.setAlarm(Date.now()+INTERVAL);
  return new Response(null,{status:101,webSocket:client});
 }
 async initialize(){
  if(this.initializing)return this.initializing;
  this.initializing=(async()=>{
   const stored=await this.ctx.storage.get('watch');
   if(stored&&this.ctx.getWebSockets().some(socket=>socket.readyState===1))return stored;
   const state=await this.database().prepare(controlSQL).first();
   if(!state||state.access_revision===null)throw Error('Contract unavailable');
   await this.ctx.storage.put('watch',state);return state;
  })().finally(()=>{this.initializing=null;});
  return this.initializing;
 }
 async alarm(){
  if(this.running)return this.running;
  this.running=this.sweep().finally(()=>{this.running=null;});return this.running;
 }
 async sweep(){
  let sockets=this.ctx.getWebSockets();
  for(const socket of sockets){try{if(socket.deserializeAttachment().expires*1000<=Date.now())socket.close(4001,'Refresh access');}catch{socket.close(4001,'Refresh access');}}
  sockets=sockets.filter(s=>s.readyState===1);
  if(!sockets.length){await this.ctx.storage.delete('watch');await this.ctx.storage.deleteAlarm();return;}
  try{
   const db=this.database(),previous=await this.ctx.storage.get('watch'),next=await db.prepare(controlSQL).first();
   if(!next||next.access_revision===null)throw Error('Contract unavailable');
   if(!previous||next.access_revision!==previous.access_revision){
    // Revocation/reset/logout/name changes invalidate connections before any
    // hints are sent; reconnect must pass current API authorization again.
    for(const socket of sockets)socket.close(4001,'Refresh access');
   }else{
    if(next.cursor!==previous.cursor){
     const result=await db.prepare('SELECT cycle_id,location_id FROM history WHERE seq>? AND seq<=? ORDER BY seq LIMIT 1001').bind(previous.cursor,next.cursor).all();
     if(result.results.length>1000){for(const socket of sockets)socket.close(1012,'Reconnect');}
     else for(const socket of sockets){
      const auth=socket.deserializeAttachment();
      if(auth.cycleId&&result.results.some(row=>row.cycle_id===auth.cycleId&&auth.scopeIds.includes(row.location_id)))socket.send(JSON.stringify({type:'changed'}));
     }
    }
    if(next.registry_revision!==previous.registry_revision){
     // Only configuration changed. Home may need a new default inventory;
     // counting/supervision re-read their authorized revision projection.
     for(const socket of sockets)if(socket.readyState===1)socket.send(JSON.stringify({type:'refresh'}));
    }
   }
   if(!previous||next.cursor!==previous.cursor||next.access_revision!==previous.access_revision||next.registry_revision!==previous.registry_revision)await this.ctx.storage.put('watch',next);
  }catch{
   // A failed watcher never suppresses a phone's fallback poll indefinitely.
   for(const socket of sockets)try{socket.close(1011,'Temporarily unavailable');}catch{}
  }
  if(this.ctx.getWebSockets().some(s=>s.readyState===1))await this.ctx.storage.setAlarm(Date.now()+INTERVAL);
  else{await this.ctx.storage.delete('watch');await this.ctx.storage.deleteAlarm();}
 }
 webSocketMessage(socket,message){
  try{if(socket.deserializeAttachment().expires*1000<=Date.now())socket.close(4001,'Refresh access');else if(typeof message==='string'&&message.length<=64&&JSON.parse(message)?.type==='ping')socket.send(JSON.stringify({type:'pong'}));else socket.close(1008,'Unsupported message');}catch{socket.close(1008,'Invalid connection');}
 }
 async webSocketClose(socket,code,reason){try{socket.close(code,reason);}catch{}await this.cleanup();}
 async webSocketError(socket){try{socket.close(1011,'Connection unavailable');}catch{}await this.cleanup();}
 async cleanup(){if(!this.ctx.getWebSockets().some(s=>s.readyState===1)){await this.ctx.storage.delete('watch');await this.ctx.storage.deleteAlarm();}}
}
// No public Worker endpoint: Pages accesses the namespace by its private binding.
export default {fetch(){return new Response('Not found',{status:404});}};
