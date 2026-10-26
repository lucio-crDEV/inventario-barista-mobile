-- Finalization with explicit acknowledgment; preserve pending/partial records.
ALTER TABLE cycles ADD COLUMN completion_revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE supervision_commands ADD COLUMN allow_incomplete INTEGER NOT NULL DEFAULT 0 CHECK(allow_incomplete IN(0,1));
ALTER TABLE supervision_commands ADD COLUMN completion_revision INTEGER NOT NULL DEFAULT -1;
ALTER TABLE supervision_commands ADD COLUMN completion_summary TEXT NOT NULL DEFAULT 'null';
CREATE TRIGGER completion_count_insert AFTER INSERT ON counts BEGIN UPDATE cycles SET completion_revision=completion_revision+1 WHERE id=NEW.cycle_id; END;
CREATE TRIGGER completion_count_update AFTER UPDATE ON counts BEGIN UPDATE cycles SET completion_revision=completion_revision+1 WHERE id=NEW.cycle_id; END;
CREATE TRIGGER completion_count_delete AFTER DELETE ON counts BEGIN UPDATE cycles SET completion_revision=completion_revision+1 WHERE id=OLD.cycle_id; END;
CREATE TRIGGER completion_activity_insert AFTER INSERT ON item_activity BEGIN UPDATE cycles SET completion_revision=completion_revision+1 WHERE catalog_version IN(SELECT version FROM catalog_items WHERE id=NEW.item_id AND json_extract(data,'$.areaId')=NEW.area_id); END;
CREATE TRIGGER completion_activity_update AFTER UPDATE ON item_activity BEGIN UPDATE cycles SET completion_revision=completion_revision+1 WHERE catalog_version IN(SELECT version FROM catalog_items WHERE id=NEW.item_id AND json_extract(data,'$.areaId')=NEW.area_id); END;
CREATE TRIGGER completion_activity_delete AFTER DELETE ON item_activity BEGIN UPDATE cycles SET completion_revision=completion_revision+1 WHERE catalog_version IN(SELECT version FROM catalog_items WHERE id=OLD.item_id AND json_extract(data,'$.areaId')=OLD.area_id); END;
DROP TRIGGER guard_supervision;
DROP TRIGGER apply_supervision;
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
 SELECT CASE WHEN NEW.kind='state' AND NEW.new_state='closed' AND NEW.allow_incomplete=0 AND EXISTS(SELECT 1 FROM supervision_items i WHERE i.cycle_id=NEW.cycle_id AND i.active=1 AND i.status!='counted' AND (NEW.scope_id='' OR i.location_id IN(SELECT descendant FROM scope_closure WHERE ancestor=NEW.scope_id))) THEN RAISE(ABORT,'PENDING_ITEMS') END;
 SELECT CASE WHEN NEW.allow_incomplete=1 AND (NEW.kind!='state' OR NEW.new_state!='closed' OR NEW.completion_revision!=(SELECT completion_revision FROM cycles WHERE id=NEW.cycle_id)) THEN RAISE(ABORT,'COMPLETION_CHANGED') END;
END;
CREATE TRIGGER apply_supervision AFTER INSERT ON supervision_commands BEGIN
 UPDATE supervision_commands SET completion_summary=json_object('pending',(SELECT count(*) FROM supervision_items i WHERE i.cycle_id=NEW.cycle_id AND i.active=1 AND i.status='pending' AND (NEW.scope_id='' OR i.location_id IN(SELECT descendant FROM scope_closure WHERE ancestor=NEW.scope_id))),'partial',(SELECT count(*) FROM supervision_items i WHERE i.cycle_id=NEW.cycle_id AND i.active=1 AND i.status='partial' AND (NEW.scope_id='' OR i.location_id IN(SELECT descendant FROM scope_closure WHERE ancestor=NEW.scope_id))),'uncompletedAsBlank',json('true')) WHERE id=NEW.id AND NEW.kind='state' AND NEW.new_state='closed';
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
 UPDATE supervision_commands SET result=json_object('completion',json((SELECT completion_summary FROM supervision_commands WHERE id=NEW.id)),'id',NEW.id,'cycleRevision',(SELECT revision FROM cycles WHERE id=NEW.cycle_id),'record',json((SELECT result FROM operations WHERE id=NEW.id)),'state',(SELECT state FROM cycles WHERE id=NEW.cycle_id),'scope',NEW.scope_id,'scopeState',NEW.new_state,'active',NEW.active,'activityRevision',(SELECT activity_revision FROM supervision_items WHERE cycle_id=NEW.cycle_id AND id=NEW.item_id AND location_id=NEW.location_id)) WHERE id=NEW.id;
 INSERT INTO admin_audit(actor,target,action,detail) VALUES(NEW.user_id,NEW.cycle_id,'inventory-'||NEW.kind,json_object('allowIncomplete',NEW.allow_incomplete,'completionRevision',NEW.completion_revision,'completion',json((SELECT completion_summary FROM supervision_commands WHERE id=NEW.id)),'commandId',NEW.id,'scope',NEW.scope_id,'itemId',NEW.item_id,'locationId',NEW.location_id,'reason',NEW.reason,'beforeState',(SELECT before_state FROM supervision_commands WHERE id=NEW.id),'afterState',NEW.new_state,'beforeActive',(SELECT before_active FROM supervision_commands WHERE id=NEW.id),'afterActive',NEW.active,'beforeRevision',NEW.expected_revision,'afterRevision',(SELECT revision FROM cycles WHERE id=NEW.cycle_id)));
END;
