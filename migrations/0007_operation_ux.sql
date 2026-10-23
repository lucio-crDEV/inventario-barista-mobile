-- UX/operation revision, independent of telemetry and additive to deployed 0006.
-- Existing command IDs/results/history/catalog/Excel references are preserved.
DROP TRIGGER guard_supervision;
DROP TRIGGER apply_supervision;
DROP TRIGGER accept_operation;
DROP TRIGGER apply_operation;
CREATE TABLE supervision_commands_v7(
 id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),session_hash TEXT NOT NULL,user_revision INTEGER NOT NULL,
 cycle_id TEXT NOT NULL REFERENCES cycles(id),expected_revision INTEGER NOT NULL,kind TEXT NOT NULL CHECK(kind IN('rectify','annul','activation','state')),
 item_id TEXT NOT NULL DEFAULT '',location_id TEXT NOT NULL DEFAULT '',scope_id TEXT NOT NULL DEFAULT '',expected_version INTEGER NOT NULL DEFAULT 0,
 q INTEGER NOT NULL DEFAULT 0,unit TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'counted',note TEXT NOT NULL DEFAULT '',out_of_stock INTEGER NOT NULL DEFAULT 0,
 active INTEGER NOT NULL DEFAULT 1,new_state TEXT NOT NULL DEFAULT '',reason TEXT NOT NULL DEFAULT '' CHECK(length(trim(reason))<=500 AND (length(trim(reason))=0 OR length(trim(reason))>=3)),
 before_state TEXT,before_active INTEGER,result TEXT,created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 expected_activity_revision INTEGER NOT NULL DEFAULT -1 CHECK(expected_activity_revision>=-1));
INSERT INTO supervision_commands_v7(rowid,id,fingerprint,user_id,session_hash,user_revision,cycle_id,expected_revision,kind,item_id,location_id,scope_id,expected_version,q,unit,status,note,out_of_stock,active,new_state,reason,before_state,before_active,result,created_at)
 SELECT rowid,id,fingerprint,user_id,session_hash,user_revision,cycle_id,expected_revision,kind,item_id,location_id,scope_id,expected_version,q,unit,status,note,out_of_stock,active,new_state,reason,before_state,before_active,result,created_at FROM supervision_commands;
DROP TABLE supervision_commands;
ALTER TABLE supervision_commands_v7 RENAME TO supervision_commands;
CREATE INDEX supervision_cycle ON supervision_commands(cycle_id,created_at);
CREATE INDEX history_cycle_item_desc ON history(cycle_id,item_id,location_id,seq DESC);
CREATE TABLE item_activity(
 area_id TEXT NOT NULL REFERENCES scopes(id),item_id TEXT NOT NULL,active INTEGER NOT NULL CHECK(active IN(0,1)),
 changed_by TEXT REFERENCES users(id),changed_at TEXT NOT NULL,inactive_since TEXT,
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),PRIMARY KEY(area_id,item_id));
CREATE TABLE item_activity_events(
 seq INTEGER PRIMARY KEY AUTOINCREMENT,command_id TEXT NOT NULL UNIQUE REFERENCES supervision_commands(id),
 cycle_id TEXT NOT NULL REFERENCES cycles(id),area_id TEXT NOT NULL REFERENCES scopes(id),item_id TEXT NOT NULL,
 location_id TEXT NOT NULL REFERENCES scopes(id),user_id TEXT NOT NULL REFERENCES users(id),
 before_active INTEGER NOT NULL CHECK(before_active IN(0,1)),active INTEGER NOT NULL CHECK(active IN(0,1)),created_at TEXT NOT NULL);
CREATE INDEX item_activity_timeline ON item_activity_events(area_id,item_id,seq DESC);
-- Carry forward the latest accepted legacy decision for an exact product/area.
-- Command chronology takes precedence over cycle creation; old cycles can be edited later.
-- The migration timestamp is the baseline when legacy evidence has no change time;
-- it must never be presented as months of historical inactivity.
INSERT INTO item_activity(area_id,item_id,active,changed_by,changed_at,inactive_since)
 SELECT area_id,item_id,active,NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'),CASE WHEN active=0 THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') END
 FROM (SELECT json_extract(ci.data,'$.areaId') area_id,s.item_id,s.active,
 row_number() OVER(PARTITION BY json_extract(ci.data,'$.areaId'),s.item_id ORDER BY m.created_at DESC,m.rowid DESC,cy.rowid DESC,s.location_id) rank
 FROM cycle_item_states s JOIN cycles cy ON cy.id=s.cycle_id JOIN catalog_items ci ON ci.version=cy.catalog_version AND ci.id=s.item_id AND ci.location_id=s.location_id
 LEFT JOIN supervision_commands m ON m.rowid=(SELECT m2.rowid FROM supervision_commands m2 WHERE m2.kind='activation' AND m2.cycle_id=s.cycle_id AND m2.item_id=s.item_id AND m2.location_id=s.location_id ORDER BY m2.created_at DESC,m2.rowid DESC LIMIT 1) AND m.active=s.active) WHERE rank=1;
DROP VIEW supervision_items;
CREATE VIEW supervision_items AS SELECT ci.rowid position,cy.id cycle_id,ci.id,ci.location_id,ci.unit,ci.data,
 json_extract(ci.data,'$.areaId') area_id,
 coalesce(st.active,CASE WHEN json_extract(ci.data,'$.active')=0 THEN 0 ELSE 1 END) active,
 coalesce(st.revision,0) activity_revision,st.changed_at activity_changed_at,st.inactive_since,
 coalesce(json_extract(cr.record,'$.status'),'pending') status,cr.record
 FROM cycles cy JOIN catalog_items ci ON ci.version=cy.catalog_version
 LEFT JOIN item_activity st ON st.area_id=json_extract(ci.data,'$.areaId') AND st.item_id=ci.id
 LEFT JOIN count_records cr ON cr.cycle_id=cy.id AND cr.item_id=ci.id AND cr.location_id=ci.location_id;
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
 SELECT CASE WHEN EXISTS(SELECT 1 FROM supervision_items WHERE cycle_id=NEW.cycle_id AND id=NEW.item_id AND location_id=NEW.location_id AND active=0) THEN RAISE(ABORT,'ITEM_INACTIVE') END;
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
CREATE TRIGGER guard_supervision BEFORE INSERT ON supervision_commands BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=NEW.session_hash AND s.expires>unixepoch() AND u.id=NEW.user_id AND u.active=1 AND u.deleted_at IS NULL AND u.must_change=0 AND u.revision=NEW.user_revision AND
 (u.role='admin' OR (u.role='service_lead' AND ((NEW.kind IN('rectify','annul') AND EXISTS(SELECT 1 FROM inventory_permissions p WHERE p.user_id=u.id AND p.scope_id=NEW.location_id)) OR (NEW.kind='state' AND NEW.scope_id='servicio'))))) THEN RAISE(ABORT,'FORBIDDEN') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM supervision_commands WHERE id=NEW.id AND (fingerprint!=NEW.fingerprint OR user_id!=NEW.user_id)) OR EXISTS(SELECT 1 FROM operations WHERE id=NEW.id AND NOT EXISTS(SELECT 1 FROM supervision_commands WHERE id=NEW.id)) THEN RAISE(ABORT,'ID_REUSED') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM supervision_commands WHERE id=NEW.id) THEN RAISE(IGNORE) END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM cycles WHERE id=NEW.cycle_id AND revision=NEW.expected_revision) THEN RAISE(ABORT,'CYCLE_CHANGED') END;
 -- Accepted retries above remain recoverable after finalization; new lead reopen requests do not.
 SELECT CASE WHEN NEW.kind='state' AND NEW.new_state='open' AND EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND role='service_lead') AND coalesce((SELECT state FROM cycle_scope_states WHERE cycle_id=NEW.cycle_id AND scope_id=NEW.scope_id),(SELECT state FROM cycles WHERE id=NEW.cycle_id))='closed' THEN RAISE(ABORT,'ADMIN_REOPEN_REQUIRED') END;
 SELECT CASE WHEN NEW.kind='state' AND NEW.new_state='open' AND length(trim(NEW.reason))<3 THEN RAISE(ABORT,'REASON_REQUIRED') END;
 SELECT CASE WHEN NEW.kind='activation' AND NEW.expected_activity_revision>=0 AND NEW.expected_activity_revision!=coalesce((SELECT activity_revision FROM supervision_items WHERE cycle_id=NEW.cycle_id AND id=NEW.item_id AND location_id=NEW.location_id),0) THEN RAISE(ABORT,'ACTIVITY_CHANGED') END;
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
 INSERT INTO item_activity_events(command_id,cycle_id,area_id,item_id,location_id,user_id,before_active,active,created_at)
 SELECT NEW.id,NEW.cycle_id,json_extract(i.data,'$.areaId'),NEW.item_id,NEW.location_id,NEW.user_id,i.active,NEW.active,NEW.created_at
 FROM supervision_items i WHERE NEW.kind='activation' AND i.cycle_id=NEW.cycle_id AND i.id=NEW.item_id AND i.location_id=NEW.location_id AND i.active!=NEW.active;
 INSERT INTO item_activity(area_id,item_id,active,changed_by,changed_at,inactive_since,revision)
 SELECT json_extract(i.data,'$.areaId'),NEW.item_id,NEW.active,NEW.user_id,NEW.created_at,CASE WHEN NEW.active=0 THEN NEW.created_at ELSE NULL END,1
 FROM supervision_items i WHERE NEW.kind='activation' AND i.cycle_id=NEW.cycle_id AND i.id=NEW.item_id AND i.location_id=NEW.location_id
 ON CONFLICT(area_id,item_id) DO UPDATE SET active=excluded.active,changed_by=excluded.changed_by,changed_at=excluded.changed_at,
 inactive_since=CASE WHEN excluded.active=1 THEN NULL WHEN item_activity.active=0 THEN item_activity.inactive_since ELSE excluded.inactive_since END,revision=item_activity.revision+1;
 DELETE FROM cycle_scope_states WHERE NEW.kind='state' AND NEW.scope_id='' AND cycle_id=NEW.cycle_id;
 INSERT INTO cycle_scope_states SELECT NEW.cycle_id,NEW.scope_id,NEW.new_state WHERE NEW.kind='state' AND NEW.scope_id!=''
 ON CONFLICT(cycle_id,scope_id) DO UPDATE SET state=excluded.state;
 UPDATE cycles SET state=CASE WHEN NEW.kind='state' AND NEW.scope_id='' THEN NEW.new_state ELSE state END,revision=revision+1
 WHERE id=NEW.cycle_id OR (NEW.kind='activation' AND EXISTS(SELECT 1 FROM catalog_items ci JOIN item_activity a ON a.item_id=ci.id AND a.area_id=json_extract(ci.data,'$.areaId') WHERE ci.version=cycles.catalog_version AND ci.id=NEW.item_id AND a.area_id=(SELECT json_extract(data,'$.areaId') FROM supervision_items WHERE cycle_id=NEW.cycle_id AND id=NEW.item_id AND location_id=NEW.location_id)));
 UPDATE supervision_commands SET result=json_object('id',NEW.id,'cycleRevision',(SELECT revision FROM cycles WHERE id=NEW.cycle_id),'record',json((SELECT result FROM operations WHERE id=NEW.id)),'state',(SELECT state FROM cycles WHERE id=NEW.cycle_id),'scope',NEW.scope_id,'scopeState',NEW.new_state,'active',NEW.active,'activityRevision',(SELECT activity_revision FROM supervision_items WHERE cycle_id=NEW.cycle_id AND id=NEW.item_id AND location_id=NEW.location_id)) WHERE id=NEW.id;
 INSERT INTO admin_audit(actor,target,action,detail) VALUES(NEW.user_id,NEW.cycle_id,'inventory-'||NEW.kind,json_object('commandId',NEW.id,'scope',NEW.scope_id,'itemId',NEW.item_id,'locationId',NEW.location_id,'reason',NEW.reason,'beforeState',(SELECT before_state FROM supervision_commands WHERE id=NEW.id),'afterState',NEW.new_state,'beforeActive',(SELECT before_active FROM supervision_commands WHERE id=NEW.id),'afterActive',NEW.active,'beforeRevision',NEW.expected_revision,'afterRevision',(SELECT revision FROM cycles WHERE id=NEW.cycle_id)));
END;
