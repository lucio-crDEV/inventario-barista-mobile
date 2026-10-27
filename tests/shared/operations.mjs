import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  statSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { hashPassword } from "../../worker/password.js";
import { runtimeSchemaSQL, runtimeReadinessSQL } from "../../worker/runtime-readiness.js";
import {
  localDatabase,
  wrangler,
  verifiedBackup,
} from "../../scripts/operations/storage.mjs";
const root = mkdtempSync(join(tmpdir(), "inventory-recovery-test-")),
  state = join(root, "source"),
  backup = join(root, "backup"),
  restored = join(root, "restored");
mkdirSync(state);
const checks = [];
const run = (script, args) =>
  execFileSync(process.execPath, [`scripts/${script}.mjs`, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
function database(state) {
  const dir = join(state, "v3/d1/miniflare-D1DatabaseObject");
  return new DatabaseSync(
    join(
      dir,
      readdirSync(dir).find(
        (p) => p.endsWith(".sqlite") && p !== "metadata.sqlite",
      ),
    ),
  );
}
let db,
  copy,
  runtime = localDatabase(state);
try {
  wrangler(["migrations", "apply", "DB", ...runtime.args]);
  db = database(state);
  const password = await hashPassword("Solo-pruebas-2026");
  db.prepare(
    "INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES(?,?,?,?,?,0)",
  ).run("admin-ops", "admin-ops", "Admin ficticio", password, "admin");
  db.prepare(
    "INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES(?,?,?,?,?,0)",
  ).run("worker-ops", "worker-ops", "Trabajador ficticio", password, "worker");
  db.exec(
    "INSERT INTO grants VALUES('worker-ops','servicio:barra'); INSERT INTO cycles(id,name,catalog_version,state) VALUES('ops-cycle','Ensayo recuperación','inventory-v2-2026-10-21','open'); INSERT INTO sessions VALUES('session-ops','worker-ops',unixepoch()+3600); INSERT INTO admin_audit(actor,target,action,detail) VALUES('fixture','worker-ops','create','{}');",
  );
  const x = db
    .prepare(
      "SELECT * FROM catalog_items WHERE location_id='servicio:barra' AND unit!='' LIMIT 1",
    )
    .get();
  const insert = db.prepare(
    "INSERT INTO operations(id,fingerprint,user_id,session_hash,cycle_id,item_id,location_id,expected_version,action,q,unit,status,note,out_of_stock) VALUES(?,?,'worker-ops',?,'ops-cycle',?,'servicio:barra',?,'direct',?,?,'counted',?,0)",
  );
  insert.run(
    "op-before-backup",
    "fingerprint-before",
    "session-ops",
    x.id,
    0,
    4000,
    x.unit,
    "Nota con autor conservado",
  );
  db.exec("BEGIN");
  for (let i = 0; i < 1005; i++) {
    db.prepare(
      "INSERT INTO sessions VALUES(?,'worker-ops',unixepoch()-172801)",
    ).run("expired-" + i);
    db.prepare(
      "INSERT INTO attempts VALUES(?,CAST((unixepoch()-259200)/900 AS INTEGER),7)",
    ).run("old-" + i);
  }
  db.exec(
    "INSERT INTO sessions VALUES('recent-expiry','worker-ops',unixepoch()-3600); INSERT INTO attempts VALUES('current-key',CAST(unixepoch()/900 AS INTEGER),2); COMMIT;",
  );
  assert.equal(db.prepare("SELECT count(*) n FROM sqlite_schema WHERE name='activity_hourly'").get().n, 0);
  db.exec("INSERT INTO sessions VALUES('admin-session-ops','admin-ops',unixepoch()+3600)");
  const extraItem=db.prepare("SELECT id,location_id FROM catalog_items WHERE version='inventory-v2-2026-10-21' AND location_id='servicio:barra' AND id!=? LIMIT 1").get(x.id);
  const activation=db.prepare("INSERT INTO supervision_commands(id,fingerprint,user_id,session_hash,user_revision,cycle_id,expected_revision,kind,item_id,location_id,expected_version,active,reason) VALUES('ops-activation','ops-fingerprint','admin-ops',?,1,'ops-cycle',1,'activation',?,?,0,0,'Exclusión de ensayo')");
  activation.run('admin-session-ops',extraItem.id,extraItem.location_id);
  db.exec("INSERT INTO supervision_commands(id,fingerprint,user_id,session_hash,user_revision,cycle_id,expected_revision,kind,scope_id,new_state,reason) VALUES('ops-review','review-fingerprint','admin-ops','admin-session-ops',1,'ops-cycle',2,'state','servicio','review','Revisión de ensayo'); INSERT INTO supervision_commands(id,fingerprint,user_id,session_hash,user_revision,cycle_id,expected_revision,kind,scope_id,new_state,reason) VALUES('ops-reopen','reopen-fingerprint','admin-ops','admin-session-ops',1,'ops-cycle',3,'state','servicio','open','Reapertura de ensayo')");
  const tables = [
    "users",
    "grants",
    "scopes",
    "scope_closure",
    "catalog_items",
    "cycles",
    "counts",
    "operations",
    "history",
    "d1_migrations",
    "cycle_item_states",
    "cycle_scope_states",
    "supervision_commands",
    "item_activity",
    "item_activity_events",
  ];
  const catalogIntegrityBefore = db.prepare("SELECT * FROM catalog_integrity ORDER BY version").all();
  const contractBefore = db.prepare("SELECT * FROM runtime_contract WHERE id=1").get();
  assert.equal(contractBefore.schema_signature, Object.values(db.prepare(runtimeSchemaSQL).get())[0]);
  assert.equal(db.prepare(runtimeReadinessSQL).get('', '').ready, 1);
  const revokedSessionCount = db.prepare("SELECT count(*) n FROM sessions").get().n;
  const snapshot = Object.fromEntries(
    tables.map((t) => [
      t,
      JSON.stringify(db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()),
    ]),
  );
  for (const forbidden of [
    "dist/backup-refused",
    "sources/backup-refused",
    "docs/backup-refused",
  ]) {
    assert.throws(() =>
      run("backup", ["--local", "--state", state, "--directory", forbidden]),
    );
    assert.equal(existsSync(forbidden), false);
  }
  run("backup", ["--local", "--state", state, "--directory", backup]);
  assert.equal(statSync(backup).mode & 0o777, 0o700);
  assert.equal(statSync(join(backup, "database.sql")).mode & 0o777, 0o600);
  assert.equal(statSync(join(backup, "manifest.json")).mode & 0o777, 0o600);
  assert.ok(
    !readFileSync(join(backup, "database.sql"), "utf8").includes(
      "Solo-pruebas-2026",
    ),
  );
  verifiedBackup(backup);
  assert.throws(() =>
    run("backup", ["--local", "--state", state, "--directory", backup]),
  );
  checks.push(
    "Exportación D1 real con manifiesto SHA-256, carpeta 0700, archivos 0600 y rechazo de sobrescritura",
  );
  run("restore-local", ["--directory", backup, "--state", restored]);
  copy = database(restored);
  assert.deepEqual(
    copy
      .prepare("PRAGMA integrity_check")
      .all()
      .map((x) => Object.values(x)[0]),
    ["ok"],
  );
  assert.deepEqual(copy.prepare("PRAGMA foreign_key_check").all(), []);
  for (const t of tables)
    assert.equal(
      JSON.stringify(copy.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()),
      snapshot[t],
      t,
    );
  assert.equal(copy.prepare("SELECT count(*) n FROM sessions").get().n, 0);
  const contractAfter = copy.prepare("SELECT * FROM runtime_contract WHERE id=1").get();
  assert.equal(contractAfter.schema_signature, contractBefore.schema_signature, "restore preserves exact signed DDL");
  assert.equal(contractAfter.schema_signature, Object.values(copy.prepare(runtimeSchemaSQL).get())[0], "restored DDL still matches its stored signature");
  assert.equal(contractAfter.catalog_version, contractBefore.catalog_version);
  assert.deepEqual(copy.prepare("SELECT * FROM catalog_integrity ORDER BY version").all(),catalogIntegrityBefore);
  assert.equal(contractAfter.users_metadata_revision, contractBefore.users_metadata_revision + revokedSessionCount, "session revocation transactionally invalidates metadata revision");
  assert.equal(copy.prepare(runtimeReadinessSQL).get('', '').ready, 1, "restored application passes hot readiness contract");
  assert.deepEqual(copy.prepare("SELECT c.version,c.row_count,c.expected_count,count(ci.id) actual FROM catalog_integrity c JOIN catalog_items ci ON ci.version=c.version GROUP BY c.version ORDER BY c.version").all().map(row=>[row.row_count,row.expected_count,row.actual]), [[1227,1227,1227],[1268,1268,1268]]);
  checks.push("Migración 0013: firma DDL exacta y contrato de lectura válidos tras exportar/restaurar, contadores de catálogo conservados e invalidación de sesiones transaccional");
  assert.equal(copy.prepare("SELECT count(*) n FROM sqlite_schema WHERE name='activity_hourly'").get().n, 0);
  assert.equal(
    copy
      .prepare("SELECT count(*) n FROM admin_audit WHERE action='restore'")
      .get().n,
    1,
  );
  assert.throws(() =>
    run("restore-local", ["--directory", backup, "--state", restored]),
  );
  checks.push(
    "Restauración en otra D1 local: datos, permisos, catálogo, conteo, historial y deduplicación idénticos; integridad y claves foráneas válidas",
  );
  checks.push(
    "Todas las sesiones restauradas quedan revocadas y el destino existente se protege",
  );
  copy.exec(
    "INSERT INTO sessions VALUES('new-session-ops','worker-ops',unixepoch()+3600)",
  );
  const replay = copy.prepare(
    "INSERT INTO operations(id,fingerprint,user_id,session_hash,cycle_id,item_id,location_id,expected_version,action,q,unit,status,note,out_of_stock) VALUES(?,?,'worker-ops','new-session-ops','ops-cycle',?,'servicio:barra',?,'direct',?,?,'counted',?,0)",
  );
  replay.run(
    "op-before-backup",
    "fingerprint-before",
    x.id,
    0,
    4000,
    x.unit,
    "Nota con autor conservado",
  );
  assert.equal(copy.prepare("SELECT version FROM counts").get().version, 1);
  replay.run(
    "op-after-restore",
    "fingerprint-after",
    x.id,
    1,
    3000,
    x.unit,
    "Nueva edición después de restaurar",
  );
  assert.equal(copy.prepare("SELECT q,version FROM counts").get().q, 3000);
  replay.run(
    "op-before-backup",
    "fingerprint-before",
    x.id,
    0,
    4000,
    x.unit,
    "Nota con autor conservado",
  );
  const current = copy.prepare("SELECT q,version FROM counts").get();
  assert.equal(current.q, 3000);
  assert.equal(current.version, 2);
  assert.equal(copy.prepare("SELECT count(*) n FROM history").get().n, 2);
  checks.push(
    "Los triggers restaurados aceptan una nueva edición y un reintento previo no duplica ni restaura un valor antiguo",
  );
  copy.exec("INSERT INTO sessions VALUES('new-admin-session','admin-ops',unixepoch()+3600)");
  const commandsBefore=copy.prepare("SELECT count(*) n FROM supervision_commands").get().n;
  copy.prepare("INSERT INTO supervision_commands(id,fingerprint,user_id,session_hash,user_revision,cycle_id,expected_revision,kind,item_id,location_id,expected_version,active,reason) VALUES('ops-activation','ops-fingerprint','admin-ops','new-admin-session',1,'ops-cycle',1,'activation',?,?,0,0,'Exclusión de ensayo')").run(extraItem.id,extraItem.location_id);
  assert.equal(copy.prepare("SELECT count(*) n FROM supervision_commands").get().n,commandsBefore);
  assert.equal(copy.prepare("SELECT revision FROM cycles WHERE id='ops-cycle'").get().revision,4);
  checks.push("Recupera actividad persistente por área, estado de Servicio y comandos auditados 3B; reintento con sesión nueva no duplica ni cambia revisión");
  const sql = readFileSync(join(backup, "database.sql"));
  writeFileSync(
    join(backup, "database.sql"),
    Buffer.concat([sql, Buffer.from("\n-- alterado\n")]),
  );
  const badTarget = join(root, "must-not-exist");
  assert.throws(() =>
    run("restore-local", ["--directory", backup, "--state", badTarget]),
  );
  assert.equal(existsSync(badTarget), false);
  writeFileSync(join(backup, "database.sql"), sql);
  checks.push("Un respaldo alterado se rechaza antes de crear el destino");
  db.exec("CREATE TABLE activity_hourly(sentinel TEXT); INSERT INTO activity_hourly VALUES('keep-old-usage')");
  const beforeSessions = db.prepare("SELECT count(*) n FROM sessions").get().n;
  const preview = JSON.parse(run("maintenance", ["--local", "--state", state]));
  assert.equal(preview.mode, "read-only");
  assert.equal(preview.remaining.expired_sessions, 1005);
  assert.equal("expired_activity_buckets" in preview.remaining, false);
  assert.equal(
    db.prepare("SELECT count(*) n FROM sessions").get().n,
    beforeSessions,
  );
  const cleaned = JSON.parse(
    run("maintenance", ["--local", "--state", state, "--apply"]),
  );
  assert.equal(cleaned.remaining.expired_sessions, 5);
  assert.equal(cleaned.remaining.expired_attempt_keys, 5);
  assert.equal("expired_activity_buckets" in cleaned.remaining, false);
  run("maintenance", ["--local", "--state", state, "--apply"]);
  assert.equal(db.prepare("SELECT count(*) n FROM sessions").get().n, 3);
  assert.equal(db.prepare("SELECT count(*) n FROM attempts").get().n, 1);
  assert.equal(db.prepare("SELECT sentinel FROM activity_hourly").get().sentinel, "keep-old-usage");
  checks.push("Mantenimiento sin dependencia de telemetría; tabla opcional existente no se consulta ni poda");
  for (const t of tables)
    assert.equal(
      JSON.stringify(db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()),
      snapshot[t],
      t,
    );
  assert.equal(
    db
      .prepare("SELECT count(*) n FROM admin_audit WHERE action='cleanup'")
      .get().n,
    2,
  );
  checks.push(
    "Retención: consulta sin cambios, limpieza limitada a 1000 filas por tabla, conserva sesiones recientes, cuota vigente, auditoría e IDs de operación",
  );
  // Exercise both modes on the real 0001–0004 baseline, with no activity table.
  db.exec("DROP TABLE activity_hourly");
  const withoutUsage = JSON.parse(run("maintenance", ["--local", "--state", state]));
  assert.equal(withoutUsage.remaining.expired_sessions, 0);
  const cleanedWithoutUsage = JSON.parse(run("maintenance", ["--local", "--state", state, "--apply"]));
  assert.equal(cleanedWithoutUsage.remaining.expired_attempt_keys, 0);
  assert.equal(db.prepare("SELECT count(*) n FROM sessions").get().n, 3);
  for (const t of tables) assert.equal(JSON.stringify(db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()), snapshot[t], t);
  checks.push("Consulta y limpieza sobre esquema operativo 0007 sin tabla de telemetría funcionan y conservan datos");
  for (const script of ["backup", "restore-local", "maintenance"]) {
    const denied = spawnSync(
      process.execPath,
      [`scripts/${script}.mjs`, "--remote"],
      { encoding: "utf8" },
    );
    assert.notEqual(denied.status, 0);
  }
  checks.push(
    "Se rechazan opciones remotas incompletas; restauración automatizada exclusivamente local",
  );
  if (process.env.OPERATIONS_WRITE_EVIDENCE !== "0") writeFileSync(
    "docs/operaciones-local-3a.json",
    JSON.stringify(
      {
        checks,
        remoteDatabaseTouched: false,
        sourceAndRestore:
          "Dos bases D1 locales desechables e independientes de desarrollo",
        inventoryPreserved: true,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ checks }, null, 2));
} finally {
  db?.close();
  copy?.close();
  runtime.close();
  rmSync(root, { recursive: true, force: true });
}
