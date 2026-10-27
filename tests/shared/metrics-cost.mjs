// Deterministic collector-only comparison. No network/real DB/billed-row model.
import {execFileSync} from 'node:child_process';
import {observeRequest} from '../../worker/observability.js';
import assert from 'node:assert/strict';
const original=name=>execFileSync('git',['show',`2f515a3:worker/${name}`],{encoding:'utf8'});
const legacy=original('telemetry.js'), hourly=original('observability.js');
const load=(source,id)=>import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${id}`);
const baseline={calls:0,statements:0},current={calls:0,statements:0};
function db(totals){return {prepare(){const s={bind(){return s;},async run(){totals.calls++;totals.statements++;return {};}};return s;},async batch(statements){totals.calls++;totals.statements+=statements.length;return [];}};}
let position=0,samples=0;
for(let client=0;client<30;client++){
 const oldDaily=await load(legacy,client),oldHourly=await load(hourly,client);
 const oldEnv={DB:db(baseline),METRICS_ENABLED:'1'},env={DB:db(current),METRICS_ENABLED:'1'};
 for(let poll=0;poll<4*3600/5;poll++){
  const now=Date.UTC(2026,9,27,10)+poll*5000;
  const event={route:'sync',method:'GET',status:200,elapsedMs:100};
  await oldDaily.recordMetric(oldEnv,event,now);await oldHourly.observeRequest(oldEnv,event,now);
  const sampled=++position%1000===0;if(sampled)samples++;
  await observeRequest(env,{...event,diagnostics:{sampled,stats:{calls:9,statements:11,rows_read:0,rows_written:0,metadata_missing:0,sql_ms:1,binding_ms:80},phases:{preflight:20,auth:20,cycle:30,handler:30}}},now);
 }
}
assert.ok(current.calls<baseline.calls);assert.ok(current.statements<baseline.statements);
console.log(JSON.stringify({scenario:{clients:30,hours:4,pollSeconds:5,requests:position,diagnosticSamples:samples},baseline,current,reductionPercent:{dbCalls:Math.round((1-current.calls/baseline.calls)*1000)/10,statements:Math.round((1-current.statements/baseline.statements)*1000)/10},limits:['Models30 stable isolates, same route, healthy storage, deterministic0.1% diagnostic sample.','Counts external D1 invocations/statements, not rows read/written or cost.','No application query, server throughput, CPU or R2 measurement.','Final buffered events await next request; process termination losses remain unknown.']},null,2));
