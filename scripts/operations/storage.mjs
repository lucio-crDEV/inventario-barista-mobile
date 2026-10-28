import {
  mkdtempSync,
  mkdirSync,
  symlinkSync,
  writeFileSync,
  rmSync,
  readFileSync,
  statSync,
  existsSync,
  realpathSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, basename, relative, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const cli = resolve('node_modules/wrangler/bin/wrangler.js');
export const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
// Wrangler export has no --persist-to; a private temporary configuration selects
// the same local state through a directory link. Every invocation remains --local.
export function localDatabase(state) {
  if (!statSync(resolve(state)).isDirectory())
    throw Error('No existe una carpeta de estado local válida.');
  const directory = mkdtempSync(join(tmpdir(), 'inventory-operations-'));
  mkdirSync(join(directory, '.wrangler'));
  symlinkSync(resolve(state), join(directory, '.wrangler/state'), 'dir');
  const config = join(directory, 'wrangler.jsonc');
  writeFileSync(
    config,
    JSON.stringify({
      name: 'inventory-operations-local',
      compatibility_date: '2026-10-01',
      d1_databases: [
        {
          binding: 'DB',
          database_name: 'inventory-v3-local',
          database_id: '00000000-0000-0000-0000-000000000001',
          migrations_dir: resolve('migrations'),
        },
      ],
    }),
  );
  return {
    args: ['--local', '--config', config],
    close: () => rmSync(directory, { recursive: true, force: true }),
  };
}
export function wrangler(args) {
  try {
    return execFileSync(process.execPath, [cli, 'd1', ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    throw Error(
      'Wrangler no completó la operación. No se certifica este respaldo/restauración; revisa la configuración y el entorno seleccionado.',
    );
  }
}
export function verifiedBackup(directory) {
  const sql = join(resolve(directory), 'database.sql'),
    manifest = join(resolve(directory), 'manifest.json');
  const info = JSON.parse(readFileSync(manifest, 'utf8')),
    bytes = readFileSync(sql);
  if (
    info.format !== 1 ||
    info.sha256 !== digest(bytes) ||
    info.bytes !== bytes.length ||
    bytes.length === 0
  )
    throw Error('Respaldo incompleto o alterado: no se restauró nada.');
  if ((statSync(sql).mode & 0o077) !== 0)
    throw Error('El SQL debe ser privado (chmod 600) antes de restaurarlo.');
  return { sql, info };
}

// In-repository outputs are confined to ignored private folders, even through
// existing directory links. Public assets, sources and tracked docs are refused.
export function privateDestination(path, folder) {
  const destination = resolve(path),
    parts = [];
  let ancestor = destination;
  while (!existsSync(ancestor)) {
    parts.unshift(basename(ancestor));
    ancestor = dirname(ancestor);
  }
  const canonical = join(realpathSync(ancestor), ...parts);
  const root = realpathSync(resolve('.'));
  const inside = relative(root, canonical);
  if (
    inside === '' ||
    (!inside.startsWith('..' + sep) && inside !== '..' && !inside.startsWith(sep))
  ) {
    if (inside !== folder && !inside.startsWith(folder + sep))
      throw Error(
        `Dentro del repositorio usa únicamente ${folder}/; no se escriben archivos en rutas públicas o versionadas.`,
      );
  }
  return destination;
}
