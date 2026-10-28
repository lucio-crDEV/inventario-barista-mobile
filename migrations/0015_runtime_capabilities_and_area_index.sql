-- Versioned request contract: runtime checks approved catalog counters and every
-- required guard/view by name. Full SQL definition integrity belongs to read-only
-- deployment preflight, which must pass before publishing. Unrelated DDL does not
-- turn healthy requests into 503s; it remains unsealed until explicitly reviewed.
ALTER TABLE runtime_contract ADD COLUMN contract_version INTEGER NOT NULL DEFAULT 15 CHECK(contract_version=15);
CREATE INDEX catalog_items_version_area ON catalog_items(version,json_extract(data,'$.areaId'));
CREATE INDEX export_snapshots_time ON export_snapshots(created_at,id);
-- Last schema-changing step: seal only this reviewed migration's complete schema.
UPDATE runtime_contract SET schema_signature=(
 SELECT group_concat(type||':'||name||':'||coalesce(sql,''),'|') FROM (
  SELECT type,name,sql FROM sqlite_schema WHERE substr(name,1,4)!='_cf_' AND substr(name,1,7)!='sqlite_' ORDER BY type,name
 )) WHERE id=1;
