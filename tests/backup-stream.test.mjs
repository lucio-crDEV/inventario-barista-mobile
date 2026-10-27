import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { runBackup, sealBackupStream, encryptionKey, backupHealth, INTERVAL_MS, MAX_STREAM_SQL_BYTES, MULTIPART_BYTES, STREAM_CHUNK_BYTES } from '../operations/backup-worker/index.js';
import { decryptBackupFile } from '../scripts/decrypt-backup.mjs';
const now=Date.now(), secret=Buffer.alloc(32,12).toString('base64');
function bucket() {
 const objects=new Map(), ops=[], uploads=[];let sequence=0;
 return {objects,ops,uploads,
  async get(key){ops.push(['get',key]);const value=objects.get(key);return value ? {etag:value.etag,json:async()=>JSON.parse(value.bytes.toString()),body:new Response(value.bytes).body,arrayBuffer(){throw Error('whole-object verification forbidden');}} : null;},
  async put(key,value,options={}){ops.push(['put',key]);const previous=objects.get(key);if(options.onlyIf && ((options.onlyIf instanceof Headers && previous) || (options.onlyIf.etagMatches && previous?.etag!==options.onlyIf.etagMatches))) return null; const item={bytes:Buffer.from(value),etag:String(++sequence)};objects.set(key,item);return item;},
  async delete(key){ops.push(['delete',key]);objects.delete(key);},
  async createMultipartUpload(key){ops.push(['multipart',key]);const upload={parts:[],aborted:false,async uploadPart(partNumber,bytes){assert.ok(bytes.length<=MULTIPART_BYTES);upload.parts.push(Buffer.from(bytes));return {partNumber,etag:String(partNumber)};},async complete(){objects.set(key,{bytes:Buffer.concat(upload.parts),etag:String(++sequence)});},async abort(){upload.aborted=true;}};uploads.push(upload);return upload;}
 };
}
const env=b=>({BACKUP_ENABLED:'1',CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),D1_DATABASE_ID:'a'.repeat(36),CF_BACKUP_TOKEN:'test-only',BACKUP_ENCRYPTION_KEY:secret,BACKUPS:b});
function fetchExport(sql){return async url=>String(url).includes('/d1/database/') ? Response.json({success:true,result:{status:'complete',result:{signed_url:'https://example.invalid/export'}}}) : new Response(sql);}
async function withFetch(fn,run){const original=globalThis.fetch;try{globalThis.fetch=fn;await run();}finally{globalThis.fetch=original;}}
const checkpoint=(createdAt)=>JSON.stringify({format:1,createdAt:new Date(createdAt).toISOString(),objectKey:'inventory/old.ibk'});

test('daily no-op reads only checkpoint; due boundary and private status do not prune historical data',async()=>{
 const b=bucket();await b.put('inventory/last-success.json',checkpoint(now));b.ops.length=0;
 await withFetch(()=>{throw Error('no network on no-op');},async()=>assert.deepEqual(await runBackup(env(b),now+86400000),{status:'not-due'}));
 assert.deepEqual(b.ops,[['get','inventory/last-success.json']]);
 assert.equal((await backupHealth(env(b),now+INTERVAL_MS)).status,'due');
 assert.equal((await backupHealth(env(bucket()),now)).status,'missing');
});

test('overlapping due runs use conditional lease; recheck after acquiring observes another completed backup',async()=>{
 const b=bucket();let calls=0,release;
 const blocked=new Promise(resolve=>{release=resolve;});
 await withFetch(async url=>{calls++;if(String(url).includes('/d1/database/')) {await blocked;return Response.json({success:true,result:{status:'complete',result:{signed_url:'https://example.invalid/export'}}});}return new Response('CREATE TABLE t(id);');},async()=>{
  const first=runBackup(env(b),now);while(!calls) await new Promise(resolve=>setImmediate(resolve));
  assert.equal((await runBackup(env(b),now)).status,'already-running');release();assert.equal((await first).status,'completed');assert.equal(calls,2);
 });
 const raced=bucket(),put=raced.put.bind(raced);
 raced.put=async(...args)=>{const result=await put(...args);if(args[0].endsWith('backup-lease.json')) await put('inventory/last-success.json',checkpoint(now));return result;};
 await withFetch(()=>{throw Error('must recheck');},async()=>assert.equal((await runBackup(env(raced),now)).status,'not-due'));
});

test('expired crash lease retries; export/readback failures never advance checkpoint or delete snapshots',async()=>{
 for(const failure of ['export','readback']) {
  const b=bucket();await b.put('inventory/last-success.json',checkpoint(now-INTERVAL_MS));await b.put('inventory/old.ibk','historical');await b.put('inventory/backup-lease.json',JSON.stringify({owner:'crashed',expires:now-1}));
  const previous=Buffer.from(b.objects.get('inventory/last-success.json').bytes);
  if(failure==='readback'){const get=b.get.bind(b);b.get=async key=>key.endsWith('.ibk') && !key.endsWith('old.ibk') ? {body:new Response('corrupt').body} : get(key);}
  await withFetch(failure==='export' ? async()=>new Response('',{status:500}) : fetchExport('CREATE TABLE t(id);'),async()=>assert.rejects(runBackup(env(b),now)));
  assert.deepEqual(b.objects.get('inventory/last-success.json').bytes,previous);assert.equal(b.objects.get('inventory/old.ibk').bytes.toString(),'historical');assert.ok(b.ops.filter(([op])=>op==='delete').every(([,key])=>key==='inventory/backup-lease.json'));
 }
});

test('IBK2 >8MiB SQL uses bounded multi-part upload and restores into isolated SQLite; tamper/truncate/reorder rejected',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'ibk2-scale-'));
 const data=randomBytes(6*1024*1024), sql=Buffer.from(`CREATE TABLE payload(value BLOB);\nINSERT INTO payload VALUES(X'${data.toString('hex')}');\n`);
 assert.ok(sql.length>8*1024*1024);
 try {
  const b=bucket();await withFetch(fetchExport(sql),async()=>assert.equal((await runBackup(env(b),now)).status,'completed'));
  assert.ok(b.uploads[0].parts.length>=2);assert.equal(b.uploads[0].parts[0].length,MULTIPART_BYTES);
  const last=JSON.parse(b.objects.get('inventory/last-success.json').bytes), encrypted=b.objects.get(last.objectKey).bytes;
  assert.equal(encrypted.subarray(0,4).toString(),'IBK2');const file=join(directory,'copy.ibk');writeFileSync(file,encrypted);
  const output=join(directory,'restored');await decryptBackupFile(file,output,secret);
  const restoredSQL=readFileSync(join(output,'database.sql'));assert.deepEqual(restoredSQL,sql);
  const db=new DatabaseSync(':memory:');try{db.exec(restoredSQL.toString());assert.equal(db.prepare('SELECT length(value) n FROM payload').get().n,data.length);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{db.close();}
  const manifest=JSON.parse(readFileSync(join(output,'manifest.json')));assert.equal(manifest.bytes,sql.length);assert.equal(manifest.encryptedFormat,2);
  const changed=Buffer.from(encrypted);changed[30]^=1;
  const firstLength=5+encrypted.readUInt32BE(13), secondOffset=12+firstLength, secondLength=5+encrypted.readUInt32BE(secondOffset+1);
  const reordered=Buffer.concat([encrypted.subarray(0,12),encrypted.subarray(secondOffset,secondOffset+secondLength),encrypted.subarray(12,secondOffset),encrypted.subarray(secondOffset+secondLength)]);
  for(const [name,bytes] of [['tampered',changed],['truncated',encrypted.subarray(0,-20)],['reordered',reordered],['appended',Buffer.concat([encrypted,Buffer.from('x')])]]) {
   writeFileSync(file,bytes);const rejected=join(directory,name);await assert.rejects(decryptBackupFile(file,rejected,secret));assert.equal(existsSync(rejected),false);
  }
  assert.ok(!readFileSync(join(output,'manifest.json')).includes('BACKUP_ENCRYPTION_KEY'));
 } finally {rmSync(directory,{recursive:true,force:true});}
});

test('stream ceiling aborts multipart upload before checkpoint; producer has backpressure',async()=>{
 const b=bucket();let generated=0;
 const sql=new ReadableStream({pull(controller){generated++;controller.enqueue(new Uint8Array(STREAM_CHUNK_BYTES));}});
 await withFetch(async url=>String(url).includes('/d1/database/') ? Response.json({success:true,result:{status:'complete',result:{signed_url:'https://example.invalid/export'}}}) : new Response(sql),async()=>assert.rejects(runBackup(env(b),now),/budget/));
 assert.ok(generated<=MAX_STREAM_SQL_BYTES/STREAM_CHUNK_BYTES+10);assert.equal(b.uploads[0].aborted,true);assert.equal(b.objects.has('inventory/last-success.json'),false);
});

test('Cron dispatch is disabled with no namespace calls and fails closed without private CPU-budget binding',async()=>{
 const {dispatchBackup,BackupJob,default:worker}=await import('../operations/backup-worker/index.js');
 const calls=[];const namespace={idFromName(name){calls.push(['id',name]);return 'only-job';},get(id){calls.push(['get',id]);return {async fetch(url,options){calls.push(['fetch',url,options.method]);return Response.json({status:'not-due'});}};}};
 assert.deepEqual(await dispatchBackup({BACKUP_JOBS:namespace}),{status:'disabled'});assert.equal(calls.length,0);
 await assert.rejects(dispatchBackup({BACKUP_ENABLED:'1'}),/binding missing/);
 const pending=[];worker.scheduled({}, {BACKUP_ENABLED:'1',BACKUP_JOBS:namespace},{waitUntil(promise){pending.push(promise);}});await Promise.all(pending);
 assert.deepEqual(calls,[['id','inventory-private-backup'],['get','only-job'],['fetch','https://backup.internal/run','POST']]);
 assert.equal((await worker.fetch()).status,404);
 assert.equal((await new BackupJob({},{}).fetch(new Request('https://backup.internal/run'))).status,404);
 assert.deepEqual(await (await new BackupJob({},{}).fetch(new Request('https://backup.internal/run',{method:'POST'}))).json(),{status:'disabled'});
});
