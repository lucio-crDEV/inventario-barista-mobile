-- 3B operational supervision. Independent of the unapproved telemetry proposal 0005.
-- Additive columns/tables, preserving counts, UUIDs and accepted operation results.
ALTER TABLE cycles ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE counts ADD COLUMN voided INTEGER NOT NULL DEFAULT 0 CHECK(voided IN (0,1));
ALTER TABLE history ADD COLUMN reason TEXT NOT NULL DEFAULT '';
CREATE INDEX history_cycle_desc ON history(cycle_id,seq DESC);
CREATE TABLE cycle_item_states(cycle_id TEXT REFERENCES cycles(id), item_id TEXT NOT NULL, location_id TEXT NOT NULL REFERENCES scopes(id),active INTEGER NOT NULL CHECK(active IN(0,1)),PRIMARY KEY(cycle_id,item_id,location_id));
CREATE TABLE cycle_scope_states(cycle_id TEXT REFERENCES cycles(id),scope_id TEXT NOT NULL REFERENCES scopes(id),state TEXT NOT NULL CHECK(state IN('open','review','closed')),PRIMARY KEY(cycle_id,scope_id));
CREATE TABLE supervision_commands(
 id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),session_hash TEXT NOT NULL,user_revision INTEGER NOT NULL,
 cycle_id TEXT NOT NULL REFERENCES cycles(id),expected_revision INTEGER NOT NULL,kind TEXT NOT NULL CHECK(kind IN('rectify','annul','activation','state')),
 item_id TEXT NOT NULL DEFAULT '',location_id TEXT NOT NULL DEFAULT '',scope_id TEXT NOT NULL DEFAULT '',expected_version INTEGER NOT NULL DEFAULT 0,
 q INTEGER NOT NULL DEFAULT 0,unit TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'counted',note TEXT NOT NULL DEFAULT '',out_of_stock INTEGER NOT NULL DEFAULT 0,
 active INTEGER NOT NULL DEFAULT 1,new_state TEXT NOT NULL DEFAULT '',reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 500),
 before_state TEXT,before_active INTEGER, result TEXT,created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX supervision_cycle ON supervision_commands(cycle_id,created_at);
DROP VIEW count_records;
DROP TRIGGER accept_operation;
DROP TRIGGER apply_operation;
CREATE VIEW count_records AS SELECT c.*, json_object(
 'itemId',c.item_id,'locationId',c.location_id,'cycleId',c.cycle_id,'quantity',CASE WHEN c.voided=1 THEN NULL ELSE c.q/1000.0 END,'unit',c.unit,
 'status',CASE WHEN c.voided=1 THEN 'pending' ELSE c.status END,'note',c.note,'outOfStock',json(CASE WHEN c.out_of_stock=1 THEN 'true' ELSE 'false' END),
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
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM cycles cy WHERE cy.id=NEW.cycle_id AND
 coalesce((SELECT cs.state FROM cycle_scope_states cs JOIN scope_closure sc ON sc.ancestor=cs.scope_id WHERE cs.cycle_id=cy.id AND sc.descendant=NEW.location_id),cy.state)='open')
 AND NOT EXISTS(SELECT 1 FROM supervision_commands m WHERE m.id=NEW.id AND m.user_id=NEW.user_id AND m.cycle_id=NEW.cycle_id AND m.item_id=NEW.item_id AND m.location_id=NEW.location_id AND m.kind IN ('rectify','annul')) THEN RAISE(ABORT,'CYCLE_CLOSED') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM cycle_item_states WHERE cycle_id=NEW.cycle_id AND item_id=NEW.item_id AND location_id=NEW.location_id AND active=0) THEN RAISE(ABORT,'ITEM_INACTIVE') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM cycles cy JOIN catalog_items ci ON ci.version=cy.catalog_version
 WHERE cy.id=NEW.cycle_id AND ci.id=NEW.item_id AND ci.location_id=NEW.location_id AND ci.unit=NEW.unit) THEN RAISE(ABORT,'INVALID_ITEM_UNIT') END;
 SELECT CASE WHEN NEW.expected_version!=coalesce((SELECT version FROM counts WHERE cycle_id=NEW.cycle_id AND item_id=NEW.item_id AND location_id=NEW.location_id),0) THEN RAISE(ABORT,'STALE') END;
 SELECT CASE WHEN NEW.action='direct' AND EXISTS(SELECT 1 FROM counts WHERE cycle_id=NEW.cycle_id AND item_id=NEW.item_id AND location_id=NEW.location_id AND author!=NEW.user_id AND voided=0) THEN RAISE(ABORT,'FOREIGN_RECORD') END;
 SELECT CASE WHEN NEW.action!='direct' AND NOT EXISTS(SELECT 1 FROM counts WHERE cycle_id=NEW.cycle_id AND item_id=NEW.item_id AND location_id=NEW.location_id) THEN RAISE(ABORT,'STALE') END;
 SELECT CASE WHEN NEW.action='add' AND EXISTS(SELECT 1 FROM counts WHERE cycle_id=NEW.cycle_id AND item_id=NEW.item_id AND location_id=NEW.location_id AND voided=1) THEN RAISE(ABORT,'STALE') END;
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
 voided=0, author=NEW.user_id, version=counts.version+1, updated_at=NEW.created_at;
 UPDATE counts SET voided=1 WHERE cycle_id=NEW.cycle_id AND item_id=NEW.item_id AND location_id=NEW.location_id
 AND EXISTS(SELECT 1 FROM supervision_commands WHERE id=NEW.id AND kind='annul');
 UPDATE history SET action=coalesce((SELECT kind FROM supervision_commands WHERE id=NEW.id),action),reason=coalesce((SELECT reason FROM supervision_commands WHERE id=NEW.id),'') WHERE operation_id=NEW.id;
 UPDATE history SET after_record=(SELECT record FROM count_records WHERE cycle_id=NEW.cycle_id AND item_id=NEW.item_id AND location_id=NEW.location_id) WHERE operation_id=NEW.id;
 UPDATE operations SET result=(SELECT after_record FROM history WHERE operation_id=NEW.id) WHERE id=NEW.id;
END;

CREATE VIEW supervision_items AS SELECT ci.rowid position,cy.id cycle_id,ci.id,ci.location_id,ci.unit,ci.data,
 coalesce(st.active,CASE WHEN json_extract(ci.data,'$.active')=0 THEN 0 ELSE 1 END) active,
 coalesce(json_extract(cr.record,'$.status'),'pending') status,cr.record
 FROM cycles cy JOIN catalog_items ci ON ci.version=cy.catalog_version
 LEFT JOIN cycle_item_states st ON st.cycle_id=cy.id AND st.item_id=ci.id AND st.location_id=ci.location_id
 LEFT JOIN count_records cr ON cr.cycle_id=cy.id AND cr.item_id=ci.id AND cr.location_id=ci.location_id;
CREATE TRIGGER guard_supervision BEFORE INSERT ON supervision_commands BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=NEW.session_hash AND s.expires>unixepoch() AND u.id=NEW.user_id AND u.active=1 AND u.deleted_at IS NULL AND u.must_change=0 AND u.revision=NEW.user_revision AND
 (u.role='admin' OR (u.role='service_lead' AND ((NEW.kind IN('rectify','annul') AND EXISTS(SELECT 1 FROM inventory_permissions p WHERE p.user_id=u.id AND p.scope_id=NEW.location_id)) OR (NEW.kind='state' AND NEW.scope_id='servicio'))))) THEN RAISE(ABORT,'FORBIDDEN') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM supervision_commands WHERE id=NEW.id AND (fingerprint!=NEW.fingerprint OR user_id!=NEW.user_id)) OR EXISTS(SELECT 1 FROM operations WHERE id=NEW.id AND NOT EXISTS(SELECT 1 FROM supervision_commands WHERE id=NEW.id)) THEN RAISE(ABORT,'ID_REUSED') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM supervision_commands WHERE id=NEW.id) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM cycles WHERE id=NEW.cycle_id AND revision=NEW.expected_revision) THEN RAISE(ABORT,'CYCLE_CHANGED') END;
 SELECT CASE WHEN NEW.kind IN('rectify','annul','activation') AND NOT EXISTS(SELECT 1 FROM supervision_items i WHERE i.cycle_id=NEW.cycle_id AND i.id=NEW.item_id AND i.location_id=NEW.location_id AND coalesce(json_extract(i.record,'$.version'),0)=NEW.expected_version) THEN RAISE(ABORT,'STALE') END;
 SELECT CASE WHEN NEW.kind IN('rectify','annul','activation') AND NOT EXISTS(SELECT 1 FROM cycles cy WHERE cy.id=NEW.cycle_id AND coalesce((SELECT cs.state FROM cycle_scope_states cs JOIN scope_closure sc ON sc.ancestor=cs.scope_id WHERE cs.cycle_id=cy.id AND sc.descendant=NEW.location_id),cy.state) IN('open','review')) THEN RAISE(ABORT,'CYCLE_CLOSED') END;
 SELECT CASE WHEN NEW.kind IN('rectify','annul') AND NOT EXISTS(SELECT 1 FROM supervision_items WHERE cycle_id=NEW.cycle_id AND id=NEW.item_id AND location_id=NEW.location_id AND active=1) THEN RAISE(ABORT,'ITEM_INACTIVE') END;
 SELECT CASE WHEN NEW.kind='annul' AND NOT EXISTS(SELECT 1 FROM counts WHERE cycle_id=NEW.cycle_id AND item_id=NEW.item_id AND location_id=NEW.location_id AND voided=0) THEN RAISE(ABORT,'STALE') END;
 SELECT CASE WHEN NEW.kind='state' AND NEW.scope_id NOT IN('','servicio') THEN RAISE(ABORT,'INVALID_SCOPE') END;
 SELECT CASE WHEN NEW.kind='state' AND NOT EXISTS(SELECT 1 FROM cycles cy WHERE cy.id=NEW.cycle_id AND (
 (NEW.new_state='open' AND (coalesce((SELECT state FROM cycle_scope_states WHERE cycle_id=cy.id AND scope_id=NEW.scope_id),cy.state)!='open' OR (NEW.scope_id='' AND EXISTS(SELECT 1 FROM cycle_scope_states WHERE cycle_id=cy.id)))) OR
 (NEW.new_state='review' AND (coalesce((SELECT state FROM cycle_scope_states WHERE cycle_id=cy.id AND scope_id=NEW.scope_id),cy.state)='open' OR (NEW.scope_id='' AND EXISTS(SELECT 1 FROM cycle_scope_states WHERE cycle_id=cy.id AND state='open')))) OR
 (NEW.new_state='closed' AND (coalesce((SELECT state FROM cycle_scope_states WHERE cycle_id=cy.id AND scope_id=NEW.scope_id),cy.state)='review' OR (NEW.scope_id='' AND cy.state='closed' AND EXISTS(SELECT 1 FROM cycle_scope_states WHERE cycle_id=cy.id))) AND (NEW.scope_id!='' OR NOT EXISTS(SELECT 1 FROM cycle_scope_states WHERE cycle_id=cy.id AND state='open')))
 )) THEN RAISE(ABORT,'INVALID_TRANSITION') END;
 SELECT CASE WHEN NEW.kind='state' AND NEW.new_state='closed' AND EXISTS(SELECT 1 FROM supervision_items i WHERE i.cycle_id=NEW.cycle_id AND i.active=1 AND i.status!='counted' AND (NEW.scope_id='' OR i.location_id IN(SELECT descendant FROM scope_closure WHERE ancestor=NEW.scope_id))) THEN RAISE(ABORT,'PENDING_ITEMS') END;
END;
CREATE TRIGGER apply_supervision AFTER INSERT ON supervision_commands BEGIN
 UPDATE supervision_commands SET before_state=coalesce((SELECT state FROM cycle_scope_states WHERE cycle_id=NEW.cycle_id AND scope_id=NEW.scope_id),(SELECT state FROM cycles WHERE id=NEW.cycle_id)),before_active=(SELECT active FROM supervision_items WHERE cycle_id=NEW.cycle_id AND id=NEW.item_id AND location_id=NEW.location_id) WHERE id=NEW.id;
 INSERT INTO operations(id,fingerprint,user_id,session_hash,cycle_id,item_id,location_id,expected_version,action,q,unit,status,note,out_of_stock)
 SELECT NEW.id,NEW.fingerprint,NEW.user_id,NEW.session_hash,NEW.cycle_id,NEW.item_id,NEW.location_id,NEW.expected_version,
 CASE WHEN NEW.expected_version=0 THEN 'direct' ELSE 'overwrite' END,NEW.q,ci.unit,NEW.status,NEW.note,NEW.out_of_stock
 FROM cycles cy JOIN catalog_items ci ON ci.version=cy.catalog_version WHERE NEW.kind IN('rectify','annul') AND cy.id=NEW.cycle_id AND ci.id=NEW.item_id AND ci.location_id=NEW.location_id;
 INSERT INTO cycle_item_states SELECT NEW.cycle_id,NEW.item_id,NEW.location_id,NEW.active WHERE NEW.kind='activation'
 ON CONFLICT(cycle_id,item_id,location_id) DO UPDATE SET active=excluded.active;
 DELETE FROM cycle_scope_states WHERE NEW.kind='state' AND NEW.scope_id='' AND cycle_id=NEW.cycle_id;
 INSERT INTO cycle_scope_states SELECT NEW.cycle_id,NEW.scope_id,NEW.new_state WHERE NEW.kind='state' AND NEW.scope_id!=''
 ON CONFLICT(cycle_id,scope_id) DO UPDATE SET state=excluded.state;
 UPDATE cycles SET state=CASE WHEN NEW.kind='state' AND NEW.scope_id='' THEN NEW.new_state ELSE state END,revision=revision+1 WHERE id=NEW.cycle_id;
 UPDATE supervision_commands SET result=json_object('id',NEW.id,'cycleRevision',(SELECT revision FROM cycles WHERE id=NEW.cycle_id),'record',json((SELECT result FROM operations WHERE id=NEW.id)),'state',(SELECT state FROM cycles WHERE id=NEW.cycle_id),'scope',NEW.scope_id,'scopeState',NEW.new_state,'active',NEW.active) WHERE id=NEW.id;
 INSERT INTO admin_audit(actor,target,action,detail) VALUES(NEW.user_id,NEW.cycle_id,'inventory-'||NEW.kind,json_object('commandId',NEW.id,'scope',NEW.scope_id,'itemId',NEW.item_id,'locationId',NEW.location_id,'reason',NEW.reason,'beforeState',(SELECT before_state FROM supervision_commands WHERE id=NEW.id),'afterState',NEW.new_state,'beforeActive',(SELECT before_active FROM supervision_commands WHERE id=NEW.id),'afterActive',NEW.active,'beforeRevision',NEW.expected_revision,'afterRevision',(SELECT revision FROM cycles WHERE id=NEW.cycle_id)));
END;
