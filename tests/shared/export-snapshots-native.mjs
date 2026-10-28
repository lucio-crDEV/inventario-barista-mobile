import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Client,database,operation} from './helpers.mjs';
const db=database(),directory=await mkdtemp(join(tmpdir(),'inventory-export-native-'));
try {
 db.exec('DELETE FROM attempts');
 const admin=new Client(),second=new Client(),lead=new Client(),worker=new Client(),anonymous=new Client();
 await admin.login('admin-prueba');await second.login('admin-prueba');
 await lead.login('jefa-servicio');await worker.login('ana');
 const cycleId='export-native-'+randomUUID().slice(0,8);
 db.prepare("INSERT INTO cycles(id,name,catalog_version,state) SELECT ?,'Synthetic export native',catalog_version,'open' FROM cycles WHERE id='prueba-compartida'").run(cycleId);
 const current=()=>db.prepare('SELECT * FROM cycles WHERE id=?').get(cycleId);
 const item=(await admin.request('/api/bootstrap?cycle='+cycleId+'&area=cocina')).data.items.find(i=>i.id==='cocina:74');
 assert.ok(item);
 assert.equal((await admin.request('/api/count',operation(item,17.5,{cycleId}))).status,200);
 const command=state=>({id:randomUUID(),cycleId,expectedRevision:current().revision,kind:'state',scope:'',state,reason:state==='open'?'Ensayo de reapertura':'',confirm:true});
 assert.equal((await admin.request('/api/admin/supervision/command',command('review'))).status,200);
 const finalization=command('closed'),warning=await admin.request('/api/admin/supervision/command',finalization);
 assert.equal(warning.data.code,'PENDING_ITEMS');
 assert.equal((await admin.request('/api/admin/supervision/command',{...finalization,allowIncomplete:true,completionRevision:warning.data.completionRevision})).status,200);
 const capture=()=>({id:randomUUID(),cycleId,expectedRevision:current().revision,expectedCompletionRevision:current().completion_revision});
 const api='/api/admin/export-snapshots';
 assert.equal((await anonymous.request(api,capture())).status,401);
 for(const client of [lead,worker])assert.equal((await client.request(api,capture())).status,403);
 const a=capture(),b=capture(),pair=await Promise.all([admin.request(api,a),second.request(api,b)]);
 for(const response of pair)assert.equal(response.status,200,JSON.stringify(response.data));
 assert.equal(pair[0].data.snapshotId,pair[1].data.snapshotId);
 const id=pair[0].data.snapshotId;
 assert.equal(db.prepare('SELECT count(*) n FROM export_snapshots WHERE cycle_id=?').get(cycleId).n,1);
 const source=(await admin.request(api+'/'+id+'?include=source')).data;
 assert.equal(source.review.ready,true);assert.equal(source.review.summary.numeric,1);
 assert.equal(source.sha256,createHash('sha256').update(source.payload).digest('hex'));
 assert.equal(db.prepare('SELECT count(*) n FROM export_snapshot_chunks WHERE snapshot_id=?').get(id).n>1,true);
 assert.equal((await worker.request(api+'/'+id)).status,403);
 const input=join(directory,'private.json'),output=join(directory,'copy.xlsx');
 await writeFile(input,JSON.stringify(source),{mode:0o600});
 const generated=spawnSync(process.execPath,['scripts/export-excel.mjs','--snapshot',input,'--output',output],{encoding:'utf8'});
 assert.equal(generated.status,0,generated.stderr);
 const verified=spawnSync('python3',['scripts/verify-excel-template.py','--candidate',output,'--recalculate-on-open'],{encoding:'utf8'});
 assert.equal(verified.status,0,verified.stderr);
 let reopen=command('open'),reopened=await admin.request('/api/admin/supervision/command',reopen);
 if(reopened.data.code==='CONFIRMATION_REQUIRED')reopened=await admin.request('/api/admin/supervision/command',{...reopen,confirmWarnings:true,confirmationRevision:reopened.data.confirmationRevision});
 assert.equal(reopened.status,200,JSON.stringify(reopened.data));
 assert.equal((await admin.request('/api/count',operation(item,99,{cycleId,expectedVersion:1}))).status,200);
 assert.equal((await admin.request(api,capture())).data.code,'INVENTORY_NOT_FINALIZED');
 const historical=(await admin.request(api+'/'+id+'?include=source')).data;
 assert.equal(historical.sha256,source.sha256);assert.equal(historical.payload,source.payload);
 assert.deepEqual((await second.request(api,a)).data,pair[0].data);
 await second.request('/api/logout',{});
 assert.equal((await second.request(api+'/'+id)).status,401);
 console.log(JSON.stringify({passed:true,catalogItems:source.snapshot.items.length,
  snapshotBytes:new TextEncoder().encode(source.payload).length,
  chunks:db.prepare('SELECT count(*) n FROM export_snapshot_chunks WHERE snapshot_id=?').get(id).n,
  checks:['native D1 trigger with immutable chunks','two simultaneous sessions share one snapshot',
   'API close with pending confirmation','admin-only capture and source read','exact accepted retry',
   'complete native capture to independently verified XLSX','history unchanged after reopen/new count','logout revokes source access']}));
}finally{db.close();await rm(directory,{recursive:true,force:true});}
