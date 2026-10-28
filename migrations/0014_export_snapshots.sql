-- Additive export capture. No counts, lifecycle, catalog, history or sessions change.
CREATE TABLE export_snapshot_commands (
 id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id), session_hash TEXT NOT NULL,
 user_revision INTEGER NOT NULL, cycle_id TEXT NOT NULL REFERENCES cycles(id),
 expected_revision INTEGER NOT NULL, expected_completion_revision INTEGER NOT NULL,
 template_id TEXT NOT NULL, template_sha256 TEXT NOT NULL, policy_id TEXT NOT NULL,
 result TEXT, created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX export_commands_actor_time ON export_snapshot_commands(user_id,created_at);
CREATE TABLE export_snapshots (
 id TEXT PRIMARY KEY, command_id TEXT NOT NULL UNIQUE REFERENCES export_snapshot_commands(id),
 cycle_id TEXT NOT NULL REFERENCES cycles(id), cycle_revision INTEGER NOT NULL,
 completion_revision INTEGER NOT NULL, catalog_version TEXT NOT NULL,
 template_id TEXT NOT NULL, template_sha256 TEXT NOT NULL, policy_id TEXT NOT NULL,
 created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL,
 UNIQUE(cycle_id,cycle_revision,completion_revision,catalog_version,template_id,template_sha256,policy_id)
);
-- Small immutable chunks keep exported SQL INSERT statements below D1's
-- 100 KB statement limit, including worst-case UTF-8 and SQL quoting.
CREATE TABLE export_snapshot_chunks (
 snapshot_id TEXT NOT NULL REFERENCES export_snapshots(id),
 part INTEGER NOT NULL CHECK(part>=1), content TEXT NOT NULL CHECK(length(content)<=8192),
 PRIMARY KEY(snapshot_id,part)
) WITHOUT ROWID;
CREATE TRIGGER export_snapshot_insert BEFORE INSERT ON export_snapshots BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM export_snapshot_commands c WHERE c.id=NEW.command_id
  AND c.result IS NULL AND c.user_id=NEW.created_by AND c.cycle_id=NEW.cycle_id
  AND c.template_id=NEW.template_id AND c.template_sha256=NEW.template_sha256 AND c.policy_id=NEW.policy_id)
  THEN RAISE(ABORT,'IMMUTABLE_EXPORT_SNAPSHOT') END;
END;
CREATE TRIGGER export_chunk_insert BEFORE INSERT ON export_snapshot_chunks BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM export_snapshots s JOIN export_snapshot_commands c ON c.id=s.command_id
  WHERE s.id=NEW.snapshot_id AND c.result IS NULL) THEN RAISE(ABORT,'IMMUTABLE_EXPORT_SNAPSHOT') END;
END;
CREATE TRIGGER export_chunk_immutable_update BEFORE UPDATE ON export_snapshot_chunks BEGIN
 SELECT RAISE(ABORT,'IMMUTABLE_EXPORT_SNAPSHOT');
END;
CREATE TRIGGER export_chunk_immutable_delete BEFORE DELETE ON export_snapshot_chunks BEGIN
 SELECT RAISE(ABORT,'IMMUTABLE_EXPORT_SNAPSHOT');
END;
CREATE INDEX export_snapshots_cycle ON export_snapshots(cycle_id,created_at,id);
CREATE TRIGGER export_snapshot_immutable_update BEFORE UPDATE ON export_snapshots BEGIN
 SELECT RAISE(ABORT,'IMMUTABLE_EXPORT_SNAPSHOT');
END;
CREATE TRIGGER export_snapshot_immutable_delete BEFORE DELETE ON export_snapshots BEGIN
 SELECT RAISE(ABORT,'IMMUTABLE_EXPORT_SNAPSHOT');
END;
CREATE TRIGGER guard_export_snapshot BEFORE INSERT ON export_snapshot_commands BEGIN
 -- Authorization precedes deduplication, including accepted historical retries.
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sessions s JOIN users u ON u.id=s.user_id
  WHERE s.hash=NEW.session_hash AND s.user_id=NEW.user_id AND s.expires>unixepoch()
  AND u.active=1 AND u.deleted_at IS NULL AND u.must_change=0
  AND u.role='admin' AND u.revision=NEW.user_revision) THEN RAISE(ABORT,'FORBIDDEN') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM export_snapshot_commands WHERE id=NEW.id
  AND (fingerprint!=NEW.fingerprint OR user_id!=NEW.user_id)) THEN RAISE(ABORT,'ID_REUSED') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM export_snapshot_commands WHERE id=NEW.id) THEN RAISE(IGNORE) END;
 -- Global per-account limit; accepted retries do not spend another slot.
 SELECT CASE WHEN (SELECT count(*) FROM (SELECT 1 FROM export_snapshot_commands
  WHERE user_id=NEW.user_id AND created_at>=strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 minute') LIMIT 10))>=10
  THEN RAISE(ABORT,'EXPORT_RATE_LIMIT') END;

 SELECT CASE WHEN NEW.template_id!='totalizado-11-10-v1'
  OR NEW.template_sha256!='9c123ce93a01df5167c80339451d2ffa94e5f29e9260a24519879fb1b78a14e9'
  OR NEW.policy_id NOT IN('stock-v1-3dp-preserve-calc','stock-v1-3dp-recalc-on-open')
  THEN RAISE(ABORT,'EXPORT_POLICY_UNSUPPORTED') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM cycles c WHERE c.id=NEW.cycle_id
  AND c.lifecycle='active' AND c.state='closed'
  AND NOT EXISTS(SELECT 1 FROM cycle_scope_states s WHERE s.cycle_id=c.id AND s.state!='closed'))
  THEN RAISE(ABORT,'INVENTORY_NOT_FINALIZED') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM cycles c WHERE c.id=NEW.cycle_id
  AND c.revision=NEW.expected_revision AND c.completion_revision=NEW.expected_completion_revision)
  THEN RAISE(ABORT,'EXPORT_SOURCE_CHANGED') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM cycles c JOIN catalog_integrity ci ON ci.version=c.catalog_version
  WHERE c.id=NEW.cycle_id AND ci.row_count=ci.expected_count
  AND ci.expected_count=CASE c.catalog_version WHEN 'inventory-v2-2026-10-21' THEN 1227 WHEN 'inventory-v3-2026-10-22' THEN 1268 ELSE -1 END)
  THEN RAISE(ABORT,'CATALOG_REQUIRED') END;
END;
CREATE TRIGGER apply_export_snapshot AFTER INSERT ON export_snapshot_commands BEGIN
 INSERT INTO export_snapshots(id,command_id,cycle_id,cycle_revision,completion_revision,
  catalog_version,template_id,template_sha256,policy_id,created_by,created_at)
 SELECT NEW.id,NEW.id,c.id,c.revision,c.completion_revision,c.catalog_version,
  NEW.template_id,NEW.template_sha256,NEW.policy_id,NEW.user_id,NEW.created_at
 FROM cycles c WHERE c.id=NEW.cycle_id AND NOT EXISTS(
  SELECT 1 FROM export_snapshots s WHERE s.cycle_id=c.id AND s.cycle_revision=c.revision
   AND s.completion_revision=c.completion_revision AND s.catalog_version=c.catalog_version
   AND s.template_id=NEW.template_id AND s.template_sha256=NEW.template_sha256 AND s.policy_id=NEW.policy_id)
 ON CONFLICT(cycle_id,cycle_revision,completion_revision,catalog_version,template_id,template_sha256,policy_id) DO NOTHING;
 INSERT INTO export_snapshot_chunks(snapshot_id,part,content)
 SELECT NEW.id,part,content FROM (
  WITH RECURSIVE source(payload) AS MATERIALIZED (
   SELECT json_object('schema',1,'id',NEW.id,'capturedAt',NEW.created_at,
   'cycle',json_object('id',c.id,'name',c.name,'state',c.state,'lifecycle',c.lifecycle,
    'revision',c.revision,'completionRevision',c.completion_revision,'catalogVersion',c.catalog_version),
   'template',json_object('id',NEW.template_id,'sha256',NEW.template_sha256),
   'policy',json_object('id',NEW.policy_id,'decimals',3,'partial','sum-counted',
    'excludeInactive',json('true'),'recalculateOnOpen',json(CASE WHEN NEW.policy_id='stock-v1-3dp-recalc-on-open' THEN 'true' ELSE 'false' END)),
   'items',json((SELECT json_group_array(json(item)) FROM (
    SELECT json_object('id',ci.id,'locationId',ci.location_id,
     'name',json_extract(ci.data,'$.name'),'unit',ci.unit,
     'justoId',json_extract(ci.data,'$.justoId'),
     'exportSheet',json_extract(ci.data,'$.exportSheet'),'exportRow',json_extract(ci.data,'$.exportRow'),
     'exportUnit',json_extract(ci.data,'$.exportUnit'),'toExportFactor',json_extract(ci.data,'$.toExportFactor'),
     'active',json(CASE WHEN coalesce(a.active,CASE WHEN json_extract(ci.data,'$.active')=0 THEN 0 ELSE 1 END)=1 THEN 'true' ELSE 'false' END),
     'record',json(CASE WHEN co.author IS NULL THEN 'null' ELSE json_object(
      'q',co.q,'unit',co.unit,'status',co.status,'voided',co.voided,'version',co.version) END)) item
    FROM catalog_items ci LEFT JOIN item_activity a
     ON a.area_id=json_extract(ci.data,'$.areaId') AND a.item_id=ci.id
    LEFT JOIN counts co ON co.cycle_id=c.id AND co.item_id=ci.id AND co.location_id=ci.location_id
    WHERE ci.version=c.catalog_version ORDER BY ci.id,ci.location_id
   ))))
   FROM cycles c WHERE c.id=NEW.cycle_id
    AND EXISTS(SELECT 1 FROM export_snapshots s WHERE s.id=NEW.id AND s.command_id=NEW.id)
  ), pieces(part,content) AS (
   SELECT 1,substr(payload,1,8192) FROM source WHERE length(CAST(payload AS BLOB))<=1000000
   UNION ALL
   SELECT part+1,substr(payload,part*8192+1,8192) FROM pieces,source WHERE part*8192<length(payload)
  ) SELECT part,content FROM pieces
 );
 SELECT CASE WHEN EXISTS(SELECT 1 FROM export_snapshots WHERE id=NEW.id)
  AND NOT EXISTS(SELECT 1 FROM export_snapshot_chunks WHERE snapshot_id=NEW.id)
  THEN RAISE(ABORT,'EXPORT_SNAPSHOT_TOO_LARGE') END;
 UPDATE export_snapshot_commands SET result=(
  SELECT json_object('commandId',NEW.id,'snapshotId',s.id,'cycleId',s.cycle_id,
   'cycleRevision',s.cycle_revision,'completionRevision',s.completion_revision,
   'templateId',s.template_id,'policyId',s.policy_id,'capturedAt',s.created_at)
  FROM export_snapshots s JOIN cycles c ON c.id=s.cycle_id
  WHERE s.cycle_id=NEW.cycle_id AND s.cycle_revision=NEW.expected_revision
   AND s.completion_revision=NEW.expected_completion_revision AND s.catalog_version=c.catalog_version
   AND s.template_id=NEW.template_id AND s.template_sha256=NEW.template_sha256 AND s.policy_id=NEW.policy_id
 ) WHERE id=NEW.id;
 SELECT CASE WHEN (SELECT result FROM export_snapshot_commands WHERE id=NEW.id) IS NULL
  THEN RAISE(ABORT,'EXPORT_CAPTURE_FAILED') END;
 INSERT INTO admin_audit(actor,target,action,detail) VALUES(NEW.user_id,NEW.cycle_id,'export-snapshot',
  json_object('commandId',NEW.id,'result',json((SELECT result FROM export_snapshot_commands WHERE id=NEW.id))));
END;
-- Last schema-changing step. Never restamp an arbitrary/incomplete schema.
UPDATE runtime_contract SET schema_signature=(
 SELECT group_concat(type||':'||name||':'||coalesce(sql,''),'|') FROM (
  SELECT type,name,sql FROM sqlite_schema WHERE substr(name,1,4)!='_cf_' AND substr(name,1,7)!='sqlite_' ORDER BY type,name
 )) WHERE id=1;
