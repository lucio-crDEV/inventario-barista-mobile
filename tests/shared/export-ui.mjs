import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const browser=await chromium.launch({headless:true});
const out=process.env.EXPORT_UI_OUTPUT;
if(out)await mkdir(out,{recursive:true});
const snapshotId='synthetic-snapshot-00000001';
const cycle={id:'synthetic-cycle',name:'Inventario de prueba',lifecycle:'active',state:'closed',revision:4,completion_revision:8,scopeStates:[],type:'weekly',period:'2026-10-28'};
const contexts=[];let tested=0;
try {
 for(const theme of ['light','dark'])for(const width of [320,390,1024]) {
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',acceptDownloads:true});contexts.push(context);
  await context.addInitScript(value=>localStorage.setItem('inventario-theme',value),theme);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let role='admin',captured=false,generated=false,polls=0,blocked=false,permanent=false,moduleFailure=false,uncertain=true,firstCommand;
  const user=()=>({id:'synthetic-admin',username:'admin-prueba',name:'Cuenta de prueba',role,mustChange:false,revision:1});
  await page.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname;
   let data;
   if(path==='/api/me')data={user:user()};
   else if(path==='/api/cycles')data={user:user(),cycles:[cycle],defaultCycleId:cycle.id};
   else if(path==='/api/admin/exports')data={snapshots:captured?[{id:snapshotId,cycle_id:cycle.id,cycle_name:cycle.name,created_at:'2026-10-28T05:00:00Z'}]:[]};
   else if(path==='/api/admin/export-snapshots') {
    const command=JSON.parse(request.postData());assert.equal(command.cycleId,cycle.id);assert.equal(command.expectedRevision,4);assert.equal(command.expectedCompletionRevision,8);
    if(firstCommand)assert.deepEqual(command,firstCommand);else firstCommand=command;
    captured=true;
    if(uncertain){uncertain=false;await route.abort('failed');return;}
    data={snapshotId};
   } else if(path.endsWith('/artifact'))data=permanent?{snapshotId,state:'failed',retryable:false}:{snapshotId,state:generated?(++polls>1?'ready':'queued'):'not_started'};
   else if(path.endsWith('/generate')){assert.deepEqual(JSON.parse(request.postData()),{});generated=true;data={snapshotId,state:'queued'};}
   else if(path.endsWith('/file')) {await route.fulfill({status:200,contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',headers:{'Content-Disposition':'attachment; filename="inventario-prueba.xlsx"'},body:Buffer.from([80,75,3,4])});return;}
   else if(path===`/api/admin/export-snapshots/${snapshotId}`)data={snapshotId,capturedAt:'2026-10-28T05:00:00Z',review:{ready:!blocked,summary:{numeric:10,blank:1141,partial:1,roundedToZero:1,blockers:blocked?1:0},blockers:blocked?[{name:'<img src=x onerror=alert(1)>',code:'CONVERSION_REQUIRED',sheet:'cocina',cell:'C10'}]:[]}};
   if(data){await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});return;}
   const file=resolve('dist',path==='/'?'index.html':'.'+path+(path.endsWith('/')?'index.html':''));
   if(!file.startsWith(resolve('dist')+'/')){await route.fulfill({status:404,body:''});return;}
   try{const body=await readFile(file);if(moduleFailure&&extname(file)==='.js'&&body.includes('Sin inventarios finalizados')){moduleFailure=false;await route.abort('failed');return;}await route.fulfill({status:200,contentType:({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[extname(file)]||'text/plain',body});}catch{await route.fulfill({status:404,body:''});}
  });
  await page.goto('http://127.0.0.1:8877/pages/cuenta/?profile=1');
  await page.getByRole('button',{name:'Revisar Excel',exact:true}).waitFor();
  assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
  await page.waitForFunction(()=>!document.querySelector('.export-form button').disabled);
  await page.getByRole('button',{name:'Revisar Excel',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.export-feedback').dataset.tone==='error');
  await page.getByRole('button',{name:'Revisar Excel',exact:true}).click();
  await page.getByRole('button',{name:'Generar Excel',exact:true}).waitFor();
  assert.equal(await page.locator('html').evaluate(el=>el.scrollWidth<=innerWidth),true);
  assert.ok(await page.getByText('solo ubicaciones terminadas.',{exact:false}).isVisible());
  if(out&&width===390)await page.screenshot({path:resolve(out,`export-${theme}.png`),fullPage:true});
  await page.getByRole('button',{name:'Generar Excel',exact:true}).click();
  await page.getByRole('button',{name:'Descargar Excel',exact:true}).waitFor({timeout:10000});
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar Excel',exact:true}).click();
  assert.equal((await download).suggestedFilename(),'inventario-prueba.xlsx');
  await page.locator('.export-history summary').click();
  permanent=true;await page.locator('[data-snapshot]').click();
  await page.getByRole('button',{name:'Generación no disponible',exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.export-card').getAttribute('aria-busy')==='false');
  assert.equal(await page.getByRole('button',{name:'Generación no disponible',exact:true}).isDisabled(),true);
  permanent=false;blocked=true;await page.locator('[data-snapshot]').click();
  await page.getByText('1 producto requiere revisión antes de generar.').waitFor();
  assert.equal(await page.getByRole('button',{name:'Generar Excel',exact:true}).count(),0);
  await page.getByText('Ver productos',{exact:true}).click();assert.equal(await page.locator('.export-issues img').count(),0);
  assert.equal(await page.locator('.export-issues').textContent().then(t=>t.includes('<img')),true);
  for(role of ['service_lead','worker']) {
   await page.reload();await page.getByRole('heading',{name:'Mi perfil',exact:true}).waitFor();
   assert.equal(await page.locator('.export-card').count(),0);
  }
  role='admin';moduleFailure=true;await page.reload();
  await page.getByRole('button',{name:'Reintentar exportación',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Guardar nombre visible',exact:true}).isEnabled(),true);
  await page.getByRole('button',{name:'Reintentar exportación',exact:true}).click();
  await page.getByRole('button',{name:'Revisar Excel',exact:true}).waitFor();
  assert.deepEqual(errors,[]);await context.close();tested++;
 }
 console.log(JSON.stringify({pass:true,syntheticUI:true,viewports:[320,390,1024],themes:['light','dark'],cases:tested,checks:['admin only','uncertain capture retries same id','review and warnings','server job progress','download','history','blockers and escaped text','no overflow'],productionCertified:false}));
}finally{await browser.close();}
