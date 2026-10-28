import { mkdirSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
const cwd = resolve('.wrangler/pages-runtime');
mkdirSync(cwd, { recursive: true });
const publicDir = resolve(cwd, 'public');
rmSync(publicDir, { recursive: true, force: true });
cpSync(resolve('dist'), publicDir, { recursive: true });
const secure = process.argv.includes('--https');
const testing = process.argv.includes('--test'),
  port = testing ? 8791 : 8788;
const origin = `${secure ? 'https' : 'http'}://127.0.0.1:${port}`;
writeFileSync(
  resolve(cwd, 'wrangler.jsonc'),
  JSON.stringify(
    {
      name: 'inventory-v3-pages-local',
      pages_build_output_dir: publicDir,
      compatibility_date: '2026-10-01',
      vars: {
        APP_ENV: secure ? 'production' : 'local',
        APP_ORIGIN: origin,
        ACTIVE_CYCLE_ID: 'prueba-compartida',
      },
      d1_databases: [
        {
          binding: 'DB',
          database_name: 'inventory-v3-local',
          database_id: '00000000-0000-0000-0000-000000000001',
        },
      ],
    },
    null,
    2,
  ),
);
const args = [
  'pages',
  'dev',
  '--port',
  String(port),
  '--ip',
  '127.0.0.1',
  '--inspector-port',
  '9231',
  '--persist-to',
  resolve(testing ? '.wrangler/pages-test-state' : '.wrangler/state'),
  '--d1',
  'DB=00000000-0000-0000-0000-000000000001',
  '--binding',
  `APP_ENV=${secure ? 'production' : 'local'}`,
  '--binding',
  `APP_ORIGIN=${origin}`,
  '--binding',
  'ACTIVE_CYCLE_ID=prueba-compartida',
  ...(secure ? ['--local-protocol', 'https'] : []),
];
const child = spawn(resolve('node_modules/.bin/wrangler'), args, {
  stdio: 'inherit',
  cwd,
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => (process.exitCode = code || 0));
