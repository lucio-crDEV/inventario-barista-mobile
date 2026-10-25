// Isolated browser tests: mock API responses, never touch D1.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const server=createServer(async(req,res)=>{try{let file=resolve('.','.'+new URL(req.url,'http://local').pathname);if((await stat(file)).isDirectory())file+='/index.html';res.writeHead(200,{'Content-Type':{'.js':'text/javascript','.css':'text/css','.html':'text/html'}[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 await page.clock.setFixedTime(new Date('2026-10-25T15:00:00Z'));
 let user={id:'context-admin',username:'admin',name:'Admin',role:'admin',revision:1},signedIn=true;
 const scopes=[{id:'cocina',name:'Cocina',parent:null},{id:'servicio',name:'Servicio',parent:null},{id:'servicio:garzones',name:'Garzones',parent:'servicio'},{id:'servicio:garzones:salon',name:'Salón',parent:'servicio:garzones'},{id:'servicio:garzones:terraza',name:'Terraza',parent:'servicio:garzones'},{id:'servicio:garzones:privada',name:'Zona Privada',parent:'servicio:garzones'}];
 const cycles=[{id:'current',name:'Actual',period:'2026-10-25',created_at:'2026-10-25T12:00:00Z',state:'open',lifecycle:'active',revision:1},{id:'history',name:'Anterior',period:'2026-10-18',state:'closed',lifecycle:'active',revision:1}];
 let mode='warning',commands=[],uncertainStatus=503,scopeQueries=[];
 const json=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/logout'){signedIn=false;return json(route,{});}
  if(path==='/api/login'){signedIn=true;return json(route,{user,homeUrl:'/'});}
  if(!signedIn)return json(route,{message:'Sesión requerida'},401);
  if(path==='/api/admin/cycles/command'){
   const command=route.request().postDataJSON();commands.push(command);
   if(mode==='uncertain'){mode='success';return json(route,{message:'Respuesta no confirmada'},uncertainStatus);}
   if(mode==='warning')return json(route,{code:'CONFIRMATION_REQUIRED',message:'Hay otro inventario activo.',warnings:[{message:'Hay otro inventario activo.'}],confirmationRevision:'revision-1'},409);
   return json(route,{ok:true});
  }
  if(path==='/api/cycles'||path==='/api/admin/supervision/cycles')return json(route,{user,cycles,defaultCycleId:'current'});
  if(path==='/api/navigation')return json(route,{user,scopes});
  if(path==='/api/me')return json(route,{user});
  if(path==='/api/admin/supervision/authors')return json(route,{authors:[]});
  if(path==='/api/admin/supervision'){
   scopeQueries.push(new URL(route.request().url()).searchParams.get('scope'));
   const allowed=user.role==='service_lead'?scopes.filter(s=>s.id.startsWith('servicio')):scopes;
   const summary=id=>({scopeId:id,areaId:id.split(':')[0],total:2,counted:1,partial:0,pending:1,excluded:0});
   return json(route,{user,cycle:cycles.find(c=>c.id===new URL(route.request().url()).searchParams.get('cycle'))||cycles[0],scopes:allowed,groups:allowed.filter(s=>!s.parent).map(s=>summary(s.id)),scopeGroups:allowed.map(s=>summary(s.id)),updatedAt:'2026-10-25T15:00:00Z'});
  }
  return json(route,{items:[],nextCursor:null});
 });
 await page.goto(origin+'/');
 const recommendation=page.getByRole('complementary',{name:'Recomendación de inventario'});
 await expect(recommendation).toBeVisible();
 await recommendation.getByRole('button',{name:'Descartar recomendación'}).click();
 await expect(recommendation).toHaveCount(0);await page.reload();await expect(page.locator('.inventory-context-bar')).toBeVisible();await expect(recommendation).toHaveCount(0);
 await page.goto(origin+'/pages/cuenta/?profile=1');await expect(page.getByRole('heading',{name:'Mi perfil'})).toBeVisible();await page.goto(origin+'/');await expect(page.locator('.inventory-context-bar')).toBeVisible();await expect(recommendation).toHaveCount(0);
 signedIn=false;await page.goto(origin+'/pages/cuenta/');await page.getByLabel('Usuario',{exact:true}).fill('admin');await page.locator('input[name=password]').fill('prueba');await page.getByRole('button',{name:'Ingresar',exact:true}).click();await expect(page.locator('.inventory-context-bar')).toBeVisible();await expect(recommendation).toHaveCount(0);
 // The warning appears after a real submit and must be re-earned after editing.
 await page.locator('[data-new]').click();await page.keyboard.press('Tab');await page.locator('dialog input[value=weekly]').focus();await expect(page.locator('dialog input[value=weekly] + span')).toHaveCSS('text-decoration-line','none');await page.locator('dialog [type=submit]').click();await expect(page.locator('[data-warnings]')).toBeVisible();assert.equal(await page.locator('[data-warnings]').evaluate(el=>el.nextElementSibling.className),'inventory-submit-row');assert.equal(commands.length,1);assert.ok(!commands[0].confirmWarnings);
 await expect(page.locator('dialog select')).toHaveCount(0);await expect(page.locator('dialog input[name=name]')).toHaveCount(0);await expect(page.locator('.inventory-opening-date')).toHaveText('25/10/2026');await page.getByText('Fin de mes',{exact:true}).click();await expect(page.locator('[data-warnings]')).toBeHidden();await expect(page.locator('dialog [type=submit]')).toHaveText('Crear inventario');
 await page.locator('dialog [type=submit]').click();assert.equal(commands.length,2);assert.equal(commands[1].name,'25/10/2026');assert.equal(commands[1].type,'month_end');assert.equal(commands[1].confirmWarnings,false);
 mode='success';await page.locator('dialog [type=submit]').click();await expect(page.locator('dialog')).toHaveCount(0);assert.equal(commands.length,3);assert.equal(commands[2].confirmWarnings,true);assert.equal(commands[2].confirmationRevision,'revision-1');assert.equal(commands[2].id,commands[1].id);
 // An uncertain result stays recoverable after dismissing the presentation.
 mode='uncertain';await page.locator('[data-new]').click();await page.locator('dialog [type=submit]').click();await expect(page.locator('dialog [type=submit]')).toHaveText('Reintentar confirmación');await expect(page.locator('dialog input[name=type]').first()).toBeDisabled();const uncertain=commands.at(-1);
 await page.locator('dialog [data-cancel]').click();await page.locator('[data-new]').click();await expect(page.getByRole('heading',{name:'Confirmar cambio pendiente'})).toBeVisible();await page.locator('[data-retry]').click();await expect(page.locator('dialog')).toHaveCount(0);assert.deepEqual(commands.at(-1),uncertain);
 for(const status of [408,429]){
  mode='uncertain';uncertainStatus=status;await page.locator('[data-new]').click();await page.locator('dialog [type=submit]').click();await expect(page.locator('dialog [type=submit]')).toHaveText('Reintentar confirmación');await expect(page.locator('dialog input[name=type]').first()).toBeDisabled();const pending=commands.at(-1);await page.locator('dialog [type=submit]').click();await expect(page.locator('dialog')).toHaveCount(0);assert.deepEqual(commands.at(-1),pending);
 }
 // Worker can select history but cannot create. Lead sees only Service hierarchy.
 user={...user,id:'context-worker',role:'worker'};await page.goto(origin+'/');await expect(page.locator('.inventory-context-bar')).toBeVisible();await expect(page.locator('[data-new]')).toHaveCount(0);await page.locator('[data-select]').click();await expect(page.locator('[data-cycle]')).toHaveCount(2);await expect(page.locator('[data-cycle=current] .inventory-status')).toHaveText('Activo');await page.locator('[data-history-close]').click();
 user={...user,id:'context-lead',role:'service_lead'};await page.goto(origin+'/pages/admin/supervision.html');await expect(page.locator('#cycle option')).toHaveCount(2);await expect(page.locator('#create-inventory')).toHaveCount(0);
 const service=page.locator('details[data-scope="servicio"]');await expect(service).toBeVisible();await service.locator(':scope > summary').click();const waiters=page.locator('details[data-scope="servicio:garzones"]');await waiters.locator(':scope > summary').click();
 for(const name of ['Salón','Terraza','Zona Privada'])await expect(waiters.getByRole('link',{name:new RegExp(name)})).toBeVisible();
 assert.equal(await page.locator('#scope option').allTextContents().then(v=>v.some(x=>x.includes('Cocina'))),false);
 await expect(page.locator('#cycle-actions')).not.toContainText('Inventario Global');
 await page.reload();await expect(page.locator('details[data-scope="servicio"]')).toHaveAttribute('open','');await expect(page.locator('details[data-scope="servicio:garzones"]')).toHaveAttribute('open','');
 await page.getByRole('tab',{name:'Productos',exact:true}).click();
 await page.locator('#scope').selectOption('servicio:garzones:salon');
 await page.getByRole('tab',{name:'Áreas',exact:true}).click();
 await expect(page.locator('details[data-scope="servicio"]')).toBeVisible();
 assert.equal(scopeQueries.at(-1),'');
 await page.locator('#cycle').selectOption('history');await expect(page.locator('#cycle-actions')).toContainText('Finalizado');await expect(page.locator('[data-transition="open"]')).toHaveCount(0);


 // A long history remains browsable without mounting hundreds of rows or focusing search.
 cycles.push(...Array.from({length:180},(_,i)=>({id:'old-'+i,name:'Archivo '+i,type:'weekly',period:`${2023+Math.floor(i/60)}-${String(1+Math.floor(i%60/5)).padStart(2,'0')}-${String(1+i%5).padStart(2,'0')}`,state:'closed',lifecycle:'active'})));
 user={...user,id:'history-worker',role:'worker'};await page.goto(origin+'/');await page.locator('[data-select]').click();
 await expect(page.locator('[data-cycle]')).toHaveCount(24);assert.equal(await page.evaluate(()=>document.activeElement.tagName),'H2');
 await page.getByLabel('Año',{exact:true}).selectOption('2024');await expect(page.locator('[data-history-count]')).toHaveText('60 inventarios');
 await page.getByRole('button',{name:'Cargar más',exact:true}).click();await expect(page.locator('[data-cycle]')).toHaveCount(48);
 await page.getByLabel('Buscar inventario',{exact:true}).fill('01/01/2024');await expect(page.locator('[data-cycle]')).toHaveCount(1);
 await page.getByLabel('Buscar inventario',{exact:true}).fill('sin coincidencias');await expect(page.locator('[data-history-list]')).toContainText('No hay inventarios');
 await page.getByLabel('Buscar inventario',{exact:true}).fill('');
 for(const width of [320,390,654]){await page.setViewportSize({width,height:804});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await page.locator('[data-cycle]').first().click();await expect(page.getByRole('heading',{name:'Cambiar inventario',exact:true})).toBeVisible();await page.locator('dialog [data-cancel]').click();await expect(page.getByRole('heading',{name:'Seleccionar inventario',exact:true})).toBeVisible();await page.locator('[data-history-close]').click();
 console.log('PASS cycle UI: daily dismissal across reload/navigation/login; submit warnings/reset/confirmation counts; exact uncertain recovery; worker history/no-create; lead Service/Garzones hierarchy.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
