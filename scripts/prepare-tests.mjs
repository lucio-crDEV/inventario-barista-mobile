import { execFileSync } from 'node:child_process';
import { rmSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
// Only these disposable fixture directories are reset; never dev or remote D1.
const states = process.argv.includes('--pages-only')
  ? ['.wrangler/pages-test-state']
  : ['.wrangler/test-state', '.wrangler/pages-test-state'];
const run = (args) =>
  execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', ...args], {
    stdio: 'pipe',
  });
const file = '.wrangler/test-fixtures.bootstrap.sql';
try {
  mkdirSync('.wrangler', { recursive: true });
  writeFileSync(file, execFileSync(process.execPath, ['scripts/bootstrap.mjs', '--fixtures']), {
    mode: 0o600,
  });
  for (const state of states) {
    rmSync(state, { recursive: true, force: true });
    mkdirSync(state, { recursive: true });
    run(['d1', 'migrations', 'apply', 'DB', '--local', '--env', 'local', '--persist-to', state]);
    run([
      'd1',
      'execute',
      'DB',
      '--local',
      '--env',
      'local',
      '--persist-to',
      state,
      '--file',
      file,
    ]);
    console.log(`${state}: migraciones y usuarios ficticios preparados.`);
  }
} finally {
  try {
    unlinkSync(file);
  } catch {}
}
