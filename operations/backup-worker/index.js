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
const sha = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2,'0')).join('');
export async function encryptionKey(value) {
  const bytes = Uint8Array.from(atob(value || ''), c => c.charCodeAt(0));
  if (bytes.length !== 32) throw Error('Backup key must contain 32 bytes');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt','decrypt']);
}
export async function sealBackup(sql, key, createdAt = new Date().toISOString()) {
  const bytes = encoder.encode(sql);
  if (!bytes.length || bytes.length > MAX_SQL_BYTES) throw Error('Backup size invalid');
  const manifest = {format:1, createdAt, source:'remote', bytes:bytes.length, sha256:await sha(bytes)};
  const plain = encoder.encode(JSON.stringify({manifest, sql}));
  const compressed = await new Response(new Blob([plain]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode('inventory-backup-v1')},key,compressed));
  const output = new Uint8Array(16+cipher.length);
  output.set(encoder.encode('IBK1')); output.set(iv,4); output.set(cipher,16);
  return {output, manifest, sha256:await sha(output)};
}
async function exportSQL(env) {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${env.D1_DATABASE_ID}/export`;
  let bookmark;
  for (let attempt = 0; attempt < 25; attempt++) {
    const response = await fetch(endpoint, {method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${env.CF_BACKUP_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({output_format:'polling',...(bookmark ? {current_bookmark:bookmark} : {})})});
    if (!response.ok) throw Error('D1 export request failed');
    const body = await response.json();
    if (!body.success || !body.result) throw Error('D1 export failed');
    const result = body.result;
    if (result.success === false) throw Error('D1 export failed');
    if (result.status === 'complete' && result.result?.signed_url) {
      const url = new URL(result.result.signed_url);
      if (url.protocol !== 'https:') throw Error('Invalid export URL');
      const download = await fetch(url,{signal:AbortSignal.timeout(15000)});
      if (!download.ok) throw Error('D1 download failed');
      const declaredSize = Number(download.headers.get('content-length'));
      if (declaredSize > MAX_SQL_BYTES) throw Error('Backup exceeds memory budget');
      // Bound streamed bytes as content-length may be absent or incorrect.
      const reader = download.body.getReader();
      const chunks = []; let size = 0;
      while (true) {
        const {done,value} = await reader.read(); if (done) break;
        size += value.length;
        if (size > MAX_SQL_BYTES) { await reader.cancel(); throw Error('Backup exceeds memory budget'); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
      return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    }
    if (result.status === 'error') throw Error('D1 export failed');
    bookmark = result.at_bookmark || bookmark;
    if (!bookmark) throw Error('D1 export polling checkpoint missing');
    await new Promise(resolve => setTimeout(resolve,2000));
  }
  throw Error('D1 export did not finish; next daily check retries');
}
export async function runBackup(env, now = Date.now()) {
  if (env.BACKUP_ENABLED !== '1') return {status:'disabled'};
  if (!/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID || '') || !/^[a-f0-9-]{36}$/i.test(env.D1_DATABASE_ID || '') || !env.CF_BACKUP_TOKEN) throw Error('Backup configuration incomplete');
  const key = await encryptionKey(env.BACKUP_ENCRYPTION_KEY);
  // R2 conditional writes serialize overlapping cron deliveries. A crashed run
  // leaves a 30-minute lease; a daily retry can acquire it without deleting data.
  const lockKey = 'inventory/backup-lease.json';
  const previous = await env.BACKUPS.get(lockKey);
  if (previous && (await previous.json()).expires > now) return {status:'already-running'};
  const owner = crypto.randomUUID();
  const lease = await env.BACKUPS.put(lockKey,JSON.stringify({owner,expires:now+30*60000}),{
    onlyIf: previous ? {etagMatches:previous.etag} : new Headers({'If-None-Match':'*'}),
    httpMetadata:{contentType:'application/json'}
  });
  if (!lease) return {status:'already-running'};
  try {
    const last = await env.BACKUPS.get('inventory/last-success.json');
    if (!isDue(last ? await last.json() : null, now)) return {status:'not-due'};
    const createdAt = new Date(now).toISOString();
    const sealed = await sealBackup(await exportSQL(env),key,createdAt);
    const objectKey = `inventory/${createdAt.replaceAll(':','-')}-${crypto.randomUUID()}.ibk`;
    // Never overwrite an earlier snapshot or prune data. Failed runs leave the
    // checkpoint untouched, so tomorrow retries. R2 storage must stay private.
    await env.BACKUPS.put(objectKey,sealed.output,{httpMetadata:{contentType:'application/octet-stream'},customMetadata:{sha256:sealed.sha256}});
    const stored = await env.BACKUPS.get(objectKey);
    if (!stored || await sha(await stored.arrayBuffer()) !== sealed.sha256) throw Error('Backup verification failed');
    await env.BACKUPS.put('inventory/last-success.json',JSON.stringify({format:1,createdAt,objectKey,bytes:sealed.output.length,sha256:sealed.sha256}),{httpMetadata:{contentType:'application/json'}});
    return {status:'completed'};
  } finally {
    // The runtime is bounded below the lease duration. Check ownership anyway;
    // never release a lease belonging to another invocation.
    const current = await env.BACKUPS.get(lockKey);
    if (current && (await current.json()).owner === owner) await env.BACKUPS.delete(lockKey);
  }
}
export default {
  fetch() { return new Response('Not found',{status:404}); },
  scheduled(_event,env,ctx) {
    ctx.waitUntil(runBackup(env).then(result => console.log(JSON.stringify({type:'backup',status:result.status}))).catch(() => {
      console.error(JSON.stringify({type:'backup',status:'failed',action:'check-private-backup-configuration'}));
      throw Error('Private backup failed');
    }));
  }
};
