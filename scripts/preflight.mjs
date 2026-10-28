import { catalogCountSQL } from '../shared/deployment-domain.js';
import { runtimeGuardSQL, runtimeContractVersion } from '../worker/deployment-contract.js';
import { exportSchemaSQL, exportDiscoverySQL } from '../worker/export-snapshots.js';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { localDatabase, wrangler } from './operations/storage.mjs';
import { readinessSQL } from '../worker/readiness.js';
import { cycleSchemaSQL } from '../worker/inventory-cycles.js';
import { runtimeSchemaSQL } from '../worker/runtime-readiness.js';

export const preflightDiscoverySQL = `SELECT
 (SELECT count(*) FROM sqlite_schema WHERE type='table' AND name IN('runtime_contract','catalog_integrity')) runtime_tables,
 EXISTS(SELECT 1 FROM sqlite_schema WHERE type='table' AND name='inventory_cycle_commands') cycles,
 EXISTS(SELECT 1 FROM pragma_table_info('runtime_contract') WHERE name='contract_version') capabilities`;

// Full cardinality/guard checks belong to this explicit, read-only deployment
// check. Runtime requests use the transactionally maintained 0013 contract.
export function preflightSQL(
  cycle,
  { runtime = false, cycles = false, exports = false, capabilities = false } = {},
) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(cycle)) throw Error('Invalid cycle.');
  let sql =
    readinessSQL.replace('?', `'${cycle}'`) +
    (cycles ? cycleSchemaSQL : '') +
    ` AND EXISTS(SELECT 1 FROM sqlite_schema WHERE type='trigger' AND name='last_admin_delete')`;
  if (runtime)
    sql += ` AND EXISTS(SELECT 1 FROM runtime_contract r JOIN catalog_integrity ci ON ci.version=c.catalog_version WHERE r.id=1 AND r.schema_signature=(${runtimeSchemaSQL}) AND r.users_metadata_revision>=1 AND ci.expected_count>0 AND ci.row_count=ci.expected_count
      AND EXISTS(SELECT 1 FROM catalog_integrity baseline WHERE baseline.version=r.catalog_version AND baseline.expected_count>0 AND baseline.row_count=baseline.expected_count))
    AND NOT EXISTS(SELECT 1 FROM catalog_integrity ci WHERE ci.row_count!=(SELECT count(*) FROM catalog_items i WHERE i.version=ci.version)
      OR ci.expected_count!=${catalogCountSQL('ci.version')})
    AND NOT EXISTS(SELECT 1 FROM catalog_items i WHERE NOT EXISTS(SELECT 1 FROM catalog_integrity ci WHERE ci.version=i.version))
    AND (SELECT count(*) FROM sqlite_schema WHERE type='trigger' AND name IN(
      'catalog_integrity_insert','catalog_integrity_delete','catalog_integrity_version',
      'runtime_user_insert','runtime_user_update','runtime_user_delete','runtime_session_delete','runtime_session_expiry',
      'completion_count_insert','completion_count_update','completion_count_delete',
      'completion_activity_insert','completion_activity_update','completion_activity_delete'))=14
    AND (SELECT count(*) FROM pragma_table_info('supervision_commands') WHERE name IN('allow_incomplete','completion_revision','completion_summary'))=3`;
  if (exports) sql += exportSchemaSQL;
  if (capabilities)
    sql +=
      runtimeGuardSQL +
      ` AND EXISTS(SELECT 1 FROM runtime_contract WHERE id=1 AND contract_version=${runtimeContractVersion})
    AND (SELECT count(*) FROM sqlite_schema WHERE type='index' AND name IN('catalog_items_version_area','export_snapshots_time'))=2`;
  return sql;
}

function main() {
  const { values: v } = parseArgs({
    options: {
      local: { type: 'boolean' },
      remote: { type: 'boolean' },
      state: { type: 'string' },
      config: { type: 'string' },
      cycle: { type: 'string' },
      exports: { type: 'boolean' },
    },
  });
  if (
    !!v.local === !!v.remote ||
    !v.cycle ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(v.cycle) ||
    (v.remote && (!v.config || v.state))
  )
    throw Error(
      'Use --local --state STATE --cycle ID, or explicitly --remote --config CONFIG --cycle ID. Read-only.',
    );
  const target = v.local
    ? localDatabase(v.state || '.wrangler/state')
    : { args: ['--remote', '--config', v.config], close() {} };
  const query = (sql) =>
    JSON.parse(wrangler(['execute', 'DB', ...target.args, '--command', sql, '--json'])).flatMap(
      (r) => r.results || [],
    );
  try {
    const discovery = query(preflightDiscoverySQL)[0];
    if (!discovery || ![0, 2].includes(discovery.runtime_tables))
      throw Error('Incomplete runtime contract. Do not publish.');
    const runtime = discovery.runtime_tables === 2;
    const exportTables = query(exportDiscoverySQL)[0]?.n;
    if (![0, 3].includes(exportTables)) throw Error('Incomplete export schema. Do not publish.');
    if (v.exports && exportTables !== 3)
      throw Error('Export snapshots require migration 0014. Do not publish this feature yet.');
    const rows = query(
      preflightSQL(v.cycle, {
        runtime,
        cycles: !!discovery.cycles,
        exports: exportTables === 3,
        capabilities: !!discovery.capabilities,
      }),
    );
    if (!rows.some((row) => row.ready === 1))
      throw Error('Schema/catalog/cycle/admin contract not ready. Do not publish.');
    console.log(
      JSON.stringify({
        ready: true,
        readOnly: true,
        cycle: v.cycle,
        schemaContract: discovery.capabilities
          ? 'runtime-capabilities-0015'
          : exportTables === 3
            ? 'export-snapshots-0014'
            : runtime
              ? 'runtime-consumption-0013'
              : 'operation-ux-0007',
        telemetryRequired: false,
        exportSnapshotsReady: exportTables === 3,
        note: 'Verify effective Pages bindings/origin/environment separately; this does not authenticate or certify remote CPU.',
      }),
    );
  } finally {
    target.close();
  }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main();
