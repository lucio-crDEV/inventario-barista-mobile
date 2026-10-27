// Synthetic real API + SQLite. Counts outer statements/bindings, not billed rows.
import worker from '../../worker/index.js';
import {sqliteDB} from './sqlite-adapter.mjs';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const db=sqliteDB(13),token='a'.repeat(64),origin='https://cost.test';
try{
 db.sqlite.exec("INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES('cost-admin','cost-admin','Synthetic','!','admin',0);INSERT INTO cycles(id,name,catalog_version,state) VALUES('cost','Cost','inventory-v3-2026-10-22','open')");
 db.sqlite.prepare('INSERT INTO sessions VALUES(?,?,unixepoch()+3600)').run(createHash('sha256').update(token).digest('hex'),'cost-admin');
 const env={DB:db,APP_ENV:'production',APP_ORIGIN:origin,ACTIVE_CYCLE_ID:'cost',METRICS_ENABLED:'1'},rows=[];
 const call=async(path,payload)=>{
  const tasks=[];
  const response=await worker.fetch(new Request(origin+path,{method:payload?'POST':'GET',headers:{Cookie:`__Host-inventory_session=${token}`,...(payload?{Origin:origin,'Content-Type':'application/json','X-Inventory-User':'cost-admin'}:{})},...(payload?{body:JSON.stringify(payload)}:{})}),env,{waitUntil:p=>tasks.push(p)});
  const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));
  const timing=response.headers.get('Server-Timing'),number=name=>Number(timing.match(new RegExp(`d1_${name};desc="(\\d+)"`))[1]);
  rows.push({path,statements:number('statements'),bindings:number('calls')});await Promise.all(tasks);return data;
 };
 await call('/api/me');await call('/api/navigation?cycle=cost');await call('/api/sync?cycle=cost&cursor=0');
 const boot=await call('/api/bootstrap?cycle=cost&area=cocina');await call('/api/cycles');
 const overview=await call('/api/admin/supervision?cycle=cost');
 await call('/api/admin/supervision?cycle=cost&version='+encodeURIComponent(overview.version));
 const item=boot.items.find(i=>i.active&&i.unit);
 await call('/api/count',{id:randomUUID(),cycleId:'cost',itemId:item.id,locationId:item.locationId,unit:item.unit,quantity:1,status:'counted',note:'',outOfStock:false,action:'direct',expectedVersion:0});
 console.log(JSON.stringify({fixture:{catalog:1268,cycles:1,role:'admin'},rows,limits:['Synthetic local API requests, no remote traffic.','Counts outside triggers; excludes collector writes.','Not billed rows, production latency, CPU or throughput.']},null,2));
}finally{db.sqlite.close();}
