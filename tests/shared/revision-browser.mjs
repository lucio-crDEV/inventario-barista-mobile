import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { Client, database, resetLocal, origin, password, record } from './helpers.mjs';
const db=database(); resetLocal(db); db.exec("UPDATE cycle_scope_states SET state='open'");
const client=new Client(); await client.login('ana'); const boot=await client.boot(); const items=boot.items.filter(x=>x.active);
for(const [item,quantity,status] of [[items[0],5,'partial'],[items[1],7,'counted']]) assert.equal((await client.save(item,quantity,{status})).status,200);
const checks=[],errors=[],browser=await chromium.launch({headless:true});
await mkdir('test-results/revision',{recursive:true});
async function session(user){const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const result=await context.request.post(origin+'/api/login',{headers:{Origin:origin},data:{username:user,password}});assert.equal(result.status(),200);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page};}
try{
 const {page}=await session('ana');
 await page.goto(origin+'/pages/inventario/?area=servicio&sector=barra&summary=1');
 await expect(page.locator('.summary-counter-counted strong')).toHaveText('1');
 await expect(page.locator('.summary-counter-partial strong')).toHaveText('1');
 await expect(page.locator('.summary-counter-pending strong')).toHaveText(String(items.length-2));
 await expect(page.locator('.summary-progress-heading')).toContainText('1 de');
 assert.equal(await page.locator('.responsible-section, #copy-summary, #share-summary, #new-session, #confirm-reset-modal').count(),0);
 await expect(page.locator('#progress-bar-container')).toBeHidden();
 for(const width of [320,390,1024]){await page.setViewportSize({width,height:844});for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const cards=await page.locator('.summary-counter').evaluateAll(es=>es.map(el=>{const label=el.querySelector('span').getBoundingClientRect(),number=el.querySelector('strong').getBoundingClientRect();return {height:el.getBoundingClientRect().height,sameLine:Math.abs(label.y+label.height/2-number.y-number.height/2)<3};}));assert.ok(cards.every(c=>c.height>=52&&c.sameLine),JSON.stringify(cards));await page.screenshot({path:`test-results/revision/summary-${width}-${theme}.png`});}}
 checks.push('Resumen sin acciones obsoletas, anillo combinado y cifras reales; punto, etiqueta y cifra en una línea a320/390/1024 en ambos temas');
 await page.setViewportSize({width:390,height:844});
 await page.locator('[data-summary-status=counted]').click();
 await page.locator('.summary-category > summary').first().click();
 await page.locator('.summary-item-button').filter({has:page.getByText(items[1].name,{exact:true})}).click();
 await expect(page.locator('#quantity')).toBeVisible();await page.locator('#note').fill('Borrador que debe permanecer');
 await page.locator('#record-history').click(); await expect(page.locator('.history-minimal li')).toHaveCount(1);
 await expect(page.locator('.history-minimal time')).toContainText('Hace');
 assert.equal(await page.getByRole('button',{name:'Anular conteo',exact:true}).count(),0);
 assert.equal(await page.locator('.history-minimal time').getAttribute('title')!==null,true);
 await page.mouse.click(2,2);await expect(page.locator('dialog[open]')).toHaveCount(0);await expect(page.locator('#note')).toHaveValue('Borrador que debe permanecer');
 await page.locator('#header-back-to-categories').click();await expect(page.locator('[data-summary-status=counted]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('.summary-category[open]')).toHaveCount(1);
 checks.push('Historial trabajador mínimo con tiempo relativo y fecha accesible; cierre exterior conserva borrador y regreso conserva filtro/categoría');
 const adminAPI=new Client();await adminAPI.login('admin-prueba');const snapshot=await adminAPI.request('/api/admin/supervision?cycle=prueba-compartida');assert.equal((await adminAPI.request('/api/admin/supervision/command',{id:crypto.randomUUID(),cycleId:'prueba-compartida',expectedRevision:snapshot.data.cycle.revision,kind:'state',scope:'servicio',state:'review',confirm:true})).status,200);
 await Promise.all([page.waitForNavigation(),page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')))]);
 await expect(page.locator('[data-summary-status=counted]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('.summary-category[open]')).toHaveCount(1);
 checks.push('Revalidación automática de ciclo conserva estado y categorías del resumen después de recargar la proyección autorizada');

 const admin=await session('admin-prueba');await admin.page.goto(origin+'/pages/inventario/?area=servicio&summary=1&from=supervision');
 await admin.page.locator('[data-summary-status=counted]').click();const group=admin.page.locator('.summary-category').filter({has:admin.page.getByText('Barra',{exact:true})}).first();
 if(await group.count())await group.locator('summary').click();else await admin.page.locator('.summary-category > summary').first().click();
 await admin.page.locator('.summary-item-button').filter({has:admin.page.getByText(items[1].name,{exact:true})}).click();await expect(admin.page.locator('#quantity')).toBeVisible();
 await admin.page.locator('#record-history').click();await expect(admin.page.locator('.history-movement')).toHaveCount(1);await expect(admin.page.locator('[data-annul]')).toBeVisible();
 await admin.page.locator('[data-annul]').click();await expect(admin.page.locator('textarea[name=reason]')).not.toHaveAttribute('required','');
 await admin.page.locator('[data-confirm]').click();await expect(admin.page.locator('dialog[open]')).toHaveCount(0);assert.equal((await record(client,items[1])).status,'pending');
 await expect(admin.page.locator('.summary-progress-card')).toBeVisible();
 checks.push('Resumen agregado Servicio permite abrir producto; Administrador ve secuencia y anula por el mismo comando sin motivo obligatorio');
 // Exercise keyboard visual viewport geometry through the browser-provided interface seam.
 await page.evaluate(async()=>{window.noticeModule=await import('/shared/notices.js');const vv=new EventTarget();Object.assign(vv,{offsetTop:210,offsetLeft:0,width:390,height:330});Object.defineProperty(window,'visualViewport',{configurable:true,value:vv});window.noticeModule.showNotice('Listo. Conteo guardado.');});
 const notice=page.locator('.inventory-notice');await expect(notice).toBeVisible();const box=await notice.boundingBox();assert.ok(box.y>=210&&box.y<300,JSON.stringify(box));
 await page.evaluate(()=>{visualViewport.offsetTop=280;visualViewport.dispatchEvent(new Event('scroll'));});assert.ok((await notice.boundingBox()).y>=280);
 const swipe=await notice.boundingBox();await page.mouse.move(swipe.x+30,swipe.y+30);await page.mouse.down();await page.mouse.move(swipe.x+30,swipe.y-20,{steps:5});await page.mouse.up();await expect(notice).toHaveCount(0);
 await page.evaluate(()=>window.noticeModule.showNotice('Otro aviso'));await page.getByRole('button',{name:'Descartar aviso'}).click();await expect(notice).toHaveCount(0);
 checks.push('Aviso se reposiciona con visualViewport de teclado, se descarta deslizando arriba o con cierre accesible');
 await page.evaluate(async()=>{document.querySelector('#app-content').innerHTML='<section class="count-view"><article class="item-card">Anterior</article></section>';window.transitions=[];const native=Element.prototype.animate;Element.prototype.animate=function(frames,options){window.transitions.push({frames,duration:options.duration});return native.call(this,frames,options)};await window.noticeModule.transitionItem(()=>document.querySelector('.count-view').innerHTML='<article class="item-card">Siguiente</article>');});
 assert.deepEqual(await page.evaluate(()=>transitions.map(x=>x.duration)),[160,180]);
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(async()=>{transitions=[];await window.noticeModule.transitionItem(()=>document.querySelector('.item-card').textContent='Sin movimiento');});assert.deepEqual(await page.evaluate(()=>transitions),[]);
 checks.push('Transición breve izquierda/derecha y cambio inmediato con movimiento reducido');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,errors},null,2));await writeFile('docs/revision-browser-local-2026-10-23.json',JSON.stringify({checks,errors,physicalDevice:false,keyboard:'Geometría visualViewport simulada, no teclado físico',screenshots:'test-results/revision/'},null,2)+'\n');
}finally{await browser.close();db.close();}
