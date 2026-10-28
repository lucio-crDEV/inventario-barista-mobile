import { databaseErrorCode } from './db-errors.js';
import { permissionsSQL } from './authorization.js';
import { defaultCycle } from '../shared/cycles.js';
// Readiness must fail closed if a partial/manual schema is missing transactional guards.
export const cycleSchemaSQL = ` AND (SELECT count(*) FROM sqlite_schema WHERE type='trigger' AND name IN('guard_inventory_cycle','apply_inventory_cycle','lifecycle_operation','lifecycle_supervision','cycle_registry_insert','cycle_registry_update','cycle_registry_delete','lifecycle_reopen_warning','cycle_registry_scope_insert','cycle_registry_scope_update','cycle_registry_scope_delete'))=11`;
const actor = permissionsSQL();
export async function cyclesEnabled(db) {
  return !!(await db
    .prepare(
      "SELECT 1 ok FROM sqlite_schema WHERE type='table' AND name='inventory_cycle_commands'",
    )
    .first());
}
async function cyclesSnapshot(db, hash, includeDeleted = false, modern = undefined) {
  if (modern === undefined) modern = await cyclesEnabled(db);
  const statements = [
    db
      .prepare(
        actor +
          `SELECT c.* FROM cycles c WHERE ${modern && !includeDeleted ? "c.lifecycle!='deleted' AND (c.lifecycle!='prepared' OR EXISTS(SELECT 1 FROM actor WHERE role IN('admin','service_lead'))) AND " : ''}EXISTS(SELECT 1 FROM catalog_items ci WHERE ci.version=c.catalog_version AND ci.location_id IN(SELECT scope_id FROM allowed)) ${includeDeleted ? "AND EXISTS(SELECT 1 FROM actor WHERE role='admin')" : ''} ORDER BY c.rowid DESC`,
      )
      .bind(hash),
    db
      .prepare(
        actor +
          `SELECT cs.* FROM cycle_scope_states cs WHERE EXISTS(SELECT 1 FROM scope_closure cl WHERE cl.ancestor=cs.scope_id AND cl.descendant IN(SELECT scope_id FROM allowed))`,
      )
      .bind(hash),
  ];
  if (modern) statements.push(db.prepare('SELECT revision FROM cycle_registry WHERE id=1'));
  // A confirmation revision must describe the same snapshot that the person saw.
  const [rows, states, registry] = await db.batch(statements);
  const cycles = rows.results.map((c) => ({
    ...c,
    scopeStates: states.results
      .filter((s) => s.cycle_id === c.id)
      .map(({ scope_id, state }) => ({ scope_id, state })),
  }));
  return { cycles, ...(modern ? { confirmationRevision: registry.results[0].revision } : {}) };
}
export async function listCycles(db, hash, includeDeleted = false) {
  return (await cyclesSnapshot(db, hash, includeDeleted)).cycles;
}
export async function resolveCycle(db, hash, requested, legacyDefault, modern = undefined) {
  if (modern === undefined) modern = await cyclesEnabled(db);
  if (!modern) return requested || legacyDefault;
  const row = await db
    .prepare(
      actor +
        `SELECT c.id FROM cycles c WHERE c.lifecycle!='deleted'
 AND (c.lifecycle!='prepared' OR EXISTS(SELECT 1 FROM actor WHERE role IN('admin','service_lead')))
 AND ((?2='' AND c.lifecycle!='prepared' AND (c.state IN('open','review','closed') OR EXISTS(SELECT 1 FROM cycle_scope_states cs WHERE cs.cycle_id=c.id AND cs.state!='closed'))) OR c.id=?2) AND EXISTS(SELECT 1 FROM catalog_items ci WHERE ci.version=c.catalog_version AND ci.location_id IN(SELECT scope_id FROM allowed))
 ORDER BY CASE WHEN (c.state IN('open','review') OR EXISTS(SELECT 1 FROM cycle_scope_states cs WHERE cs.cycle_id=c.id AND cs.state!='closed')) THEN 0 WHEN c.state='closed' THEN 1 ELSE 2 END,c.rowid DESC LIMIT 1`,
    )
    .bind(hash, requested || '')
    .first();
  return row?.id || null;
}
export async function warningData(db, b) {
  const [rowsResult, registryResult] = await db.batch([
    db
      .prepare(
        "SELECT c.*,EXISTS(SELECT 1 FROM cycle_scope_states cs WHERE cs.cycle_id=c.id AND cs.state IN('open','review')) scope_active FROM cycles c WHERE c.lifecycle!='deleted' AND c.id!=? ORDER BY c.rowid DESC",
      )
      .bind(b.cycleId),
    db.prepare('SELECT revision FROM cycle_registry WHERE id=1'),
  ]);
  const rows = rowsResult.results;
  const warnings = [];
  if (
    (b.kind === 'activate' || b.activate !== false) &&
    rows.some((c) => c.lifecycle === 'active' && (c.state !== 'closed' || c.scope_active))
  )
    warnings.push({
      code: 'OTHER_ACTIVE',
      message: 'Ya existe otro inventario activo. Ambos permanecerán disponibles.',
    });
  const week = (value) => {
    const d = new Date(value + 'T00:00:00Z');
    if (!Number.isFinite(+d)) return '';
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  if (
    b.period &&
    rows.some(
      (c) =>
        (['weekly', 'both'].includes(c.type) &&
          ['weekly', 'both'].includes(b.type) &&
          week(c.period) === week(b.period)) ||
        (['month_end', 'both'].includes(c.type) &&
          ['month_end', 'both'].includes(b.type) &&
          c.period.slice(0, 7) === b.period.slice(0, 7)),
    )
  )
    warnings.push({
      code: 'DUPLICATE_PERIOD',
      message: 'Ya existe un inventario de este tipo para el período indicado.',
    });
  return { warnings, confirmationRevision: registryResult.results[0].revision };
}
export async function inventoryCyclesRequest(
  req,
  db,
  url,
  { u, hash },
  { json, fail, body, userDTO, digest },
  catalogVersion,
) {
  if (
    req.method === 'GET' &&
    ['/api/cycles', '/api/admin/cycles', '/api/admin/supervision/cycles'].includes(url.pathname)
  ) {
    if (url.pathname !== '/api/cycles' && !['admin', 'service_lead'].includes(u.role))
      fail(403, 'SUPERVISOR_REQUIRED', 'No tienes acceso a supervisión.');
    const snapshot = await cyclesSnapshot(
      db,
      hash,
      u.role === 'admin' && url.searchParams.get('includeDeleted') === '1',
      true,
    );
    return json({
      user: userDTO(u),
      ...snapshot,
      defaultCycleId: defaultCycle(snapshot.cycles)?.id || null,
    });
  }
  if (url.pathname !== '/api/admin/cycles/command' || req.method !== 'POST') fail(404, 'NOT_FOUND');
  if (u.role !== 'admin')
    fail(
      403,
      'ADMIN_REQUIRED',
      'Solo un Administrador puede crear, activar o eliminar inventarios.',
    );
  const b = await body(req),
    keys = [
      'id',
      'kind',
      'cycleId',
      'expectedRevision',
      'name',
      'type',
      'period',
      'activate',
      'confirmWarnings',
      'confirmationRevision',
      'confirm',
    ];
  if (
    Object.keys(b).some((k) => !keys.includes(k)) ||
    !/^[-a-zA-Z0-9]{16,80}$/.test(b.id || '') ||
    !['create', 'activate', 'delete'].includes(b.kind) ||
    typeof b.cycleId !== 'string' ||
    !/^[-a-zA-Z0-9]{1,150}$/.test(b.cycleId) ||
    ('activate' in b && typeof b.activate !== 'boolean') ||
    ('confirmWarnings' in b && typeof b.confirmWarnings !== 'boolean') ||
    ('confirm' in b && typeof b.confirm !== 'boolean') ||
    ('confirmationRevision' in b &&
      (!Number.isSafeInteger(b.confirmationRevision) || b.confirmationRevision < 1))
  )
    fail(400, 'INVALID_COMMAND', 'Revisa los datos del inventario.');
  if (b.kind === 'create') {
    if (
      typeof b.name !== 'string' ||
      !b.name.trim() ||
      b.name.trim().length > 120 ||
      !['weekly', 'month_end', 'both'].includes(b.type) ||
      typeof b.period !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(b.period) ||
      !Number.isFinite(Date.parse(b.period + 'T00:00:00Z')) ||
      new Date(b.period + 'T00:00:00Z').toISOString().slice(0, 10) !== b.period
    )
      fail(400, 'INVALID_CYCLE', 'Indica nombre, tipo y fecha válidos.');
  } else if (!Number.isSafeInteger(b.expectedRevision) || b.expectedRevision < 1)
    fail(400, 'INVALID_COMMAND', 'Actualiza la versión del inventario.');
  if (b.kind === 'delete' && b.confirm !== true)
    fail(
      400,
      'DELETE_CONFIRMATION_REQUIRED',
      'Confirma la eliminación. Se conservarán los conteos y el historial.',
    );
  // Fingerprint describes intent, including confirmation; failed attempts persist no command.
  const fingerprint = await digest(JSON.stringify(keys.map((k) => b[k] ?? null)));
  const existing =
    b.kind === 'create'
      ? null
      : await db.prepare('SELECT * FROM cycles WHERE id=?').bind(b.cycleId).first();
  const openingDay = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const intent = {
    ...b,
    type: b.kind === 'create' ? b.type : existing?.type,
    period: b.kind === 'create' ? b.period : b.kind === 'activate' ? openingDay : existing?.period,
  };
  try {
    await db
      .prepare(
        `INSERT INTO inventory_cycle_commands(id,fingerprint,user_id,session_hash,user_revision,kind,cycle_id,expected_revision,name,type,period,catalog_version,activate,confirm_warnings,confirmation_revision,confirmed_delete) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        b.id,
        fingerprint,
        u.id,
        hash,
        u.revision,
        b.kind,
        b.cycleId,
        b.expectedRevision || 0,
        b.kind === 'create'
          ? b.name.trim()
          : b.kind === 'activate'
            ? openingDay.split('-').reverse().join('/')
            : '',
        intent.type || 'both',
        intent.period || '',
        catalogVersion,
        b.activate === false ? 0 : 1,
        b.confirmWarnings === true ? 1 : 0,
        b.confirmationRevision ?? -1,
        b.confirm === true ? 1 : 0,
      )
      .run();
  } catch (e) {
    const code = databaseErrorCode(e, [
      'FORBIDDEN',
      'ID_REUSED',
      'CYCLE_EXISTS',
      'CYCLE_CHANGED',
      'INVALID_TRANSITION',
      'CATALOG_REQUIRED',
      'DELETE_CONFIRMATION_REQUIRED',
      'CONFIRMATION_REQUIRED',
      'CONFIRMATION_CHANGED',
    ]);
    if (code)
      fail(
        code === 'FORBIDDEN' ? 403 : 409,
        code,
        {
          CONFIRMATION_REQUIRED: 'Revisa los avisos y confirma antes de continuar.',
          CONFIRMATION_CHANGED: 'La lista de inventarios cambió. Revisa los avisos nuevamente.',
          CYCLE_CHANGED: 'El inventario cambió. Actualiza antes de continuar.',
        }[code] || 'No se pudo aplicar el cambio.',
        code.startsWith('CONFIRMATION_') ? await warningData(db, intent) : {},
      );
    throw e;
  }
  const result = await db
    .prepare(
      actor +
        'SELECT m.result FROM inventory_cycle_commands m JOIN actor a ON a.id=m.user_id WHERE m.id=?2',
    )
    .bind(hash, b.id)
    .first();
  if (!result) fail(403, 'FORBIDDEN');
  return json(JSON.parse(result.result));
}
