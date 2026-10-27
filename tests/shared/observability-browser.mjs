import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { APP_VERSION } from '../../dist/shared/telemetry-config.js';

const reports = [];
const server = createServer(async (req, res) => {
  if (req.url === '/api/telemetry') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    reports.push({ body: JSON.parse(raw), headers: req.headers });
    res.writeHead(204).end();
    return;
  }
  if (req.url.startsWith('/shared/')) {
    try {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(await readFile('dist' + req.url));
    } catch { res.writeHead(404).end(); }
    return;
  }
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Set-Cookie', 'private-session=never-send; SameSite=Strict');
  res.end(`<h1>Test mobile</h1><button>Probar</button><script type="module">
    import { startClientTelemetry } from '/shared/telemetry-client.js';
    startClientTelemetry();
    // Test-only observers verify that Chromium produced real entries.
    window.measured = { shifts: [], interactions: [] };
    new PerformanceObserver(list => measured.shifts.push(...list.getEntries()
      .filter(entry => !entry.hadRecentInput && entry.value > 0)))
      .observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver(list => measured.interactions.push(...list.getEntries()
      .filter(entry => entry.interactionId && entry.duration >= 100)))
      .observe({ type: 'event', buffered: true, durationThreshold: 40 });
    document.querySelector('button').onclick = () => {
      const end = performance.now() + 120;
      while (performance.now() < end) {}
    };
    window.ready = true;
  </script>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`http://127.0.0.1:${server.address().port}/?inventory=private-secret`);
  await page.waitForFunction(() => window.ready);
  await page.waitForTimeout(400);
  // Shift content independently of recent input so CLS must include it.
  await page.evaluate(() => { document.querySelector('h1').style.marginTop = '100px'; });
  await page.waitForFunction(() => window.measured.shifts.length > 0);
  await page.click('button');
  await page.waitForFunction(() => window.measured.interactions.length > 0);
  await page.evaluate(() => window.dispatchEvent(new ErrorEvent('error', { error: new TypeError('private-secret') })));
  await page.goto('about:blank');
  for (let n = 0; n < 20 && !reports.length; n++) await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(reports.length, 1);
  const report = reports[0];
  assert.equal(report.headers.cookie, undefined);
  assert.equal(report.headers.referer, undefined);
  assert.equal(report.body.version, APP_VERSION);
  assert.equal(report.body.device, 'mobile');
  assert.ok(report.body.vitals.some(v => v.name === 'LCP' && v.value > 0));
  assert.ok(report.body.vitals.some(v => v.name === 'INP' && v.value >= 100));
  assert.ok(report.body.vitals.some(v => v.name === 'CLS' && v.value > 0));
  assert.ok(report.body.errors.some(e => e.code === 'TypeError'));
  assert.ok(!JSON.stringify(report).includes('private-secret'));
  console.log('PASS real Chromium: LCP + deliberate INP/CLS + normalized error + build version; no cookie/referrer/content; one report.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
