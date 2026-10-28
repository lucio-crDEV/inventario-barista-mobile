import { cleanupSQL } from '../../scripts/operations/retention.mjs';
import { generateSnapshotExcel } from '../../worker/export-service.js';
import { excelTemplate } from '../../data/inventario/export-template.js';
import { digest } from '../../worker/session.js';

const MAX_ATTEMPTS = 3,
  RETRY_MS = 10000,
  WATCHDOG_MS = 60000,
  MANUAL_COOLDOWN_MS = 60000;
const idPattern = /^[-a-zA-Z0-9]{16,80}$/;
const sha = async (bytes) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (v) =>
    v.toString(16).padStart(2, '0'),
  ).join('');
const reply = (value, status = 200, headers = {}) =>
  Response.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
  });
const error = (code, status = 409) =>
  reply({ code, message: 'No se pudo completar la exportación.' }, status);
const cooldown = (job) =>
  Math.max(0, Math.ceil(((job.failedAt || 0) + MANUAL_COOLDOWN_MS - Date.now()) / 1000));
const publicState = (job) => ({
  snapshotId: job.snapshotId,
  state: job.state,
  attempts: job.attempts,
  retryable: job.state === 'failed' && job.retryable === true,
  ...(job.state === 'failed' && job.retryable ? { retryAfter: cooldown(job) } : {}),
  ...(job.code ? { code: job.code } : {}),
  ...(job.state === 'ready'
    ? {
        sha256: job.sha256,
        size: job.size,
        createdAt: job.createdAt,
        downloadUrl: '/api/admin/export-snapshots/' + job.snapshotId + '/file',
      }
    : {}),
});
const validContext = (value) =>
  value &&
  typeof value.snapshotId === 'string' &&
  idPattern.test(value.snapshotId) &&
  typeof value.userId === 'string' &&
  value.userId.length <= 150 &&
  Number.isSafeInteger(value.revision) &&
  value.revision > 0 &&
  typeof value.hash === 'string' &&
  /^[a-f0-9]{64}$/.test(value.hash);
const failure = (code) => {
  throw Object.assign(Error(code), { code });
};

// One SQLite-backed object per immutable D1 capture. Session hashes live only in
// private binding request memory. Persisted metadata has neither cells nor tokens.
export class InventoryExport {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.serial = Promise.resolve();
  }
  database() {
    return this.env.DB.withSession ? this.env.DB.withSession('first-primary') : this.env.DB;
  }
  exclusive(work) {
    const next = this.serial.then(work, work);
    this.serial = next.catch(() => {});
    return next;
  }
  async authorized(auth, exactSession = true) {
    return this.database()
      .prepare(
        `SELECT 1 allowed FROM users u WHERE u.id=?1 AND u.revision=?2 AND u.role='admin'
   AND u.active=1 AND u.deleted_at IS NULL AND u.must_change=0 ${
     exactSession
       ? 'AND EXISTS(SELECT 1 FROM sessions s WHERE s.user_id=u.id AND s.hash=?3 AND s.expires>unixepoch())'
       : ''
   }`,
      )
      .bind(auth.userId, auth.revision, ...(exactSession ? [auth.hash] : []))
      .first();
  }
  async metadata(id) {
    return this.database()
      .prepare(
        `SELECT s.* FROM export_snapshots s JOIN export_snapshot_commands c ON c.id=s.command_id
  WHERE s.id=? AND c.result IS NOT NULL`,
      )
      .bind(id)
      .first();
  }
  fetch(req) {
    return this.exclusive(() => this.request(req)).catch(() => error('EXPORT_UNAVAILABLE', 503));
  }
  async request(req) {
    const action = new URL(req.url).pathname;
    if (!(
      (action === '/generate' && req.method === 'POST') ||
      (['/artifact', '/file'].includes(action) && req.method === 'GET')
    ))
      return error('NOT_FOUND', 404);
    let auth;
    try {
      auth = JSON.parse(req.headers.get('X-Inventory-Export-Context'));
    } catch {
      return error('EXPORT_ACCESS_DENIED', 403);
    }
    if (!validContext(auth) || !(await this.authorized(auth)))
      return error('EXPORT_ACCESS_DENIED', 403);
    const meta = await this.metadata(auth.snapshotId);
    if (!meta) return error('EXPORT_SNAPSHOT_NOT_FOUND', 404);
    let job = await this.ctx.storage.get('job');
    if (job && job.snapshotId !== auth.snapshotId) return error('EXPORT_CONTEXT_MISMATCH', 409);
    if (action === '/generate' && !job) {
      if (!(await this.authorized(auth))) return error('EXPORT_ACCESS_DENIED', 403);
      job = {
        version: 1,
        snapshotId: auth.snapshotId,
        state: 'queued',
        attempts: 0,
        userId: auth.userId,
        revision: auth.revision,
      };
      await this.ctx.storage.put('job', job);
      await this.ctx.storage.setAlarm(Date.now() + 1);
    }
    if (action === '/generate' && job?.state === 'failed' && job.retryable) {
      const retryAfter = cooldown(job);
      if (retryAfter)
        return reply(
          {
            ...publicState(job),
            code: 'EXPORT_RETRY_COOLDOWN',
            message: 'Espera un minuto antes de reintentar.',
          },
          429,
          { 'Retry-After': String(retryAfter) },
        );
      if (!(await this.authorized(auth))) return error('EXPORT_ACCESS_DENIED', 403);
      // A freshly authorized administrator may resume an admitted immutable
      // capture after configuration or account repair. Each round is bounded,
      // with at most one manual retry per minute; no lifetime lockout is needed.
      job = {
        ...job,
        state: 'queued',
        attempts: 0,
        userId: auth.userId,
        revision: auth.revision,
        retryable: false,
      };
      delete job.code;
      delete job.failedAt;
      await this.ctx.storage.put('job', job);
      await this.ctx.storage.setAlarm(Date.now() + 1);
    }
    if (action === '/generate' && job?.state === 'queued')
      await this.ctx.storage.setAlarm(Date.now() + 1);
    if (action === '/file') {
      if (job?.state !== 'ready') return error('EXPORT_ARTIFACT_NOT_READY');
      const object = await this.env.EXPORT_FILES.get(job.objectKey);
      if (!object?.body || object.size !== job.size || object.customMetadata?.sha256 !== job.sha256)
        return error('EXPORT_ARTIFACT_UNAVAILABLE', 503);
      // Recheck after the R2 await, immediately before exposing the private stream.
      if (!(await this.authorized(auth))) return error('EXPORT_ACCESS_DENIED', 403);
      return new Response(object.body, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition':
            'attachment; filename="inventario-' + auth.snapshotId.slice(0, 80) + '.xlsx"',
          'Content-Length': String(job.size),
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    // Recheck current exact session after state/storage work as well.
    if (!(await this.authorized(auth))) return error('EXPORT_ACCESS_DENIED', 403);
    return reply(
      job
        ? publicState(job)
        : { snapshotId: auth.snapshotId, state: 'not_started', attempts: 0, retryable: false },
      job?.state === 'queued' ? 202 : 200,
    );
  }
  alarm() {
    return this.exclusive(() => this.run());
  }
  async run() {
    let job = await this.ctx.storage.get('job');
    if (!job || ['ready', 'failed'].includes(job.state)) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    const exhausted = job.attempts >= MAX_ATTEMPTS;
    if (exhausted && !job.sha256) {
      job = {
        ...job,
        state: 'failed',
        code: 'EXPORT_ATTEMPTS_EXHAUSTED',
        retryable: true,
        failedAt: Date.now(),
      };
      await this.ctx.storage.put('job', job);
      await this.ctx.storage.deleteAlarm();
      return;
    }
    // A final-attempt crash after a successful put may still verify the recorded
    // candidate. It must never spend another compression/upload attempt.
    job = {
      ...job,
      state: 'generating',
      attempts: job.attempts + Number(!exhausted),
      lastAttemptAt: Date.now(),
      retryable: false,
    };
    await this.ctx.storage.put('job', job);
    // Persist the watchdog before CPU-heavy work: eviction/termination can resume
    // this attempt without a session secret and without overwriting an artifact.
    await this.ctx.storage.setAlarm(Date.now() + WATCHDOG_MS);
    try {
      if (!(await this.authorized(job, false))) failure('EXPORT_ACCESS_REVOKED');
      const meta = await this.metadata(job.snapshotId);
      if (!meta) failure('EXPORT_SNAPSHOT_NOT_FOUND');
      if (meta.template_id !== excelTemplate.id || meta.template_sha256 !== excelTemplate.sha256)
        failure('TEMPLATE_MISMATCH');
      const source = await this.database()
        .prepare(
          `SELECT group_concat(content,'') payload FROM
    (SELECT content FROM export_snapshot_chunks WHERE snapshot_id=?1 AND EXISTS(SELECT 1 FROM users u WHERE u.id=?2 AND u.revision=?3
     AND u.role='admin' AND u.active=1 AND u.deleted_at IS NULL AND u.must_change=0) ORDER BY part)`,
        )
        .bind(job.snapshotId, job.userId, job.revision)
        .first();
      if (
        typeof source?.payload !== 'string' ||
        !source.payload.length ||
        new TextEncoder().encode(source.payload).length > 1000000
      ) {
        if (!(await this.authorized(job, false))) failure('EXPORT_ACCESS_REVOKED');
        failure('INVALID_EXPORT_SNAPSHOT');
      }
      const payload = source.payload,
        snapshot = JSON.parse(payload),
        snapshotSha256 = await digest(payload);
      if (
        snapshot.id !== job.snapshotId ||
        snapshot.cycle?.id !== meta.cycle_id ||
        snapshot.template?.sha256 !== meta.template_sha256 ||
        snapshot.policy?.id !== meta.policy_id
      )
        failure('EXPORT_SNAPSHOT_MISMATCH');
      if (job.snapshotSha256 && job.snapshotSha256 !== snapshotSha256)
        failure('EXPORT_SNAPSHOT_HASH_MISMATCH');
      const objectKey = 'exports/v1/' + job.snapshotId + '/' + snapshotSha256 + '.xlsx';
      let stored = await this.env.EXPORT_FILES.get(objectKey);
      if (!stored) {
        if (exhausted) failure('EXPORT_ATTEMPTS_EXHAUSTED');
        const template = await this.env.EXPORT_FILES.get('template/' + excelTemplate.sha256);
        if (!template || template.size > 16 * 1024 * 1024) failure('EXPORT_TEMPLATE_UNAVAILABLE');
        const templateBytes = new Uint8Array(await template.arrayBuffer());
        if (!(await this.authorized(job, false))) failure('EXPORT_ACCESS_REVOKED');
        const generated = await generateSnapshotExcel({
          snapshot,
          payload,
          sha256: snapshotSha256,
          templateBytes,
        });
        job = {
          ...job,
          objectKey,
          snapshotSha256,
          sha256: generated.sha256,
          size: generated.bytes.length,
        };
        await this.ctx.storage.put('job', job);
        if (!(await this.authorized(job, false))) failure('EXPORT_ACCESS_REVOKED');
        await this.env.EXPORT_FILES.put(objectKey, generated.bytes, {
          onlyIf: new Headers({ 'If-None-Match': '*' }),
          httpMetadata: {
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
          customMetadata: {
            snapshotId: job.snapshotId,
            snapshotSha256,
            templateSha256: excelTemplate.sha256,
            sha256: generated.sha256,
            policyId: meta.policy_id,
          },
        });
        stored = await this.env.EXPORT_FILES.get(objectKey);
      }
      // A ready state is published only after reading and hashing the stored bytes.
      // Persisting the candidate fingerprint before put makes a crashed put recoverable.
      if (
        !job.sha256 ||
        !stored ||
        stored.size !== job.size ||
        stored.customMetadata?.snapshotSha256 !== snapshotSha256 ||
        stored.customMetadata?.templateSha256 !== excelTemplate.sha256 ||
        stored.customMetadata?.sha256 !== job.sha256 ||
        (await sha(await stored.arrayBuffer())) !== job.sha256
      )
        failure('EXPORT_ARTIFACT_INTEGRITY');
      job = { ...job, state: 'ready', createdAt: new Date().toISOString() };
      delete job.code;
      await this.ctx.storage.put('job', job);
      await this.ctx.storage.deleteAlarm();
    } catch (e) {
      const permanent = [
        'EXPORT_SNAPSHOT_NOT_FOUND',
        'TEMPLATE_MISMATCH',
        'EXPORT_DATA_UNRESOLVED',
        'INVALID_EXPORT_SNAPSHOT',
        'EXPORT_SNAPSHOT_MISMATCH',
        'EXPORT_SNAPSHOT_HASH_MISMATCH',
        'EXPORT_ARTIFACT_INTEGRITY',
        'TEMPLATE_CHANGED',
      ].includes(e.code || e.message);
      const revoked = e.code === 'EXPORT_ACCESS_REVOKED',
        terminal = permanent || revoked || job.attempts >= MAX_ATTEMPTS;
      const code = permanent || revoked ? e.code || e.message : 'EXPORT_GENERATION_FAILED';
      job = {
        ...job,
        state: terminal ? 'failed' : 'queued',
        code,
        retryable: terminal && !permanent,
        ...(terminal ? { failedAt: Date.now() } : {}),
      };
      await this.ctx.storage.put('job', job);
      if (job.state === 'queued')
        await this.ctx.storage.setAlarm(Date.now() + RETRY_MS * job.attempts);
      else await this.ctx.storage.deleteAlarm();
    }
  }
}
// Never attach a public route, workers.dev address, or R2 public domain.
export default {
  fetch() {
    return new Response('Not found', { status: 404 });
  },
  scheduled(_event, env, ctx) {
    ctx.waitUntil(
      env.DB.batch(
        cleanupSQL
          .split(';')
          .map((sql) => sql.trim())
          .filter(Boolean)
          .map((sql) => env.DB.prepare(sql)),
      ),
    );
  },
};
