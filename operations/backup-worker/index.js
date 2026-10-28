// Separate operator-deployed Worker; never part of the public inventory bundle.
// Secrets: CF_BACKUP_TOKEN (D1 Edit on this account), BACKUP_ENCRYPTION_KEY
// (32 random bytes encoded as base64, retained separately from Cloudflare).
const encoder = new TextEncoder();
const MAX_SQL_BYTES = 8 * 1024 * 1024;
export const INTERVAL_MS = 90 * 86400000;
export function isDue(last, now = Date.now()) {
  if (!last) return true;
  const time = Date.parse(last.createdAt);
  if (!Number.isFinite(time) || time > now) throw Error('Invalid backup checkpoint');
  return now - time >= INTERVAL_MS;
}
const sha = async (bytes) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
export async function encryptionKey(value) {
  const bytes = Uint8Array.from(atob(value || ''), (c) => c.charCodeAt(0));
  if (bytes.length !== 32) throw Error('Backup key must contain 32 bytes');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function sealBackup(sql, key, createdAt = new Date().toISOString()) {
  const bytes = encoder.encode(sql);
  if (!bytes.length || bytes.length > MAX_SQL_BYTES) throw Error('Backup size invalid');
  const manifest = {
    format: 1,
    createdAt,
    source: 'remote',
    bytes: bytes.length,
    sha256: await sha(bytes),
  };
  const plain = encoder.encode(JSON.stringify({ manifest, sql }));
  const compressed = await new Response(
    new Blob([plain]).stream().pipeThrough(new CompressionStream('gzip')),
  ).arrayBuffer();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: encoder.encode('inventory-backup-v1') },
      key,
      compressed,
    ),
  );
  const output = new Uint8Array(16 + cipher.length);
  output.set(encoder.encode('IBK1'));
  output.set(iv, 4);
  output.set(cipher, 16);
  return { output, manifest, sha256: await sha(output) };
}
async function exportSQL(env) {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${env.D1_DATABASE_ID}/export`;
  let bookmark;
  // At most ten export requests: with 26 multipart parts and fixed storage
  // operations, a worst-case 128 MiB run remains under 50 subrequests.
  for (let attempt = 0; attempt < 10; attempt++) {
    const response = await fetch(endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${env.CF_BACKUP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        output_format: 'polling',
        ...(bookmark ? { current_bookmark: bookmark } : {}),
      }),
    });
    if (!response.ok) throw Error('D1 export request failed');
    const body = await response.json();
    if (!body.success || !body.result) throw Error('D1 export failed');
    const result = body.result;
    if (result.success === false) throw Error('D1 export failed');
    if (result.status === 'complete' && result.result?.signed_url) {
      const url = new URL(result.result.signed_url);
      if (url.protocol !== 'https:') throw Error('Invalid export URL');
      const download = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (!download.ok) throw Error('D1 download failed');
      const declaredSize = Number(download.headers.get('content-length'));
      if (declaredSize > MAX_STREAM_SQL_BYTES) {
        await download.body?.cancel();
        throw Error('Backup exceeds bounded export budget');
      }
      return download.body;
    }
    if (result.status === 'error') throw Error('D1 export failed');
    bookmark = result.at_bookmark || bookmark;
    if (!bookmark) throw Error('D1 export polling checkpoint missing');
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw Error('D1 export did not finish; next daily check retries');
}
export async function runBackup(env, now = Date.now()) {
  if (env.BACKUP_ENABLED !== '1') return { status: 'disabled' };
  if (
    !/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID || '') ||
    !/^[a-f0-9-]{36}$/i.test(env.D1_DATABASE_ID || '') ||
    !env.CF_BACKUP_TOKEN
  )
    throw Error('Backup configuration incomplete');
  // An ordinary daily check costs one read and no writes or lock operations.
  const checkpoint = await env.BACKUPS.get('inventory/last-success.json');
  if (!isDue(checkpoint ? await checkpoint.json() : null, now)) return { status: 'not-due' };
  const key = await encryptionKey(env.BACKUP_ENCRYPTION_KEY);
  // R2 conditional writes serialize overlapping cron deliveries. A crashed run
  // leaves a 30-minute lease; a daily retry can acquire it without deleting data.
  const lockKey = 'inventory/backup-lease.json';
  const previous = await env.BACKUPS.get(lockKey);
  if (previous && (await previous.json()).expires > now) return { status: 'already-running' };
  const startedAt = Date.now();
  const owner = crypto.randomUUID();
  const lease = await env.BACKUPS.put(
    lockKey,
    JSON.stringify({ owner, expires: now + 30 * 60000 }),
    {
      onlyIf: previous ? { etagMatches: previous.etag } : new Headers({ 'If-None-Match': '*' }),
      httpMetadata: { contentType: 'application/json' },
    },
  );
  if (!lease) return { status: 'already-running' };
  try {
    const last = await env.BACKUPS.get('inventory/last-success.json');
    if (!isDue(last ? await last.json() : null, now)) return { status: 'not-due' };
    const createdAt = new Date(now).toISOString();
    const objectKey = `inventory/${createdAt.replaceAll(':', '-')}-${crypto.randomUUID()}.ibk`;
    // Never overwrite an earlier snapshot or prune data. Failed runs leave the
    // checkpoint untouched, so tomorrow retries. R2 storage must stay private.
    const sealed = await uploadBackup(env.BACKUPS, objectKey, await exportSQL(env), key, createdAt);
    const stored = await env.BACKUPS.get(objectKey);
    if (!stored?.body || (await streamFingerprint(stored.body)).digest !== sealed.digest)
      throw Error('Backup verification failed');
    // A run exceeding its lease must never advance the checkpoint.
    const held = await env.BACKUPS.get(lockKey);
    if (!held || (await held.json()).owner !== owner || Date.now() - startedAt >= 20 * 60000)
      throw Error('Backup lease expired');
    await env.BACKUPS.put(
      'inventory/last-success.json',
      JSON.stringify({
        format: 2,
        createdAt,
        objectKey,
        bytes: sealed.bytes,
        integrity: 'sha256-chain-64k-v1',
        digest: sealed.digest,
      }),
      { httpMetadata: { contentType: 'application/json' } },
    );
    return { status: 'completed' };
  } finally {
    // The runtime is bounded below the lease duration. Check ownership anyway;
    // never release a lease belonging to another invocation.
    const current = await env.BACKUPS.get(lockKey);
    if (Date.now() - startedAt < 20 * 60000 && current && (await current.json()).owner === owner)
      await env.BACKUPS.delete(lockKey);
  }
}
// A Cron delivery on Workers Free has a much smaller CPU budget than a
// SQLite-backed Durable Object. Only the private object performs gzip/crypto;
// a missing binding must not fall back to doing the job in the Cron invocation.
export async function dispatchBackup(env) {
  if (env.BACKUP_ENABLED !== '1') return { status: 'disabled' };
  if (!env.BACKUP_JOBS?.idFromName || !env.BACKUP_JOBS?.get)
    throw Error('Private backup job binding missing');
  const job = env.BACKUP_JOBS.get(env.BACKUP_JOBS.idFromName('inventory-private-backup'));
  const response = await job.fetch('https://backup.internal/run', { method: 'POST' });
  if (!response.ok) throw Error('Private backup job failed');
  return response.json();
}
export class BackupJob {
  constructor(_state, env) {
    this.env = env;
  }
  async fetch(request) {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/run')
      return new Response('Not found', { status: 404 });
    try {
      return Response.json(await runBackup(this.env));
    } catch {
      console.error(
        JSON.stringify({
          type: 'backup-job',
          status: 'failed',
          action: 'check-private-backup-configuration',
        }),
      );
      return Response.json({ status: 'failed' }, { status: 500 });
    }
  }
}
export default {
  fetch() {
    return new Response('Not found', { status: 404 });
  },
  scheduled(_event, env, ctx) {
    ctx.waitUntil(
      dispatchBackup(env)
        .then((result) => console.log(JSON.stringify({ type: 'backup', status: result.status })))
        .catch(() => {
          console.error(
            JSON.stringify({
              type: 'backup',
              status: 'failed',
              action: env.BACKUP_JOBS
                ? 'check-private-backup-configuration'
                : 'configure-private-backup-job-binding',
            }),
          );
          throw Error(
            env.BACKUP_JOBS ? 'Private backup failed' : 'Private backup job binding missing',
          );
        }),
    );
  },
};

// IBK2: 12-byte header (magic + random nonce prefix), then authenticated records.
// Each record: type byte, ciphertext length u32 BE, AES-GCM ciphertext/tag.
// The implicit record index and type are authenticated with the header. The final
// record is mandatory, authenticates the manifest and rules out silent truncation.
export const STREAM_CHUNK_BYTES = 64 * 1024;
export const MULTIPART_BYTES = 5 * 1024 * 1024;
export const MAX_STREAM_SQL_BYTES = 128 * 1024 * 1024;
const MAX_OBJECT_BYTES = MAX_STREAM_SQL_BYTES + 1024 * 1024;
async function* blocks(stream, length = STREAM_CHUNK_BYTES) {
  const reader = stream.getReader();
  let buffer = new Uint8Array(length),
    used = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (let offset = 0; offset < value.length;) {
        const take = Math.min(length - used, value.length - offset);
        buffer.set(value.subarray(offset, offset + take), used);
        offset += take;
        used += take;
        if (used === length) {
          yield buffer;
          buffer = new Uint8Array(length);
          used = 0;
        }
      }
    }
    if (used) yield buffer.subarray(0, used);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
function readable(iterator) {
  return new ReadableStream({
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });
}
function fingerprint() {
  let chain = new Uint8Array(32),
    bytes = 0;
  return {
    async add(block) {
      bytes += block.length;
      if (bytes > MAX_OBJECT_BYTES) throw Error('Backup object budget exceeded');
      const input = new Uint8Array(32 + block.length);
      input.set(chain);
      input.set(block, 32);
      chain = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
    },
    result() {
      return { bytes, digest: [...chain].map((v) => v.toString(16).padStart(2, '0')).join('') };
    },
  };
}
export async function streamFingerprint(stream) {
  const state = fingerprint();
  for await (const block of blocks(stream)) await state.add(block);
  return state.result();
}
export function sealBackupStream(sqlStream, key, createdAt = new Date().toISOString()) {
  let sqlBytes = 0;
  const counted = sqlStream.pipeThrough(
    new TransformStream({
      transform(value, controller) {
        sqlBytes += value.length;
        if (sqlBytes > MAX_STREAM_SQL_BYTES) throw Error('Backup exceeds bounded export budget');
        controller.enqueue(value);
      },
    }),
  );
  const compressed = counted.pipeThrough(new CompressionStream('gzip'));
  return readable(
    (async function* () {
      const header = new Uint8Array(12);
      header.set(encoder.encode('IBK2'));
      header.set(crypto.getRandomValues(new Uint8Array(8)), 4);
      yield header;
      let index = 0,
        compressedBytes = 0;
      async function record(type, plain) {
        const iv = new Uint8Array(12);
        iv.set(header.subarray(4));
        new DataView(iv.buffer).setUint32(8, index);
        const aad = new Uint8Array(17);
        aad.set(header);
        aad[12] = type;
        new DataView(aad.buffer).setUint32(13, index++);
        const cipher = new Uint8Array(
          await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, plain),
        );
        const frame = new Uint8Array(5 + cipher.length);
        frame[0] = type;
        new DataView(frame.buffer).setUint32(1, cipher.length);
        frame.set(cipher, 5);
        return frame;
      }
      for await (const block of blocks(compressed)) {
        compressedBytes += block.length;
        yield await record(0, block);
      }
      if (!sqlBytes) throw Error('Empty backup');
      yield await record(
        1,
        encoder.encode(
          JSON.stringify({
            format: 2,
            createdAt,
            source: 'remote',
            bytes: sqlBytes,
            compressedBytes,
            chunks: index,
          }),
        ),
      );
    })(),
  );
}
export async function uploadBackup(bucket, objectKey, sqlStream, key, createdAt) {
  const upload = await bucket.createMultipartUpload(objectKey, {
    httpMetadata: { contentType: 'application/octet-stream' },
  });
  const state = fingerprint(),
    parts = [];
  // The two assemblers retain at most 5 MiB + 64 KiB, independent of SQL size.
  // No tee: awaiting each upload provides backpressure to gzip, AES and download.
  const sealed = sealBackupStream(sqlStream, key, createdAt);
  const checked = readable(
    (async function* () {
      for await (const block of blocks(sealed)) {
        await state.add(block);
        yield block;
      }
    })(),
  );
  try {
    for await (const part of blocks(checked, MULTIPART_BYTES))
      parts.push(await upload.uploadPart(parts.length + 1, part));
    await upload.complete(parts);
    return state.result();
  } catch (error) {
    await upload.abort().catch(() => {});
    throw error;
  }
}

// Private operator use only; no HTTP route or public status object is exposed.
export async function backupHealth(env, now = Date.now()) {
  const object = await env.BACKUPS.get('inventory/last-success.json');
  const last = object ? await object.json() : null;
  const due = isDue(last, now);
  return {
    status: last ? (due ? 'due' : 'current') : 'missing',
    lastSuccess: last?.createdAt || null,
    nextDue: last ? new Date(Date.parse(last.createdAt) + INTERVAL_MS).toISOString() : null,
  };
}
