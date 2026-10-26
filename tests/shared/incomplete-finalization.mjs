// UI contracts only: mocked APIs, no inventories modified.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const server=createServer(async(req,res)=>{try{const path=resolve('.','.'+new URL(req.url,'http://local').pathname);res.setHeader('Content-Type',{'.js':'text/javascript','.css':'text/css','.html':'text/html'}[extname(path)]||'text/plain');res.end(await readFile(path));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
try{
 for(const role of ['admin','service_lead']){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),commands=[],errors=[];page.on('pageerror',e=>errors.push(e.message));let mode='warning';
  const user={id:'test-'+role,role,name:'Prueba'},cycle={id:'test',name:'26/10/2026',revision:1,state:'review',lifecycle:'active',type:'weekly',period:'2026-10-26',scopeStates:[]};
  const data={user,cycle,scopes:[{id:'servicio',name:'Servicio'}],groups:[{areaId:'servicio',total:4,counted:1,pending:2,partial:1,excluded:0}],scopeGroups:[],updatedAt:'2026-10-26T10:00:00Z'};
  await page.route('**/shared/telemetry-client.js',r=>r.fulfill({contentType:'text/javascript',body:'export function startClientTelemetry(){}'}));
  await page.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname;let body=data,status=200;
   if(path==='/api/admin/supervision/command'){
    const cmd=route.request().postDataJSON();commands.push(cmd);
    if(mode==='warning'){status=409;body={code:'PENDING_ITEMS',message:'Quedan productos sin completar.',completion:{pending:2,partial:1},completionRevision:4};mode='changed';}
    else if(mode==='changed'){status=409;body={code:'COMPLETION_CHANGED',message:'Los conteos cambiaron.',completion:{pending:3,partial:1},completionRevision:5};mode='uncertain';}
    else if(mode==='uncertain'){status=503;body={message:'Resultado no confirmado'};mode='success';}
    else {body={ok:true};cycle.state='closed';}
   }else if(path.endsWith('/cycles'))body={user,cycles:[cycle],defaultCycleId:'test'};
   else if(path.endsWith('/authors'))body={authors:[]};else if(path==='/api/me')body={user};
   await route.fulfill({status,json:body});
  });
  await page.goto(origin+'/pages/admin/supervision.html');await page.locator('[data-transition="closed"]').first().click();
  await page.locator('dialog [data-confirm]').click();await expect(page.locator('[data-completion-warning]')).toContainText('2 ítems pendientes y 1 con avance');await expect(page.locator('dialog [data-confirm]')).toHaveText('Continuar de todas formas');
  assert.equal(commands[0].allowIncomplete,undefined);assert.equal(commands[0].scope,role==='admin'?'':'servicio');
  for(const theme of ['light','dark'])for(const width of [320,390,654]){await page.setViewportSize({width,height:844});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);assert.ok(await page.locator('dialog').evaluate(d=>d.scrollWidth<=d.clientWidth));}
  await page.setViewportSize({width:390,height:844});await page.locator('dialog [data-confirm]').click();await expect(page.locator('[data-completion-warning]')).toContainText('Los conteos cambiaron.');assert.equal(commands[1].completionRevision,4);assert.equal(commands[1].allowIncomplete,true);assert.equal(commands[1].id,commands[0].id);
  if(role==='admin')await page.screenshot({path:'/private/tmp/finalize-with-pending.png'});
  await page.locator('dialog [data-confirm]').click();assert.equal(commands[2].completionRevision,5);await expect(page.locator('dialog [data-cancel]')).toHaveText('Cerrar');await page.locator('dialog [data-cancel]').click();await page.locator('#retry-command').click();await expect(page.locator('#retry-command')).toHaveCount(0);assert.deepEqual(commands[3],commands[2]);assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS incomplete finalization: admin/Service-only, explicit warning, changed counts require new confirmation, exact uncertain retry, compact themes/widths.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
