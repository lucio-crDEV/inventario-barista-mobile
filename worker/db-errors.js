// D1 exposes trigger RAISE codes through message strings. Decode only a standalone
// terminal code, with optional D1/SQLite framing; quoted SQL and substring matches
// must never turn an unrelated database failure into a business response.
const businessCodes = new Set([
  'FORBIDDEN','ID_REUSED','CYCLE_CLOSED','INVALID_ITEM_UNIT','STALE','FOREIGN_RECORD',
  'INVALID_ZERO','QUANTITY_LIMIT','ITEM_INACTIVE','COMPLETION_CHANGED','CONFIRMATION_REQUIRED',
  'CONFIRMATION_CHANGED','ADMIN_REOPEN_REQUIRED','REASON_REQUIRED','CYCLE_CHANGED',
  'ACTIVITY_CHANGED','INVALID_TRANSITION','PENDING_ITEMS','INVALID_SCOPE','CYCLE_EXISTS',
  'CATALOG_REQUIRED','DELETE_CONFIRMATION_REQUIRED','INVENTORY_NOT_FINALIZED',
  'EXPORT_SOURCE_CHANGED','EXPORT_POLICY_UNSUPPORTED','EXPORT_CAPTURE_FAILED',
  'EXPORT_SNAPSHOT_TOO_LARGE','EXPORT_RATE_LIMIT','LAST_ADMIN',
]);
export function databaseErrorCode(error, allowed) {
  const message = (typeof error?.message==='string' ? error.message : '').replace(
    /(:\s*SQLITE_CONSTRAINT)\s+\(extended:\s*SQLITE_CONSTRAINT_[A-Z]+\)\s*$/, '$1',
  );
  const token=message.match(/(?:^|:\s*)([A-Z][A-Z0-9_]*)(?::\s*SQLITE_CONSTRAINT(?:_[A-Z]+)?)?\s*$/)?.[1];
  let code=businessCodes.has(token)?token:null;
  if(!code && /(?:^|:\s*)CHECK constraint failed:\s*value\s*=\s*1(?::\s*SQLITE_CONSTRAINT(?:_CHECK)?)?\s*$/.test(message)) code='ACCOUNT_CHANGED';
  if(!code && /(?:^|:\s*)UNIQUE constraint failed:\s*[a-zA-Z_][\w.]*?(?:,\s*[a-zA-Z_][\w.]*)*(?::\s*SQLITE_CONSTRAINT(?:_UNIQUE)?)?\s*$/.test(message)) code='DUPLICATE';
  return code && (!allowed || allowed.includes(code)) ? code : null;
}
