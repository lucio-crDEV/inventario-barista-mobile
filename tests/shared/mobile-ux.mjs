// Browser-only regression checks with isolated responses; no D1 or production data.
import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('.');
const server=createServer(async(req,res)=>{
  try {let file=resolve(root,'.'+new URL(req.url,'http://local').pathname);if((await stat(file)).isDirectory())file+='/index.html'; const data=await readFile(file); res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await mkdir('test-results/mobile-ux',{recursive:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/shared/inventory-context.js',route=>route.fulfill({contentType:'text/javascript',body:'export function mountInventoryContext() {}'}));
 await page.route('**/api/**',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({message:'Usuario o contraseña incorrectos.'})}));
 await page.goto(origin+'/pages/cuenta/');
 await page.getByLabel('Usuario',{exact:true}).fill('prueba');
 await page.locator('input[name=password]').fill('incorrecta');
 await page.getByRole('button',{name:'Ingresar',exact:true}).click();
 const message=page.locator('#message'); await expect(message).toBeVisible();
 assert.ok(await page.evaluate(()=>document.querySelector('.account-heading').compareDocumentPosition(document.querySelector('#message')) & Node.DOCUMENT_POSITION_FOLLOWING));
 assert.ok((await message.boundingBox()).y < (await page.locator('form').boundingBox()).y);
 await page.waitForTimeout(4200); await expect(message).toBeVisible();
 await page.screenshot({path:'test-results/mobile-ux/login-390.png'});
 await page.evaluate(async()=>{ const {dialog}=await import('/shared/client.js'); window.testDialog=dialog('Crear usuario','<label>Usuario<input name="new-user" value="prueba"></label><button>Cerrar</button>'); });
 assert.equal(await page.evaluate(()=>document.activeElement.tagName),'H2');
 await expect(page.locator('dialog input')).toHaveCSS('font-size','16px');
 await page.evaluate(()=>window.testDialog.close());
 await page.evaluate(async()=>{const {showNotice}=await import('/shared/notices.js');showNotice('Error persistente','error');});
 await page.waitForTimeout(4200);await expect(page.locator('.inventory-notice')).toHaveText('Error persistente');
 assert.ok((await page.locator('.inventory-notice').boundingBox()).y<100);
 await page.evaluate(async()=>{const {showNotice}=await import('/shared/notices.js');showNotice('Guardado');});
 await page.waitForTimeout(4200);await expect(page.locator('.inventory-notice')).toHaveCount(0);
 const user={id:'mobile-test',username:'mobile',name:'Prueba móvil',role:'worker',revision:1};
 const scopes=[{id:'cocina',name:'Cocina',parent:null}];
 const item={id:'mobile-item',name:'Harina de prueba',areaId:'cocina',locationId:'cocina',unit:'kg',category:'Secos',countCategory:'Secos',active:true,order:1};
 await page.route('**/api/bootstrap*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({user,scopes,items:[item],counts:[],cycle:{id:'test-mobile',state:'open',revision:1},cursor:0})}));
 await page.goto(origin+'/pages/inventario/?area=cocina');
 await page.locator('.category-card').first().click();

 // Programmatic panel focus must never decorate all descendant labels.
 const panel=page.locator('.item-drawer-panel'),current=page.locator('.item-drawer-link.is-current');
 await expect(panel).toBeVisible();
 await page.keyboard.press('Tab');await panel.focus();
 for(const theme of ['light','dark'])for(const width of [320,390,654]){
  await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);await page.setViewportSize({width,height:844});await panel.focus();
  assert.equal(await panel.evaluate(el=>el.matches(':focus-visible')),true);
  const underlined=await page.locator('.item-drawer-name').first().evaluate(el=>{const found=[];for(let node=el;node;node=node.parentElement)if(getComputedStyle(node).textDecorationLine.includes('underline'))found.push(node.className||node.tagName);return found;});
  assert.deepEqual(underlined,[]);
  await expect(current).toHaveCSS('border-color','rgba(0, 0, 0, 0)');await expect(current).toHaveCSS('box-shadow','none');
  const normal=await current.evaluate(el=>getComputedStyle(el).filter);await current.focus();
  assert.notEqual(await current.evaluate(el=>getComputedStyle(el).filter),normal);
  await expect(current).toHaveCSS('text-decoration-line','none');await expect(current).toHaveCSS('outline-style','none');
  await panel.focus();await page.screenshot({path:`test-results/mobile-ux/focus-list-${width}-${theme}.png`});
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.dataset.theme='light');await current.click();
 await page.locator('[data-settings-toggle]').click();await page.keyboard.press('Tab');await page.locator('.settings-panel').focus();
 await expect(page.locator('.settings-panel')).toHaveCSS('text-decoration-line','none');
 await page.locator('.identity-profile').focus();await expect(page.locator('.identity-profile')).toHaveCSS('text-decoration-line','none');
 await page.locator('.settings-close').click();
 await expect(page.locator('#quantity')).toBeVisible();
 assert.equal(await page.locator('.item-card').getByText('Sin conteo vigente.',{exact:false}).count(),0);
 const badge=await page.locator('.item-header .status-badge').boundingBox();
 const category=await page.locator('.item-category').boundingBox();
 assert.ok(Math.abs(badge.y-category.y)<12);
 assert.deepEqual(await page.locator('.count-actions button').allTextContents().then(values=>values.map(v=>v.trim())),['Sin stock','Avance','Listo']);
 await page.locator('#quantity').fill('12,5');
 await page.evaluate(()=>{Object.defineProperty(window.visualViewport,'height',{configurable:true,get:()=>420});window.visualViewport.dispatchEvent(new Event('resize'));});
 await expect(page.locator('.count-actions')).toHaveClass(/above-keyboard/);
 assert.ok((await page.locator('.count-actions').boundingBox()).y<420);
 await expect(page.locator('#quantity')).toHaveValue('12,5');
 assert.ok((await page.locator('#quantity').boundingBox()).y+(await page.locator('#quantity').boundingBox()).height<(await page.locator('.count-actions').boundingBox()).y);
 assert.equal(await page.locator('#save-counted').evaluate(button=>button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}))),false);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'quantity');
 await page.screenshot({path:'test-results/mobile-ux/count-keyboard-390.png'});
 await page.setViewportSize({width:320,height:700});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 await page.screenshot({path:'test-results/mobile-ux/count-keyboard-320.png'});
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');
 await page.screenshot({path:'test-results/mobile-ux/count-keyboard-dark-320.png'});
 // Selected history must reach navigation and survive canonical scope redirects.
 let requestedCycle='',readState='closed';
 const serviceScopes=[{id:'servicio',name:'Servicio',parent:null},{id:'servicio:barra',name:'Barra',parent:'servicio'}];
 const serviceItem={...item,areaId:'servicio',sectorId:'barra',locationId:'servicio:barra'};
 await page.route('**/api/navigation*',route=>{requestedCycle=new URL(route.request().url()).searchParams.get('cycle');return route.fulfill({contentType:'application/json',body:JSON.stringify({user,scopes:serviceScopes,cycleId:'history'})});});
 await page.route('**/api/bootstrap*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({user,scopes:serviceScopes,items:[serviceItem],counts:[],cycle:{id:'history',state:readState,revision:1},cursor:0})}));
 await page.goto(origin+'/?inventory=history');
 await expect(page).toHaveURL(/inventory=history/);await expect(page.locator('.category-card')).toBeVisible();assert.equal(requestedCycle,'history');
 await page.goto(origin+'/pages/inventario/?area=servicio&inventory=history&from=supervision&summary=0');
 await expect(page).toHaveURL(/sector=barra/);assert.equal(new URL(page.url()).searchParams.get('inventory'),'history');assert.equal(new URL(page.url()).searchParams.get('from'),'supervision');assert.equal(new URL(page.url()).searchParams.get('summary'),'0');
 await page.locator('.category-card').first().click();await page.locator('.item-drawer-link.is-current').click();
 for(const selector of ['#quantity','#note','#save-counted','#save-partial','#save-out-of-stock'])await expect(page.locator(selector)).toBeDisabled();
 await expect(page.locator('#record-history')).toBeEnabled();
 const retained=await page.evaluate(()=>localStorage.getItem('inventory-drafts-v1:mobile-test:history'));
 await page.locator('#quantity').evaluate(field=>{field.value='99';field.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal(await page.evaluate(()=>localStorage.getItem('inventory-drafts-v1:mobile-test:history')),retained);
 readState='open';await page.reload();await page.locator('.item-drawer-link.is-current').click();await expect(page.locator('#quantity')).toBeEditable();await expect(page.locator('#save-counted')).toBeEnabled();
 assert.deepEqual(errors,[]);
 console.log('PASS mobile UX: focus without inherited underlines or selected borders across320/390/654 and both themes, login error placement/persistence, dialog heading focus, 16px fields, top persistent errors and transient successes; compact count header, action order and simulated keyboard dock.');
} finally {await browser.close();await new Promise(r=>server.close(r));}
