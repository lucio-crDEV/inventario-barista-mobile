CREATE TABLE users (
 id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
 name TEXT NOT NULL, password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('worker','admin')),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 must_change INTEGER NOT NULL DEFAULT 1, revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE scopes (id TEXT PRIMARY KEY, name TEXT NOT NULL, parent TEXT REFERENCES scopes(id));
CREATE TABLE scope_closure (ancestor TEXT REFERENCES scopes(id), descendant TEXT REFERENCES scopes(id), PRIMARY KEY(ancestor,descendant));
CREATE TABLE grants (user_id TEXT REFERENCES users(id), scope_id TEXT REFERENCES scopes(id), PRIMARY KEY(user_id,scope_id));
CREATE TABLE catalog_items (version TEXT NOT NULL, id TEXT NOT NULL, location_id TEXT NOT NULL REFERENCES scopes(id), unit TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(version,id,location_id));
CREATE TABLE cycles (id TEXT PRIMARY KEY, name TEXT NOT NULL, catalog_version TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('open','review','closed')));
CREATE TABLE counts (
 cycle_id TEXT REFERENCES cycles(id), item_id TEXT, location_id TEXT REFERENCES scopes(id),
 q INTEGER NOT NULL CHECK(q BETWEEN 0 AND 1000000000), unit TEXT NOT NULL,
 status TEXT CHECK(status IN ('partial','counted')), note TEXT NOT NULL, out_of_stock INTEGER NOT NULL,
 author TEXT REFERENCES users(id), version INTEGER NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(cycle_id,item_id,location_id)
);
CREATE TABLE operations (
 id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), session_hash TEXT NOT NULL,
 cycle_id TEXT NOT NULL REFERENCES cycles(id), item_id TEXT NOT NULL, location_id TEXT NOT NULL,
 expected_version INTEGER NOT NULL, action TEXT NOT NULL CHECK(action IN ('direct','add','overwrite')),
 q INTEGER NOT NULL CHECK(q BETWEEN 0 AND 1000000000), unit TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('partial','counted')), note TEXT NOT NULL CHECK(length(note)<=1000),
 out_of_stock INTEGER NOT NULL CHECK(out_of_stock IN (0,1)),
 result TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE history (
 seq INTEGER PRIMARY KEY AUTOINCREMENT, operation_id TEXT NOT NULL UNIQUE REFERENCES operations(id),
 cycle_id TEXT NOT NULL, item_id TEXT NOT NULL, location_id TEXT NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, before_record TEXT, entered_record TEXT NOT NULL, after_record TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX history_scope_cursor ON history(cycle_id,location_id,seq);
CREATE TABLE admin_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL, target TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE attempts (key TEXT PRIMARY KEY, window INTEGER NOT NULL, n INTEGER NOT NULL);
CREATE TABLE guards (value INTEGER NOT NULL CHECK(value=1));
CREATE TRIGGER last_admin_update BEFORE UPDATE OF active,role ON users
 WHEN OLD.role='admin' AND OLD.active=1 AND (NEW.role!='admin' OR NEW.active!=1)
 AND (SELECT count(*) FROM users WHERE role='admin' AND active=1)<=1
 BEGIN SELECT RAISE(ABORT,'LAST_ADMIN'); END;
CREATE TRIGGER last_admin_delete BEFORE DELETE ON users WHEN OLD.role='admin' AND OLD.active=1
 AND (SELECT count(*) FROM users WHERE role='admin' AND active=1)<=1
 BEGIN SELECT RAISE(ABORT,'LAST_ADMIN'); END;
CREATE TRIGGER revoke_sessions AFTER UPDATE OF password_hash,active ON users
 WHEN OLD.password_hash!=NEW.password_hash OR NEW.active=0
 BEGIN DELETE FROM sessions WHERE user_id=NEW.id; END;
CREATE VIEW count_records AS SELECT c.*, json_object(
 'itemId',c.item_id,'locationId',c.location_id,'cycleId',c.cycle_id,'quantity',c.q/1000.0,'unit',c.unit,
 'status',c.status,'note',c.note,'outOfStock',json(CASE WHEN c.out_of_stock=1 THEN 'true' ELSE 'false' END),
 'authorId',c.author,'authorName',u.name,'version',c.version,'countedAt',c.updated_at) AS record
 FROM counts c JOIN users u ON u.id=c.author;
CREATE TRIGGER accept_operation BEFORE INSERT ON operations BEGIN
 -- Permission/session checks precede deduplication: revoked users cannot recover old data.
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sessions s JOIN users u ON u.id=s.user_id
 WHERE s.hash=NEW.session_hash AND s.user_id=NEW.user_id AND s.expires>unixepoch() AND u.active=1 AND u.must_change=0
 AND (u.role='admin' OR EXISTS(SELECT 1 FROM grants g JOIN scope_closure sc ON sc.ancestor=g.scope_id WHERE g.user_id=u.id AND sc.descendant=NEW.location_id)))
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
