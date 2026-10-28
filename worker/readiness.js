import { catalogCountSQL, catalogVersionsSQL } from '../shared/deployment-domain.js';
// Read-only deployment contract; legacy cycles remain intentionally supported.
const schemaSQL = `AND EXISTS(SELECT 1 FROM sqlite_schema WHERE type='table' AND name='item_activity')
 AND EXISTS(SELECT 1 FROM sqlite_schema WHERE type='table' AND name='item_activity_events')
 AND EXISTS(SELECT 1 FROM pragma_table_info('supervision_commands') WHERE name='expected_activity_revision')
 AND EXISTS(SELECT 1 FROM sqlite_schema WHERE type='trigger' AND name='guard_supervision')
 AND EXISTS(SELECT 1 FROM sqlite_schema WHERE type='trigger' AND name='apply_supervision')
 AND EXISTS(SELECT 1 FROM sqlite_schema WHERE type='view' AND name='supervision_items')
 AND EXISTS(SELECT 1 FROM users WHERE role='admin' AND active=1 AND deleted_at IS NULL)
 AND (SELECT count(*) FROM sqlite_schema WHERE
 (type='view' AND name IN ('inventory_permissions','count_records')) OR
 (type='trigger' AND name IN ('accept_operation','apply_operation','revoke_sessions','last_admin_update','deleted_user_immutable')))=7`;
export const readinessSQL = `SELECT 1 ready FROM cycles c WHERE c.id=?
 AND (SELECT count(*) FROM catalog_items ci WHERE ci.version=c.catalog_version)=${catalogCountSQL('c.catalog_version')}
 AND ${catalogCountSQL('c.catalog_version')}>0
 ${schemaSQL}`;
// Polls/writes avoid scanning every catalog row; entry/bootstrap and preflight
// perform full cardinality validation. Neither variant caches session/permissions.
export const fastReadinessSQL = `SELECT 1 ready FROM cycles c WHERE c.id=?
 AND c.catalog_version IN (${catalogVersionsSQL})
 AND EXISTS(SELECT 1 FROM catalog_items ci WHERE ci.version=c.catalog_version)
 ${schemaSQL}`;
