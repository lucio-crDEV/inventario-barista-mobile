import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sqliteDB} from './shared/sqlite-adapter.mjs';
import {boot,searchItems,summarizeItems,searchNameSQL} from '../worker/inventory-queries.js';
function fixture(through=15) {
  const db=sqliteDB(through),statements=[];
  db.sqlite.exec("INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES('a','aaa','Admin','!','admin',0),('w','www','Worker','!','worker',0),('l','lll','Lead','!','service_lead',0);INSERT INTO sessions VALUES('a','a',unixepoch()+3600),('w','w',unixepoch()+3600),('l','l',unixepoch()+3600);INSERT INTO grants VALUES('w','servicio:barra');INSERT INTO cycles(id,name,catalog_version,state) VALUES('target','Target','inventory-v3-2026-10-22','open'),('old','Old','inventory-v2-2026-10-21','closed')");
  const prepare=db.prepare.bind(db);
  db.prepare=sql=>{statements.push(sql);return prepare(sql);};
  const count=(item,{status='counted',voided=0,author='a',cycle='target'}={})=>db.sqlite.prepare('INSERT INTO counts(cycle_id,item_id,location_id,q,unit,status,note,out_of_stock,author,version,updated_at,voided) VALUES(?,?,?,1000,?,?,\'\',0,?,1,\'now\',?)').run(cycle,item.id,item.locationId,item.unit,status,author,voided);
  return {db,statements,count};
}
const plain=value=>JSON.parse(JSON.stringify(value));
const order=items=>items.sort((a,b)=>(a.id+'@'+a.locationId).localeCompare(b.id+'@'+b.locationId));
function reference(data,{scope='',query=''}={}) {
  const items=data.items.filter(item=>item.active&&(!scope||item.locationId===scope||item.locationId.startsWith(scope+':'))&&item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const ids=new Set(items.map(item=>item.id));
  return {items,total:items.length,counted:data.counts.filter(count=>ids.has(count.itemId)&&count.status==='counted').length};
}

test('SQL search and aggregates preserve approved catalogs, all projected fields, case/accent/literal substring and scoped permissions',async()=>{
  for(const through of [7,15]) {
    const f=fixture(through);
    try {
      const whole=await boot(f.db,'a','target'),service=whole.items.filter(item=>item.locationId==='servicio:barra'&&item.active);
      f.count(service[0]);f.count(service[1],{status:'partial'});f.count(service[2],{voided:1});f.count(service[3],{author:null});
      const inactive=service[4];f.count(inactive);
      f.db.sqlite.prepare("INSERT INTO item_activity(area_id,item_id,active,changed_at,inactive_since) VALUES('servicio',?,0,'now','now')").run(inactive.id);
      for(const hash of ['a','w','l'])for(const cycle of ['target','old']) {
        const data=await boot(f.db,hash,cycle);
        const scopes=['',...data.scopes.filter(scope=>scope.id==='servicio'||scope.id==='servicio:barra'||scope.id==='cocina').map(scope=>scope.id)];
        for(const scope of scopes)for(const query of ['', 'CAFÉ','café','Ñ','azúcar','%','_',' ',"'",'inexistente']) {
          const options={scope,query},expected=reference(data,options);
          assert.deepEqual(order(await searchItems(f.db,hash,cycle,options)),order(expected.items),JSON.stringify({through,hash,cycle,scope,query}));
          assert.deepEqual(plain(await summarizeItems(f.db,hash,cycle,options)),{total:expected.total,counted:expected.counted},JSON.stringify({through,hash,cycle,scope,query}));
        }
      }
      // Exhaustively validate the SQL folding against JavaScript for both approved catalogs.
      for(const row of f.db.sqlite.prepare(`SELECT data,${searchNameSQL} normalized FROM catalog_items ci`).all())assert.equal(row.normalized,JSON.parse(row.data).name.toLocaleLowerCase());
    } finally {f.db.sqlite.close();}
  }
});

test('search/summary validate visible scopes and recheck permissions and sessions on every statement',async()=>{
  const f=fixture();try {
    for(const helper of [searchItems,summarizeItems]) {
      for(const scope of ['cocina','missing','servicio:barra:missing'])await assert.rejects(helper(f.db,'w','target',{scope}),error=>error.code==='FORBIDDEN');
      assert.ok((await searchItems(f.db,'w','target',{scope:'servicio'})).length>0);
      assert.deepEqual(await searchItems(f.db,'w','target',{query:'%'}),[]);
      f.db.sqlite.exec("DELETE FROM grants WHERE user_id='w'");
      await assert.rejects(helper(f.db,'w','target',{scope:'servicio'}),error=>error.code==='FORBIDDEN');
      assert.deepEqual(await searchItems(f.db,'w','target'),[]);
      assert.deepEqual(plain(await summarizeItems(f.db,'w','target')),{total:0,counted:0});
      f.db.sqlite.exec("INSERT INTO grants VALUES('w','servicio:barra')");
      f.db.sqlite.exec("UPDATE sessions SET expires=unixepoch()-1 WHERE hash='w'");
      assert.deepEqual(await searchItems(f.db,'w','target'),[]);
      await assert.rejects(helper(f.db,'w','target',{scope:'servicio'}),error=>error.code==='FORBIDDEN');
      f.db.sqlite.exec("UPDATE sessions SET expires=unixepoch()+3600 WHERE hash='w'");
    }
  } finally {f.db.sqlite.close();}
});

test('SQL summary returns one aggregate row and search never hydrates counts, history, scopes, cursor or cycle payload',async()=>{
  const f=fixture();try {
    f.statements.length=0;
    const summary=await summarizeItems(f.db,'a','target');assert.ok(summary.total>0);
    assert.equal(f.statements.length,1);assert.match(f.statements[0],/SELECT count\(\*\) total/);
    assert.doesNotMatch(f.statements[0],/count_records|cr\.record|history|cycle_scope_states|SELECT cy\.\*/);
    f.statements.length=0;
    const items=await searchItems(f.db,'w','target',{query:'CAFÉ'});assert.ok(items.length>0);
    assert.equal(f.statements.length,1);assert.doesNotMatch(f.statements[0],/count_records|JOIN counts|history|cycle_scope_states/);
    f.statements.length=0;
    await searchItems(f.db,'w','target',{scope:'servicio',query:'CAFÉ'});assert.equal(f.statements.length,2);
  } finally {f.db.sqlite.close();}
});
