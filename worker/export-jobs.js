import { body, fail, json } from './http.js';
import { actorSQL } from './authorization.js';
import { exportSchemaSQL } from './export-snapshots.js';

const actor = 'WITH actor AS (' + actorSQL('u', ['admin']) + ' AND u.id=?2 AND u.revision=?3) ';
export const exportJobPath =
  /^\/api\/admin\/export-snapshots\/([-a-zA-Z0-9]{16,80})\/(generate|artifact|file)$/;
// This adapter intentionally imports no XLSX generator or review builder. The
// private namespace is the only path to compression and to the private R2 body.
export async function exportJobRequest(req, env, url, { u, hash }) {
  if (u.role !== 'admin') fail(403, 'ADMIN_REQUIRED', 'Solo un Administrador puede exportar.');
  const db = env.DB;
  const gate = await db
    .prepare(
      actor + 'SELECT EXISTS(SELECT 1 FROM actor) authorized,(1=1' + exportSchemaSQL + ') ready',
    )
    .bind(hash, u.id, u.revision)
    .first();
  if (!gate?.authorized) fail(403, 'EXPORT_ACCESS_DENIED', 'Actualiza tu sesión para continuar.');
  if (!gate.ready) fail(503, 'EXPORT_NOT_READY', 'La exportación todavía no está habilitada.');
  if (url.pathname === '/api/admin/exports' && req.method === 'GET') {
    const cycle = url.searchParams.get('cycle'),
      cursor = url.searchParams.get('cursor');
    if (
      (cycle !== null && (!cycle || cycle.length > 150)) ||
      [...url.searchParams.keys()].some((k) => !['cycle', 'cursor'].includes(k))
    )
      fail(400, 'INVALID_EXPORT_QUERY');
    let before = null;
    if (cursor)
      try {
        before = JSON.parse(atob(cursor));
        if (
          !Array.isArray(before) ||
          before.length !== 2 ||
          typeof before[0] !== 'string' ||
          before[0].length > 40 ||
          !/^[-a-zA-Z0-9]{16,80}$/.test(before[1])
        )
          throw Error();
      } catch {
        fail(400, 'INVALID_EXPORT_QUERY');
      }
    const result = await db
      .prepare(
        actor +
          `SELECT id,cycle_id,(SELECT name FROM cycles WHERE id=cycle_id) cycle_name,cycle_revision,completion_revision,created_at,template_id,policy_id
   FROM export_snapshots WHERE EXISTS(SELECT 1 FROM actor) ${cycle ? 'AND cycle_id=?4' : ''}
   ${before ? `AND (created_at,id)<(?${cycle ? 5 : 4},?${cycle ? 6 : 5})` : ''} ORDER BY created_at DESC,id DESC LIMIT 21`,
      )
      .bind(hash, u.id, u.revision, ...(cycle ? [cycle] : []), ...(before || []))
      .all();
    const snapshots = result.results.slice(0, 20),
      last = snapshots.at(-1);
    return json({
      snapshots,
      ...(result.results.length > 20
        ? { nextCursor: btoa(JSON.stringify([last.created_at, last.id])) }
        : {}),
    });
  }
  const match = url.pathname.match(exportJobPath);
  if (
    !match ||
    !(
      (match[2] === 'generate' && req.method === 'POST') ||
      (match[2] !== 'generate' && req.method === 'GET')
    )
  )
    fail(404, 'NOT_FOUND');
  if ([...url.searchParams].length) fail(400, 'INVALID_EXPORT_QUERY');
  if (match[2] === 'generate' && Object.keys(await body(req)).length)
    fail(400, 'INVALID_EXPORT_COMMAND');
  // Fresh authorization and a completed capture are checked without loading any
  // chunks or rebuilding its plan, including for stable repeat downloads.
  const exists = await db
    .prepare(
      actor +
        `SELECT s.id FROM export_snapshots s JOIN export_snapshot_commands c ON c.id=s.command_id
  WHERE s.id=?4 AND c.result IS NOT NULL AND EXISTS(SELECT 1 FROM actor)`,
    )
    .bind(hash, u.id, u.revision, match[1])
    .first();
  if (!exists) fail(404, 'EXPORT_SNAPSHOT_NOT_FOUND', 'La captura no está disponible.');
  if (!env.EXPORTS?.idFromName || !env.EXPORTS?.get)
    fail(503, 'EXPORT_NOT_READY', 'La generación de Excel todavía no está habilitada.');
  const stub = env.EXPORTS.get(env.EXPORTS.idFromName('snapshot:' + match[1]));
  return stub.fetch(
    new Request('https://exports.internal/' + match[2], {
      method: match[2] === 'generate' ? 'POST' : 'GET',
      headers: {
        'X-Inventory-Export-Context': JSON.stringify({
          snapshotId: match[1],
          userId: u.id,
          revision: u.revision,
          hash,
        }),
      },
    }),
  );
}
