import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const root=resolve('.');
const require=createRequire(root+'/package.json');
const {Miniflare,convertV4MiniflareOptions}=require('miniflare'),{build}=require('esbuild');
const source=`import {requestMetrics} from '${root}/worker/request-metrics.js';
export default {async fetch(req,env){
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS probe(id INTEGER PRIMARY KEY,value TEXT)').run();
 await env.DB.prepare('INSERT INTO probe VALUES(1,?)').bind('fixture').run();
 const trace=requestMetrics(env.DB,()=>performance.now(),true),db=trace.DB;
 const native=await env.DB.prepare('SELECT * FROM probe WHERE id=?').bind(1).first();
 const wrapped=await db.prepare('SELECT * FROM probe WHERE id=?').bind(1).first();
 if(JSON.stringify(native)!==JSON.stringify(wrapped))throw Error('first mismatch');
 if(await db.prepare('SELECT * FROM probe WHERE id=99').first()!==null)throw Error('empty mismatch');
 if(await db.prepare('SELECT value FROM probe').first('value')!=='fixture')throw Error('column mismatch');
 const rows=await db.batch([db.prepare('UPDATE probe SET value=? WHERE id=1').bind('updated'),db.prepare('SELECT value FROM probe WHERE id=1')]);
 if(rows[1].results[0].value!=='updated')throw Error('batch mismatch');
 let rejected=false;try{await db.batch([db.prepare('UPDATE probe SET value=? WHERE id=1').bind('rolled-back'),db.prepare('INSERT INTO nonexistent VALUES(1)')]);}catch{rejected=true;}
 if(!rejected||(await env.DB.prepare('SELECT value FROM probe WHERE id=1').first('value'))!=='updated')throw Error('rollback mismatch');
 const metrics=trace.finish();if(metrics.stats.metadata_missing!==2||metrics.stats.statements!==7||metrics.stats.calls!==5)throw Error('metadata mismatch '+JSON.stringify(metrics));
 return Response.json({pass:true,runtime:'local workerd/D1',metadata:metrics.stats,sqlDataStored:false});
}}`;
const bundle=await build({stdin:{contents:source,resolveDir:root},bundle:true,write:false,format:'esm',target:'es2022'});
const mf=new Miniflare(convertV4MiniflareOptions({telemetry:{enabled:false},modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-01',d1Databases:{DB:'metrics-isolated'},}));
try{const response=await mf.dispatchFetch('http://localhost/');const out=await response.text();console.log(out);if(response.status!==200)throw Error('D1 runtime test failed');}finally{await mf.dispose();}
