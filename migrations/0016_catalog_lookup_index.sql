-- Explicit cycle navigation and incremental reads filter by catalog + location.
-- Content, identifiers, scopes and transactional guards remain unchanged.
CREATE INDEX catalog_items_version_location ON catalog_items(version,location_id);
UPDATE runtime_contract SET schema_signature=(
 SELECT group_concat(type||':'||name||':'||coalesce(sql,''),'|') FROM (
  SELECT type,name,sql FROM sqlite_schema WHERE substr(name,1,4)!='_cf_' AND substr(name,1,7)!='sqlite_' ORDER BY type,name
 )) WHERE id=1;
