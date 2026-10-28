import {exportPolicy} from '../../worker/export-plan.js';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
// Isolated native provider test. Synthetic local D1/R2 only; all outbound blocked.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {sqliteDB} from './sqlite-adapter.mjs';
import {excelTemplate} from '../../data/inventario/export-template.js';
const require=createRequire(resolve('package.json'));
const {Miniflare,convertV4MiniflareOptions}=require('miniflare'),{build}=require('esbuild');
const hash='a'.repeat(64),id=randomUUID(),userId='synthetic-export-admin';
const local=sqliteDB(14);let payload,metadata;
try {
 local.sqlite.prepare("INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES(?,?,?,'!','admin',0)").run(userId,userId,'Synthetic');
 local.sqlite.prepare('INSERT INTO sessions VALUES(?,?,unixepoch()+3600)').run(hash,userId);
 local.sqlite.exec("INSERT INTO cycles(id,name,catalog_version,state) VALUES('runtime-export','Synthetic','inventory-v3-2026-10-22','closed')");
 local.sqlite.prepare(`INSERT INTO export_snapshot_commands(id,fingerprint,user_id,session_hash,user_revision,cycle_id,expected_revision,expected_completion_revision,template_id,template_sha256,policy_id)
  VALUES(?,?,?,?,1,'runtime-export',1,1,?,?,?)`).run(id,'synthetic-fingerprint',userId,hash,excelTemplate.id,excelTemplate.sha256,exportPolicy.id);
 metadata=local.sqlite.prepare('SELECT * FROM export_snapshots WHERE id=?').get(id);
 payload=local.sqlite.prepare("SELECT group_concat(content,'') payload FROM (SELECT content FROM export_snapshot_chunks WHERE snapshot_id=? ORDER BY part)").get(id).payload;
}finally{local.sqlite.close();}
const source=`import {InventoryExport as Native} from ${JSON.stringify(resolve('operations/export-worker/entry.js'))};
export class RuntimeTest extends Native {
 constructor(ctx,env){super(ctx,env);this.testContext=ctx;}
 async fetch(request){const path=new URL(request.url).pathname;
  if(path==='/__run'){await this.alarm();return Response.json({ok:true});}
  if(path==='/__state')return Response.json({job:await this.testContext.storage.get('job'),alarm:await this.testContext.storage.getAlarm(),sql:[...this.testContext.storage.sql.exec('SELECT 1 enabled')][0].enabled});
  return super.fetch(request);
 }
}
export default {fetch(){return new Response('Not found',{status:404});}};`;
const bundle=await build({stdin:{contents:source,resolveDir:resolve('.')},bundle:true,write:false,format:'esm',target:'es2022',external:['cloudflare:workers']});
let outbound=0;
const mf=new Miniflare(convertV4MiniflareOptions({telemetry:{enabled:false},modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-01',
 d1Databases:{DB:'export-runtime-synthetic'},durableObjects:{EXPORTS:{className:'RuntimeTest',useSQLite:true}},r2Buckets:{EXPORT_FILES:'export-runtime-private'},
 outboundService:async()=>{outbound++;throw Error('Outbound prohibited in export runtime test');}}));
try {
 assert.equal((await mf.dispatchFetch('http://localhost/')).status,404);
 const db=await mf.getD1Database('DB');
 for(const sql of [
  'CREATE TABLE users(id TEXT PRIMARY KEY,revision INTEGER,role TEXT,active INTEGER,deleted_at TEXT,must_change INTEGER)',
  'CREATE TABLE sessions(hash TEXT PRIMARY KEY,user_id TEXT,expires INTEGER)',
  'CREATE TABLE export_snapshot_commands(id TEXT PRIMARY KEY,result TEXT)',
  'CREATE TABLE export_snapshots(id TEXT PRIMARY KEY,command_id TEXT,cycle_id TEXT,template_id TEXT,template_sha256 TEXT,policy_id TEXT)',
  'CREATE TABLE export_snapshot_chunks(snapshot_id TEXT,part INTEGER,content TEXT,PRIMARY KEY(snapshot_id,part))',
 ])await db.prepare(sql).run();
 await db.prepare("INSERT INTO users VALUES(?,1,'admin',1,NULL,0)").bind(userId).run();
 await db.prepare('INSERT INTO sessions VALUES(?,?,unixepoch()+3600)').bind(hash,userId).run();
 await db.prepare("INSERT INTO export_snapshot_commands VALUES(?,'{}')").bind(id).run();
 await db.prepare('INSERT INTO export_snapshots VALUES(?,?,?,?,?,?)').bind(id,id,metadata.cycle_id,metadata.template_id,metadata.template_sha256,metadata.policy_id).run();
 const inserts=[];for(let offset=0;offset<payload.length;offset+=8192)inserts.push(db.prepare('INSERT INTO export_snapshot_chunks VALUES(?,?,?)').bind(id,offset/8192+1,payload.slice(offset,offset+8192)));
 await db.batch(inserts);
 const namespace=await mf.getDurableObjectNamespace('EXPORTS'),stub=namespace.get(namespace.idFromName('snapshot:'+id));
 const headers={'X-Inventory-Export-Context':JSON.stringify({snapshotId:id,userId,revision:1,hash})};
 const call=action=>stub.fetch('https://exports.internal/'+action,{headers,method:action==='generate'?'POST':'GET'});
 const inspect=async()=>await (await stub.fetch('https://exports.internal/__state')).json();
 const started=await Promise.all(Array.from({length:5},()=>call('generate')));assert.ok(started.every(r=>r.status===202));
 // The real persisted alarm attempts generation, finds the missing private
 // template, and schedules a bounded retry. Repairing configuration can resume.
 const deadline=Date.now()+6000;let state;
 do{state=await inspect();if(state.job?.attempts>=1&&state.job.state==='queued')break;await new Promise(resolve=>setTimeout(resolve,15));}while(Date.now()<deadline);
 assert.equal(state.job.state,'queued');assert.equal(state.job.attempts,1);assert.equal(state.sql,1);assert.ok(state.alarm>Date.now());
 const bucket=await mf.getR2Bucket('EXPORT_FILES');await bucket.put('template/'+excelTemplate.sha256,await readFile(excelTemplate.path));
 await stub.fetch('https://exports.internal/__run');
 const ready=await (await call('artifact')).json();assert.equal(ready.state,'ready');assert.equal(ready.attempts,2);
 const one=await call('file'),first=new Uint8Array(await one.arrayBuffer());assert.equal(one.headers.get('Cache-Control'),'no-store');assert.equal(one.headers.get('X-Content-Type-Options'),'nosniff');
 assert.equal(createHash('sha256').update(first).digest('hex'),ready.sha256);
 const directory=await mkdtemp(join(tmpdir(),'native-export-verify-'));
 try {
  const file=join(directory,'copy.xlsx');await writeFile(file,first,{mode:0o600});
  const check=spawnSync('python3',['scripts/verify-excel-template.py','--candidate',file,'--recalculate-on-open'],{encoding:'utf8'});
  assert.equal(check.status,0,check.stderr);
 } finally {await rm(directory,{recursive:true,force:true});}
 assert.deepEqual(new Uint8Array(await (await call('file')).arrayBuffer()),first);
 assert.equal((await (await call('generate')).json()).sha256,ready.sha256);
 const objects=await bucket.list({prefix:'exports/'});assert.equal(objects.objects.length,1);
 const final=await inspect();assert.equal(final.alarm,null);assert.ok(!JSON.stringify(final.job).includes(hash));
 await db.prepare('DELETE FROM sessions WHERE hash=?').bind(hash).run();
 for(const action of ['artifact','file','generate'])assert.equal((await call(action)).status,403);
 assert.equal(outbound,0);
 console.log(JSON.stringify({pass:true,runtime:'local workerd + SQLite Durable Object + D1 + private R2',realAlarmRetry:true,simultaneousStarts:5,stableRedownload:true,currentSessionRevocation:true,artifactObjects:1,independentFidelityCheck:true,recalculateOnOpen:exportPolicy.recalculateOnOpen,outboundRequests:outbound,productionCPUCertified:false}));
}finally{await mf.dispose();}
