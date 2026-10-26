// No raw requests, identities, messages, DOM or arbitrary dimensions are retained.
const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'development';
const collectors = new WeakMap();
const pages = new Set(['home','account','count','summary','admin-users','supervision','other']);
const errors = new Set(['TypeError','ReferenceError','SyntaxError','RangeError','Error','SERVER_ERROR','NOT_INITIALIZED','NOT_CONFIGURED','other']);
const latency = [100,300,1000,3000,10000,60000];
function collector(env) {
 let c=collectors.get(env.DB);
 if(!c){c={rows:new Map(),next:0,busy:false,lost:0,failed:0,oldest:0,quota:0,window:0};collectors.set(env.DB,c);}
 return c;
}
function add(c,row,now){
 if(!c.oldest)c.oldest=now;
 const key=JSON.stringify(row.slice(0,7)); const old=c.rows.get(key);
 if(old){old[7]+=row[7];old[8]+=row[8];return;}
 if(c.rows.size>=512){const first=c.rows.keys().next().value;c.lost+=c.rows.get(first)[7];c.rows.delete(first);}
 c.rows.set(key,row);
}
async function flush(env,c,now){
 if(c.busy||now<c.next)return;
 c.busy=true;c.next=now+60000;
 const rows=[...c.rows.values()],lost=c.lost,failed=c.failed,age=Math.max(0,now-c.oldest);
 c.rows.clear();c.lost=0;c.failed=0;c.oldest=0;
 const n=rows.reduce((s,r)=>s+r[7],0),day=new Date(now).toISOString().slice(0,10);
 try{
  await env.DB.batch([
   ...rows.map(r=>env.DB.prepare(`INSERT INTO telemetry_hourly VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(hour,version,kind,route,device,metric,bucket) DO UPDATE SET n=n+excluded.n,value_sum=value_sum+excluded.value_sum`).bind(...r)),
   env.DB.prepare(`INSERT INTO collector_health VALUES(?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'),1,?,?,?,?) ON CONFLICT(day,version) DO UPDATE SET last_success_at=excluded.last_success_at,flushes=flushes+1,recorded=recorded+excluded.recorded,known_lost=known_lost+excluded.known_lost,failed_flushes=failed_flushes+excluded.failed_flushes,max_buffer_age_ms=max(max_buffer_age_ms,excluded.max_buffer_age_ms)`).bind(day,VERSION,n,lost,failed,age),
   env.DB.prepare("DELETE FROM telemetry_hourly WHERE (hour,version,kind,route,device,metric,bucket) IN (SELECT hour,version,kind,route,device,metric,bucket FROM telemetry_hourly WHERE hour<? LIMIT 1000)").bind(new Date(now-90*86400000).toISOString().slice(0,10)),
   env.DB.prepare('DELETE FROM collector_health WHERE day<?').bind(new Date(now-90*86400000).toISOString().slice(0,10))
  ]);
 }catch{c.lost+=lost+n;c.failed+=failed+1; /* A later successful flush persists this lower bound. */}
 finally{c.busy=false;}
}
export async function observeRequest(env,event,now=Date.now()){
 if(env.METRICS_ENABLED!=='1'||!env.DB)return;
 const c=collector(env),hour=new Date(now).toISOString().slice(0,13)+':00:00Z';
 const ms=Math.max(0,Math.min(60000,Math.round(Number(event.elapsedMs)||0)));
 const bucket=latency.find(x=>ms<x)??'overflow';
 add(c,[hour,VERSION,'latency',event.route,'server',String(Math.floor(event.status/100)),String(bucket),1,ms],now);
 if(event.status>=500)add(c,[hour,VERSION,'error',event.route,'server',errors.has(event.errorCode)?event.errorCode:'SERVER_ERROR','count',1,0],now);
 await flush(env,c,now);
}
const bad=(status,code)=>{throw Object.assign(Error(code),{status,code});};
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
export async function receiveTelemetry(req,env,now=Date.now()){
 if(!env.DB||!env.APP_ORIGIN||new URL(req.url).origin!==env.APP_ORIGIN)bad(503,'NOT_CONFIGURED');
 if(req.method!=='POST')bad(405,'METHOD_NOT_ALLOWED');
 if(req.headers.get('origin')!==env.APP_ORIGIN||req.headers.get('sec-fetch-site')==='cross-site')bad(403,'ORIGIN_REJECTED');
 if(env.METRICS_ENABLED!=='1')return new Response(null,{status:204});
 if(!req.headers.get('content-type')?.startsWith('application/json'))bad(415,'JSON_REQUIRED');
 const c=collector(env),win=Math.floor(now/60000);if(c.window!==win){c.window=win;c.quota=0;}
 if(++c.quota>120)bad(429,'RATE_LIMIT'); // Bounded per-isolate, no IP/user tracking.
 const reader=req.body?.getReader();let raw='',size=0;const decoder=new TextDecoder();
 if(reader)while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048){await reader.cancel();bad(413,'TOO_LARGE');}raw+=decoder.decode(value,{stream:true});}
 raw+=decoder.decode();let b;try{b=JSON.parse(raw);}catch{bad(400,'INVALID_JSON');}
 if(!exact(b,['version','page','device','vitals','errors'])||b.version!==VERSION||!pages.has(b.page)||!['mobile','other'].includes(b.device)||!Array.isArray(b.vitals)||b.vitals.length>3||!Array.isArray(b.errors)||b.errors.length>6||(!b.vitals.length&&!b.errors.length))bad(400,'INVALID_TELEMETRY');
 const seen=new Set(),rows=[],hour=new Date(now).toISOString().slice(0,13)+':00:00Z';let count=0;
 for(const v of b.vitals){
  if(!exact(v,['name','value'])||!['LCP','INP','CLS'].includes(v.name)||seen.has(v.name)||typeof v.value!=='number'||!Number.isFinite(v.value)||v.value<0||v.value>(v.name==='CLS'?100:600000))bad(400,'INVALID_TELEMETRY');
  seen.add(v.name);const thresholds=v.name==='LCP'?[2500,4000]:v.name==='INP'?[200,500]:[.1,.25];
  rows.push([hour,VERSION,'vital',b.page,b.device,v.name,v.value<=thresholds[0]?'good':v.value<=thresholds[1]?'needs_improvement':'poor',1,Math.round(v.value*(v.name==='CLS'?10000:1))]);
 }
 seen.clear();for(const e of b.errors){
  if(!exact(e,['code','count'])||!errors.has(e.code)||seen.has(e.code)||!Number.isSafeInteger(e.count)||e.count<1||(count+=e.count)>20)bad(400,'INVALID_TELEMETRY');
  seen.add(e.code);rows.push([hour,VERSION,'error',b.page,b.device,e.code,'count',e.count,0]);
 }
 for(const row of rows)add(c,row,now);
 await flush(env,c,now);
 return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
}
