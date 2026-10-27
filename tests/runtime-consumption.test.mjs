import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import worker from '../worker/index.js';
import {deploymentState,runtimeReadinessSQL,runtimeSchemaSQL} from '../worker/runtime-readiness.js';
import {listCycles,resolveCycle} from '../worker/inventory-cycles.js';
import {defaultCycle} from '../shared/cycles.js';
import {preflightDiscoverySQL,preflightSQL} from '../scripts/preflight.mjs';
import {sqliteDB} from './shared/sqlite-adapter.mjs';
const origin='https://runtime.test';
function fixture(through=13) {
  const db=sqliteDB(through),identities={},tag=randomUUID(),queries=[];
  for(const role of ['admin','worker','service_lead']) {
    const id=randomUUID(),token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(token).digest('hex');
    db.sqlite.prepare('INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES(?,?,?,?,?,0)').run(id,role+'-'+tag.slice(0,8),role,'!',role);
    db.sqlite.prepare('INSERT INTO sessions VALUES(?,?,unixepoch()+3600)').run(hash,id);
    identities[role]={id,token,hash};
  }
  db.sqlite.exec("INSERT INTO cycles(id,name,catalog_version,state) VALUES('target','Target','inventory-v3-2026-10-22','open')");
  db.sqlite.prepare("INSERT INTO grants VALUES(?,'servicio:barra')").run(identities.worker.id);
  const env={DB:db,APP_ENV:'production',APP_ORIGIN:origin,ACTIVE_CYCLE_ID:'target'};
  const prepare=db.prepare.bind(db);
  db.prepare=sql=>{const st=prepare(sql);for(const method of ['first','all','run']){const execute=st[method].bind(st);st[method]=async(...args)=>{queries.push(sql);return execute(...args);};}return st;};
  const call=async(path='/api/me',role='admin',payload)=>{
    const tasks=[],who=identities[role];
    const response=await worker.fetch(new Request(origin+path,{method:payload===undefined?'GET':'POST',headers:{Cookie:`__Host-inventory_session=${who.token}`,...(payload===undefined?{}:{Origin:origin,'Content-Type':'application/json','X-Inventory-User':who.id})},...(payload===undefined?{}:{body:JSON.stringify(payload)})}),env,{waitUntil:p=>tasks.push(p)});
    await Promise.all(tasks);return {status:response.status,data:await response.json()};
  };
  const metadata=()=>db.sqlite.prepare('SELECT users_metadata_revision FROM runtime_contract WHERE id=1').get().users_metadata_revision;
  const item=location=>db.sqlite.prepare("SELECT * FROM catalog_items WHERE version='inventory-v3-2026-10-22' AND location_id=? LIMIT 1").get(location);
  const count=(i)=>db.sqlite.prepare("INSERT INTO counts(cycle_id,item_id,location_id,q,unit,status,note,out_of_stock,author,version,updated_at) VALUES('target',?,?,3000,?,'counted','',0,?,1,'2026-10-27')").run(i.id,i.location_id,i.unit,identities.admin.id);
  const history=i=>{
    db.sqlite.exec('PRAGMA foreign_keys=OFF');
    db.sqlite.prepare("INSERT INTO history(operation_id,cycle_id,item_id,location_id,user_id,action,entered_record,after_record,created_at) VALUES(?,'target',?,?,?,'direct','{}','{}','2026-10-27')").run(randomUUID(),i.id,i.location_id,identities.admin.id);
    db.sqlite.exec('PRAGMA foreign_keys=ON');
  };
  return {db,env,identities,queries,call,metadata,item,count,history};
}
const plain=x=>JSON.parse(JSON.stringify(x));

test('0013 readiness and /me execute two SQL statements without catalog scans or cached authentication',async t=>{
  const f=fixture();try{
    const before=f.db.sqlite.prepare('SELECT total_changes() n').get().n;
    t.diagnostic(JSON.stringify(f.db.sqlite.prepare("SELECT (SELECT count(*) FROM sqlite_schema WHERE substr(name,1,4)!='_cf_' AND substr(name,1,7)!='sqlite_') schemaObjects,length(schema_signature) signatureBytes FROM runtime_contract").get()));
    for(let i=0;i<3;i++){
      f.queries.length=0;const response=await f.call();assert.equal(response.status,200);assert.equal(response.data.user.id,f.identities.admin.id);
      assert.equal(f.queries.length,2);assert.equal(f.queries[0],runtimeReadinessSQL);
      assert.ok(!f.queries.some(sql=>/FROM catalog_items|pragma_table_info/i.test(sql)));
    }
    assert.equal(f.db.sqlite.prepare('SELECT total_changes() n').get().n,before);
    f.db.sqlite.prepare('UPDATE sessions SET expires=unixepoch()-1 WHERE hash=?').run(f.identities.admin.hash);
    assert.equal((await f.call()).status,401);
    f.db.sqlite.prepare('DELETE FROM sessions WHERE hash=?').run(f.identities.worker.hash);
    assert.equal((await f.call('/api/me','worker')).status,401);
  }finally{f.db.sqlite.close();}
});

test('runtime counters follow catalog deletion/restoration and reject corrupt or unsupported active catalogs',async()=>{
  const f=fixture();try{
    const row=f.item('cocina'),counter=()=>f.db.sqlite.prepare("SELECT * FROM catalog_integrity WHERE version='inventory-v3-2026-10-22'").get();
    assert.equal(counter().row_count,1268);
    f.db.sqlite.prepare('DELETE FROM catalog_items WHERE version=? AND id=? AND location_id=?').run(row.version,row.id,row.location_id);
    assert.equal(counter().row_count,1267);assert.equal((await f.call()).status,503);
    f.db.sqlite.prepare('INSERT INTO catalog_items VALUES(?,?,?,?,?)').run(row.version,row.id,row.location_id,row.unit,row.data);
    assert.equal(counter().row_count,1268);assert.equal((await f.call()).status,200);
    f.db.sqlite.exec("UPDATE catalog_integrity SET row_count=1 WHERE version='inventory-v3-2026-10-22'");
    assert.equal((await f.call()).status,503);
    f.db.sqlite.exec("UPDATE catalog_integrity SET expected_count=1 WHERE version='inventory-v3-2026-10-22'");
    assert.equal((await f.call()).status,503,'coupled counter corruption must not redefine approved catalog cardinality');
    f.db.sqlite.exec("UPDATE catalog_integrity SET row_count=1268,expected_count=1268 WHERE version='inventory-v3-2026-10-22'");
    const invalid=await deploymentState(f.db,{...f.env,ACTIVE_CATALOG_VERSION:'missing'}).then(()=>null,error=>error);
    assert.equal(invalid.code,'NOT_INITIALIZED');
  }finally{f.db.sqlite.close();}
});

test('schema changes and removed guards fail closed; preflight verifies actual counts and never restamps DDL',async()=>{
  const f=fixture();try{
    const discovery=plain(f.db.sqlite.prepare(preflightDiscoverySQL).get());assert.deepEqual(discovery,{runtime_tables:2,cycles:1});
    const sql=preflightSQL('target',{runtime:true,cycles:true});
    const changes=f.db.sqlite.prepare('SELECT total_changes() n').get().n;
    assert.equal(f.db.sqlite.prepare(sql).get().ready,1);assert.equal(f.db.sqlite.prepare('SELECT total_changes() n').get().n,changes);
    assert.equal(f.db.sqlite.prepare(preflightSQL('wrong-cycle',{runtime:true,cycles:true})).get(),undefined);
    f.db.sqlite.exec("UPDATE catalog_integrity SET row_count=1,expected_count=1 WHERE version='inventory-v3-2026-10-22'");
    assert.equal(f.db.sqlite.prepare(sql).get(),undefined,'preflight checks counters against actual catalog and approved counts');
    f.db.sqlite.exec("UPDATE catalog_integrity SET row_count=1268,expected_count=1268 WHERE version='inventory-v3-2026-10-22'");
    const stamp=f.db.sqlite.prepare('SELECT schema_signature FROM runtime_contract').get().schema_signature;
    f.db.sqlite.exec('DROP TRIGGER accept_operation');
    assert.equal((await f.call()).status,503);assert.equal(f.db.sqlite.prepare(sql).get(),undefined);
    assert.equal(f.db.sqlite.prepare('SELECT schema_signature FROM runtime_contract').get().schema_signature,stamp);
    // Even a manually forged matching stamp cannot fool explicit preflight.
    f.db.sqlite.exec('UPDATE runtime_contract SET schema_signature=('+runtimeSchemaSQL+')');
    assert.equal(f.db.sqlite.prepare(sql).get(),undefined);
  }finally{f.db.sqlite.close();}
  const g=fixture();try{
    g.db.sqlite.exec('CREATE TABLE unexpected_ddl(value TEXT)');assert.equal((await g.call()).status,503);
  }finally{g.db.sqlite.close();}
  const altered=fixture();try{
    const count=altered.db.sqlite.prepare('SELECT count(*) n FROM sqlite_schema').get().n;
    altered.db.sqlite.exec('DROP TRIGGER catalog_integrity_delete; CREATE TRIGGER catalog_integrity_delete AFTER DELETE ON catalog_items BEGIN SELECT 1; END;');
    assert.equal(altered.db.sqlite.prepare('SELECT count(*) n FROM sqlite_schema').get().n,count);
    assert.equal((await altered.call()).status,503,'same-name definition changes invalidate the contract too');
  }finally{altered.db.sqlite.close();}
  const legacy=fixture(7);try{
    assert.equal(legacy.db.sqlite.prepare(preflightDiscoverySQL).get().runtime_tables,0);
    assert.equal(legacy.db.sqlite.prepare(preflightSQL('target')).get().ready,1);
  }finally{legacy.db.sqlite.close();}
});

test('user, supported permission and session changes invalidate metadata without caching scopes or identities',async()=>{
  const f=fixture();try{
    const before=f.metadata();
    const response=await f.call('/api/profile','worker',{name:'Nombre actualizado',expectedRevision:1});assert.equal(response.status,200);assert.ok(f.metadata()>before);
    assert.equal((await f.call('/api/me','worker')).data.user.name,'Nombre actualizado');
    const original=await f.call('/api/navigation?cycle=target','worker');assert.ok(original.data.scopes.some(x=>x.id==='servicio:barra'));
    const oldRevision=f.metadata();
    const current=f.db.sqlite.prepare('SELECT * FROM users WHERE id=?').get(f.identities.worker.id);
    const reassigned=await f.call('/api/admin/users/'+current.id,'admin',{username:current.username,role:current.role,active:true,grants:['cocina'],expectedRevision:current.revision});
    assert.equal(reassigned.status,200);
    assert.ok(f.metadata()>oldRevision);
    const moved=await f.call('/api/navigation?cycle=target','worker');assert.ok(moved.data.scopes.some(x=>x.id==='cocina'));assert.ok(!moved.data.scopes.some(x=>x.id.startsWith('servicio')));
    const expiryRevision=f.metadata();f.db.sqlite.prepare('UPDATE sessions SET expires=unixepoch()-1 WHERE hash=?').run(f.identities.worker.hash);
    assert.ok(f.metadata()>expiryRevision);assert.equal((await f.call('/api/me','worker')).status,401);
    const deleteRevision=f.metadata();f.db.sqlite.prepare('DELETE FROM sessions WHERE hash=?').run(f.identities.service_lead.hash);
    assert.ok(f.metadata()>deleteRevision);assert.equal((await f.call('/api/me','service_lead')).status,401);
  }finally{f.db.sqlite.close();}
});

test('area bootstrap filters only products and records, retaining all permitted scopes and the global cursor',async()=>{
  const f=fixture();try{
    const service=f.item('servicio:barra'),kitchen=f.item('cocina');f.count(service);f.count(kitchen);f.history(service);f.history(kitchen);
    f.db.sqlite.exec("INSERT INTO cycle_scope_states VALUES('target','servicio','review')");
    const full=await f.call('/api/bootstrap?cycle=target'),area=await f.call('/api/bootstrap?cycle=target&area=servicio');
    assert.equal(full.status,200);assert.equal(area.status,200);assert.ok(area.data.items.length>0);assert.ok(area.data.items.every(x=>x.areaId==='servicio'));
    assert.deepEqual(area.data.items,full.data.items.filter(x=>x.areaId==='servicio'));
    assert.deepEqual(area.data.counts,full.data.counts.filter(x=>x.locationId.startsWith('servicio:')));
    assert.deepEqual(area.data.scopes,full.data.scopes);assert.deepEqual(area.data.cycle,full.data.cycle);
    assert.equal(area.data.cursor,full.data.cursor);assert.equal(area.data.cursor,2,'cursor includes newer movement outside the selected area');
    const denied=await f.call('/api/bootstrap?cycle=target&area=cocina','worker');assert.equal(denied.status,200);assert.deepEqual(denied.data.items,[]);assert.deepEqual(denied.data.counts,[]);assert.equal(denied.data.cursor,1);
    assert.equal((await f.call('/api/bootstrap?cycle=target&area=invalid')).status,400);
  }finally{f.db.sqlite.close();}
});

test('indexed default-cycle resolution matches visible cycle snapshots for workers and supervisors',async()=>{
  const f=fixture();try{
    f.db.sqlite.exec("INSERT INTO cycles(id,name,catalog_version,state,lifecycle) VALUES('closed-newer','Closed','inventory-v3-2026-10-22','closed','active'),('prepared-newest','Prepared','inventory-v3-2026-10-22','open','prepared'),('deleted','Deleted','inventory-v3-2026-10-22','open','deleted')");
    const check=async()=>{
      for(const role of ['admin','worker','service_lead']){
        const hash=f.identities[role].hash,cycles=await listCycles(f.db,hash),expected=defaultCycle(cycles)?.id||null;
        assert.equal(await resolveCycle(f.db,hash,null,'target',true),expected,role);
        for(const visible of cycles)assert.equal(await resolveCycle(f.db,hash,visible.id,'target',true),visible.id);
        assert.equal(await resolveCycle(f.db,hash,'deleted','target',true),null);
      }
    };
    await check();
    f.db.sqlite.exec("UPDATE cycles SET state='closed' WHERE id='target'; INSERT INTO cycle_scope_states VALUES('target','servicio','review')");await check();
    f.db.sqlite.exec("DELETE FROM cycle_scope_states");await check();
    assert.equal(await resolveCycle(f.db,f.identities.worker.hash,'prepared-newest','target',true),null);
  }finally{f.db.sqlite.close();}
});
