import test from 'node:test';
import assert from 'node:assert/strict';
import {requestMetrics} from '../worker/request-metrics.js';
import {sqliteDB} from './shared/sqlite-adapter.mjs';
import worker from '../worker/index.js';
import {createHash} from 'node:crypto';

test('D1 measurement executes once, unwraps batch, preserves results, and keeps no SQL/content',async()=>{
 let time=0,calls=0;
 const DB={prepare(sql){return {bind(...args){this.args=args;return this;},async all(){calls++;time+=2;if(sql==='bad')throw Error('private-error');return {results:sql==='empty'?[]:[{secret:'private-result'}],meta:{rows_read:7,rows_written:0,timings:{sql_duration_ms:.7}}};},async run(){calls++;time+=3;return {meta:{rows_read:1,rows_written:2,duration:.3}};}};},async batch(statements){return Promise.all(statements.map(s=>s.all()));}};
 const measure=requestMetrics(DB,()=>time,true),db=measure.DB;
 assert.deepEqual(await db.prepare('private-sql').bind('private-binding').first(),{secret:'private-result'});
 assert.equal(await db.prepare('empty').first(),null);
 assert.equal(await db.prepare('value').first('secret'),'private-result');
 await db.prepare('write').run();
 assert.equal((await db.batch([db.prepare('one'),db.prepare('two')])).length,2);
 await assert.rejects(db.prepare('bad').first(),/private-error/);
 assert.equal(calls,7);
 const result=measure.finish();
 assert.equal(result.stats.calls,6);assert.equal(result.stats.statements,7);
 assert.equal(result.stats.rows_read,36);assert.equal(result.stats.rows_written,2);
 assert.equal(result.stats.metadata_missing,1);
 assert.equal(result.phases.preflight,15);
 assert.deepEqual(result,measure.finish());
 assert.ok(!JSON.stringify(result).includes('private'));
 assert.match(measure.serverTiming(),/d1_rows_read;desc="36"/);
});

test('missing D1 metadata remains explicit; phases accumulate and freeze at completion',async()=>{
 const DB=sqliteDB(11);let now=0;
 try{const measure=requestMetrics(DB,()=>now,false);
 now=2;measure.phase('auth');now=5;measure.phase('cycle');now=9;measure.phase('handler');
 await measure.DB.prepare('SELECT 1 value').first();now=12;
 const result=measure.finish();now=100;
 assert.deepEqual(result.phases,{preflight:2,auth:3,cycle:4,handler:3});
 assert.equal(result.sampled,false);assert.equal(result.stats.metadata_missing,1);
 assert.deepEqual(measure.finish(),result);
 }finally{DB.sqlite.close();}
});

test('HTTP timing headers are admin-only, opt-in, and no collector query is recursively metered',async()=>{
 const DB=sqliteDB(15),origin='https://example.test';
 DB.sqlite.exec("INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES('admin','admin','Admin','!hash','admin',0),('worker','worker','Worker','!hash','worker',0);INSERT INTO cycles(id,name,catalog_version,state) VALUES('test','Test','inventory-v3-2026-10-22','open');");
 const headers=id=>{const raw=(id==='admin'?'a':'b').repeat(64);DB.sqlite.prepare('INSERT INTO sessions VALUES(?,?,unixepoch()+3600)').run(createHash('sha256').update(raw).digest('hex'),id);return {cookie:`__Host-inventory_session=${raw}`};};
 const admin=headers('admin'),ordinary=headers('worker');
 const env={DB,APP_ENV:'production',APP_ORIGIN:origin,ACTIVE_CYCLE_ID:'test',METRICS_ENABLED:'1'};
 async function get(headers,e=env){const waits=[];const response=await worker.fetch(new Request(origin+'/api/me',{headers}),e,{waitUntil:p=>waits.push(p)});await Promise.all(waits);return response;}
 try{
  const response=await get(admin);assert.equal(response.status,200);
  assert.match(response.headers.get('Server-Timing'),/d1_statements;desc="2"/);
  assert.match(response.headers.get('Server-Timing'),/d1_metadata_missing;desc="2"/);
  assert.equal((await get(ordinary)).headers.get('Server-Timing'),null);
  assert.equal((await get({})).headers.get('Server-Timing'),null);
  assert.equal((await get(admin,{...env,METRICS_ENABLED:'0'})).headers.get('Server-Timing'),null);
  assert.equal(DB.sqlite.prepare('SELECT sum(requests) n FROM usage_daily').get().n,1);
 }finally{DB.sqlite.close();}
});
