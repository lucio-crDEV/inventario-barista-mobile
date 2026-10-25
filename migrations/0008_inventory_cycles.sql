-- Inventory lifecycle is additive: deletion archives; counts and history never cascade.
ALTER TABLE cycles ADD COLUMN type TEXT NOT NULL DEFAULT 'both' CHECK(type IN('weekly','month_end','both'));
ALTER TABLE cycles ADD COLUMN period TEXT NOT NULL DEFAULT '';
ALTER TABLE cycles ADD COLUMN lifecycle TEXT NOT NULL DEFAULT 'active' CHECK(lifecycle IN('prepared','active','deleted'));
ALTER TABLE cycles ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE cycles ADD COLUMN activated_at TEXT;
ALTER TABLE cycles ADD COLUMN deleted_at TEXT;
CREATE TABLE cycle_registry(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL);
INSERT INTO cycle_registry VALUES(1,1);
CREATE TABLE inventory_cycle_commands(
 id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),session_hash TEXT NOT NULL,user_revision INTEGER NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN('create','activate','delete')),cycle_id TEXT NOT NULL,expected_revision INTEGER NOT NULL DEFAULT 0,
 name TEXT NOT NULL DEFAULT '',type TEXT NOT NULL DEFAULT 'both' CHECK(type IN('weekly','month_end','both')),period TEXT NOT NULL DEFAULT '',catalog_version TEXT NOT NULL,
 activate INTEGER NOT NULL DEFAULT 1 CHECK(activate IN(0,1)),confirm_warnings INTEGER NOT NULL DEFAULT 0,confirmation_revision INTEGER NOT NULL DEFAULT -1,
 confirmed_delete INTEGER NOT NULL DEFAULT 0,result TEXT,created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TRIGGER guard_inventory_cycle BEFORE INSERT ON inventory_cycle_commands BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=NEW.session_hash AND s.expires>unixepoch() AND u.id=NEW.user_id AND u.active=1 AND u.deleted_at IS NULL AND u.must_change=0 AND u.role='admin' AND u.revision=NEW.user_revision) THEN RAISE(ABORT,'FORBIDDEN') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM inventory_cycle_commands WHERE id=NEW.id AND (fingerprint!=NEW.fingerprint OR user_id!=NEW.user_id)) THEN RAISE(ABORT,'ID_REUSED') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM inventory_cycle_commands WHERE id=NEW.id) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NEW.kind='create' AND EXISTS(SELECT 1 FROM cycles WHERE id=NEW.cycle_id) THEN RAISE(ABORT,'CYCLE_EXISTS') END;
 SELECT CASE WHEN NEW.kind!='create' AND NOT EXISTS(SELECT 1 FROM cycles WHERE id=NEW.cycle_id AND revision=NEW.expected_revision AND lifecycle!='deleted') THEN RAISE(ABORT,'CYCLE_CHANGED') END;
 SELECT CASE WHEN NEW.kind='activate' AND NOT EXISTS(SELECT 1 FROM cycles WHERE id=NEW.cycle_id AND lifecycle='prepared') THEN RAISE(ABORT,'INVALID_TRANSITION') END;
 SELECT CASE WHEN NEW.kind='create' AND NOT EXISTS(SELECT 1 FROM catalog_items WHERE version=NEW.catalog_version) THEN RAISE(ABORT,'CATALOG_REQUIRED') END;
 SELECT CASE WHEN NEW.kind='delete' AND NEW.confirmed_delete!=1 THEN RAISE(ABORT,'DELETE_CONFIRMATION_REQUIRED') END;
 SELECT CASE WHEN (NEW.kind='activate' OR (NEW.kind='create' AND NEW.activate=1)) AND EXISTS(SELECT 1 FROM cycles WHERE id!=NEW.cycle_id AND lifecycle='active' AND (state IN('open','review') OR EXISTS(SELECT 1 FROM cycle_scope_states cs WHERE cs.cycle_id=cycles.id AND cs.state IN('open','review')))) AND NEW.confirm_warnings!=1 THEN RAISE(ABORT,'CONFIRMATION_REQUIRED') END;
 SELECT CASE WHEN NEW.kind IN('create','activate') AND EXISTS(SELECT 1 FROM cycles c WHERE c.id!=NEW.cycle_id AND c.lifecycle!='deleted' AND ((c.type IN('weekly','both') AND NEW.type IN('weekly','both') AND date(c.period,'weekday 0','-6 days')=date(NEW.period,'weekday 0','-6 days')) OR (c.type IN('month_end','both') AND NEW.type IN('month_end','both') AND strftime('%Y-%m',c.period)=strftime('%Y-%m',NEW.period)))) AND NEW.confirm_warnings!=1 THEN RAISE(ABORT,'CONFIRMATION_REQUIRED') END;
 SELECT CASE WHEN NEW.kind IN('create','activate') AND NEW.confirm_warnings=1 AND NEW.confirmation_revision!=(SELECT revision FROM cycle_registry WHERE id=1) THEN RAISE(ABORT,'CONFIRMATION_CHANGED') END;
END;
CREATE TRIGGER apply_inventory_cycle AFTER INSERT ON inventory_cycle_commands BEGIN
 INSERT INTO cycles(id,name,catalog_version,state,type,period,lifecycle,created_at,activated_at)
 SELECT NEW.cycle_id,NEW.name,NEW.catalog_version,CASE WHEN NEW.activate=1 THEN 'open' ELSE 'review' END,NEW.type,NEW.period,CASE WHEN NEW.activate=1 THEN 'active' ELSE 'prepared' END,NEW.created_at,CASE WHEN NEW.activate=1 THEN NEW.created_at ELSE NULL END WHERE NEW.kind='create';
 UPDATE cycles SET lifecycle=CASE WHEN NEW.kind='delete' THEN 'deleted' ELSE 'active' END,state=CASE WHEN NEW.kind='activate' THEN 'open' ELSE state END,revision=revision+1,activated_at=CASE WHEN NEW.kind='activate' THEN NEW.created_at ELSE activated_at END,deleted_at=CASE WHEN NEW.kind='delete' THEN NEW.created_at ELSE deleted_at END WHERE id=NEW.cycle_id AND NEW.kind!='create';
 UPDATE cycle_registry SET revision=revision+1 WHERE id=1;
 UPDATE inventory_cycle_commands SET result=json_object('id',NEW.id,'cycle',json((SELECT json_object('id',id,'name',name,'catalog_version',catalog_version,'state',state,'revision',revision,'type',type,'period',period,'lifecycle',lifecycle,'created_at',created_at,'activated_at',activated_at,'deleted_at',deleted_at) FROM cycles WHERE id=NEW.cycle_id))) WHERE id=NEW.id;
 INSERT INTO admin_audit(actor,target,action,detail) VALUES(NEW.user_id,NEW.cycle_id,'inventory-cycle-'||NEW.kind,json_object('commandId',NEW.id,'beforeRevision',NEW.expected_revision,'result',json((SELECT result FROM inventory_cycle_commands WHERE id=NEW.id)),'warningsConfirmed',NEW.confirm_warnings,'confirmationRevision',NEW.confirmation_revision));
END;
-- Additional guards keep old accepted retries intact and block every new write on prepared/deleted cycles.
CREATE TRIGGER lifecycle_operation BEFORE INSERT ON operations WHEN NOT EXISTS(SELECT 1 FROM operations WHERE id=NEW.id) BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=NEW.session_hash AND s.user_id=NEW.user_id AND s.expires>unixepoch() AND u.active=1 AND u.must_change=0 AND u.deleted_at IS NULL AND EXISTS(SELECT 1 FROM inventory_permissions p WHERE p.user_id=u.id AND p.scope_id=NEW.location_id)) THEN RAISE(ABORT,'FORBIDDEN') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM cycles WHERE id=NEW.cycle_id AND lifecycle!='active') THEN RAISE(ABORT,'CYCLE_CLOSED') END;
END;
CREATE TRIGGER lifecycle_supervision BEFORE INSERT ON supervision_commands WHEN NOT EXISTS(SELECT 1 FROM supervision_commands WHERE id=NEW.id) BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=NEW.session_hash AND s.expires>unixepoch() AND u.id=NEW.user_id AND u.active=1 AND u.deleted_at IS NULL AND u.must_change=0 AND u.revision=NEW.user_revision AND (u.role='admin' OR (u.role='service_lead' AND ((NEW.kind IN('rectify','annul') AND EXISTS(SELECT 1 FROM inventory_permissions p WHERE p.user_id=u.id AND p.scope_id=NEW.location_id)) OR (NEW.kind='state' AND NEW.scope_id='servicio'))))) THEN RAISE(ABORT,'FORBIDDEN') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM cycles WHERE id=NEW.cycle_id AND lifecycle!='active') THEN RAISE(ABORT,'CYCLE_CLOSED') END;
END;
-- Any state/lifecycle change invalidates an earlier warning confirmation, including
-- a concurrent reopen through the existing supervision command API.
CREATE TRIGGER cycle_registry_insert AFTER INSERT ON cycles BEGIN UPDATE cycle_registry SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER cycle_registry_update AFTER UPDATE OF state,lifecycle,type,period ON cycles BEGIN UPDATE cycle_registry SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER cycle_registry_delete AFTER DELETE ON cycles BEGIN UPDATE cycle_registry SET revision=revision+1 WHERE id=1; END;

ALTER TABLE supervision_commands ADD COLUMN confirm_warnings INTEGER NOT NULL DEFAULT 0;
ALTER TABLE supervision_commands ADD COLUMN confirmation_revision INTEGER NOT NULL DEFAULT -1;
CREATE TRIGGER lifecycle_reopen_warning BEFORE INSERT ON supervision_commands
 WHEN NEW.kind='state' AND NEW.new_state='open' AND NOT EXISTS(SELECT 1 FROM supervision_commands WHERE id=NEW.id) BEGIN
 -- Permission and finalization checks precede warnings, independently of SQLite's
 -- ordering of separate BEFORE triggers. No conflict data reaches revoked actors.
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=NEW.session_hash AND s.expires>unixepoch() AND u.id=NEW.user_id AND u.active=1 AND u.deleted_at IS NULL AND u.must_change=0 AND u.revision=NEW.user_revision AND (u.role='admin' OR (u.role='service_lead' AND NEW.scope_id='servicio'))) THEN RAISE(ABORT,'FORBIDDEN') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM cycles WHERE id=NEW.cycle_id AND revision=NEW.expected_revision) THEN RAISE(ABORT,'CYCLE_CHANGED') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM cycles WHERE id=NEW.cycle_id AND lifecycle!='active') THEN RAISE(ABORT,'CYCLE_CLOSED') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND role='service_lead') AND coalesce((SELECT state FROM cycle_scope_states WHERE cycle_id=NEW.cycle_id AND scope_id=NEW.scope_id),(SELECT state FROM cycles WHERE id=NEW.cycle_id))='closed' THEN RAISE(ABORT,'ADMIN_REOPEN_REQUIRED') END;
 SELECT CASE WHEN length(trim(NEW.reason))<3 THEN RAISE(ABORT,'REASON_REQUIRED') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM cycles c WHERE c.id!=NEW.cycle_id AND c.lifecycle='active' AND (c.state IN('open','review') OR EXISTS(SELECT 1 FROM cycle_scope_states cs WHERE cs.cycle_id=c.id AND cs.state IN('open','review')))) AND NEW.confirm_warnings!=1 THEN RAISE(ABORT,'CONFIRMATION_REQUIRED') END;
 SELECT CASE WHEN NEW.confirm_warnings=1 AND NEW.confirmation_revision!=(SELECT revision FROM cycle_registry WHERE id=1) THEN RAISE(ABORT,'CONFIRMATION_CHANGED') END;
END;
CREATE TRIGGER cycle_registry_scope_insert AFTER INSERT ON cycle_scope_states BEGIN UPDATE cycle_registry SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER cycle_registry_scope_update AFTER UPDATE OF state ON cycle_scope_states BEGIN UPDATE cycle_registry SET revision=revision+1 WHERE id=1; END;
CREATE TRIGGER cycle_registry_scope_delete AFTER DELETE ON cycle_scope_states BEGIN UPDATE cycle_registry SET revision=revision+1 WHERE id=1; END;
