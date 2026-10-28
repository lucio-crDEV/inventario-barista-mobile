import { parseArgs } from 'node:util';
import {
  readFileSync,
  mkdirSync,
  writeFileSync,
  mkdtempSync,
  renameSync,
  rmSync,
  existsSync,
  statSync,
  createWriteStream,
} from 'node:fs';
import { open } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createDecipheriv, createHash } from 'node:crypto';
import { gunzipSync, createGunzip } from 'node:zlib';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { privateDestination, verifiedBackup } from './operations/storage.mjs';
const MAX_SQL = 128 * 1024 * 1024,
  MAX_FRAME = 65536 + 16;

export async function decryptBackupFile(file, requestedDirectory, secret) {
  const key = Buffer.from(secret || '', 'base64');
  if (key.length !== 32 || statSync(file).size > MAX_SQL + 1024 * 1024)
    throw Error('Clave o tamaño inválido');
  const directory = privateDestination(requestedDirectory, '.backups');
  if (existsSync(directory)) throw Error('La carpeta de destino debe ser nueva');
  const handle = await open(file, 'r');
  let temporary;
  try {
    const exact = async (length) => {
      const value = Buffer.alloc(length);
      let offset = 0;
      while (offset < length) {
        const { bytesRead } = await handle.read(value, offset, length - offset, null);
        if (!bytesRead) throw Error('Respaldo truncado');
        offset += bytesRead;
      }
      return value;
    };
    const magic = await exact(4);
    let manifest, legacySQL;
    if (magic.toString() === 'IBK1') {
      const bytes = readFileSync(file);
      if (bytes.length < 33) throw Error('Formato inválido');
      const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(4, 16));
      decipher.setAAD(Buffer.from('inventory-backup-v1'));
      decipher.setAuthTag(bytes.subarray(-16));
      const payload = JSON.parse(
        gunzipSync(Buffer.concat([decipher.update(bytes.subarray(16, -16)), decipher.final()]), {
          maxOutputLength: MAX_SQL,
        }).toString('utf8'),
      );
      manifest = payload.manifest;
      legacySQL = payload.sql;
      if (
        typeof legacySQL !== 'string' ||
        manifest?.format !== 1 ||
        manifest.bytes !== Buffer.byteLength(legacySQL) ||
        manifest.sha256 !== createHash('sha256').update(legacySQL).digest('hex')
      )
        throw Error('Integridad inválida');
    } else if (magic.toString() !== 'IBK2') throw Error('Formato inválido');
    mkdirSync(dirname(directory), { recursive: true, mode: 0o700 });
    temporary = mkdtempSync(join(dirname(directory), '.decrypt-'));
    const sqlFile = join(temporary, 'database.sql');
    if (legacySQL !== undefined) writeFileSync(sqlFile, legacySQL, { flag: 'wx', mode: 0o600 });
    else {
      const header = Buffer.concat([magic, await exact(8)]);
      let index = 0,
        compressedBytes = 0,
        final;
      async function* records() {
        while (true) {
          const frame = await exact(5),
            type = frame[0],
            length = frame.readUInt32BE(1);
          if ((type !== 0 && type !== 1) || length < 16 || length > MAX_FRAME || index > 4096)
            throw Error('Registro inválido');
          const cipher = await exact(length),
            iv = Buffer.alloc(12),
            aad = Buffer.alloc(17);
          header.copy(iv, 0, 4);
          iv.writeUInt32BE(index, 8);
          header.copy(aad);
          aad[12] = type;
          aad.writeUInt32BE(index++, 13);
          const decipher = createDecipheriv('aes-256-gcm', key, iv);
          decipher.setAAD(aad);
          decipher.setAuthTag(cipher.subarray(-16));
          const plain = Buffer.concat([decipher.update(cipher.subarray(0, -16)), decipher.final()]);
          if (type === 1) {
            final = JSON.parse(plain.toString('utf8'));
            if (
              final.format !== 2 ||
              final.chunks !== index - 1 ||
              final.compressedBytes !== compressedBytes ||
              !Number.isSafeInteger(final.bytes) ||
              final.bytes < 1 ||
              final.bytes > MAX_SQL ||
              !Number.isFinite(Date.parse(final.createdAt)) ||
              final.source !== 'remote'
            )
              throw Error('Manifiesto inválido');
            const extra = Buffer.alloc(1);
            if ((await handle.read(extra, 0, 1, null)).bytesRead)
              throw Error('Datos posteriores al manifiesto');
            return;
          }
          compressedBytes += plain.length;
          if (compressedBytes > MAX_SQL + 1024 * 1024) throw Error('Respaldo demasiado grande');
          yield plain;
        }
      }
      let bytes = 0;
      const hash = createHash('sha256');
      await pipeline(
        Readable.from(records()),
        createGunzip(),
        new Transform({
          transform(chunk, _encoding, callback) {
            bytes += chunk.length;
            if (bytes > MAX_SQL) return callback(Error('SQL supera el límite'));
            hash.update(chunk);
            callback(null, chunk);
          },
        }),
        createWriteStream(sqlFile, { flags: 'wx', mode: 0o600 }),
      );
      if (!final || final.bytes !== bytes) throw Error('Respaldo incompleto');
      // The authenticated IBK2 manifest certifies the stream; emit the original
      // local format so existing isolated restore tooling remains compatible.
      manifest = {
        format: 1,
        createdAt: final.createdAt,
        source: final.source,
        bytes,
        sha256: hash.digest('hex'),
        encryptedFormat: 2,
      };
    }
    writeFileSync(join(temporary, 'manifest.json'), JSON.stringify(manifest) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
    if (legacySQL !== undefined) verifiedBackup(temporary);
    renameSync(temporary, directory);
    temporary = undefined;
    return directory;
  } finally {
    await handle.close();
    if (temporary) rmSync(temporary, { recursive: true, force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values: v } = parseArgs({
    options: { file: { type: 'string' }, directory: { type: 'string' } },
  });
  if (!v.file || !v.directory)
    throw Error(
      'Usa --file RESPALDO.ibk --directory NUEVA_CARPETA. Clave en BACKUP_ENCRYPTION_KEY.',
    );
  await decryptBackupFile(v.file, v.directory, process.env.BACKUP_ENCRYPTION_KEY);
  console.log(
    'Respaldo descifrado y checksum verificado. Usa restore:local para ensayar en una base nueva.',
  );
}
