// Isolated provider-runtime exercise. All exports and R2 objects are synthetic;
// outboundService intercepts every request and never reaches Cloudflare APIs.
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {decryptBackupFile} from '../../scripts/decrypt-backup.mjs';
const require=createRequire(resolve('package.json'));
const {Miniflare,convertV4MiniflareOptions,Response:MFResponse}=require('miniflare'),{build}=require('esbuild');
const secret=Buffer.alloc(32,19).toString('base64'),fixture=randomBytes(6*1024*1024);
const sql=`CREATE TABLE payload(value BLOB);INSERT INTO payload VALUES(X'${fixture.toString('hex')}');`;
const bundle=await build({entryPoints:[resolve('operations/backup-worker/entry.js')],bundle:true,write:false,format:'esm',target:'es2022',external:['cloudflare:workers']});
let outbound=0;
const mf=new Miniflare(convertV4MiniflareOptions({telemetry:{enabled:false},modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-01',
 bindings:{BACKUP_ENABLED:'1',CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),D1_DATABASE_ID:'a'.repeat(36),CF_BACKUP_TOKEN:'synthetic-no-network',BACKUP_ENCRYPTION_KEY:secret},
 durableObjects:{BACKUP_JOBS:{className:'BackupJob',useSQLite:true}},r2Buckets:{BACKUPS:'backup-runtime-isolated'},
 outboundService:async request=>{outbound++;const url=new URL(request.url);if(url.hostname==='api.cloudflare.com' && url.pathname.endsWith('/export'))return MFResponse.json({success:true,result:{status:'complete',result:{signed_url:'https://export.invalid/synthetic.sql'}}});if(url.hostname==='export.invalid')return new MFResponse(sql);throw Error('Unexpected outbound request blocked');}
}));
const temporary=mkdtempSync(join(tmpdir(),'backup-workerd-'));
try {
 assert.equal((await mf.dispatchFetch('http://localhost/')).status,404);
 const namespace=await mf.getDurableObjectNamespace('BACKUP_JOBS'),stub=namespace.get(namespace.idFromName('inventory-private-backup'));
 assert.equal((await stub.fetch('https://backup.internal/run')).status,404);
 const first=await stub.fetch('https://backup.internal/run',{method:'POST'});assert.equal(first.status,200);assert.deepEqual(await first.json(),{status:'completed'});
 const second=await stub.fetch('https://backup.internal/run',{method:'POST'});assert.deepEqual(await second.json(),{status:'not-due'});assert.equal(outbound,2);
 const bucket=await mf.getR2Bucket('BACKUPS'),checkpoint=await (await bucket.get('inventory/last-success.json')).json();
 const object=await bucket.get(checkpoint.objectKey),file=join(temporary,'copy.ibk');writeFileSync(file,Buffer.from(await object.arrayBuffer()));
 const destination=join(temporary,'restored');await decryptBackupFile(file,destination,secret);
 const db=new DatabaseSync(':memory:');try{db.exec(readFileSync(join(destination,'database.sql'),'utf8'));assert.equal(db.prepare('SELECT length(value) n FROM payload').get().n,fixture.length);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{db.close();}
 console.log(JSON.stringify({pass:true,runtime:'local workerd + SQLite Durable Object + R2 multipart',sqlBytes:Buffer.byteLength(sql),outboundMockRequests:outbound,publicHTTP:404,secondRun:'not-due',sqliteIntegrity:'ok',productionCPUCertified:false}));
} finally {await mf.dispose();rmSync(temporary,{recursive:true,force:true});}
