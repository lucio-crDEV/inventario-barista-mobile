// Isolated inventory options UX; every write is a mocked browser request.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const server=createServer(async(req,res)=>{try{
 if(req.url==='/__options'){res.writeHead(200,{'Content-Type':'text/html'});return res.end('<!doctype html><html><head><script type="importmap">{"imports":{"web-vitals":"/node_modules/web-vitals/dist/web-vitals.js"}}</script><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/shared/shared.css"><link rel="stylesheet" href="/theme.css"><link rel="stylesheet" href="/shared/revision.css"><style>:root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}body{margin:0}</style></head><body></body></html>');}
 let file=resolve('.','.'+new URL(req.url,'http://local').pathname);if((await stat(file)).isDirectory())file+='/index.html';res.writeHead(200,{'Content-Type':{'.js':'text/javascript','.css':'text/css','.html':'text/html'}[extname(file)]||'application/octet-stream'});res.end(await readFile(file));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 const user={id:'options-admin',role:'admin'},cycle={id:'active',name:'Inventario de prueba',period:'2026-10-26',type:'weekly',state:'open',lifecycle:'active',revision:7};
 let commands=[],mode='success';
 await page.route('**/api/**',route=>{
  if(new URL(route.request().url()).pathname!='/api/admin/cycles/command')return route.fulfill({json:{}});
  commands.push(route.request().postDataJSON());
  if(mode==='uncertain')return route.fulfill({status:503,json:{message:'Respuesta no confirmada'}});
  if(mode==='warning')return route.fulfill({status:409,json:{code:'CONFIRMATION_REQUIRED',message:'Ya hay otro inventario.',warnings:[{message:'Ya hay otro inventario.'}],confirmationRevision:'activation-revision'}});
  return route.fulfill({json:{ok:true}});
 });
 await page.goto(origin+'/__options');
 const open=async(c=cycle,role='admin')=>page.evaluate(async({c,user,role})=>{const {inventoryDialog}=await import('/shared/inventory-context.js');inventoryDialog({...user,role},[c].filter(Boolean),c);},{c,user,role});
 await open(cycle,'worker');await expect(page.locator('dialog')).toHaveCount(0);
 await open(null);await expect(page.locator('[type=submit]')).toHaveText('Crear inventario');await expect(page.locator('dialog')).toContainText('últ. inventario');await expect(page.locator('[data-delete]')).toHaveCount(0);await page.locator('[data-cancel]').click();
 await open();await expect(page.locator('.inventory-options-context')).toContainText('26/10/2026');await expect(page.locator('.inventory-options-context')).toContainText('Semanal');await expect(page.locator('.inventory-options-context')).toContainText('Activo');await expect(page.locator('dialog')).not.toContainText('últ. inventario');
 await page.locator('[data-delete]').click();assert.equal(commands.length,0);await expect(page.locator('[data-delete-confirm]')).toBeVisible();if(process.env.INVENTORY_OPTIONS_SCREENSHOT)await page.screenshot({path:process.env.INVENTORY_OPTIONS_SCREENSHOT});await expect(page.locator('[data-cancel]')).toBeFocused();await expect(page.locator('[type=submit]')).toHaveClass(/inventory-danger-button/);
 await page.locator('[data-cancel]').click();await expect(page.locator('[data-delete-option]')).toBeVisible();assert.equal(commands.length,0);
 for(const theme of ['light','dark'])for(const width of [320,390,654]){
  await page.setViewportSize({width,height:844});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  await page.locator('[data-delete]').click();await page.locator('[type=submit]').focus();await expect(page.locator('[type=submit]')).toHaveCSS('outline-style','none');
  assert.equal(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  for(const button of await page.locator('dialog button:visible').all())assert.ok((await button.boundingBox()).height>=44);
  await page.locator('[data-cancel]').click();
 }
 await page.locator('[data-options-close]').click();await expect(page.locator('dialog')).toHaveCount(0);
 // Activation still confirms duplicates with its original command ID.
 const prepared={...cycle,id:'prepared',lifecycle:'prepared'};await open(prepared);await expect(page.locator('[data-delete]')).toBeVisible();await expect(page.locator('[type=submit]')).toHaveText('Activar inventario');mode='warning';await page.locator('[type=submit]').click();await expect(page.locator('[data-warnings]')).toBeVisible();const activate=commands.at(-1);mode='success';await page.locator('[type=submit]').click();await expect(page.locator('dialog')).toHaveCount(0);assert.equal(commands.at(-1).id,activate.id);assert.equal(commands.at(-1).kind,'activate');assert.equal(commands.at(-1).expectedRevision,7);assert.equal(commands.at(-1).confirmationRevision,'activation-revision');
 // Prepared deletion is separate; uncertain results freeze action switching and replay exactly.
 await open(prepared);await page.locator('[data-delete]').click();mode='uncertain';await page.locator('[type=submit]').click();await expect(page.locator('[type=submit]')).toHaveText('Reintentar confirmación');const pending=commands.at(-1);await page.setViewportSize({width:320,height:844});assert.equal(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true);assert.equal(pending.kind,'delete');assert.equal(pending.confirm,true);assert.equal(pending.expectedRevision,7);await expect(page.locator('[data-delete]')).toBeDisabled();
 await page.locator('[type=submit]').click();await expect(page.locator('[type=submit]')).toHaveText('Reintentar confirmación');assert.deepEqual(commands.at(-1),pending);
 await page.locator('[data-cancel]').click();await open();await expect(page.getByRole('heading',{name:'Confirmar cambio pendiente'})).toBeVisible();mode='success';await page.locator('[data-retry]').click();await expect(page.locator('dialog')).toHaveCount(0);assert.deepEqual(commands.at(-1),pending);
 // Ordinary active deletion requires the second explicit click as well.
 await open();await page.locator('[data-delete]').click();const before=commands.length;await page.locator('[type=submit]').click();await expect(page.locator('dialog')).toHaveCount(0);assert.equal(commands.length,before+1);assert.equal(commands.at(-1).cycleId,'active');assert.equal(commands.at(-1).kind,'delete');
 console.log('PASS inventory options: context, compact themes/widths, safe delete confirmation, admin guard, prepared activate/delete, duplicate confirmation, exact uncertain replay/recovery.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
