// Small ZIP32 reader/writer for the hash-pinned Excel template. No XLSX roundtrip.
const decoder = new TextDecoder('utf-8', { fatal: true });
const MAX_PART = 8 * 1024 * 1024;
const table = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let bit = 0; bit < 8; bit++) n = (n >>> 1) ^ ((n & 1) ? 0xedb88320 : 0);
  return n >>> 0;
});
const fail = () => { throw new Error('INVALID_TEMPLATE_ZIP'); };
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ table[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}
function view(bytes) { return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
function same(a, b) { return a.length === b.length && a.every((byte, i) => byte === b[i]); }
function extraValid(bytes) {
  const data = view(bytes);
  for (let at = 0; at < bytes.length;) {
    if (at + 4 > bytes.length) fail();
    const id = data.getUint16(at, true), size = data.getUint16(at + 2, true);
    if (id === 1 || at + 4 + size > bytes.length) fail(); // ZIP64 is unsupported.
    at += 4 + size;
  }
}
async function transform(bytes, compression) {
  const stream = compression ? new CompressionStream('deflate-raw') : new DecompressionStream('deflate-raw');
  const output = new Blob([bytes]).stream().pipeThrough(stream);
  const reader = output.getReader(), pieces = [];
  let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.length;
      if (size > MAX_PART) { await reader.cancel(); fail(); }
      pieces.push(next.value);
    }
  } catch { fail(); }
  return join(pieces, size);
}
function join(pieces, size = pieces.reduce((n, part) => n + part.length, 0)) {
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const part of pieces) { bytes.set(part, at); at += part.length; }
  return bytes;
}
export function readZip(bytes) {
  const data = view(bytes);
  // The approved file has no archive comment, preamble or data descriptors.
  const end = bytes.length - 22;
  if (end < 0 || data.getUint32(end, true) !== 0x06054b50 || data.getUint16(end + 20, true)) fail();
  const count = data.getUint16(end + 10, true);
  const centralSize = data.getUint32(end + 12, true), centralAt = data.getUint32(end + 16, true);
  if (data.getUint16(end + 4, true) || data.getUint16(end + 6, true)
      || count === 0xffff || count !== data.getUint16(end + 8, true)
      || centralAt + centralSize !== end) fail();
  const entries = [], names = new Set();
  let at = centralAt, localAt = 0;
  for (let index = 0; index < count; index++) {
    if (at + 46 > end || data.getUint32(at, true) !== 0x02014b50) fail();
    const flags = data.getUint16(at + 8, true), method = data.getUint16(at + 10, true);
    const crc = data.getUint32(at + 16, true), compressedSize = data.getUint32(at + 20, true);
    const size = data.getUint32(at + 24, true), nameSize = data.getUint16(at + 28, true);
    const extraSize = data.getUint16(at + 30, true), commentSize = data.getUint16(at + 32, true);
    const offset = data.getUint32(at + 42, true), next = at + 46 + nameSize + extraSize + commentSize;
    if (flags !== 6 || method !== 8 || size > MAX_PART || compressedSize === 0xffffffff
        || data.getUint16(at + 34, true) || offset !== localAt || next > end) fail();
    const nameBytes = bytes.subarray(at + 46, at + 46 + nameSize);
    const name = decoder.decode(nameBytes);
    if (names.has(name) || !name || name.startsWith('/') || name.split('/').includes('..')) fail();
    names.add(name);
    extraValid(bytes.subarray(at + 46 + nameSize, at + 46 + nameSize + extraSize));
    if (offset + 30 > centralAt || data.getUint32(offset, true) !== 0x04034b50) fail();
    const localNameSize = data.getUint16(offset + 26, true), localExtraSize = data.getUint16(offset + 28, true);
    const contentAt = offset + 30 + localNameSize + localExtraSize, contentEnd = contentAt + compressedSize;
    if (contentEnd > centralAt || localNameSize !== nameSize
        || !same(bytes.subarray(offset + 4, offset + 26), bytes.subarray(at + 6, at + 28))
        || !same(nameBytes, bytes.subarray(offset + 30, offset + 30 + localNameSize))) fail();
    extraValid(bytes.subarray(offset + 30 + localNameSize, contentAt));
    entries.push({ name, crc, size, compressed: bytes.subarray(contentAt, contentEnd),
      local: bytes.subarray(offset, contentAt), central: bytes.subarray(at, next) });
    localAt = contentEnd;
    at = next;
  }
  if (at !== end || localAt !== centralAt) fail();
  return { entries, end: bytes.subarray(end) };
}
export async function inflateEntry(entry) {
  const bytes = await transform(entry.compressed, false);
  if (bytes.length !== entry.size || crc32(bytes) !== entry.crc) fail();
  return bytes;
}
export async function writeZip(zip, replacements) {
  const locals = [], centrals = [];
  let offset = 0, centralSize = 0;
  for (const entry of zip.entries) {
    const replacement = replacements.get(entry.name);
    const central = entry.central.slice();
    let local = entry.local, compressed = entry.compressed;
    if (replacement) {
      compressed = await transform(replacement, true);
      local = local.slice();
      const crc = crc32(replacement);
      for (const [bytes, crcAt, sizeAt] of [[local, 14, 18], [central, 16, 20]]) {
        const data = view(bytes);
        data.setUint32(crcAt, crc, true);
        data.setUint32(sizeAt, compressed.length, true);
        data.setUint32(sizeAt + 4, replacement.length, true);
      }
    }
    view(central).setUint32(42, offset, true);
    locals.push(local, compressed);
    centrals.push(central);
    offset += local.length + compressed.length;
    centralSize += central.length;
  }
  const end = zip.end.slice(), data = view(end);
  data.setUint32(12, centralSize, true);
  data.setUint32(16, offset, true);
  return join([...locals, ...centrals, end]);
}
