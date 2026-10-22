import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { items } from "../data/inventario/items/index.js";
import { vitrinaReferences } from "../data/inventario/items/service-layout.js";
import { homeScope, scopeURL, canonicalScope } from "../shared/navigation.js";
import { scopes } from "../worker/catalog.js";

test("Reparto confirmado: 32 Aseo en Copería, 42 Línea/Armado y 41 Vitrina independientes", () => {
  assert.equal(items.filter(i => i.sectorId === "coperia").length,32);
  assert.ok(items.filter(i => i.sectorId === "coperia").every(i => i.countCategory === "Aseo"));
  assert.equal(items.filter(i => i.sectorId === "armado-linea-coperia").length,42);
  for (const [,row] of vitrinaReferences) {
    const pair = items.filter(i => i.sectorId === "mercadito" && i.exportRow === row);
    assert.equal(pair.length,2);
    assert.equal(new Set(pair.map(i => i.id)).size,2);
    assert.equal(pair[0].name,pair[1].name); assert.equal(pair[0].unit,pair[1].unit);
    assert.equal(pair[1].countCategory,"Vitrina"); assert.equal(pair[1].zoneId,"vitrina");
  }
});
test("Inicio salta áreas/sectores únicos pero conserva zonas de Garzones", () => {
  const visible = ids => scopes.filter(s => ids.includes(s.id));
  assert.equal(homeScope(visible(["pasteleria"])),"pasteleria");
  assert.equal(homeScope(visible(["cocina","pasteleria"])),null);
  assert.equal(homeScope(visible(["servicio","servicio:garzones","servicio:garzones:privada"])),"servicio:garzones");
  assert.equal(homeScope(visible(["servicio","servicio:barra"])),"servicio:barra");
  assert.equal(homeScope(visible(["servicio","servicio:barra","servicio:coperia"])),"servicio");
  assert.equal(canonicalScope("servicio",visible(["servicio","servicio:garzones"])),"servicio:garzones");
  assert.equal(scopeURL("servicio:garzones:privada"),"/pages/inventario/?area=servicio&sector=garzones&zone=privada");
  assert.equal(homeScope([]),null);
});
test("Migración conserva identidad, sesiones y conteos; rol acotado y eliminación irreversible", () => {
  const db = new DatabaseSync(":memory:"); db.exec("PRAGMA foreign_keys=ON");
  db.exec(readFileSync("migrations/0001_core.sql","utf8"));
  db.exec(readFileSync("migrations/0002_catalog.sql","utf8"));
  db.exec(`INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES('a','admin','Admin','hash','admin',0),('w','worker','Persona','hash','worker',0);
    INSERT INTO grants VALUES('w','servicio:barra');
    INSERT INTO sessions VALUES('session','w',unixepoch()+3600);
    INSERT INTO cycles VALUES('old-cycle','Anterior','inventory-v2-2026-10-21','open');
    INSERT INTO operations(id,fingerprint,user_id,session_hash,cycle_id,item_id,location_id,expected_version,action,q,unit,status,note,out_of_stock)
    SELECT 'operation-before','hash','w','session','old-cycle',id,location_id,0,'direct',4000,unit,'counted','Nota histórica',0 FROM catalog_items WHERE location_id='servicio:barra' LIMIT 1;`);
  const before = db.prepare("SELECT * FROM counts").get();
  db.exec("BEGIN"); db.exec(readFileSync("migrations/0003_users_service.sql","utf8")); db.exec("COMMIT");
  db.exec("BEGIN"); db.exec(readFileSync("migrations/0004_service_catalog.sql","utf8")); db.exec("COMMIT");
  assert.deepEqual(db.prepare("SELECT * FROM counts").get(),before);
  assert.equal(db.prepare("SELECT user_id FROM sessions WHERE hash='session'").get().user_id,"w");
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(),[]);
  db.exec("INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES('j','jefa','Jefa','hash','service_lead',0); INSERT INTO grants VALUES('j','cocina');");
  assert.equal(db.prepare("SELECT count(*) n FROM inventory_permissions WHERE user_id='j' AND scope_id='cocina'").get().n,0);
  assert.equal(db.prepare("SELECT count(*) n FROM inventory_permissions WHERE user_id='j' AND scope_id='servicio:coperia'").get().n,1);
  db.exec("UPDATE users SET username='nuevo' WHERE id='w'");
  assert.equal(db.prepare("SELECT count(*) n FROM sessions WHERE user_id='w'").get().n,0);
  db.exec("UPDATE users SET active=0,deleted_at='2026-10-22' WHERE id='w'");
  assert.throws(() => db.exec("UPDATE users SET active=1,deleted_at=NULL WHERE id='w'"),/DELETED_USER/);
  assert.equal(db.prepare("SELECT author FROM counts").get().author,"w");
  assert.equal(JSON.parse(db.prepare("SELECT after_record FROM history").get().after_record).authorName,"Persona");
  assert.throws(() => db.exec("UPDATE users SET active=0 WHERE id='a'"),/LAST_ADMIN/);
  assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check,"ok");
  db.close();
});
