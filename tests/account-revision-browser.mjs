import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname,resolve } from 'node:path';
import { chromium } from '@playwright/test';
const root=resolve('.');
const actor={id:'a0000000-0000-4000-8000-000000000001',username:'fixture-admin',name:'Administradora de prueba',role:'admin',revision:1,active:true,mustChange:false};
const scopes=[{id:'cocina',name:'Cocina',parent:null},{id:'servicio',name:'Servicio',parent:null},{id:'servicio:barra',name:'Barra',parent:'servicio'}];
const users=[actor,{id:'b0000000-0000-4000-8000-000000000002',username:'fixture-worker',name:'Persona de prueba',role:'worker',revision:1,active:true,mustChange:false,grants:['cocina']}].map(u=>({...u,grants:u.grants||[]}));
let attempts=[],failed=false;
const server=createServer(async(req,res)=>{
  try{
    const path=new URL(req.url,'http://test').pathname;
    if(path.startsWith('/api/')){
      let input='';for await(const chunk of req)input+=chunk;
      const body=input?JSON.parse(input):null;
      if(req.method==='POST')attempts.push({path,body});
      res.setHeader('Content-Type','application/json');
      if(failed && req.method==='POST'){res.statusCode=503;res.end(JSON.stringify({code:'UNAVAILABLE',message:'Resultado no confirmado'}));return;}
      let data=path==='/api/me'?{user:actor}:path==='/api/admin/users'&&req.method==='GET'?{user:actor,users,scopes}:{ok:true,id:'c0000000-0000-4000-8000-000000000003'};
      res.end(JSON.stringify(data));return;
    }
    const route=path.endsWith('/')?path+'index.html':path;
    const file=resolve(root,'.'+route);if(!file.startsWith(root+'/'))throw Error('path');
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(file)]||'text/plain');res.end(await readFile(file));
  }catch{res.statusCode=404;res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},permissions:['clipboard-read','clipboard-write']});
 await page.addInitScript(()=>{Object.defineProperty(navigator,'share',{value:async data=>{window.__sharedFixture=data;},configurable:true});});
 await page.goto(origin+'/pages/admin/');
 await page.addStyleTag({path:resolve('shared/account-ux.css')});
 await page.locator('.create-user-trigger').waitFor();
 assert.equal(await page.locator('.users-list .user-card').count(),2);
 await page.waitForTimeout(200);await page.screenshot({path:'/tmp/account-revision-users.png'});
 await page.locator('.create-user-trigger').click();
 await page.locator('#create [name=username]').fill('new-fixture');await page.locator('#create [name=name]').fill('Persona nueva');
 await page.locator('[data-create-next]').click();await page.locator('[data-create-next]').click();
 assert.match(await page.locator('.create-feedback').innerText(),/Selecciona/);
 await page.locator('#create [name=grants][value=cocina]').check();await page.locator('[data-create-next]').click();
 await page.screenshot({path:'/tmp/account-revision-wizard.png'});
 const password=await page.locator('#create [name=password]').inputValue();assert.match(password,/-[a-zA-Z2-9]{12}$/);
 await page.locator('#create .regenerate-password').click();assert.notEqual(await page.locator('#create [name=password]').inputValue(),password);
 await page.locator('[data-create-next]').click();await page.locator('.account-credentials').waitFor();
 assert.deepEqual(attempts[0].body.grants,['cocina']);
 await page.locator('[data-copy]').click();await page.waitForFunction(()=>document.querySelector('.credential-feedback')?.textContent.includes('copiados'));
 await page.locator('[data-share]').click();assert.equal((await page.evaluate(()=>window.__sharedFixture)).text.includes(attempts[0].body.password),true);assert.equal((await page.evaluate(()=>window.__sharedFixture)).url,undefined);
 assert.ok(!(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}))).includes(attempts[0].body.password));
 await page.locator('[data-close]').click();
 // Reset is generated, requires confirmation, and only then delivers access.
 const workerRow=page.locator('.user-card[data-id="'+users[1].id+'"]');await workerRow.locator('.user-details > summary').click();await workerRow.getByRole('tab',{name:'Seguridad',exact:true}).click();
 assert.match(await workerRow.locator('[data-reset] [name=password]').inputValue(),/-[a-zA-Z2-9]{12}$/);
 await workerRow.getByRole('button',{name:'Restablecer contraseña',exact:true}).click();
 assert.equal(await page.locator('.account-credentials').count(),0);await page.locator('[data-confirm]').click();await page.locator('.account-credentials').waitFor();
 assert.equal(attempts.at(-1).path,'/api/admin/users/'+users[1].id+'/password');await page.locator('[data-close]').click();
 // Dismiss a draft by a full outside gesture, reopen it, and retain its values.
 await page.locator('.create-user-trigger').click();await page.locator('#create [name=username]').fill('draft-fixture');
 await page.mouse.click(5,5);await page.locator('.account-create').waitFor({state:'detached'});
 await page.locator('.create-user-trigger').click();assert.equal(await page.locator('#create [name=username]').inputValue(),'draft-fixture');
 // A pointer gesture beginning inside and ending outside must keep the draft.
 const field=await page.locator('#create [name=username]').boundingBox();await page.mouse.move(field.x+10,field.y+10);await page.mouse.down();await page.mouse.move(5,5);await page.mouse.up();assert.equal(await page.locator('.account-create').count(),1);
 await page.keyboard.press('Escape');await page.locator('.account-create').waitFor({state:'detached'});
 // Failed/uncertain create never opens the credential delivery dialog.
 await page.locator('.create-user-trigger').click();await page.locator('#create [name=name]').fill('No confirmar');await page.locator('[data-create-next]').click();await page.locator('#create [name=grants][value=cocina]').check();await page.locator('[data-create-next]').click();failed=true;await page.locator('[data-create-next]').click();await page.waitForFunction(()=>document.querySelector('.create-feedback')?.textContent.includes('No se confirmó'));
 assert.equal(await page.locator('.account-credentials').count(),0);await page.keyboard.press('Escape');await page.locator('.account-create').waitFor({state:'detached'});failed=false;
 // Menu uses platform-independent SVG, no avatar, and exact current labels.
 await page.locator('[data-settings-toggle]').click();assert.equal(await page.locator('.identity-avatar').count(),0);assert.equal(await page.getByRole('link',{name:'Mi perfil',exact:true}).count(),1);assert.equal(await page.getByRole('link',{name:'Cambiar contraseña',exact:true}).count(),0);assert.equal(await page.getByRole('link',{name:'Panel de supervisión',exact:true}).count(),1);assert.equal(await page.getByRole('link',{name:'Gestionar usuarios y accesos',exact:true}).count(),1);
 await page.waitForTimeout(200);await page.screenshot({path:'/tmp/account-revision-menu.png'});
 assert.equal(await page.locator('.sync-refresh svg').count(),1);assert.ok(!(await page.locator('.identity-person').innerText()).includes('Compartido'));
 for(const width of [320,390,1024])for(const theme of ['light','dark']){await page.setViewportSize({width,height:844});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}/${theme}: no horizontal overflow`);}
 await page.getByRole('link',{name:'Mi perfil',exact:true}).click();await page.getByRole('link',{name:'Cambiar contraseña',exact:true}).waitFor();
 console.log('Account browser revision: wizard/access guard, generated credentials, failed response, backdrop/draft, menu/profile and 6 viewport/theme checks passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
