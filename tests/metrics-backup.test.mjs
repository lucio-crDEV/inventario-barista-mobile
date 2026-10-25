import test from 'node:test';
import assert from 'node:assert/strict';
import { sqliteDB } from './shared/sqlite-adapter.mjs';
import { recordMetric, routeName } from '../worker/telemetry.js';
import { isDue, INTERVAL_MS, encryptionKey, sealBackup, runBackup } from '../operations/backup-worker/index.js';
import { createDecipheriv } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

test('telemetry opt-in, safe dimensions, minute batching, retention only metrics', async () => {
 assert.equal(routeName('/api/cycles'),'cycles');
 assert.equal(routeName('/api/admin/cycles/command'),'inventory-management');
 const DB = sqliteDB(9); const now = Date.UTC(2026,9,25);
 try {
  await recordMetric({DB},{route:'count',method:'POST',status:200,elapsedMs:15},now);
  assert.equal(DB.sqlite.prepare('SELECT count(*) n FROM usage_daily').get().n,0);
  DB.sqlite.exec("INSERT INTO usage_daily VALUES('2020-01-01','count','POST',2,1,1,0)");
  const env = {DB,METRICS_ENABLED:'1'};
  await recordMetric(env,{route:'alice/private',method:'SECRET',status:200,elapsedMs:1500,username:'never-store'},now);
  await recordMetric(env,{route:'count',method:'POST',status:409,elapsedMs:15},now+1);
  assert.equal(DB.sqlite.prepare('SELECT count(*) n FROM usage_daily').get().n,1);
  await recordMetric(env,{route:'count',method:'POST',status:200,elapsedMs:20},now+60001);
  const rows = DB.sqlite.prepare('SELECT * FROM usage_daily ORDER BY route,status_class').all();
  assert.equal(rows.length,3); assert.equal(rows[2].route,'unknown'); assert.equal(rows[2].method,'other'); assert.equal(rows[2].slow_requests,1);
  assert.equal(rows[0].requests,1); assert.equal(rows[1].status_class,4);
  assert.equal(DB.sqlite.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name='users'").get().n,1);
 } finally { DB.sqlite.close(); }
});
test('backup exact90day cadence and invalid checkpoints', () => {
 const now=Date.now(); assert.equal(isDue(null,now),true);
 assert.equal(isDue({createdAt:new Date(now-INTERVAL_MS+1).toISOString()},now),false);
 assert.equal(isDue({createdAt:new Date(now-INTERVAL_MS).toISOString()},now),true);
 assert.throws(()=>isDue({createdAt:'broken'},now));
});
test('encrypted backup roundtrip preserves SQL and verifies tampering',async()=>{
 const secret=Buffer.alloc(32,7); const key=await encryptionKey(secret.toString('base64'));
 const sql='CREATE TABLE t(id INTEGER PRIMARY KEY);\nINSERT INTO t VALUES(7);\n';
 const sealed=await sealBackup(sql,key);
 const decrypt=bytes=>{
  const decipher=createDecipheriv('aes-256-gcm',secret,bytes.subarray(4,16));
  decipher.setAAD(Buffer.from('inventory-backup-v1')); decipher.setAuthTag(bytes.subarray(-16));
  return JSON.parse(gunzipSync(Buffer.concat([decipher.update(bytes.subarray(16,-16)),decipher.final()])).toString());
 };
 const bytes=Buffer.from(sealed.output); const restored=decrypt(bytes);
 assert.equal(restored.sql,sql); assert.equal(restored.manifest.bytes,Buffer.byteLength(sql));
 bytes[20]^=1; assert.throws(()=>decrypt(bytes));
});
test('scheduled backup disabled requires no services and failed export never advances checkpoint',async()=>{
 assert.deepEqual(await runBackup({}),{status:'disabled'});
 const original=globalThis.fetch; const writes=[];
 try {
  globalThis.fetch=async()=>new Response('{}',{status:403});
  await assert.rejects(runBackup({BACKUP_ENABLED:'1',CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),D1_DATABASE_ID:'a'.repeat(36),CF_BACKUP_TOKEN:'fake',BACKUP_ENCRYPTION_KEY:Buffer.alloc(32,1).toString('base64'),BACKUPS:{get:async()=>null,put:async(key)=>{writes.push(key);return {};},delete:async()=>{}}}));
  assert.deepEqual(writes,['inventory/backup-lease.json']);
 } finally {globalThis.fetch=original;}
});
test('scheduled complete export verifies R2 before checkpoint; downloaded artifact restores in SQLite',async()=>{
 const original=globalThis.fetch; const objects=new Map(); const secret=Buffer.alloc(32,4);
 const sql='CREATE TABLE users(id TEXT PRIMARY KEY);\nINSERT INTO users VALUES(\'retained-author\');\nCREATE TABLE sessions(hash TEXT);\n';
 const bucket={
  async get(key){const bytes=objects.get(key);return bytes ? {json:async()=>JSON.parse(Buffer.from(bytes).toString()),arrayBuffer:async()=>Uint8Array.from(bytes).buffer} : null;},
  async put(key,value){objects.set(key,typeof value==='string'?Buffer.from(value):Buffer.from(value));return {};},
  async delete(key){objects.delete(key);}
 };
 try {
  globalThis.fetch=async url=>String(url).includes('/export') ? Response.json({success:true,result:{status:'complete',result:{signed_url:'https://example.com/signed-export'}}}) : new Response(sql);
  const env={BACKUP_ENABLED:'1',CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),D1_DATABASE_ID:'a'.repeat(36),CF_BACKUP_TOKEN:'fake',BACKUP_ENCRYPTION_KEY:secret.toString('base64'),BACKUPS:bucket};
  assert.equal((await runBackup(env,Date.UTC(2026,9,25))).status,'completed');
  assert.equal((await runBackup(env,Date.UTC(2026,9,26))).status,'not-due');
  const checkpoint=JSON.parse(objects.get('inventory/last-success.json').toString());
  const bytes=objects.get(checkpoint.objectKey); assert.equal(objects.size,2);
  const decipher=createDecipheriv('aes-256-gcm',secret,bytes.subarray(4,16));
  decipher.setAAD(Buffer.from('inventory-backup-v1'));decipher.setAuthTag(bytes.subarray(-16));
  const payload=JSON.parse(gunzipSync(Buffer.concat([decipher.update(bytes.subarray(16,-16)),decipher.final()])).toString());
  const {DatabaseSync}=await import('node:sqlite'); const restored=new DatabaseSync(':memory:');
  try {restored.exec(payload.sql);assert.equal(restored.prepare('SELECT id FROM users').get().id,'retained-author');assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check,'ok');} finally {restored.close();}
 } finally {globalThis.fetch=original;}
});

test('concurrent backup lease suppresses overlapping cron export',async()=>{
 const original=globalThis.fetch;let calls=0;
 try {
 globalThis.fetch=async()=>{calls++;throw Error('should not export');};
 const env={BACKUP_ENABLED:'1',CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),D1_DATABASE_ID:'a'.repeat(36),CF_BACKUP_TOKEN:'fake',BACKUP_ENCRYPTION_KEY:Buffer.alloc(32,1).toString('base64'),BACKUPS:{get:async()=>({json:async()=>({owner:'another',expires:Date.now()+60000})})}};
 assert.equal((await runBackup(env)).status,'already-running');assert.equal(calls,0);
 env.BACKUPS={get:async()=>null,put:async(_key,_value,options)=>{assert.equal(options.onlyIf.get('If-None-Match'),'*');return null;}};
 assert.equal((await runBackup(env)).status,'already-running');assert.equal(calls,0);
 }finally{globalThis.fetch=original;}
});
test('metrics storage failure is isolated and logs no submitted content',async()=>{
 const original=console.log;const lines=[];
 try {
 console.log=value=>lines.push(value);
 await recordMetric({METRICS_ENABLED:'1',DB:{prepare(){throw Error('secret-db-detail');},async batch(){throw Error('secret-db-detail');}}},{route:'count',method:'POST',status:200,elapsedMs:4,note:'never-record-this'},Date.UTC(2026,10,1));
 assert.equal(lines.length,1);assert.ok(!lines.join('').includes('secret-db-detail'));assert.ok(!lines.join('').includes('never-record-this'));
 }finally{console.log=original;}
});
test('operator decrypt command emits private verified files and refuses tampering before writes',async()=>{
 const {mkdtempSync,writeFileSync,readFileSync,statSync,existsSync,rmSync}=await import('node:fs');
 const {execFileSync}=await import('node:child_process');
 const {join}=await import('node:path'); const {tmpdir}=await import('node:os');
 const directory=mkdtempSync(join(tmpdir(),'inventory-backup-test-'));const secret=Buffer.alloc(32,8).toString('base64');
 try {
 const sql='CREATE TABLE t(id INTEGER);\nINSERT INTO t VALUES(2);\n';
 const sealed=await sealBackup(sql,await encryptionKey(secret));const file=join(directory,'backup.ibk');writeFileSync(file,sealed.output,{mode:0o600});
 const restored=join(directory,'restored');
 execFileSync(process.execPath,['scripts/decrypt-backup.mjs','--file',file,'--directory',restored],{env:{...process.env,BACKUP_ENCRYPTION_KEY:secret},stdio:'pipe'});
 assert.equal(readFileSync(join(restored,'database.sql'),'utf8'),sql);assert.equal(statSync(join(restored,'database.sql')).mode&0o077,0);
 const damaged=Buffer.from(sealed.output);damaged[20]^=1;writeFileSync(file,damaged);
 const rejected=join(directory,'rejected');
 assert.throws(()=>execFileSync(process.execPath,['scripts/decrypt-backup.mjs','--file',file,'--directory',rejected],{env:{...process.env,BACKUP_ENCRYPTION_KEY:secret},stdio:'pipe'}));assert.equal(existsSync(rejected),false);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
