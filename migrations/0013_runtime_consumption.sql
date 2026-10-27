-- Flatten operational reads, including existing transactional trigger reads.
-- Preserve the prior view columns and count-record JSON exactly.
DROP VIEW supervision_items;
CREATE VIEW supervision_items AS SELECT ci.rowid position,cy.id cycle_id,ci.id,ci.location_id,ci.unit,ci.data,
    json_extract(ci.data,'$.areaId') area_id,coalesce(st.active,CASE WHEN json_extract(ci.data,'$.active')=0 THEN 0 ELSE 1 END) active,
    coalesce(st.revision,0) activity_revision,st.changed_at activity_changed_at,st.inactive_since,
    CASE WHEN c.voided=1 THEN 'pending' ELSE coalesce(c.status,'pending') END status
    ,CASE WHEN cu.id IS NULL THEN NULL ELSE json_object('itemId',c.item_id,'locationId',c.location_id,'cycleId',c.cycle_id,
    'quantity',CASE WHEN c.voided=1 THEN NULL ELSE c.q/1000.0 END,'unit',c.unit,
    'status',CASE WHEN c.voided=1 THEN 'pending' ELSE c.status END,'note',c.note,
    'outOfStock',json(CASE WHEN c.out_of_stock=1 THEN 'true' ELSE 'false' END),
    'authorId',c.author,'authorName',cu.name,'version',c.version,'countedAt',c.updated_at) END record
    FROM cycles cy JOIN catalog_items ci ON ci.version=cy.catalog_version
    LEFT JOIN item_activity st ON st.area_id=json_extract(ci.data,'$.areaId') AND st.item_id=ci.id
    LEFT JOIN counts c ON c.cycle_id=cy.id AND c.item_id=ci.id AND c.location_id=ci.location_id AND c.author IS NOT NULL
    LEFT JOIN users cu ON cu.id=c.author
    ;

-- Deployment contract and transactionally maintained catalog cardinality.
-- No runtime COUNT over the catalog; any schema change fails the bounded schema contract.
CREATE TABLE catalog_integrity (
 version TEXT PRIMARY KEY, row_count INTEGER NOT NULL CHECK(row_count>=0),
 expected_count INTEGER NOT NULL CHECK(expected_count>=0)
) WITHOUT ROWID;
INSERT INTO catalog_integrity
 SELECT version,count(*),CASE version WHEN 'inventory-v2-2026-10-21' THEN 1227 WHEN 'inventory-v3-2026-10-22' THEN 1268 ELSE 0 END
 FROM catalog_items GROUP BY version;
CREATE TABLE runtime_contract (
 id INTEGER PRIMARY KEY CHECK(id=1), schema_signature TEXT NOT NULL,
 catalog_version TEXT NOT NULL, users_metadata_revision INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX users_ready_admin ON users(id) WHERE role='admin' AND active=1 AND deleted_at IS NULL;
CREATE TRIGGER catalog_integrity_insert AFTER INSERT ON catalog_items BEGIN
 INSERT INTO catalog_integrity VALUES(NEW.version,1,CASE NEW.version WHEN 'inventory-v2-2026-10-21' THEN 1227 WHEN 'inventory-v3-2026-10-22' THEN 1268 ELSE 0 END)
 ON CONFLICT(version) DO UPDATE SET row_count=row_count+1;
END;
CREATE TRIGGER catalog_integrity_delete AFTER DELETE ON catalog_items BEGIN
 UPDATE catalog_integrity SET row_count=row_count-1 WHERE version=OLD.version;
END;
CREATE TRIGGER catalog_integrity_version AFTER UPDATE OF version ON catalog_items WHEN NEW.version!=OLD.version BEGIN
 UPDATE catalog_integrity SET row_count=row_count-1 WHERE version=OLD.version;
 INSERT INTO catalog_integrity VALUES(NEW.version,1,CASE NEW.version WHEN 'inventory-v2-2026-10-21' THEN 1227 WHEN 'inventory-v3-2026-10-22' THEN 1268 ELSE 0 END)
 ON CONFLICT(version) DO UPDATE SET row_count=row_count+1;
END;
-- Operational invalidation only: no activity analytics or personal metadata.
CREATE TRIGGER runtime_user_insert AFTER INSERT ON users BEGIN UPDATE runtime_contract SET users_metadata_revision=users_metadata_revision+1 WHERE id=1; END;
CREATE TRIGGER runtime_user_update AFTER UPDATE ON users BEGIN UPDATE runtime_contract SET users_metadata_revision=users_metadata_revision+1 WHERE id=1; END;
CREATE TRIGGER runtime_user_delete AFTER DELETE ON users BEGIN UPDATE runtime_contract SET users_metadata_revision=users_metadata_revision+1 WHERE id=1; END;
CREATE TRIGGER runtime_session_delete AFTER DELETE ON sessions BEGIN UPDATE runtime_contract SET users_metadata_revision=users_metadata_revision+1 WHERE id=1; END;
CREATE TRIGGER runtime_session_expiry AFTER UPDATE OF expires ON sessions BEGIN UPDATE runtime_contract SET users_metadata_revision=users_metadata_revision+1 WHERE id=1; END;
-- Must be the final schema-changing statement. Later migrations refresh this
-- signature only after validating their complete schema; arbitrary DDL fails closed.
-- D1 forbids pragma_schema_version. Compare its small public schema metadata
-- instead; exclude provider/SQLite internals that are outside the app contract.
INSERT INTO runtime_contract(id,schema_signature,catalog_version)
 SELECT 1,(SELECT group_concat(type||':'||name||':'||coalesce(sql,''),'|') FROM (SELECT type,name,sql FROM sqlite_schema WHERE substr(name,1,4)!='_cf_' AND substr(name,1,7)!='sqlite_' ORDER BY type,name)),(SELECT version FROM catalog_integrity WHERE expected_count>0 ORDER BY version DESC LIMIT 1);
