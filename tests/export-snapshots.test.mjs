import {test} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import worker from '../worker/index.js';
import {sqliteDB} from './shared/sqlite-adapter.mjs';
import {runtimeSchemaSQL} from '../worker/runtime-readiness.js';
import {preflightSQL} from '../scripts/preflight.mjs';
const origin='https://export-snapshot.test';
function fixture(version=14,catalogVersion='inventory-v3-2026-10-22') {
  const db=sqliteDB(version),who={};
  for(const role of ['admin','worker','service_lead']) {
    const id=randomUUID(),token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(token).digest('hex');
    db.sqlite.prepare('INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES(?,?,?,?,?,0)').run(id,role+'-'+id,role,'!',role);
    db.sqlite.prepare('INSERT INTO sessions VALUES(?,?,unixepoch()+3600)').run(hash,id);
    who[role]={id,token,hash};
  }
  db.sqlite.prepare("INSERT INTO cycles(id,name,catalog_version,state) VALUES('export-test','Synthetic export',?,'open')").run(catalogVersion);
  const env={DB:db,APP_ENV:'production',APP_ORIGIN:origin,ACTIVE_CYCLE_ID:'export-test'};
  const call=async(path,role='admin',payload,headers={})=>{
    const identity=who[role],response=await worker.fetch(new Request(origin+path,{
      method:payload===undefined?'GET':'POST',
      headers:{...(identity?{Cookie:'__Host-inventory_session='+identity.token}:{}),
        ...(payload===undefined?{}:{Origin:origin,'Content-Type':'application/json','X-Inventory-User':identity?.id}),...headers},
      ...(payload===undefined?{}:{body:JSON.stringify(payload)}),
    }),env,{});
    return {status:response.status,data:await response.json()};
  };
  const current=()=>db.sqlite.prepare("SELECT * FROM cycles WHERE id='export-test'").get();
  const command=()=>({id:randomUUID(),cycleId:'export-test',expectedRevision:current().revision,expectedCompletionRevision:current().completion_revision});
  const close=()=>db.sqlite.exec("UPDATE cycles SET state='closed',revision=revision+1 WHERE id='export-test'");
  return {db,who,call,current,command,close};
}
const api='/api/admin/export-snapshots';
test('Export capture is admin-only and gated on schema 0014, identity and final global state',async()=>{
  const f=fixture();try{
    for(const role of ['anonymous','worker','service_lead']){
      assert.equal((await f.call(api,role,f.command())).status,role==='anonymous'?401:403);
      assert.equal((await f.call(api+'/'+randomUUID(),role)).status,role==='anonymous'?401:403);
    }
    assert.equal((await f.call(api,'admin',f.command(),{'X-Inventory-User':'other'})).data.code,'IDENTITY_CHANGED');
    assert.equal((await f.call(api,'admin',f.command())).data.code,'INVENTORY_NOT_FINALIZED');
    f.close();f.db.sqlite.exec("INSERT INTO cycle_scope_states VALUES('export-test','servicio','review')");
    assert.equal((await f.call(api,'admin',f.command())).data.code,'INVENTORY_NOT_FINALIZED');
    f.db.sqlite.exec("DELETE FROM cycle_scope_states;UPDATE cycles SET lifecycle='deleted' WHERE id='export-test'");
    assert.equal((await f.call(api,'admin',f.command())).data.code,'INVENTORY_NOT_FINALIZED');
  }finally{f.db.sqlite.close();}
  const old=fixture(13);try{
    assert.equal((await old.call('/api/me')).status,200);
    assert.equal((await old.call(api,'admin',old.command())).data.code,'EXPORT_NOT_READY');
  }finally{old.db.sqlite.close();}
});
test('Snapshot capture is atomic, immutable, private and reproducible after reopen/activity/count changes',async()=>{
  const f=fixture();try{
    const item=f.db.sqlite.prepare("SELECT * FROM catalog_items WHERE version='inventory-v3-2026-10-22' AND location_id='cocina' AND json_extract(data,'$.exportRow')=74").get();
    f.db.sqlite.prepare("INSERT INTO counts(cycle_id,item_id,location_id,q,unit,status,note,out_of_stock,author,version,updated_at) VALUES('export-test',?,?,17500,?,'counted','PRIVATE-NOTE',0,?,1,'now')").run(item.id,item.location_id,item.unit,f.who.admin.id);
    f.close();const command=f.command();
    const made=await f.call(api,'admin',command);assert.equal(made.status,200,JSON.stringify(made.data));
    const url=api+'/'+made.data.snapshotId+'?include=source';
    const first=await f.call(url);assert.equal(first.status,200);
    assert.equal(first.data.review.ready,true);
    assert.equal(first.data.review.summary.numeric,1);
    assert.equal(first.data.review.summary.blank,1150);
    assert.equal(first.data.snapshot.items.length,1268);
    const raw=f.db.sqlite.prepare("SELECT group_concat(content,'') payload FROM (SELECT content FROM export_snapshot_chunks WHERE snapshot_id=? ORDER BY part)").get(made.data.snapshotId).payload;
    assert.equal(first.data.sha256,createHash('sha256').update(raw).digest('hex'));
    assert.ok(!raw.includes('PRIVATE-NOTE')&&!raw.includes('password')&&!raw.includes(f.who.admin.token));
    assert.throws(()=>f.db.sqlite.prepare('UPDATE export_snapshots SET policy_id=policy_id WHERE id=?').run(made.data.snapshotId),/IMMUTABLE_EXPORT_SNAPSHOT/);
    assert.throws(()=>f.db.sqlite.prepare('DELETE FROM export_snapshots WHERE id=?').run(made.data.snapshotId),/IMMUTABLE_EXPORT_SNAPSHOT/);
    assert.throws(()=>f.db.sqlite.prepare('UPDATE export_snapshot_chunks SET content=content WHERE snapshot_id=?').run(made.data.snapshotId),/IMMUTABLE_EXPORT_SNAPSHOT/);
    assert.throws(()=>f.db.sqlite.prepare('INSERT INTO export_snapshot_chunks VALUES(?,9999,?)').run(made.data.snapshotId,''),/IMMUTABLE_EXPORT_SNAPSHOT/);
    assert.throws(()=>f.db.sqlite.prepare('DELETE FROM export_snapshot_chunks WHERE snapshot_id=?').run(made.data.snapshotId),/IMMUTABLE_EXPORT_SNAPSHOT/);
    const chunks=f.db.sqlite.prepare('SELECT count(*) n,max(length(CAST(content AS BLOB))) bytes FROM export_snapshot_chunks').get();
    assert.ok(chunks.n>1&&chunks.bytes<=32768);

    f.db.sqlite.exec("UPDATE cycles SET state='open',revision=revision+1 WHERE id='export-test';UPDATE counts SET q=99000,version=version+1");
    f.db.sqlite.prepare("INSERT INTO item_activity(area_id,item_id,active,changed_by,changed_at,inactive_since,revision) VALUES('cocina',?,0,?,'now','now',1)").run(item.id,f.who.admin.id);
    const after=await f.call(url);assert.deepEqual(after.data,first.data);
    assert.deepEqual((await f.call(api,'admin',command)).data,made.data);
    assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM export_snapshots').get().n,1);
    assert.equal((await f.call(api,'admin',f.command())).data.code,'INVENTORY_NOT_FINALIZED');
    f.close();const second=await f.call(api,'admin',f.command());
    assert.notEqual(second.data.snapshotId,made.data.snapshotId);
    assert.equal((await f.call(api+'/'+second.data.snapshotId)).data.review.summary.numeric,0);
    const plain=await f.call(api+'/'+made.data.snapshotId);assert.equal(plain.data.snapshot,undefined);
  }finally{f.db.sqlite.close();}
});
test('Retries deduplicate captures for the same revision and never bypass session/role revocation',async()=>{
  const f=fixture();try{
    f.close();const a=f.command(),b=f.command();
    const one=await f.call(api,'admin',a),two=await f.call(api,'admin',b);
    assert.equal(one.data.snapshotId,two.data.snapshotId);
    assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM export_snapshots').get().n,1);
    assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM export_snapshot_commands').get().n,2);
    assert.equal((await f.call(api,'admin',{...a,expectedRevision:a.expectedRevision+1})).data.code,'ID_REUSED');
    f.db.sqlite.prepare('DELETE FROM sessions WHERE hash=?').run(f.who.admin.hash);
    assert.equal((await f.call(api,'admin',a)).status,401);
  }finally{f.db.sqlite.close();}
});
test('Revisions and SQL-time permissions are checked inside the capture statement, with no partial audit',async()=>{
  const f=fixture();try{
    f.close();const stale=f.command();
    f.db.sqlite.exec("UPDATE cycles SET completion_revision=completion_revision+1 WHERE id='export-test'");
    assert.equal((await f.call(api,'admin',stale)).data.code,'EXPORT_SOURCE_CHANGED');
    assert.equal(f.db.sqlite.prepare("SELECT count(*) n FROM admin_audit WHERE action='export-snapshot'").get().n,0);
    const prepare=f.db.prepare.bind(f.db);let injected=false;
    f.db.prepare=sql=>{
      const statement=prepare(sql),run=statement.run;
      if(sql.startsWith('INSERT INTO export_snapshot_commands'))statement.run=async()=>{
        injected=true;
        f.db.sqlite.prepare('UPDATE users SET revision=revision+1 WHERE id=?').run(f.who.admin.id);
        return run();
      };
      return statement;
    };
    assert.equal((await f.call(api,'admin',f.command())).data.code,'FORBIDDEN');assert.equal(injected,true);
    assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM export_snapshots').get().n,0);
    assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM export_snapshot_commands').get().n,0);
  }finally{f.db.sqlite.close();}
});
test('Migration 0014 preserves populated data and schema signature, and rolls back a failed capture',async()=>{
  const f=fixture(13);try{
    const item=f.db.sqlite.prepare("SELECT * FROM catalog_items WHERE version='inventory-v3-2026-10-22' AND location_id='cocina' AND unit!='' LIMIT 1").get();
    const accepted=await f.call('/api/count','admin',{id:randomUUID(),cycleId:'export-test',itemId:item.id,
      locationId:item.location_id,expectedVersion:0,action:'direct',quantity:1.25,unit:item.unit,
      status:'counted',note:'Synthetic preserved record',outOfStock:false});
    assert.equal(accepted.status,200);
    const protectedTables=['users','sessions','catalog_items','cycles','counts','operations','history','admin_audit'];
    const protectedBefore=Object.fromEntries(protectedTables.map(table=>[table,JSON.stringify(f.db.sqlite.prepare('SELECT * FROM '+table+' ORDER BY rowid').all())]));
    const before=f.db.sqlite.prepare("SELECT (SELECT count(*) FROM users) users,(SELECT count(*) FROM catalog_items) catalog,(SELECT count(*) FROM cycles) cycles,(SELECT count(*) FROM sessions) sessions").get();
    assert.equal(f.db.sqlite.prepare(preflightSQL('export-test',{runtime:true,cycles:true,exports:true})).get(),undefined);
    f.db.migrate(14,14);
    for(const table of protectedTables)assert.equal(JSON.stringify(f.db.sqlite.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()),protectedBefore[table],table);
    assert.deepEqual(f.db.sqlite.prepare("SELECT (SELECT count(*) FROM users) users,(SELECT count(*) FROM catalog_items) catalog,(SELECT count(*) FROM cycles) cycles,(SELECT count(*) FROM sessions) sessions").get(),before);
    assert.equal(f.db.sqlite.prepare('SELECT schema_signature FROM runtime_contract').get().schema_signature,f.db.sqlite.prepare(runtimeSchemaSQL).get()[Object.keys(f.db.sqlite.prepare(runtimeSchemaSQL).get())[0]]);
    assert.equal(f.db.sqlite.prepare(preflightSQL('export-test',{runtime:true,cycles:true,exports:true})).get().ready,1);
    f.close();
    f.db.sqlite.exec("CREATE TRIGGER test_export_failure AFTER INSERT ON export_snapshots BEGIN SELECT RAISE(ABORT,'TEST_EXPORT_FAILURE');END;");
    f.db.sqlite.exec('UPDATE runtime_contract SET schema_signature=('+runtimeSchemaSQL+') WHERE id=1');
    assert.equal((await f.call(api,'admin',f.command())).status,500);
    assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM export_snapshots').get().n,0);
    assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM export_snapshot_commands').get().n,0);
    assert.equal(f.db.sqlite.prepare("SELECT count(*) n FROM admin_audit WHERE action='export-snapshot'").get().n,0);
  }finally{f.db.sqlite.close();}
});

test('Legacy catalog v2 captures all 1227 physical items and still covers all 1151 template destinations',async()=>{
 const f=fixture(14,'inventory-v2-2026-10-21');try{
  f.close();const created=await f.call(api,'admin',f.command());
  assert.equal(created.status,200);
  const source=await f.call(api+'/'+created.data.snapshotId+'?include=source');
  assert.equal(source.data.snapshot.items.length,1227);
  assert.equal(source.data.review.ready,true);
  assert.equal(source.data.review.summary.blank,1151);
 }finally{f.db.sqlite.close();}
});
test('A repeated revision skips catalog JSON work instead of rebuilding an ignored payload',async()=>{
 const f=fixture(),probe=new DatabaseSync(':memory:');
 try{
  let extracts=0;const builtin=probe.prepare('SELECT json_extract(?1,?2) value');
  f.db.sqlite.function('json_extract',{deterministic:true},(value,path)=>{
   extracts++;return builtin.get(value,path).value;
  });
  f.close();const first=await f.call(api,'admin',f.command());
  assert.equal(first.status,200);assert.ok(extracts>1268);
  extracts=0;const second=await f.call(api,'admin',f.command());
  assert.equal(second.status,200);assert.equal(first.data.snapshotId,second.data.snapshotId);
  assert.equal(extracts,0);
 }finally{f.db.sqlite.close();probe.close();}
});

test('A durable per-admin limit rejects excess commands, while accepted retry and one shared snapshot remain available',async()=>{
 const f=fixture();try{
  f.close();const first=f.command();
  assert.equal((await f.call(api,'admin',first)).status,200);
  for(let i=0;i<9;i++)assert.equal((await f.call(api,'admin',f.command())).status,200);
  assert.equal((await f.call(api,'admin',f.command())).data.code,'EXPORT_RATE_LIMIT');
  assert.equal((await f.call(api,'admin',first)).status,200);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM export_snapshots').get().n,1);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) n FROM export_snapshot_commands').get().n,10);
 }finally{f.db.sqlite.close();}
});
