import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import worker from '../worker/index.js';
import {sqliteDB} from './shared/sqlite-adapter.mjs';
const origin='https://delivery.test';
test('Protected HTML redirects without a cookie before loading page assets or querying the database',async()=>{
 let assets=0;
 const env={APP_ENV:'production',ASSETS:{fetch:async()=>{assets++;return new Response('page');}},DB:{prepare(){throw Error('Should not query without a cookie');}}};
 for(const path of ['/','/index.html','/pages/inventario/','/pages/inventario/index.html','/pages/admin/','/pages/admin/supervision','/pages/admin/supervision.html']){
  const response=await worker.fetch(new Request(origin+path),env,{});
  assert.equal(response.status,302,path);assert.equal(response.headers.get('location'),'/pages/cuenta/');assert.equal(response.headers.get('cache-control'),'no-store');
 }
 assert.equal(assets,0);
});
test('Valid identity receives uncacheable HTML; revoked and forced-change sessions redirect before page code',async()=>{
 const DB=sqliteDB(15),raw='a'.repeat(64),hash=createHash('sha256').update(raw).digest('hex');let assets=0;
 try{
  DB.sqlite.exec("INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES('delivery','delivery','Synthetic','!','admin',0)");
  DB.sqlite.prepare('INSERT INTO sessions VALUES(?,?,unixepoch()+3600)').run(hash,'delivery');
  const env={DB,APP_ENV:'production',ASSETS:{fetch:async()=>{assets++;return new Response('<h1>Page</h1>',{headers:{'Content-Type':'text/html','Cache-Control':'public,max-age=1'}});}}};
  const call=()=>worker.fetch(new Request(origin+'/',{headers:{Cookie:'__Host-inventory_session='+raw}}),env,{});
  assert.equal((await call()).headers.get('cache-control'),'no-store');assert.equal(assets,1);
  DB.sqlite.exec("UPDATE users SET must_change=1 WHERE id='delivery'");assert.equal((await call()).status,302);assert.equal(assets,1);
  DB.sqlite.exec('DELETE FROM sessions');assert.equal((await call()).status,302);assert.equal(assets,1);
 }finally{DB.sqlite.close();}
});
test('Public hashed JS/CSS and login stay reachable; private and unknown files cannot reach the asset binding',async()=>{
 const seen=[],env={ASSETS:{fetch:async req=>{seen.push(new URL(req.url).pathname);return new Response('asset');}}};
 for(const path of ['/pages/cuenta/','/assets/home-ABCD1234.js','/assets/account-styles-ABCD1234.css'])assert.equal((await worker.fetch(new Request(origin+path),env,{})).status,200);
 for(const path of ['/assets/private.xlsx','/worker/session.js','/data/inventario/items/catalogo-excel.js','/inventarios_og/11_10-INVENTARIO-totalizado.xlsx','/.backups/database.sql','/unknown.html'])assert.equal((await worker.fetch(new Request(origin+path),env,{})).status,404);
 assert.equal(seen.length,3);
});
