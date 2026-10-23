import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
const directory = mkdtempSync(join(tmpdir(),"inventory-service-migration-"));
const run = file => execFileSync(process.execPath,["node_modules/wrangler/bin/wrangler.js","d1","execute","DB","--local","--env","local","--persist-to",join(directory,"state"),"--file",file],{stdio:"pipe"});
const file = join(directory,"migration.sql");
const execute = sql => { writeFileSync(file,sql,{mode:0o600}); run(file); };
let db;
try {
  execute(readFileSync("migrations/0001_core.sql","utf8")+readFileSync("migrations/0002_catalog.sql","utf8")+`
    INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES('admin-migration','admin-migration','Admin','hash','admin',0),('worker-migration','worker-migration','Persona histórica','hash','worker',0);
    INSERT INTO sessions VALUES('migration-session','worker-migration',unixepoch()+3600);
    INSERT INTO grants VALUES('worker-migration','servicio:armado-linea-coperia');
    INSERT INTO cycles VALUES('previous-cycle','Ciclo anterior','inventory-v2-2026-10-21','open');
    INSERT INTO operations(id,fingerprint,user_id,session_hash,cycle_id,item_id,location_id,expected_version,action,q,unit,status,note,out_of_stock)
      SELECT 'migration-operation','same-payload','worker-migration','migration-session','previous-cycle',id,location_id,0,'direct',4000,unit,'counted','Nota original',0 FROM catalog_items WHERE location_id='servicio:armado-linea-coperia' AND json_extract(data,'$.category')='Aseo' LIMIT 1;
  `);
  const folder=join(directory,"state/v3/d1/miniflare-D1DatabaseObject");
  const databaseFile=join(folder,readdirSync(folder).find(n=>n.endsWith(".sqlite")&&n!=="metadata.sqlite"));
  db=new DatabaseSync(databaseFile);
  const tables=["sessions","cycles","counts","operations","history"];
  const before=Object.fromEntries(tables.map(t=>[t,db.prepare(`SELECT * FROM ${t}`).all()]));
  db.close();db=null;
  execute(readFileSync("migrations/0003_users_service.sql","utf8"));
  execute(readFileSync("migrations/0004_service_catalog.sql","utf8"));
  db=new DatabaseSync(databaseFile);
  for(const table of tables) assert.deepEqual(db.prepare(`SELECT * FROM ${table}`).all(),before[table],table);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(),[]);
  assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check,"ok");
  assert.equal(db.prepare("SELECT count(*) n FROM grants WHERE user_id='worker-migration' AND scope_id='servicio:coperia'").get().n,1);
  assert.equal(db.prepare("SELECT count(*) n FROM catalog_items WHERE version='inventory-v2-2026-10-21'").get().n,1227);
  assert.equal(db.prepare("SELECT count(*) n FROM catalog_items WHERE version='inventory-v3-2026-10-22'").get().n,1268);
  const op=db.prepare("SELECT * FROM operations WHERE id='migration-operation'").get();
  db.close();db=null;
  const q=x=>`'${String(x).replaceAll("'","''")}'`;
  execute(`INSERT INTO operations(id,fingerprint,user_id,session_hash,cycle_id,item_id,location_id,expected_version,action,q,unit,status,note,out_of_stock) VALUES(${[op.id,op.fingerprint,op.user_id,op.session_hash,op.cycle_id,op.item_id,op.location_id].map(q).join(",")},0,'direct',4000,${q(op.unit)},'counted','Nota original',0);`);
  db=new DatabaseSync(databaseFile);
  assert.deepEqual(db.prepare("SELECT * FROM operations").all(),before.operations);
  assert.deepEqual(db.prepare("SELECT * FROM counts").all(),before.counts);
  assert.deepEqual(db.prepare("SELECT * FROM history").all(),before.history);
  assert.equal(db.prepare("SELECT count(*) n FROM sqlite_schema WHERE name='activity_hourly'").get().n,0);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(),[]);
  assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check,"ok");
  const before3b=Object.fromEntries(["users","grants",...tables].map(t=>[t,db.prepare(`SELECT * FROM ${t}`).all()]));
  db.close();db=null;
  execute(readFileSync("migrations/0006_supervision.sql","utf8"));
  db=new DatabaseSync(databaseFile);
  for(const [table,rows] of Object.entries(before3b)){
    const after=db.prepare(`SELECT * FROM ${table}`).all().map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>!(["voided","reason","revision"].includes(key)&&!(key in (rows[0]||{}))))));
    assert.deepEqual(after,rows.map(row=>({...row})),table);
  }
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(),[]);
  assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check,"ok");
  assert.equal(db.prepare("SELECT count(*) n FROM supervision_commands").get().n,0);
  const report={environment:"Wrangler + D1 local real, base temporal separada",date:new Date().toISOString(),passed:true,checks:["0003, 0004 y 0006 sobre usuarios, sesiones, ciclo, conteo y operación previos","Claves foráneas e integridad válidas","Sesiones/UUID/conteos/historial/resultados previos idénticos","Catálogo anterior conservado y alcance combinado trasladado a Copería","Reintento previo no duplica ni modifica el conteo tras migrar"]};
  writeFileSync("docs/migracion-servicio-local-3b.json",JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify(report,null,2));
} finally { db?.close();rmSync(directory,{recursive:true,force:true}); }
