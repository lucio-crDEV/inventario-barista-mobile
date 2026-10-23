// Run only against disposable local fixtures. UI commands below exercise real D1.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {Client,database,origin} from './helpers.mjs';
const db = database(); db.exec('DELETE FROM attempts');
const suffix = Date.now(),cycleId = `supervision-browser-${suffix}`,catalog = `ui-${suffix}`;
const source = db.prepare("SELECT ci.* FROM catalog_items ci JOIN cycles cy ON cy.catalog_version=ci.version WHERE cy.id='prueba-compartida'").all();
const chosen = [...source.filter(x => x.location_id === 'servicio:barra' && x.unit).slice(0,2),source.find(x => x.location_id === 'cocina' && x.unit)];
assert.equal(chosen.filter(Boolean).length,3,'Three independent fixture products');
const copy = db.prepare('INSERT INTO catalog_items(version,id,location_id,unit,data) VALUES(?,?,?,?,?)');
const items = chosen.map((row,index) => {const item = {...JSON.parse(row.data),id:`ui-${suffix}-${index}`,locationId:row.location_id,unit:row.unit,active:true}; copy.run(catalog,item.id,item.locationId,item.unit,JSON.stringify(item));return item;});
db.prepare("INSERT INTO cycles(id,name,catalog_version,state) VALUES(?,'Revisión visual compacta',?,'open')").run(cycleId,catalog);
const [first,second] = items;
const admin = new Client();await admin.login('admin-prueba');
const browser = await chromium.launch({headless:true}),errors = [],checks = [];
mkdirSync('test-results/supervision',{recursive:true});
const revision = () => db.prepare('SELECT revision FROM cycles WHERE id=?').get(cycleId).revision;
const version = item => db.prepare('SELECT version FROM counts WHERE cycle_id=? AND item_id=? AND location_id=?').get(cycleId,item.id,item.locationId)?.version || 0;
const command = (kind,item,extra = {}) => ({id:crypto.randomUUID(),cycleId,expectedRevision:revision(),kind,confirm:true,...(item ? {itemId:item.id,locationId:item.locationId,expectedVersion:version(item)} : {}),...extra});
async function contextFor(client) {
  const context = await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await context.addCookies([{name:'inventory_session_local',value:client.cookie.split('=')[1],url:origin}]);
  const page = await context.newPage();page.on('pageerror',error => errors.push(error.message));
  await page.goto(origin+'/pages/admin/supervision.html');
  await expect(page.locator('#cycle')).toBeVisible();await page.locator('#cycle').selectOption(cycleId);
  await expect(page.locator('.supervision-area-row')).toHaveCount(client.user.role === 'admin' ? 2 : 1);
  return {page,context};
}
async function openFirst(page) {
  await page.getByRole('tab',{name:'Productos',exact:true}).click();
  await page.locator('#scope').selectOption('servicio:barra');
  await page.locator('#search').fill(first.name);await page.waitForTimeout(350);
  await expect(page.locator('.supervision-product')).toHaveCount(1);
  if (!(await page.locator('.supervision-product').evaluate(el => el.open))) await page.locator('.supervision-product > summary').click();
}
async function closeReview(page) {
  await page.locator('[data-transition="review"][data-scope="servicio"]').click();
  await expect(page.locator('dialog [name="reason"]')).toHaveCount(0);
  await expect(page.locator('dialog input[type="checkbox"]')).toHaveCount(0);
  await page.locator('dialog [data-confirm]').click();await expect(page.locator('dialog')).toHaveCount(0);
  await expect(page.locator('[data-transition="closed"][data-scope="servicio"]')).toBeVisible();
}
try {
  const {page,context} = await contextFor(admin);
  await expect(page.locator('progress')).toHaveCount(0);await expect(page.locator('#refresh')).toHaveCount(0);
  for(const width of [320,390,1024]) for(const theme of ['light','dark']) {
    await page.setViewportSize({width,height:900});await page.evaluate(t => document.documentElement.dataset.theme=t,theme);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth),`Overflow ${width} ${theme}`);
    await page.screenshot({path:`test-results/supervision/${width}-${theme}.png`});
  }
  checks.push('Áreas compactas con anillo segmentado, 320/390/1024 en ambos temas sin desborde');
  await page.setViewportSize({width:390,height:844});await openFirst(page);
  await page.getByRole('button',{name:'Corregir total',exact:true}).click();
  await expect(page.locator('dialog [name="reason"]')).not.toHaveAttribute('required','');
  await expect(page.getByRole('button',{name:'Cancelar',exact:true})).toBeFocused();
  await page.locator('dialog [name="quantity"]').fill('3');
  await page.locator('dialog [data-confirm]').click();await expect(page.locator('dialog')).toHaveCount(0);
  assert.equal(db.prepare('SELECT q FROM counts WHERE cycle_id=? AND item_id=?').get(cycleId,first.id).q,3000);
  await page.getByRole('button',{name:'Ver historial',exact:true}).click();
  await expect(page.locator('.supervision-movement')).toHaveCount(1);
  await expect(page.locator('dialog [data-annul-history]')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('dialog')).toHaveCount(0);
  checks.push('Rectificar sin motivo guarda en D1; historial muestra autor/detalle y Anular; Escape cierra');
  // Let D1 accept, then lose the HTTP response. Retrying must not create a second command.
  await page.route('**/api/admin/supervision/command',async route => {await route.fetch();await route.abort('failed');await page.unroute('**/api/admin/supervision/command');});
  await page.getByRole('button',{name:'Anular conteo',exact:true}).click();
  await expect(page.locator('dialog [name="reason"]')).not.toHaveAttribute('required','');
  await page.locator('dialog [data-confirm]').click();
  await expect(page.locator('#message')).toContainText('Resultado incierto');
  await page.locator('dialog [data-cancel]').click();
  const accepted = db.prepare('SELECT count(*) n FROM supervision_commands WHERE cycle_id=?').get(cycleId).n;
  await page.locator('#retry-command').click();await expect(page.locator('#retry-command')).toHaveCount(0);
  assert.equal(db.prepare('SELECT count(*) n FROM supervision_commands WHERE cycle_id=?').get(cycleId).n,accepted);
  assert.equal(db.prepare('SELECT voided FROM counts WHERE cycle_id=? AND item_id=?').get(cycleId,first.id).voided,1);
  checks.push('Anular con respuesta perdida conserva ID y reintento explícito no duplica comandos ni historial');
  await page.getByRole('tab',{name:'Historial',exact:true}).click();
  await page.getByRole('button',{name:'Correcciones',exact:true}).click();
  await expect(page.locator('.supervision-history-item')).toHaveCount(1);
  await page.locator('.supervision-history-item > summary').click();
  await expect(page.locator('.supervision-movement')).toHaveCount(2);
  await expect(page.locator('#results')).toContainText('Anulación');
  await page.getByRole('button',{name:'Anulaciones',exact:true}).click();
  await expect(page.locator('.supervision-history-item')).toHaveCount(1);
  checks.push('Historial agrupa por producto/ubicación, filtra por pertenencia y conserva la secuencia completa');
  await openFirst(page);
  await page.getByRole('switch').uncheck();await expect(page.locator('#message')).toHaveText('Cambio guardado.');
  await page.locator('#status').selectOption('excluded');await expect(page.locator('.supervision-product')).toHaveCount(1);
  assert.equal(db.prepare('SELECT active FROM item_activity WHERE item_id=?').get(first.id).active,0);
  const otherCycle = cycleId+'-other';db.prepare("INSERT INTO cycles(id,name,catalog_version,state) VALUES(?,'Comprobación persistencia',?,'open')").run(otherCycle,catalog);
  assert.equal(db.prepare('SELECT active FROM supervision_items WHERE cycle_id=? AND id=?').get(otherCycle,first.id).active,0);
  if (!(await page.locator('.supervision-product').evaluate(el => el.open))) await page.locator('.supervision-product > summary').click();
  await page.getByRole('switch').check();await expect(page.locator('.supervision-product')).toHaveCount(0);
  await page.locator('#status').selectOption('');await expect(page.locator('.supervision-product')).toHaveCount(1);
  await page.locator('.supervision-product > summary').click();
  assert.deepEqual(db.prepare('SELECT active FROM item_activity_events WHERE item_id=? ORDER BY seq').all(first.id).map(row => row.active),[0,1]);
  checks.push('Activo/Inactivo funciona sin modal/motivo, persiste entre ciclos y conserva desactivación/reactivación');
  await page.locator('#scope-summary').click();
  await expect(page.locator('.summary-view')).toBeVisible();
  assert.ok(page.url().includes('summary=1'));
  await page.goBack();
  await expect(page.getByRole('tab',{name:'Productos',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#scope')).toHaveValue('servicio:barra');
  await expect(page.locator('#search')).toHaveValue(first.name);
  await expect(page.locator('.supervision-product')).toHaveAttribute('open','');
  checks.push('Resumen real de área y volver preservan pestaña, área, búsqueda y detalle abierto');
  // Finish a two-item scope through real commands, rather than bypassing strict closure.
  for (const item of [first,second]) {
    const response = await admin.request('/api/admin/supervision/command',command('rectify',item,{quantity:0,status:'counted',note:'Ensayo de cierre estricto',outOfStock:true}));
    assert.equal(response.status,200,JSON.stringify(response.data));
  }
  const lead = new Client();await lead.login('jefa-servicio-2');
  const {page:lp,context:lc} = await contextFor(lead);
  assert.equal(await lp.locator('[data-transition][data-scope=""]').count(),0);
  await closeReview(lp);
  await lp.locator('[data-transition="open"][data-scope="servicio"]').click();
  await expect(lp.locator('dialog [name="reason"]')).toHaveAttribute('required','');
  await lp.getByRole('button',{name:'Revisar conteos',exact:true}).click();await lp.locator('dialog [data-confirm]').click();
  await expect(lp.locator('dialog')).toHaveCount(0);await expect(lp.locator('[data-transition="review"]')).toBeVisible();
  await closeReview(lp);
  await lp.locator('[data-transition="closed"]').click();
  await expect(lp.locator('dialog [name="reason"]')).toHaveCount(0);
  await lp.locator('dialog [data-confirm]').click();await expect(lp.locator('dialog')).toHaveCount(0);
  await expect(lp.locator('[data-transition="open"]')).toHaveCount(0);
  const denied = await lead.request('/api/admin/supervision/command',command('state',null,{scope:'servicio',state:'open',reason:'Revisión no autorizada'}));
  assert.equal(denied.status,403);
  await lc.close();
  await page.reload();await page.locator('[data-transition="open"][data-scope="servicio"]').click();
  await page.getByRole('button',{name:'Completar productos',exact:true}).click();await page.locator('dialog [data-confirm]').click();
  await expect(page.locator('dialog')).toHaveCount(0);
  assert.equal(db.prepare('SELECT state FROM cycle_scope_states WHERE cycle_id=? AND scope_id=\'servicio\'').get(cycleId).state,'open');
  checks.push('Jefa cierra/reabre revisión/finaliza solo Servicio; únicamente Administrador reabre finalizado con motivo');
  await context.close();assert.deepEqual(errors,[]);
  writeFileSync('test-results/supervision/checks.json',JSON.stringify({checks,errors},null,2));
  console.log(JSON.stringify({checks,errors},null,2));
} finally {db.close();await browser.close();}
