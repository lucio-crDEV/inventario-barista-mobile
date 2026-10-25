// Browser contract tests use intercepted APIs and never mutate an inventory/D1.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const directory = fileURLToPath(new URL('../../',import.meta.url));
const server = createServer(async (req,res) => {
  try {
    const path = resolve(directory,'.' + new URL(req.url,'http://localhost').pathname);
    if (!path.startsWith(directory)) throw Error('Invalid path');
    const types = {'.js':'text/javascript','.css':'text/css','.html':'text/html'};
    const bytes = await readFile(path); res.writeHead(200,{'Content-Type':types[extname(path)] || 'text/plain'}); res.end(bytes);
  } catch {res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless:true});
const errors = [],requests = [],commands = [];
let uncertain = false;
const fixture = role => ({
  user:{id:role,name:role === 'admin' ? 'Administración de prueba' : 'Jefa de servicio',role},
  cycle:{id:'demo',name:'Inventario de prueba',revision:1,state:'review',scopeStates:[{scope_id:'servicio',state:'review'}]},
  scopes:[{id:'cocina',name:'Cocina'},{id:'principal',name:'Bodega / Principal'},{id:'servicio',name:'Servicio'},{id:'servicio:barra',name:'Servicio / Barra'}],
  groups:[{areaId:'cocina',total:12,counted:2,partial:1,pending:9,excluded:2},{areaId:'servicio',total:12,counted:3,partial:2,pending:7,excluded:1}],
  updatedAt:'2026-10-23T12:34:56.000Z',
});
const product = {id:'azucar',name:'Azúcar blanca',locationId:'servicio:barra',areaId:'servicio',unit:'KG',active:true,status:'counted',activityRevision:2,record:{quantity:7,status:'counted',version:2,authorName:'Ana',note:''}};
const rows = [{seq:2,itemId:'azucar',locationId:'servicio:barra',authorName:'Ana',action:'add',createdAt:'2026-10-23T12:34:56Z',product:'Azúcar blanca',unit:'KG',before:{quantity:3,status:'counted'},entered:{quantity:4},after:{quantity:7,status:'counted'}},{seq:1,itemId:'azucar',locationId:'servicio:barra',authorName:'Luz',action:'direct',createdAt:'2026-10-22T12:30:56Z',product:'Azúcar blanca',unit:'KG',before:null,after:{quantity:3,status:'counted'}}];
async function contextFor(role = 'admin') {
  const context = await browser.newContext({viewport:{width:390,height:844}}),data = fixture(role);
  const page = await context.newPage();page.on('pageerror',e => errors.push(e.message));
  await page.route('**/api/**',async route => {
    const url = new URL(route.request().url());requests.push(url.pathname + url.search);
    let result = {},status = 200;
    if (url.pathname === '/api/admin/supervision/command') {
      const body = route.request().postDataJSON();commands.push(body);
      if (uncertain) {status = 503;result = {message:'Resultado de prueba incierto'};}
      else {data.cycle.revision++;if(body.kind === 'state') {if(body.scope) data.cycle.scopeStates[0].state = body.state; else data.cycle.state = body.state;}result = {ok:true};}
    } else if (url.pathname.endsWith('/cycles')) result = {user:data.user,cycles:[data.cycle]};
    else if (url.pathname.endsWith('/authors')) result = {authors:[{id:'ana',name:'Ana'}]};
    else if (url.pathname.endsWith('/items')) result = {items:[product],nextCursor:null};
    else if (url.pathname.endsWith('/history')) result = url.searchParams.get('item') ? {history:rows,nextCursor:null} : {items:[{itemId:'azucar',locationId:'servicio:barra',product:'Azúcar blanca',unit:'KG',counts:{counts:2,corrections:1,annulments:0},lastSeq:2,latestAt:rows[0].createdAt}],nextCursor:null};
    else if (url.pathname.endsWith('/events')) result = {events:[],nextCursor:null};
    else if (url.pathname === '/api/me') result = {user:data.user};
    else result = data;
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
  });
  await page.goto(origin + '/pages/admin/supervision.html');
  await expect(page.getByRole('tab',{name:'Áreas',exact:true})).toBeVisible();
  await expect(page.locator('.supervision-area-row')).toHaveCount(2);
  return {page,context,data};
}
try {
  const {page,context} = await contextFor();
  await expect(page.locator('.supervision-ring').first()).toContainText('25%');
  await expect(page.locator('#cycle-state')).not.toContainText(':56');
  await expect(page.locator('progress')).toHaveCount(0);
  await expect(page.locator('#refresh')).toHaveCount(0);
  assert.match(await page.locator('.supervision-area-row').first().getAttribute('href'),/area=cocina.*summary=1.*from=supervision/);
  await page.getByRole('tab',{name:'Productos',exact:true}).click();
  await page.locator('.supervision-product > summary').click();
  await expect(page.getByRole('switch')).toBeVisible();
  await page.getByRole('button',{name:'Corregir total',exact:true}).click();
  await expect(page.locator('dialog [name=reason]')).not.toHaveAttribute('required','');
  await page.locator('dialog [name=quantity]').fill('8');
  await page.locator('dialog [name=reason]').fill('Borrador conservado');
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.getByRole('button',{name:'Corregir total',exact:true}).click();
  await expect(page.locator('dialog [name=quantity]')).toHaveValue('8');
  await expect(page.locator('dialog [name=reason]')).toHaveValue('Borrador conservado');
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.getByRole('tab',{name:'Historial',exact:true}).click();
  await selectFilter(page,'#history-category','correction');
  await expect(page.locator('.supervision-history-item')).toHaveCount(1);
  assert.ok(requests.some(url => url.includes('category=correction')));
  await page.locator('.supervision-history-item > summary').click();
  await expect(page.locator('.supervision-movement')).toHaveCount(2);
  await expect(page.locator('.supervision-movement').first()).toContainText('+4 KG');
  await expect(page.locator('.supervision-day')).toHaveCount(2);
  await expect(page.locator('.supervision-movement').first()).not.toContainText(':56');
  for (const width of [320,390,1024]) for (const theme of ['light','dark']) {
    await page.setViewportSize({width,height:844});
    await page.evaluate(value => document.documentElement.dataset.theme = value,theme);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true,`${width}/${theme} no overflow`);
  }
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('tab',{name:'Productos',exact:true}).click();
  await selectFilter(page,'#scope','servicio:barra');
  await expect(page.locator('#scope-summary')).toBeVisible();
  await page.locator('#search').fill('Azúcar');
  await expect(page.locator('.supervision-product')).toHaveCount(1);
  await page.waitForTimeout(350);
  await page.locator('.supervision-product > summary').click();
  await page.route('**/pages/inventario/**', route => route.fulfill({contentType:'text/html',body:'<h1>Resumen de prueba</h1>'}));
  await page.locator('#scope-summary').click();
  await expect(page.getByRole('heading',{name:'Resumen de prueba'})).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('tab',{name:'Productos',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#scope')).toHaveValue('servicio:barra');
  await expect(page.locator('#search')).toHaveValue('Azúcar');
  await expect(page.locator('.supervision-product')).toHaveAttribute('open','');
  const reopen = page.locator('[data-transition=open][data-scope="servicio"]');
  await reopen.click();
  await expect(page.locator('dialog [name=reason]')).toHaveAttribute('required','');
  await page.getByRole('button',{name:'Revisar conteos',exact:true}).click();
  await expect(page.locator('dialog [name=reason]')).toHaveValue('Revisar o corregir conteos');
  const cancel = await page.getByRole('button',{name:'Cancelar',exact:true}).boundingBox();
  const submit = await page.locator('dialog [data-confirm]').boundingBox();
  assert.ok(Math.abs(cancel.y - submit.y) < 2,'dialog actions share a row');
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.locator('[data-transition=closed][data-scope="servicio"]').click();
  await expect(page.locator('dialog [name=reason]')).toHaveCount(0);
  await expect(page.locator('dialog input[type=checkbox]')).toHaveCount(0);
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.getByRole('tab',{name:'Productos',exact:true}).click();
  if (!(await page.locator('.supervision-product').evaluate(el => el.open))) await page.locator('.supervision-product > summary').click();
  uncertain = true;
  await page.getByRole('button',{name:'Anular conteo',exact:true}).click();
  await expect(page.locator('dialog [name=reason]')).not.toHaveAttribute('required','');
  await page.locator('dialog [data-confirm]').click();
  await expect(page.locator('#message')).toContainText('Resultado incierto');
  await page.getByRole('button',{name:'Cerrar',exact:true}).last().click();
  await expect(page.locator('#retry-command')).toBeVisible();
  const sent = commands.at(-1); assert.equal(sent.kind,'annul'); assert.equal(sent.reason,'');
  uncertain = false;await page.locator('#retry-command').click();
  await expect(page.locator('.inventory-notice')).toHaveText('Cambio guardado.');
  assert.equal(commands.at(-1).id,sent.id,'uncertain retry preserves operation id');
  await context.close();
  const lead = await contextFor('service_lead');
  lead.data.cycle.scopeStates[0].state = 'closed';
  await lead.page.reload();
  await expect(lead.page.locator('[data-transition=open]')).toHaveCount(0);
  await lead.page.getByRole('tab',{name:'Productos',exact:true}).click();
  await lead.page.locator('.supervision-product > summary').click();
  await expect(lead.page.getByRole('switch')).toHaveCount(0);
  await expect(lead.page.getByRole('button',{name:'Corregir total',exact:true})).toHaveCount(0);
  await lead.context.close();
  assert.deepEqual(errors,[]);
  console.log('Supervision browser checks passed: compact navigation, grouped history, filters, permissions, draft preservation, responsive themes and idempotent uncertain retry.');
} finally {await browser.close();await new Promise(resolve => server.close(resolve));}

async function selectFilter(page, selector, value) { if(!(await page.locator(selector).isVisible()))await page.locator("#toggle-filters").click();await page.locator(selector).selectOption(value); }
