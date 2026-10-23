import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {Client,database,origin} from './helpers.mjs';
const db=database();db.exec('DELETE FROM attempts');const cycleId='supervision-browser-'+Date.now();
db.prepare("INSERT INTO cycles(id,name,catalog_version,state) SELECT ?,'Revisión visual 3B',catalog_version,'open' FROM cycles WHERE id='prueba-compartida'").run(cycleId);
const c=new Client();await c.login('admin-prueba');const browser=await chromium.launch({headless:true});const errors=[];const checks=[];
mkdirSync('test-results/supervision',{recursive:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await context.addCookies([{name:'inventory_session_local',value:c.cookie.split('=')[1],url:origin}]);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/pages/admin/supervision.html');await page.locator('#cycle').selectOption(cycleId);await page.locator('#supervision[aria-busy="false"]').waitFor();await page.locator('#results article').first().waitFor();
 for(const width of [320,390,1024])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});await page.evaluate(t=>{document.documentElement.dataset.theme=t;},theme);
  await page.waitForFunction(t=>{const c=getComputedStyle(document.body),h=getComputedStyle(document.querySelector('.supervision-card h2'));const expected=t==='dark'?'rgb(240, 246, 248)':'rgb(20, 43, 77)';return c.color===expected&&h.color===expected;},theme);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow ${width} ${theme}`);
  await page.screenshot({path:`test-results/supervision/${width}-${theme}.png`,fullPage:false});
 }
 checks.push('Supervisión 320/390/1024, claro/oscuro, sin desborde');
 await page.setViewportSize({width:390,height:844});
 await page.locator('[data-change="rectify"]').first().click();let modal=page.locator('dialog');await modal.waitFor();await page.screenshot({path:'test-results/supervision/modal-rectify.png'});assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Cancelar');
 assert.equal(await modal.locator('[name="reason"]').getAttribute('placeholder'),'actualizacion/revision item');assert.equal(await modal.locator('[name="reason"]').inputValue(),'');
 await modal.locator('[name="quantity"]').fill('3');await modal.locator('[name="reason"]').fill('Revisión visual');await modal.locator('[data-confirm]').click();await modal.waitFor({state:'detached'});
 await page.locator('[data-change="annul"]').first().waitFor();await page.locator('[data-change="annul"]').first().click();await page.keyboard.press('Escape');await modal.waitFor({state:'detached'});assert.equal(await page.locator('dialog').count(),0);
 checks.push('Rectificar guarda con motivo; anular permite Escape y conserva datos');
 // Response lost after server accepts; ID/payload remain until manual retry.
 await page.route('**/api/admin/supervision/command',async route=>{const response=await route.fetch();await route.abort('failed');await page.unroute('**/api/admin/supervision/command');});
 await page.locator('[data-change="annul"]').first().click();modal=page.locator('dialog');await modal.locator('[name="reason"]').fill('Anulación comprobada');await modal.locator('[data-confirm]').click();await modal.locator('[data-cancel]').filter({hasText:'Cerrar y conservar envío'}).waitFor();await modal.locator('[data-cancel]').click();
 const before=db.prepare('SELECT count(*) n FROM supervision_commands WHERE cycle_id=?').get(cycleId).n;
 await page.getByRole('button',{name:'Reintentar cambio pendiente'}).click();await page.getByRole('button',{name:'Reintentar cambio pendiente'}).waitFor({state:'detached'});
 assert.equal(db.prepare('SELECT count(*) n FROM supervision_commands WHERE cycle_id=?').get(cycleId).n,before);
 checks.push('Respuesta perdida: reintento manual conserva ID sin duplicar anulación');
 await page.getByRole('button',{name:'Historial',exact:true}).click();await page.locator('#results article').first().waitFor();assert.ok(await page.locator('#results').innerText().then(t=>t.includes('Anulación')));
 await page.getByRole('button',{name:'Productos',exact:true}).click();await page.locator('[data-change="activation"]').first().click();modal=page.locator('dialog');await modal.locator('[name="reason"]').fill('Exclusión revisada');await modal.locator('[data-confirm]').click();await modal.waitFor({state:'detached'});
 await page.locator('#status').selectOption('excluded');await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.getByRole('button',{name:'Volver a activar'}).first().waitFor();
 checks.push('Historial y exclusiones se consultan con filtros; no se muestran como cero');
 await context.close();
 const lead=new Client();await lead.login('jefa-servicio-2');const lc=await browser.newContext({viewport:{width:320,height:900}});await lc.addCookies([{name:'inventory_session_local',value:lead.cookie.split('=')[1],url:origin}]);const lp=await lc.newPage();lp.on('pageerror',e=>errors.push(e.message));await lp.goto(origin+'/pages/admin/supervision.html');await lp.locator('#cycle').selectOption(cycleId);await lp.locator('#supervision[aria-busy="false"]').waitFor();await lp.locator('#results article').first().waitFor();assert.equal(await lp.getByRole('button',{name:'Excluir de este inventario'}).count(),0);await lp.getByText('Gestionar revisión, cierre o reapertura',{exact:true}).click();assert.equal(await lp.getByRole('button',{name:'Reabrir',exact:true}).count(),1);assert.ok(await lp.locator('#scope option').allTextContents().then(a=>!a.includes('Cocina')));checks.push('Jefa: solo Servicio, sin activación ni control global');await lc.close();
 assert.deepEqual(errors,[]);writeFileSync('docs/supervision-vistas-local-3b.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{db.close();await browser.close();}
