-- Usuarios personales: nuevo rol, eliminación irreversible e identidad estable.
-- D1 aplica la migración como transacción; preservar claves de todos los hijos.
PRAGMA defer_foreign_keys=ON;
DROP VIEW count_records;
DROP TRIGGER accept_operation;
DROP TRIGGER apply_operation;
CREATE TABLE users_next (
 id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
 name TEXT NOT NULL, password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('worker','service_lead','admin')),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 must_change INTEGER NOT NULL DEFAULT 1, revision INTEGER NOT NULL DEFAULT 1,
 deleted_at TEXT,
 managed_scope TEXT CHECK(managed_scope IS NULL OR managed_scope='servicio')
);
INSERT INTO users_next(id,username,name,password_hash,role,active,must_change,revision)
 SELECT id,username,name,password_hash,role,active,must_change,revision FROM users;
DROP TABLE users;
ALTER TABLE users_next RENAME TO users;
CREATE TRIGGER last_admin_update BEFORE UPDATE OF active,role ON users
 WHEN OLD.role='admin' AND OLD.active=1 AND (NEW.role!='admin' OR NEW.active!=1)
 AND (SELECT count(*) FROM users WHERE role='admin' AND active=1 AND deleted_at IS NULL)<=1
 BEGIN SELECT RAISE(ABORT,'LAST_ADMIN'); END;
CREATE TRIGGER last_admin_delete BEFORE DELETE ON users WHEN OLD.role='admin' AND OLD.active=1
 AND (SELECT count(*) FROM users WHERE role='admin' AND active=1 AND deleted_at IS NULL)<=1
 BEGIN SELECT RAISE(ABORT,'LAST_ADMIN'); END;
CREATE TRIGGER revoke_sessions AFTER UPDATE OF username,password_hash,active,deleted_at ON users
 WHEN OLD.username!=NEW.username OR OLD.password_hash!=NEW.password_hash OR NEW.active=0 OR NEW.deleted_at IS NOT NULL
 BEGIN DELETE FROM sessions WHERE user_id=NEW.id; END;
CREATE TRIGGER deleted_user_immutable BEFORE UPDATE ON users WHEN OLD.deleted_at IS NOT NULL
 BEGIN SELECT RAISE(ABORT,'DELETED_USER'); END;
CREATE VIEW inventory_permissions AS
 SELECT u.id user_id,s.id scope_id FROM users u CROSS JOIN scopes s
 WHERE u.active=1 AND u.deleted_at IS NULL AND (
  u.role='admin' OR
  (u.role='service_lead' AND EXISTS(SELECT 1 FROM scope_closure c WHERE c.ancestor='servicio' AND c.descendant=s.id)) OR
  (u.role='worker' AND EXISTS(SELECT 1 FROM grants g JOIN scope_closure c ON c.ancestor=g.scope_id WHERE g.user_id=u.id AND c.descendant=s.id))
 );
CREATE VIEW count_records AS SELECT c.*, json_object(
 'itemId',c.item_id,'locationId',c.location_id,'cycleId',c.cycle_id,'quantity',c.q/1000.0,'unit',c.unit,
 'status',c.status,'note',c.note,'outOfStock',json(CASE WHEN c.out_of_stock=1 THEN 'true' ELSE 'false' END),
 'authorId',c.author,'authorName',u.name,'version',c.version,'countedAt',c.updated_at) AS record
 FROM counts c JOIN users u ON u.id=c.author;
CREATE TRIGGER accept_operation BEFORE INSERT ON operations BEGIN
 -- Permission/session checks precede deduplication: revoked users cannot recover old data.
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sessions s JOIN users u ON u.id=s.user_id
 WHERE s.hash=NEW.session_hash AND s.user_id=NEW.user_id AND s.expires>unixepoch() AND u.active=1 AND u.must_change=0
 AND u.deleted_at IS NULL AND EXISTS(SELECT 1 FROM inventory_permissions p WHERE p.user_id=u.id AND p.scope_id=NEW.location_id))
 THEN RAISE(ABORT,'FORBIDDEN') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM operations WHERE id=NEW.id AND (fingerprint!=NEW.fingerprint OR user_id!=NEW.user_id)) THEN RAISE(ABORT,'ID_REUSED') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM operations WHERE id=NEW.id) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM cycles WHERE id=NEW.cycle_id AND state='open') THEN RAISE(ABORT,'CYCLE_CLOSED') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM cycles cy JOIN catalog_items ci ON ci.version=cy.catalog_version
 WHERE cy.id=NEW.cycle_id AND ci.id=NEW.item_id AND ci.location_id=NEW.location_id AND ci.unit=NEW.unit) THEN RAISE(ABORT,'INVALID_ITEM_UNIT') END;
 SELECT CASE WHEN NEW.expected_version!=coalesce((SELECT version FROM counts WHERE cycle_id=NEW.cycle_id AND item_id=NEW.item_id AND location_id=NEW.location_id),0) THEN RAISE(ABORT,'STALE') END;
 SELECT CASE WHEN NEW.action='direct' AND EXISTS(SELECT 1 FROM counts WHERE cycle_id=NEW.cycle_id AND item_id=NEW.item_id AND location_id=NEW.location_id AND author!=NEW.user_id) THEN RAISE(ABORT,'FOREIGN_RECORD') END;
 SELECT CASE WHEN NEW.action!='direct' AND NOT EXISTS(SELECT 1 FROM counts WHERE cycle_id=NEW.cycle_id AND item_id=NEW.item_id AND location_id=NEW.location_id) THEN RAISE(ABORT,'STALE') END;
 SELECT CASE WHEN NEW.action='add' AND NEW.unit='' THEN RAISE(ABORT,'INVALID_ITEM_UNIT') END;
 SELECT CASE WHEN NEW.out_of_stock=1 AND (NEW.q!=0 OR NEW.status!='counted' OR NEW.action='add') THEN RAISE(ABORT,'INVALID_ZERO') END;
 SELECT CASE WHEN NEW.action='add' AND NEW.q+coalesce((SELECT q FROM counts WHERE cycle_id=NEW.cycle_id AND item_id=NEW.item_id AND location_id=NEW.location_id),0)>1000000000 THEN RAISE(ABORT,'QUANTITY_LIMIT') END;
END;
CREATE TRIGGER apply_operation AFTER INSERT ON operations BEGIN
 INSERT INTO history(operation_id,cycle_id,item_id,location_id,user_id,action,before_record,entered_record,after_record,created_at)
 VALUES(NEW.id,NEW.cycle_id,NEW.item_id,NEW.location_id,NEW.user_id,NEW.action,
 (SELECT record FROM count_records WHERE cycle_id=NEW.cycle_id AND item_id=NEW.item_id AND location_id=NEW.location_id),
 json_object('quantity',NEW.q/1000.0,'status',NEW.status,'note',NEW.note,'outOfStock',NEW.out_of_stock,'unit',NEW.unit,'expectedVersion',NEW.expected_version), '{}',NEW.created_at);
 INSERT INTO counts(cycle_id,item_id,location_id,q,unit,status,note,out_of_stock,author,version,updated_at)
 VALUES(NEW.cycle_id,NEW.item_id,NEW.location_id,NEW.q,NEW.unit,NEW.status,NEW.note,NEW.out_of_stock,NEW.user_id,1,NEW.created_at)
 ON CONFLICT(cycle_id,item_id,location_id) DO UPDATE SET
 q=CASE WHEN NEW.action='add' THEN counts.q+NEW.q ELSE NEW.q END,
 status=CASE WHEN NEW.action='add' AND (counts.status='partial' OR NEW.status='partial') THEN 'partial' ELSE NEW.status END,
 note=CASE WHEN NEW.action='add' THEN CASE WHEN counts.note!='' AND substr(counts.note,1,1)!='[' THEN '[' || (SELECT name FROM users WHERE id=counts.author) || ' · ' || counts.updated_at || '] ' || counts.note ELSE counts.note END || CASE WHEN length(NEW.note)>0 THEN char(10) || '[' || (SELECT name FROM users WHERE id=NEW.user_id) || ' · ' || NEW.created_at || '] ' || NEW.note ELSE '' END ELSE NEW.note END,
 out_of_stock=CASE WHEN NEW.action='add' THEN CASE WHEN counts.q+NEW.q>0 OR counts.status='partial' OR NEW.status='partial' THEN 0 ELSE counts.out_of_stock END ELSE NEW.out_of_stock END,
 author=NEW.user_id, version=counts.version+1, updated_at=NEW.created_at;
 UPDATE history SET after_record=(SELECT record FROM count_records WHERE cycle_id=NEW.cycle_id AND item_id=NEW.item_id AND location_id=NEW.location_id) WHERE operation_id=NEW.id;
 UPDATE operations SET result=(SELECT after_record FROM history WHERE operation_id=NEW.id) WHERE id=NEW.id;
END;

PRAGMA defer_foreign_keys=OFF;
