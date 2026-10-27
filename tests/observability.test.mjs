import test from 'node:test';
import assert from 'node:assert/strict';
import { sqliteDB } from './shared/sqlite-adapter.mjs';
import {observeRequest,receiveTelemetry} from '../worker/observability.js';
const now=Date.UTC(2026,9,26,10), origin='http://127.0.0.1:8790';
const env=DB=>({DB,METRICS_ENABLED:'1',APP_ORIGIN:origin});
const report={version:'development',page:'count',device:'mobile',vitals:[{name:'LCP',value:2500},{name:'CLS',value:.26}],errors:[{code:'TypeError',count:2}]};
const req=b=>new Request(origin+'/api/telemetry',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(b)});
test('histograms preserve version, boundaries, sums and server errors without private content',async()=>{
 const DB=sqliteDB(11);try{const e=env(DB);
 await observeRequest(e,{route:'count',status:200,elapsedMs:99},now);
 for(const ms of [100,299,300,999,1000,2999,3000,9999,10000,60000])await observeRequest(e,{route:'count',status:200,elapsedMs:ms},now+1);
 await observeRequest(e,{route:'count',status:500,elapsedMs:50,errorCode:'private text'},now+60001);
 const rows=DB.sqlite.prepare("SELECT bucket,sum(n) n FROM telemetry_hourly WHERE kind='latency' GROUP BY bucket").all();assert.equal(rows.reduce((s,r)=>s+r.n,0),12);assert.equal(rows.find(r=>r.bucket==='100').n,2);
 assert.equal(DB.sqlite.prepare("SELECT metric FROM telemetry_hourly WHERE kind='error'").get().metric,'SERVER_ERROR');
 assert.equal(DB.sqlite.prepare('SELECT sum(recorded) n FROM collector_health').get().n,13);
 }finally{DB.sqlite.close();}
});
test('client ingest validates whole payload, rejects private extras, does not require session',async()=>{
 const DB=sqliteDB(11);try{const e=env(DB);
 for(const b of [{...report,name:'someone'},{...report,vitals:[{name:'INP',value:-1}]},{...report,version:'untrusted'},{...report,errors:[{code:'private-message',count:1}]}])await assert.rejects(receiveTelemetry(req(b),e,now),x=>x.status===400);
 assert.equal(DB.sqlite.prepare('SELECT count(*) n FROM telemetry_hourly').get().n,0);
 assert.equal((await receiveTelemetry(req(report),e,now)).status,204);
 assert.equal(DB.sqlite.prepare("SELECT value_sum FROM telemetry_hourly WHERE metric='CLS'").get().value_sum,2600);
 assert.equal(DB.sqlite.prepare("SELECT bucket FROM telemetry_hourly WHERE metric='LCP'").get().bucket,'good');
 assert.equal(DB.sqlite.prepare("SELECT n FROM telemetry_hourly WHERE metric='TypeError'").get().n,2);
 await assert.rejects(receiveTelemetry(new Request(origin+'/api/telemetry',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'}),e,now),x=>x.status===403);
 }finally{DB.sqlite.close();}
});
test('known failed observations persist on recovery; shutdown losses remain unknown',async()=>{
 const DB=sqliteDB(11);try{const e=env(DB),batch=DB.batch;let failed=true;DB.batch=async s=>{if(failed)throw Error('unavailable');return batch(s);};
 await observeRequest(e,{route:'sync',status:200,elapsedMs:10},now);failed=false;
 await observeRequest(e,{route:'sync',status:200,elapsedMs:10},now+60001);
 const h=DB.sqlite.prepare('SELECT * FROM collector_health').get();assert.equal(h.known_lost,1);assert.equal(h.failed_flushes,1);assert.equal(h.recorded,1);
 assert.equal(DB.sqlite.prepare("SELECT sum(n) n FROM telemetry_hourly WHERE kind='latency'").get().n,1);
 }finally{DB.sqlite.close();}
});
test('HTTP receiver bypasses user data and excludes itself from request statistics',async()=>{
 const {default:worker}=await import('../worker/index.js');const DB=sqliteDB(11);
 try{const waits=[],e={...env(DB),APP_ENV:'local'};const response=await worker.fetch(req(report),e,{waitUntil:p=>waits.push(p)});await Promise.all(waits);
 assert.equal(response.status,204);assert.equal(response.headers.get('set-cookie'),null);
 assert.equal(DB.sqlite.prepare('SELECT count(*) n FROM usage_daily').get().n,0);
 assert.equal(DB.sqlite.prepare('SELECT count(*) n FROM telemetry_hourly').get().n,3);
 }finally{DB.sqlite.close();}
});


test('unified collector preserves daily reports; minute batching avoids repeated retention work',async()=>{
 const DB=sqliteDB(11);try{const e=env(DB),base=DB.batch;let batches=0;const sizes=[];
 DB.batch=async statements=>{batches++;sizes.push(statements.length);return base(statements);};
 await observeRequest(e,{route:'count',method:'POST',status:200,elapsedMs:12},now);
 for(let n=1;n<60;n++)await observeRequest(e,{route:'count',method:'POST',status:200,elapsedMs:12},now+n*1000);
 await observeRequest(e,{route:'count',method:'POST',status:200,elapsedMs:12},now+60000);
 assert.equal(batches,2);assert.deepEqual(sizes,[6,3]);
 assert.equal(DB.sqlite.prepare('SELECT requests FROM usage_daily').get().requests,61);
 assert.equal(DB.sqlite.prepare("SELECT sum(n) n FROM telemetry_hourly WHERE kind='latency'").get().n,61);
 }finally{DB.sqlite.close();}
});

test('sampled diagnostics use fixed numeric dimensions and never infer complete row totals',async()=>{
 const DB=sqliteDB(11);try{const e=env(DB);
 const diagnostics={sampled:true,stats:{calls:4,statements:5,rows_read:1914,rows_written:0,metadata_missing:0,sql_ms:1,binding_ms:480,private:'never'},phases:{preflight:300,auth:100,cycle:0,handler:80,private:400}};
 await observeRequest(e,{route:'me',method:'GET',status:200,elapsedMs:480,diagnostics},now);
 await observeRequest(e,{route:'me',method:'GET',status:200,elapsedMs:480,diagnostics:{...diagnostics,sampled:false}},now+60000);
 const read=DB.sqlite.prepare("SELECT n,value_sum FROM telemetry_hourly WHERE kind='d1' AND metric='rows_read'").get();
 assert.deepEqual({...read},{n:1,value_sum:1914});
 assert.equal(DB.sqlite.prepare("SELECT count(*) n FROM telemetry_hourly WHERE metric='private'").get().n,0);
 assert.equal(DB.sqlite.prepare('SELECT requests FROM usage_daily').get().requests,2);
 await observeRequest(e,{route:'me',status:500,diagnostics:{...diagnostics,stats:{...diagnostics.stats,metadata_missing:1}}},now+120000);
 assert.equal(DB.sqlite.prepare("SELECT n FROM telemetry_hourly WHERE kind='d1' AND metric='rows_read'").get().n,1);
 assert.equal(DB.sqlite.prepare("SELECT sum(value_sum) n FROM telemetry_hourly WHERE kind='d1' AND metric='metadata_missing'").get().n,1);
 }finally{DB.sqlite.close();}
});

test('in-flight flush keeps new arrivals and records one loss without replay after ambiguous failure',async()=>{
 const DB=sqliteDB(11);try{const e=env(DB),base=DB.batch;let release;let first=true;
 DB.batch=async s=>{if(first){first=false;await new Promise(r=>release=r);throw Error('ambiguous');}return base(s);};
 const pending=observeRequest(e,{route:'sync',status:200,elapsedMs:1},now);
 await observeRequest(e,{route:'sync',status:200,elapsedMs:2},now+1);release();await pending;
 await observeRequest(e,{route:'sync',status:200,elapsedMs:3},now+60000);
 assert.equal(DB.sqlite.prepare('SELECT sum(requests) n FROM usage_daily').get().n,2);
 assert.equal(DB.sqlite.prepare("SELECT sum(n) n FROM telemetry_hourly WHERE kind='latency'").get().n,2);
 const health=DB.sqlite.prepare('SELECT * FROM collector_health').get();assert.equal(health.known_lost,1);assert.equal(health.failed_flushes,1);
 }finally{DB.sqlite.close();}
});


test('retention hourly marker is shared across instances and never prunes operational tables',async()=>{
 const DB=sqliteDB(11);try{const first=env(DB),second=env({prepare:DB.prepare,batch:DB.batch});
 DB.sqlite.exec("INSERT INTO usage_daily VALUES('2020-01-01','count','POST',2,1,1,0)");
 await observeRequest(first,{route:'sync',status:200,elapsedMs:1},now);
 assert.equal(DB.sqlite.prepare("SELECT count(*) n FROM usage_daily WHERE day='2020-01-01'").get().n,0);
 DB.sqlite.exec("INSERT INTO usage_daily VALUES('2020-01-01','count','POST',2,1,1,0)");
 await observeRequest(second,{route:'sync',status:200,elapsedMs:1},now+1000);
 assert.equal(DB.sqlite.prepare("SELECT count(*) n FROM usage_daily WHERE day='2020-01-01'").get().n,1);
 await observeRequest(first,{route:'sync',status:200,elapsedMs:1},now+3600000);
 assert.equal(DB.sqlite.prepare("SELECT count(*) n FROM usage_daily WHERE day='2020-01-01'").get().n,0);
 assert.equal(DB.sqlite.prepare("SELECT count(*) n FROM sqlite_schema WHERE type='table' AND name IN ('users','counts','history')").get().n,3);
 }finally{DB.sqlite.close();}
});
