// Telemetry retention is undecided; do not query or prune activity tables.
// Keep all inventory, accounts, audit, history and operation results indefinitely
// until a separate archival policy is explicitly agreed. Never prune dedup IDs.
export const retentionPolicy = { daysAfterExpiry: 2, maxRowsPerTable: 1000 };
export const reportSQL = `SELECT
 (SELECT count(*) FROM sessions WHERE expires<=unixepoch()-172800) expired_sessions,
 (SELECT count(*) FROM attempts WHERE window<CAST((unixepoch()-172800)/900 AS INTEGER)) expired_attempt_keys;`;
export const cleanupSQL = `
DELETE FROM sessions WHERE hash IN (SELECT hash FROM sessions WHERE expires<=unixepoch()-172800 LIMIT 1000);
DELETE FROM attempts WHERE key IN (SELECT key FROM attempts WHERE window<CAST((unixepoch()-172800)/900 AS INTEGER) LIMIT 1000);
INSERT INTO admin_audit(actor,target,action,detail) VALUES('offline-maintenance','expired-auth-metadata','cleanup','{"policy":"auth-metadata-v1","daysAfterExpiry":2,"maxRowsPerTable":1000}');`;
