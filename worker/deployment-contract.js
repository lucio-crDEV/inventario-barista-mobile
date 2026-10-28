// Named transactional guards and read projections required by contract 15.
// Runtime checks presence; preflight also verifies the complete sealed definitions.
export const runtimeContractVersion = 15;
const triggers = [
  'accept_operation',
  'apply_export_snapshot',
  'apply_inventory_cycle',
  'apply_operation',
  'apply_supervision',
  'catalog_integrity_delete',
  'catalog_integrity_insert',
  'catalog_integrity_version',
  'completion_activity_delete',
  'completion_activity_insert',
  'completion_activity_update',
  'completion_count_delete',
  'completion_count_insert',
  'completion_count_update',
  'cycle_registry_delete',
  'cycle_registry_insert',
  'cycle_registry_scope_delete',
  'cycle_registry_scope_insert',
  'cycle_registry_scope_update',
  'cycle_registry_update',
  'deleted_user_immutable',
  'export_chunk_immutable_delete',
  'export_chunk_immutable_update',
  'export_chunk_insert',
  'export_snapshot_immutable_delete',
  'export_snapshot_immutable_update',
  'export_snapshot_insert',
  'guard_export_snapshot',
  'guard_inventory_cycle',
  'guard_supervision',
  'last_admin_delete',
  'last_admin_update',
  'lifecycle_operation',
  'lifecycle_reopen_warning',
  'lifecycle_supervision',
  'revoke_sessions',
  'runtime_session_delete',
  'runtime_session_expiry',
  'runtime_user_delete',
  'runtime_user_insert',
  'runtime_user_update',
];
const views = ['count_records', 'inventory_permissions', 'supervision_items'];
export const runtimeObjects = Object.freeze([
  ...triggers.map((name) => Object.freeze({ type: 'trigger', name })),
  ...views.map((name) => Object.freeze({ type: 'view', name })),
]);
export const runtimeObjectsSQL = runtimeObjects
  .map(({ type, name }) => `(type='${type}' AND name='${name}')`)
  .join(' OR ');
export const runtimeGuardSQL = ` AND (SELECT count(*) FROM sqlite_schema WHERE ${runtimeObjectsSQL})=${runtimeObjects.length}`;
