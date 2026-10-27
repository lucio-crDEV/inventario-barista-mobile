import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {sqliteDB} from './shared/sqlite-adapter.mjs';
import {supervisionRequest} from '../worker/supervision.js';
import {cycleItemsSQL} from '../worker/inventory-sql.js';

function fixture() {
  const db=sqliteDB(12),version=db.sqlite.prepare('SELECT version FROM catalog_items LIMIT 1').get().version;
  db.sqlite.exec("INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES('sql-admin','sql-admin','Admin','!','admin',0),('sql-lead','sql-lead','Lead','!','service_lead',0)");
  db.sqlite.exec("INSERT INTO sessions VALUES('admin-session','sql-admin',unixepoch()+3600),('lead-session','sql-lead',unixepoch()+3600)");
  db.sqlite.prepare("INSERT INTO cycles(id,name,catalog_version,state) VALUES('target','Target',?,'open'),('unrelated','Unrelated',?,'open')").run(version,version);
  const statements=[];
  const prepare=db.prepare.bind(db);
  db.prepare=sql=>{const st=prepare(sql),bind=st.bind;st.bind=(...args)=>{statements.push({sql,args});return bind(...args);};return st;};
  const dependencies={json:x=>x,fail:(status,code)=>{throw Object.assign(Error(code),{status,code});},body:req=>req.json(),userDTO:u=>({id:u.id,revision:u.revision}),digest:x=>createHash('sha256').update(x).digest('hex')};
  const call=async(path='',role='admin',payload=undefined,metadataRevision=0)=>{
    const url=new URL('https://inventory.test/api/admin/supervision'+path);
    const u=db.sqlite.prepare('SELECT * FROM users WHERE id=?').get('sql-'+role);
    return supervisionRequest(new Request(url,payload===undefined?{}:{method:'POST',body:JSON.stringify(payload)}),db,url,{u,hash:role+'-session',metadataRevision},dependencies);
  };
  const items=db.sqlite.prepare("SELECT * FROM catalog_items WHERE version=? AND location_id='servicio:barra' AND json_extract(data,'$.active')=1 LIMIT 75").all(version);
  function count(item,{cycle='target',status='counted',q=4000,outOfStock=0,voided=0}={}) {
    db.sqlite.prepare('INSERT INTO counts(cycle_id,item_id,location_id,q,unit,status,note,out_of_stock,author,version,updated_at,voided) VALUES(?,?,?,?,?,?,?, ?,?,1,?,?)').run(cycle,item.id,item.location_id,q,item.unit,status,'note',outOfStock,'sql-admin','2026-10-27T12:00:00.000Z',voided);
  }
  function history(item,{cycle='target',action='direct',user='sql-admin',n=1}={}) {
    // Synthetic read-only workload, with no production/local fixture state touched.
    // Its history rows deliberately bypass operation triggers and their write work.
    db.sqlite.exec('PRAGMA foreign_keys=OFF');
    const st=db.sqlite.prepare("INSERT INTO history(operation_id,cycle_id,item_id,location_id,user_id,action,entered_record,after_record,created_at) VALUES(lower(hex(randomblob(16))),?,?,?,?,?,'{}','{}','2026-10-27T12:00:00.000Z')");
    for(let i=0;i<n;i++)st.run(cycle,item.id,item.location_id,user,action);
    db.sqlite.exec('PRAGMA foreign_keys=ON');
  }
  return {db,version,statements,call,items,count,history};
}
const plain=value=>JSON.parse(JSON.stringify(value));

test('cycle-filtered projection preserves pending, partial, counted, explicit stock zero, voids and global area activity',()=>{
  const f=fixture();try{
    f.count(f.items[1],{status:'partial'});f.count(f.items[2]);f.count(f.items[3],{q:0,outOfStock:1});f.count(f.items[4],{voided:1});f.count(f.items[5]);
    f.db.sqlite.prepare("UPDATE counts SET author=NULL WHERE cycle_id='target' AND item_id=? AND location_id=?").run(f.items[5].id,f.items[5].location_id);
    f.count(f.items[2],{cycle:'unrelated',q:99000});
    f.db.sqlite.prepare("INSERT INTO item_activity(area_id,item_id,active,changed_at,inactive_since) VALUES('servicio',?,0,'2026-10-27','2026-10-27')").run(f.items[2].id);
    const projection=cycleItemsSQL({records:true,cycle:'?1'});
    const expected=f.db.sqlite.prepare('SELECT * FROM supervision_items WHERE cycle_id=? ORDER BY position').all('target');
    const actual=f.db.sqlite.prepare('SELECT * FROM '+projection+' ORDER BY position').all('target');
    assert.deepEqual(plain(actual),plain(expected));
    const selected=f.items.slice(0,5).map(item=>actual.find(x=>x.id===item.id&&x.location_id===item.location_id));
    assert.deepEqual(selected.map(x=>x.status),['pending','partial','counted','counted','pending']);
    assert.equal(JSON.parse(selected[3].record).outOfStock,true);
    assert.equal(JSON.parse(selected[3].record).quantity,0);
    assert.equal(JSON.parse(selected[4].record).quantity,null);
    assert.equal(JSON.parse(selected[4].record).version,1);
    assert.equal(selected[2].active,0);
    const authorless=actual.find(x=>x.id===f.items[5].id&&x.location_id===f.items[5].location_id);
    assert.equal(authorless.status,'pending');assert.equal(authorless.record,null);
    const other=f.db.sqlite.prepare('SELECT * FROM '+projection+' WHERE id=?2 AND location_id=?3').get('unrelated',f.items[2].id,f.items[2].location_id);
    assert.equal(other.active,0);assert.equal(JSON.parse(other.record).quantity,99);
    f.db.sqlite.prepare("UPDATE item_activity SET active=1,revision=revision+1,inactive_since=NULL WHERE item_id=?").run(f.items[2].id);
    assert.equal(f.db.sqlite.prepare('SELECT active FROM '+projection+' WHERE id=?2 AND location_id=?3').get('target',f.items[2].id,f.items[2].location_id).active,1);
  }finally{f.db.sqlite.close();}
});

test('summary rollups share permitted cycle rows, preserve scope semantics and return cheap invalidatable versions',async()=>{
  const f=fixture();try{
    f.count(f.items[0],{status:'partial'});
    const first=await f.call('?cycle=target&scope=servicio','lead');
    assert.ok(first.version);assert.ok(first.groups.every(x=>x.areaId==='servicio'));
    assert.ok(first.scopeGroups.every(x=>x.scopeId.startsWith('servicio')));
    const expected=f.db.sqlite.prepare("SELECT area_id areaId,sum(active) total,sum(active=0) excluded,sum(active=1 AND status='counted') counted,sum(active=1 AND status='partial') partial,sum(active=1 AND status='pending') pending FROM supervision_items WHERE cycle_id='target' AND area_id='servicio' GROUP BY area_id").all();
    assert.deepEqual(plain(first.groups),plain(expected));
    f.statements.length=0;
    const quiet=await f.call('?cycle=target&scope=servicio&version='+first.version,'lead');
    assert.deepEqual(quiet,{user:{id:'sql-lead',revision:1},version:first.version,unchanged:true});
    assert.ok(!f.statements.some(x=>x.sql.includes('permitted_items')||x.sql.includes('LEFT JOIN counts')));
    const changed=async(version,mutate)=>{mutate();const response=await f.call('?cycle=target&scope=servicio&version='+version,'lead');assert.ok(response.groups);assert.notEqual(response.version,version);return response.version;};
    let version=first.version;
    version=await changed(version,()=>f.db.sqlite.prepare("UPDATE counts SET voided=1 WHERE cycle_id='target'").run());
    version=await changed(version,()=>f.db.sqlite.prepare("INSERT INTO item_activity(area_id,item_id,active,changed_at,inactive_since) VALUES('servicio',?,0,'2026-10-27','2026-10-27')").run(f.items[0].id));
    version=await changed(version,()=>f.db.sqlite.exec("INSERT INTO cycle_scope_states VALUES('target','servicio','review')"));
    version=await changed(version,()=>f.history(f.items[0],{user:'sql-lead'}));
    version=await changed(version,()=>f.db.sqlite.exec("UPDATE users SET revision=revision+1 WHERE id='sql-lead'"));
    const renamed=await f.call('?cycle=target&scope=servicio&version='+version,'lead',undefined,1);
    assert.ok(renamed.groups);assert.notEqual(renamed.version,version);
    await assert.rejects(f.call('?cycle=target&scope=cocina','lead'),e=>e.code==='FORBIDDEN');
    const items=await f.call('/items?cycle=target','lead');assert.ok(items.items.every(x=>x.areaId==='servicio'));
    f.db.sqlite.exec("UPDATE users SET active=0 WHERE id='sql-lead'");
    await assert.rejects(f.call('?cycle=target&scope=servicio&version='+version,'lead'));
  }finally{f.db.sqlite.close();}
});

test('history bounds aggregation to the product page and keeps independent author/category matches',async()=>{
  const f=fixture();try{
    for(const i of f.items.slice(0,65))f.history(i,{n:3});
    f.history(f.items[0],{action:'rectify',user:'sql-lead',n:200});
    f.history(f.items[1],{action:'annul',user:'sql-admin'});
    const privateItem=f.db.sqlite.prepare("SELECT * FROM catalog_items WHERE location_id='cocina' LIMIT 1").get();
    f.history(privateItem,{n:5});
    const first=await f.call('/history?cycle=target','lead');assert.equal(first.items.length,50);assert.ok(first.nextCursor);
    assert.ok(first.items.every(x=>x.locationId.startsWith('servicio:')));
    const second=await f.call('/history?cycle=target&cursor='+first.nextCursor,'lead');assert.equal(second.items.length,15);
    const keys=[...first.items,...second.items].map(x=>x.itemId+'|'+x.locationId);assert.equal(new Set(keys).size,65);
    const match=await f.call('/history?cycle=target&category=count&author=sql-lead','lead');
    assert.equal(match.items.length,1);assert.equal(match.items[0].itemId,f.items[0].id);
    assert.deepEqual(match.items[0].counts,{counts:3,corrections:200,annulments:0});
    const query=f.statements.find(x=>x.sql.includes('history_page AS MATERIALIZED'));
    const plan=f.db.sqlite.prepare('EXPLAIN QUERY PLAN '+query.sql).all(...query.args).map(x=>x.detail).join('\n');
    assert.match(plan,/MATERIALIZE history_page/);
    assert.match(plan,/SEARCH h USING INDEX history_cycle_item_desc/);
    assert.ok(query.sql.indexOf('LIMIT 51)')<query.sql.indexOf('sum(h.action'));
  }finally{f.db.sqlite.close();}
});

test('unrelated historical cycles do not increase cycle read work (SQLite plans and VM steps)',async t=>{
  const f=fixture(),dir=mkdtempSync(join(tmpdir(),'inventory-query-cost-'));try{
    // Full current-cycle counts and histories; grow only other cycles afterward.
    const all=f.db.sqlite.prepare('SELECT * FROM catalog_items WHERE version=?').all(f.version);
    for(const i of all)f.count(i);
    for(const i of f.items.slice(0,65))f.history(i,{n:3});
    await f.call('?cycle=target');await f.call('/items?cycle=target');await f.call('/history?cycle=target');
    const queries=[
      f.statements.find(x=>x.sql.includes('permitted_items AS MATERIALIZED')),
      f.statements.find(x=>x.sql.includes('SELECT i.* FROM (SELECT')),
      f.statements.find(x=>x.sql.includes('history_page AS MATERIALIZED')),
    ];
    assert.ok(queries.every(Boolean));
    for(const query of queries){
      const plan=f.db.sqlite.prepare('EXPLAIN QUERY PLAN '+query.sql).all(...query.args).map(x=>x.detail).join('\n');
      assert.ok(!/MATERIALIZE count_records|SCAN c\b/.test(plan),plan);
      if(query.sql.includes('LEFT JOIN counts'))assert.match(plan,/SEARCH c USING INDEX sqlite_autoindex_counts_1 \(cycle_id=\? AND item_id=\? AND location_id=\?\) LEFT-JOIN/);
    }
    const path=join(dir,'workload.sqlite');f.db.sqlite.exec("VACUUM INTO '"+path.replaceAll("'","''")+"'");
    const benchmark=spawnSync('python3',['-c',String.raw`
import json,sqlite3,sys,time,statistics
payload=json.loads(sys.argv[1]); db=sqlite3.connect(payload['path']); queries=payload['queries']
old="SELECT area_id,sum(active),sum(active=1 AND status='counted') FROM supervision_items WHERE cycle_id='target' GROUP BY area_id"
def measure(sql,args):
    steps=[0]
    def progress(): steps[0]+=100; return 0
    db.set_progress_handler(progress,100); start=time.perf_counter(); rows=db.execute(sql,args).fetchall(); elapsed=(time.perf_counter()-start)*1000; db.set_progress_handler(None,0)
    return {'steps':steps[0],'rows':len(rows),'ms':round(elapsed,3)}
def sample(): return [measure(q['sql'],q['args']) for q in queries]+[measure(old,[])]
result={'before':sample()}
# These are disposable synthetic rows. Disable trigger work during generation;
# query schemas/indexes stay unchanged and are measured with triggers restored.
triggers=db.execute("SELECT name,sql FROM sqlite_master WHERE type='trigger'").fetchall()
for name,sql in triggers: db.execute('DROP TRIGGER "'+name+'"')
for n in range(99):
    cycle='old-'+str(n)
    db.execute("INSERT INTO cycles(id,name,catalog_version,state) SELECT ?,?,catalog_version,'closed' FROM cycles WHERE id='target'",[cycle,cycle])
    db.execute("INSERT INTO counts SELECT ?,item_id,location_id,q,unit,status,note,out_of_stock,author,version,updated_at,voided FROM counts WHERE cycle_id='target'",[cycle])
    db.execute("INSERT INTO history(operation_id,cycle_id,item_id,location_id,user_id,action,entered_record,after_record,created_at) SELECT operation_id||?, ?,item_id,location_id,user_id,action,entered_record,after_record,created_at FROM history WHERE cycle_id='target'",[cycle,cycle])
for name,sql in triggers: db.execute(sql)
result['after']=sample();result['counts']=db.execute('SELECT count(*) FROM counts').fetchone()[0];result['history']=db.execute('SELECT count(*) FROM history').fetchone()[0]
print(json.dumps(result))
`,JSON.stringify({path,queries})],{encoding:'utf8',timeout:60000});
    assert.equal(benchmark.status,0,benchmark.stderr);
    const report=JSON.parse(benchmark.stdout);assert.ok(report.counts>=100*all.length);
    for(let i=0;i<queries.length;i++){
      assert.equal(report.after[i].rows,report.before[i].rows);
      assert.ok(report.after[i].steps<=report.before[i].steps*1.05+100,JSON.stringify({query:i,...report}));
    }
    assert.ok(report.after[3].steps>report.before[3].steps*10,'old nested view must demonstrate the avoided growth');
    t.diagnostic(JSON.stringify(report));
  }finally{f.db.sqlite.close();rmSync(dir,{recursive:true,force:true});}
});

test('0013 flat view retains nullable authors, all record fields and original transactional guards',async()=>{
  const f=fixture();try{
    f.count(f.items[0],{status:'partial'});f.count(f.items[1],{q:0,outOfStock:1});f.count(f.items[2],{voided:1});f.count(f.items[3]);
    f.db.sqlite.prepare("UPDATE counts SET author=NULL WHERE cycle_id='target' AND item_id=? AND location_id=?").run(f.items[3].id,f.items[3].location_id);
    const old=f.db.sqlite.prepare("SELECT * FROM supervision_items WHERE cycle_id='target' ORDER BY position").all();
    const triggers=f.db.sqlite.prepare("SELECT name,sql FROM sqlite_schema WHERE type='trigger' AND name IN('guard_supervision','apply_supervision','accept_operation','apply_operation') ORDER BY name").all();
    f.db.migrate(13,13);
    const view=f.db.sqlite.prepare("SELECT sql FROM sqlite_schema WHERE type='view' AND name='supervision_items'").get().sql;
    assert.ok(!view.includes('count_records'));assert.match(view,/LEFT JOIN counts c/);
    assert.deepEqual(plain(f.db.sqlite.prepare("SELECT * FROM supervision_items WHERE cycle_id='target' ORDER BY position").all()),plain(old));
    assert.deepEqual(plain(f.db.sqlite.prepare("SELECT name,sql FROM sqlite_schema WHERE type='trigger' AND name IN('guard_supervision','apply_supervision','accept_operation','apply_operation') ORDER BY name").all()),plain(triggers));
    let serial=0;
    const item=f.items[10],other=f.items[11];
    const revision=()=>f.db.sqlite.prepare("SELECT revision FROM cycles WHERE id='target'").get().revision;
    const record=()=>f.db.sqlite.prepare("SELECT record FROM supervision_items WHERE cycle_id='target' AND id=? AND location_id=?").get(item.id,item.location_id).record;
    const command=(kind,extra={})=>({id:'sql-cost-command-'+String(++serial).padStart(4,'0'),cycleId:'target',expectedRevision:revision(),kind,confirm:true,...(kind==='state'?{}:{itemId:item.id,locationId:item.location_id,expectedVersion:record()?JSON.parse(record()).version:0}),...extra});
    const partial=command('rectify',{quantity:2,status:'partial',note:'',outOfStock:false});
    const accepted=await f.call('/command','admin',partial);
    assert.equal(JSON.parse(record()).status,'partial');assert.equal(JSON.parse(record()).quantity,2);
    assert.deepEqual(await f.call('/command','admin',partial),accepted);
    await assert.rejects(f.call('/command','admin',{...partial,quantity:3}),e=>e.code==='ID_REUSED');
    await assert.rejects(f.call('/command','admin',command('rectify',{expectedVersion:0,quantity:3,status:'counted',note:'',outOfStock:false})),e=>e.code==='STALE');
    await f.call('/command','admin',command('annul'));
    assert.equal(JSON.parse(record()).status,'pending');assert.equal(JSON.parse(record()).quantity,null);assert.equal(JSON.parse(record()).version,2);
    await f.call('/command','admin',command('activation',{active:false}));
    const states=f.db.sqlite.prepare('SELECT active FROM supervision_items WHERE id=? AND location_id=? ORDER BY cycle_id').all(item.id,item.location_id);
    assert.equal(states.length,2);assert.ok(states.every(x=>x.active===0));
    await assert.rejects(f.call('/command','admin',command('rectify',{quantity:3,status:'counted',note:'',outOfStock:false})),e=>e.code==='ITEM_INACTIVE');
    await f.call('/command','admin',command('activation',{active:true}));
    await f.call('/command','lead',command('state',{scope:'servicio',state:'review'}));
    await assert.rejects(f.call('/command','lead',command('state',{scope:'servicio',state:'closed'})),e=>e.code==='PENDING_ITEMS');
    const completionRevision=f.db.sqlite.prepare("SELECT completion_revision FROM cycles WHERE id='target'").get().completion_revision;
    f.count(other);
    await assert.rejects(f.call('/command','lead',command('state',{scope:'servicio',state:'closed',allowIncomplete:true,completionRevision})),e=>e.code==='COMPLETION_CHANGED');
    const close=command('state',{scope:'servicio',state:'closed',allowIncomplete:true,completionRevision:f.db.sqlite.prepare("SELECT completion_revision FROM cycles WHERE id='target'").get().completion_revision});
    const closed=await f.call('/command','lead',close);assert.ok(closed.completion.pending>0);assert.equal(closed.completion.uncompletedAsBlank,true);
    assert.deepEqual(await f.call('/command','lead',close),closed);
    await assert.rejects(f.call('/command','lead',command('state',{scope:'servicio',state:'open',reason:'Revisión autorizada'})),e=>e.code==='ADMIN_REOPEN_REQUIRED');
  }finally{f.db.sqlite.close();}
});
