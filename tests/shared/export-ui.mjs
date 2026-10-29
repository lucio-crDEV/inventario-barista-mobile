import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const browser = await chromium.launch({ headless: true });
const out = process.env.EXPORT_UI_OUTPUT;
if (out) await mkdir(out, { recursive: true });
const origin = 'http://127.0.0.1:8877';
const snapshotId = 'synthetic-snapshot-00000001';
const originalCycle = {
  id: 'synthetic-cycle',
  name: 'Inventario de prueba',
  lifecycle: 'active',
  state: 'closed',
  revision: 4,
  completion_revision: 8,
  scopeStates: [],
  type: 'weekly',
  period: '2026-10-28',
};
let tested = 0;
try {
  for (const theme of ['light', 'dark'])
    for (const width of [320, 390, 1024]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        reducedMotion: 'reduce',
        acceptDownloads: true,
      });
      try {
        await context.addInitScript(
          (value) => localStorage.setItem('inventario-theme', value),
          theme,
        );
        const page = await context.newPage(),
          errors = [],
          requests = [];
        page.on('pageerror', (e) => errors.push(e.message));
        let role = 'admin',
          captured = false,
          generated = false,
          polls = 0,
          blocked = false,
          permanent = false,
          moduleFailure = false,
          uncertain = true,
          firstCommand,
          historyPage = 0;
        const cycle = structuredClone(originalCycle);
        const user = () => ({
          id: 'synthetic-admin',
          username: 'admin-prueba',
          name: 'Cuenta de prueba',
          role,
          mustChange: false,
          revision: 1,
        });
        const supervision = () => ({
          user: user(),
          cycle,
          scopes: [],
          groups: [],
          scopeGroups: [],
          updatedAt: '2026-10-28T05:00:00Z',
        });
        await page.route('**/*', async (route) => {
          const request = route.request(),
            url = new URL(request.url()),
            path = url.pathname;
          requests.push(path + url.search);
          let data;
          if (path === '/api/me') data = { user: user() };
          else if (path === '/api/cycles')
            data = {
              user: user(),
              cycles: [cycle, { ...originalCycle, id: 'other-cycle', name: 'Otro inventario' }],
              defaultCycleId: cycle.id,
            };
          else if (path === '/api/admin/supervision/cycles') {
            if (role === 'worker') {
              await route.fulfill({
                status: 403,
                contentType: 'application/json',
                body: JSON.stringify({
                  code: 'SUPERVISOR_REQUIRED',
                  message: 'No tienes acceso a supervisión.',
                }),
              });
              return;
            }
            data = { user: user(), cycles: [cycle] };
          } else if (path === '/api/admin/supervision') data = supervision();
          else if (path === '/api/admin/supervision/authors') data = { authors: [] };
          else if (path === '/api/admin/supervision/items') data = { items: [], nextCursor: null };
          else if (path === '/api/admin/exports') {
            assert.equal(
              url.searchParams.get('cycle'),
              cycle.id,
              'history stays in selected cycle, including pagination',
            );
            if (url.searchParams.has('cursor')) {
              historyPage++;
              data = {
                snapshots: [
                  {
                    id: snapshotId,
                    cycle_id: cycle.id,
                    cycle_name: cycle.name,
                    created_at: '2026-10-27T05:00:00Z',
                  },
                ],
                nextCursor: null,
              };
            } else
              data = {
                snapshots: captured
                  ? [
                      {
                        id: snapshotId,
                        cycle_id: cycle.id,
                        cycle_name: cycle.name,
                        created_at: '2026-10-28T05:00:00Z',
                      },
                    ]
                  : [],
                nextCursor: captured ? 'synthetic-cursor' : null,
              };
          } else if (path === '/api/admin/export-snapshots') {
            const command = JSON.parse(request.postData());
            assert.equal(command.cycleId, cycle.id);
            assert.equal(command.expectedRevision, 4);
            assert.equal(command.expectedCompletionRevision, 8);
            if (firstCommand) assert.deepEqual(command, firstCommand);
            else firstCommand = command;
            captured = true;
            if (uncertain) {
              uncertain = false;
              await route.abort('failed');
              return;
            }
            data = { snapshotId };
          } else if (path.endsWith('/artifact'))
            data = permanent
              ? { snapshotId, state: 'failed', retryable: false }
              : {
                  snapshotId,
                  state: generated ? (++polls > 1 ? 'ready' : 'queued') : 'not_started',
                };
          else if (path.endsWith('/generate')) {
            assert.deepEqual(JSON.parse(request.postData()), {});
            generated = true;
            data = { snapshotId, state: 'queued' };
          } else if (path.endsWith('/file')) {
            await route.fulfill({
              status: 200,
              contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              headers: { 'Content-Disposition': 'attachment; filename="inventario-prueba.xlsx"' },
              body: Buffer.from([80, 75, 3, 4]),
            });
            return;
          } else if (path === `/api/admin/export-snapshots/${snapshotId}`)
            data = {
              snapshotId,
              capturedAt: '2026-10-28T05:00:00Z',
              review: {
                ready: !blocked,
                summary: {
                  numeric: 10,
                  blank: 1141,
                  partial: 1,
                  roundedToZero: 1,
                  blockers: blocked ? 1 : 0,
                },
                blockers: blocked
                  ? [
                      {
                        name: '<img src=x onerror=alert(1)>',
                        code: 'CONVERSION_REQUIRED',
                        sheet: 'cocina',
                        cell: 'C10',
                      },
                    ]
                  : [],
              },
            };
          if (data) {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(data),
            });
            return;
          }
          const file = resolve(
            'dist',
            path === '/' ? 'index.html' : '.' + path + (path.endsWith('/') ? 'index.html' : ''),
          );
          if (!file.startsWith(resolve('dist') + '/')) {
            await route.fulfill({ status: 404, body: '' });
            return;
          }
          try {
            const body = await readFile(file);
            if (
              moduleFailure &&
              extname(file) === '.js' &&
              body.includes('Finaliza el inventario global')
            ) {
              moduleFailure = false;
              await route.abort('failed');
              return;
            }
            await route.fulfill({
              status: 200,
              contentType:
                { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[
                  extname(file)
                ] || 'text/plain',
              body,
            });
          } catch {
            await route.fulfill({ status: 404, body: '' });
          }
        });
        const open = async () => {
          await page.getByRole('button', { name: 'Exportar Excel', exact: true }).click();
          await expect(
            page.getByRole('dialog', { name: 'Exportar Excel', exact: true }),
          ).toBeVisible();
          await expect(
            page.getByRole('button', { name: 'Revisar Excel', exact: true }),
          ).toBeVisible();
        };
        const close = async () => {
          await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
          await expect(page.locator('#export-inventory')).toBeFocused();
        };
        const layout = async () => {
          assert.equal(
            await page.locator('html').evaluate((el) => el.scrollWidth <= innerWidth),
            true,
          );
          const dialog = page.getByRole('dialog', { name: 'Exportar Excel', exact: true });
          assert.equal(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth), true);
          for (const button of await dialog.getByRole('button').all())
            if (await button.isVisible()) {
              const box = await button.boundingBox();
              assert.ok(box.height >= 44, '44px touch target');
            }
        };
        // Profile no longer loads or requests exports, even as administrator.
        await page.goto(origin + '/pages/cuenta/?profile=1');
        await expect(page.getByRole('heading', { name: 'Mi perfil', exact: true })).toBeVisible();
        assert.equal(await page.locator('.export-card').count(), 0);
        assert.equal(
          requests.some((path) => path.startsWith('/api/admin/exports')),
          false,
        );
        await page.goto(origin + '/pages/admin/supervision.html?inventory=' + cycle.id);
        await expect(page.getByRole('tab', { name: 'Áreas', exact: true })).toBeVisible();
        await open();
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
        assert.equal(await page.locator('.export-form select').count(), 0);
        await expect(page.locator('.export-context')).toContainText(
          'Inventario global · todas las áreas',
        );
        await expect(page.locator('dialog h2')).toBeFocused();
        await layout();
        await page.getByRole('button', { name: 'Revisar Excel', exact: true }).click();
        await expect(page.locator('.export-feedback')).toHaveAttribute('data-tone', 'error');
        // Closing preserves the exact uncertain capture command, recovered on reopening.
        await close();
        await open();
        await page.getByRole('button', { name: 'Revisar Excel', exact: true }).click();
        await expect(
          page.getByRole('button', { name: 'Generar Excel', exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText('solo ubicaciones terminadas.', { exact: false }),
        ).toBeVisible();
        await layout();
        if (out && width === 390)
          await page.screenshot({ path: resolve(out, `export-${theme}.png`), fullPage: true });
        await page.getByRole('button', { name: 'Generar Excel', exact: true }).click();
        await expect(
          page.getByRole('button', { name: 'Descargar Excel', exact: true }),
        ).toBeVisible({ timeout: 10000 });
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Descargar Excel', exact: true }).click();
        assert.equal((await download).suggestedFilename(), 'inventario-prueba.xlsx');
        await page.locator('.export-history summary').click();
        await page.getByRole('button', { name: 'Ver más', exact: true }).click();
        assert.equal(historyPage, 1);
        permanent = true;
        await page.locator('[data-snapshot]').first().click();
        await expect(
          page.getByRole('button', { name: 'Generación no disponible', exact: true }),
        ).toBeDisabled();
        permanent = false;
        blocked = true;
        await page.locator('[data-snapshot]').first().click();
        await expect(
          page.getByText('1 producto requiere revisión antes de generar.'),
        ).toBeVisible();
        assert.equal(
          await page.getByRole('button', { name: 'Generar Excel', exact: true }).count(),
          0,
        );
        await page.getByText('Ver productos', { exact: true }).click();
        assert.equal(await page.locator('.export-issues img').count(), 0);
        assert.ok((await page.locator('.export-issues').textContent()).includes('<img'));
        await layout();
        await close();
        // Reopened/in-review/scope-only-closed inventories retain old copies, never capture new ones.
        for (const state of ['open', 'review', 'closed']) {
          cycle.state = state;
          cycle.scopeStates = state === 'closed' ? [{ scope_id: 'servicio', state: 'review' }] : [];
          await page.reload();
          await open();
          await expect(
            page.getByRole('button', { name: 'Revisar Excel', exact: true }),
          ).toBeDisabled();
          await page.locator('.export-history summary').click();
          await expect(page.locator('[data-snapshot]').first()).toBeVisible();
          await close();
        }
        cycle.state = 'closed';
        cycle.scopeStates = [];
        // Scope filters do not narrow the global workbook, and close keeps panel/filter context.
        await page.reload();
        await page.getByRole('tab', { name: 'Productos', exact: true }).click();
        await page.locator('#search').fill('Borrador de filtro');
        await open();
        await close();
        await expect(page.getByRole('tab', { name: 'Productos', exact: true })).toHaveAttribute(
          'aria-selected',
          'true',
        );
        await expect(page.locator('#search')).toHaveValue('Borrador de filtro');
        for (role of ['service_lead', 'worker']) {
          await page.reload();
          await expect(page.locator('#supervision')).toHaveAttribute('aria-busy', 'false');
          assert.equal(await page.locator('#export-inventory').count(), 0);
          assert.equal(await page.locator('.export-card').count(), 0);
        }
        role = 'admin';
        moduleFailure = true;
        await page.reload();
        await page.getByRole('button', { name: 'Exportar Excel', exact: true }).click();
        await expect(page.getByText('No pudimos cargar la exportación.')).toBeVisible();
        // A failed module import is cached for that document: retry reloads safely.
        await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
        await expect(page.getByRole('tab', { name: 'Áreas', exact: true })).toBeVisible();
        await open();
        await close();
        assert.deepEqual(errors, []);
        tested++;
      } finally {
        await context.close();
      }
    }
  console.log(
    JSON.stringify({
      pass: true,
      syntheticUI: true,
      viewports: [320, 390, 1024],
      themes: ['light', 'dark'],
      cases: tested,
      checks: [
        'supervision entry and profile removal',
        'selected global inventory',
        'admin only',
        'uncertain command survives close',
        'review and warnings',
        'progress/download',
        'scoped history/pagination',
        'reopened history',
        'blockers escaped',
        'panel context and focus',
        '44px controls/no overflow',
        'optional module failure',
      ],
      productionCertified: false,
    }),
  );
} finally {
  await browser.close();
}
