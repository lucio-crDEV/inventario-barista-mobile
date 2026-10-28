import { readFile, writeFile } from 'node:fs/promises';
// Generate a new migration; never rewrite the already applied core migration.
const core = await readFile(new URL('../migrations/0001_core.sql', import.meta.url), 'utf8');
const view = core.slice(
  core.indexOf('CREATE VIEW count_records'),
  core.indexOf('CREATE TRIGGER accept_operation'),
);
const apply = core.slice(core.indexOf('CREATE TRIGGER apply_operation'));
let accept = core.slice(
  core.indexOf('CREATE TRIGGER accept_operation'),
  core.indexOf('CREATE TRIGGER apply_operation'),
);
accept = accept.replace(
  "AND (u.role='admin' OR EXISTS(SELECT 1 FROM grants g JOIN scope_closure sc ON sc.ancestor=g.scope_id WHERE g.user_id=u.id AND sc.descendant=NEW.location_id))",
  'AND u.deleted_at IS NULL AND EXISTS(SELECT 1 FROM inventory_permissions p WHERE p.user_id=u.id AND p.scope_id=NEW.location_id)',
);
const sql = `-- Usuarios personales: nuevo rol, eliminación irreversible e identidad estable.
-- D1 aplica la migración como transacción; preservar claves de todos los hijos.
PRAGMA defer_foreign_keys=ON;
DROP VIEW count_records;
DROP TRIGGER accept_operation;
DROP TRIGGER apply_operation;
CREATE TABLE users_next (
 id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
 name TEXT NOT NULL, password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('worker','service_lead','admin')),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 must_change INTEGER NOT NULL DEFAULT 1, revision INTEGER NOT NULL DEFAULT 1,
 deleted_at TEXT,
 managed_scope TEXT CHECK(managed_scope IS NULL OR managed_scope='servicio')
);
INSERT INTO users_next(id,username,name,password_hash,role,active,must_change,revision)
 SELECT id,username,name,password_hash,role,active,must_change,revision FROM users;
DROP TABLE users;
ALTER TABLE users_next RENAME TO users;
CREATE TRIGGER last_admin_update BEFORE UPDATE OF active,role ON users
 WHEN OLD.role='admin' AND OLD.active=1 AND (NEW.role!='admin' OR NEW.active!=1)
 AND (SELECT count(*) FROM users WHERE role='admin' AND active=1 AND deleted_at IS NULL)<=1
 BEGIN SELECT RAISE(ABORT,'LAST_ADMIN'); END;
CREATE TRIGGER last_admin_delete BEFORE DELETE ON users WHEN OLD.role='admin' AND OLD.active=1
 AND (SELECT count(*) FROM users WHERE role='admin' AND active=1 AND deleted_at IS NULL)<=1
 BEGIN SELECT RAISE(ABORT,'LAST_ADMIN'); END;
CREATE TRIGGER revoke_sessions AFTER UPDATE OF username,password_hash,active,deleted_at ON users
 WHEN OLD.username!=NEW.username OR OLD.password_hash!=NEW.password_hash OR NEW.active=0 OR NEW.deleted_at IS NOT NULL
 BEGIN DELETE FROM sessions WHERE user_id=NEW.id; END;
CREATE TRIGGER deleted_user_immutable BEFORE UPDATE ON users WHEN OLD.deleted_at IS NOT NULL
 BEGIN SELECT RAISE(ABORT,'DELETED_USER'); END;
CREATE VIEW inventory_permissions AS
 SELECT u.id user_id,s.id scope_id FROM users u CROSS JOIN scopes s
 WHERE u.active=1 AND u.deleted_at IS NULL AND (
  u.role='admin' OR
  (u.role='service_lead' AND EXISTS(SELECT 1 FROM scope_closure c WHERE c.ancestor='servicio' AND c.descendant=s.id)) OR
  (u.role='worker' AND EXISTS(SELECT 1 FROM grants g JOIN scope_closure c ON c.ancestor=g.scope_id WHERE g.user_id=u.id AND c.descendant=s.id))
 );
${view}${accept}${apply}
PRAGMA defer_foreign_keys=OFF;
`;
if (!accept.includes('inventory_permissions')) throw Error('Guardia de permisos no generada');
await writeFile(new URL('../migrations/0003_users_service.sql', import.meta.url), sql);
