// Operational inventory supervision, separate from technical usage metrics.
const actor = `WITH actor AS (SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id
 WHERE s.hash=?1 AND s.expires>unixepoch() AND u.active=1 AND u.deleted_at IS NULL AND u.must_change=0 AND u.role IN ('admin','service_lead')),
 allowed AS (SELECT p.scope_id FROM inventory_permissions p JOIN actor a ON a.id=p.user_id) `;
const inventory = "supervision_items";
export async function supervisionRequest(req, db, url, {u,hash}, {json,fail,body,userDTO,digest}) {
  if (!['admin','service_lead'].includes(u.role)) fail(403,'SUPERVISOR_REQUIRED','No tienes acceso a supervisión.');
  const p=url.pathname, q=url.searchParams;
  if (p==='/api/admin/supervision/cycles' && req.method==='GET') {
    const rows=await db.prepare(actor+`SELECT c.* FROM cycles c WHERE EXISTS(SELECT 1 FROM catalog_items ci WHERE ci.version=c.catalog_version AND ci.location_id IN(SELECT scope_id FROM allowed)) ORDER BY c.rowid DESC LIMIT 100`).bind(hash).all();
    return json({user:userDTO(u),cycles:rows.results});
  }
  if(p==='/api/admin/supervision/command' && req.method==='POST') {
    const b=await body(req);
    const keys=['id','cycleId','expectedRevision','kind','itemId','locationId','expectedVersion','quantity','status','note','outOfStock','active','scope','state','reason','confirm','acknowledgeDrafts'];
    if(Object.keys(b).some(k=>!keys.includes(k))||!/^[-a-zA-Z0-9]{16,80}$/.test(b.id||'')||typeof b.cycleId!=='string'||b.cycleId.length>150||!b.cycleId||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<1||!['rectify','annul','activation','state'].includes(b.kind)||b.confirm!==true||typeof b.reason!=='string'||b.reason.trim().length<3||b.reason.trim().length>500) fail(400,'INVALID_COMMAND','Revisa los datos y escribe un motivo de 3 a 500 caracteres.');
    if(u.role==='service_lead' && (b.kind==='activation'||(b.kind==='state' && b.scope!=='servicio'))) fail(403,'FORBIDDEN');
    if(b.kind==='state'){
      if(!['','servicio'].includes(b.scope)||!['open','review','closed'].includes(b.state)||(b.state==='closed'&&b.acknowledgeDrafts!==true)) fail(400,'INVALID_TRANSITION','Confirma la revisión de borradores de los participantes antes de cerrar.');
    }else{
      if(['itemId','locationId'].some(k=>typeof b[k]!=='string'||!b[k]||b[k].length>150)||!Number.isSafeInteger(b.expectedVersion)||b.expectedVersion<0) fail(400,'INVALID_ITEM');
      if(b.kind==='activation'&&typeof b.active!=='boolean')fail(400,'INVALID_COMMAND');
      if(b.kind==='rectify' && (typeof b.quantity!=='number'||!Number.isFinite(b.quantity)||b.quantity<0||b.quantity>1000000||Math.abs(b.quantity*1000-Math.round(b.quantity*1000))>1e-6||!['counted','partial'].includes(b.status)||typeof b.note!=='string'||b.note.length>1000||typeof b.outOfStock!=='boolean'||(b.outOfStock&&(b.quantity!==0||b.status!=='counted'))))fail(400,'INVALID_COUNT');
    }
    const fingerprint=await digest(JSON.stringify(keys.map(k=>b[k]??null)));
    try{
      await db.prepare(`INSERT INTO supervision_commands(id,fingerprint,user_id,session_hash,user_revision,cycle_id,expected_revision,kind,item_id,location_id,expected_version,q,status,note,out_of_stock,active,new_state,scope_id,reason) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(b.id,fingerprint,u.id,hash,u.revision,b.cycleId,b.expectedRevision,b.kind,b.itemId||'',b.locationId||'',b.expectedVersion||0,b.kind==='rectify'?Math.round(b.quantity*1000):0,b.kind==='rectify'?b.status:'counted',b.kind==='rectify'?b.note:'',b.kind==='rectify'&&b.outOfStock?1:0,b.active===false?0:1,b.state||'',b.scope||'',b.reason.trim()).run();
    }catch(e){
      const code=['FORBIDDEN','ID_REUSED','CYCLE_CHANGED','STALE','CYCLE_CLOSED','ITEM_INACTIVE','INVALID_TRANSITION','PENDING_ITEMS','INVALID_SCOPE'].find(c=>e.message.includes(c));
      if(code)fail(code==='FORBIDDEN'?403:409,code,({PENDING_ITEMS:'Hay productos activos pendientes o en avance. Deben estar contados antes de cerrar.',CYCLE_CHANGED:'El inventario cambió. Actualiza y revisa antes de confirmar.',STALE:'El producto cambió. Actualiza y revisa su versión.'})[code]||'No se pudo aplicar el cambio. Actualiza y revisa el estado del inventario.');
      throw e;
    }
    const row=await db.prepare(actor+`SELECT m.result FROM supervision_commands m JOIN actor a ON a.id=m.user_id WHERE m.id=?2`).bind(hash,b.id).first();
    if(!row)fail(403,'FORBIDDEN');
    return json(JSON.parse(row.result));
  }

  const cycle=q.get('cycle');
  if (req.method==='GET') {
    if (!cycle || cycle.length>150) fail(400,'CYCLE_REQUIRED','Selecciona un inventario.');
    const cy=await db.prepare(actor+`SELECT c.* FROM cycles c WHERE c.id=?2 AND EXISTS(SELECT 1 FROM catalog_items ci WHERE ci.version=c.catalog_version AND ci.location_id IN(SELECT scope_id FROM allowed))`).bind(hash,cycle).first();
    if (!cy) fail(404,'CYCLE_NOT_FOUND','Inventario no disponible.');
    const scope=q.get('scope')||'';
    if (scope && !await db.prepare(actor+`SELECT 1 ok FROM scopes WHERE id=?2 AND id IN(SELECT scope_id FROM allowed)`).bind(hash,scope).first()) fail(403,'FORBIDDEN');
    const within=` AND (?3='' OR i.location_id IN(SELECT descendant FROM scope_closure WHERE ancestor=?3))`;
    if(p==='/api/admin/supervision/authors') {
      const rows=await db.prepare(actor+`SELECT DISTINCT h.user_id id,u.name FROM history h JOIN users u ON u.id=h.user_id WHERE h.cycle_id=?2 AND h.location_id IN(SELECT scope_id FROM allowed) ORDER BY u.name LIMIT 500`).bind(hash,cycle).all();
      return json({authors:rows.results});
    }
    if(p==='/api/admin/supervision/events') {
      const before=Number(q.get('cursor')||0);if(!Number.isSafeInteger(before)||before<0)fail(400,'INVALID_CURSOR');
      const rows=await db.prepare(actor+`SELECT m.rowid seq,m.kind,m.reason,m.created_at,m.user_id,m.scope_id,m.result FROM supervision_commands m WHERE m.cycle_id=?2 AND EXISTS(SELECT 1 FROM actor WHERE role='admin') AND (?3=0 OR m.rowid<?3) ORDER BY m.rowid DESC LIMIT 51`).bind(hash,cycle,before).all();
      if(u.role!=='admin')fail(403,'FORBIDDEN');
      const page=rows.results.slice(0,50);return json({events:page.map(m=>({...m,result:JSON.parse(m.result)})),nextCursor:rows.results.length>50?page.at(-1).seq:null});
    }
    if (p==='/api/admin/supervision') {
      const data=await db.batch([
        db.prepare(actor+`SELECT s.* FROM scopes s WHERE s.id IN(SELECT scope_id FROM allowed) ORDER BY s.id`).bind(hash),
        db.prepare(actor+`SELECT json_extract(i.data,'$.areaId') areaId, sum(i.active) total,
         sum(i.active=0) excluded, sum(i.active=1 AND i.status='counted') counted,
         sum(i.active=1 AND i.status='partial') partial, sum(i.active=1 AND i.status='pending') pending
         FROM ${inventory} i WHERE i.cycle_id=?2 AND i.location_id IN(SELECT scope_id FROM allowed) ${within} GROUP BY areaId`).bind(hash,cycle,scope),
      ]);
      return json({user:userDTO(u),cycle:{...cy,scopeStates:(await db.prepare(actor+`SELECT cs.scope_id,cs.state FROM cycle_scope_states cs WHERE cs.cycle_id=?2 AND cs.scope_id IN(SELECT scope_id FROM allowed)`).bind(hash,cycle).all()).results},scopes:data[0].results,groups:data[1].results,updatedAt:new Date().toISOString()});
    }
    const cursor=Number(q.get('cursor')||0);
    if (!Number.isSafeInteger(cursor)||cursor<0) fail(400,'INVALID_CURSOR');
    if (p==='/api/admin/supervision/items') {
      const status=q.get('status')||'',search=q.get('q')||'';
      if (!['','pending','partial','counted','excluded'].includes(status)||search.length>100) fail(400,'INVALID_FILTER');
      const rows=await db.prepare(actor+`SELECT i.* FROM ${inventory} i WHERE i.cycle_id=?2 AND i.location_id IN(SELECT scope_id FROM allowed) ${within}
       AND (?4='' OR (?4='excluded' AND i.active=0) OR (i.active=1 AND i.status=?4))
       AND instr(lower(json_extract(i.data,'$.name')),lower(?5))>0 AND i.position>?6 ORDER BY i.position LIMIT 51`).bind(hash,cycle,scope,status,search,cursor).all();
      const page=rows.results.slice(0,50);
      return json({items:page.map(x=>({id:x.id,locationId:x.location_id,name:JSON.parse(x.data).name,unit:x.unit,active:!!x.active,status:x.status,record:x.record?JSON.parse(x.record):null})),nextCursor:rows.results.length>50?page.at(-1).position:null});
    }
    if (p==='/api/admin/supervision/history') {
      const params=[hash,cycle,scope];let filter='';
      for (const [key,col] of [['item','item_id'],['location','location_id'],['author','user_id'],['action','action']]) {
        const v=q.get(key); if(v){if(v.length>150)fail(400,'INVALID_FILTER');params.push(v);filter+=` AND h.${col}=?${params.length}`;}
      }
      for(const [key,operator] of [['from','>='],['to','<=']]) {
        const v=q.get(key);if(v){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)||!Number.isFinite(Date.parse(v)))fail(400,'INVALID_DATE');params.push(v);filter+=` AND h.created_at${operator}?${params.length}`;}
      }
      params.push(cursor); const slot=params.length;
      const rows=await db.prepare(actor+`SELECT h.*,json_extract(ci.data,'$.name') product FROM history h JOIN cycles cy ON cy.id=h.cycle_id JOIN catalog_items ci ON ci.version=cy.catalog_version AND ci.id=h.item_id AND ci.location_id=h.location_id WHERE h.cycle_id=?2 AND h.location_id IN(SELECT scope_id FROM allowed)
       AND (?3='' OR h.location_id IN(SELECT descendant FROM scope_closure WHERE ancestor=?3)) ${filter} AND (?${slot}=0 OR h.seq<?${slot}) ORDER BY h.seq DESC LIMIT 51`).bind(...params).all();
      const page=rows.results.slice(0,50);
      return json({history:page.map(h=>({seq:h.seq,operationId:h.operation_id,itemId:h.item_id,locationId:h.location_id,authorId:h.user_id,action:h.action,createdAt:h.created_at,product:h.product,reason:h.reason,before:JSON.parse(h.before_record),after:JSON.parse(h.after_record)})),nextCursor:rows.results.length>50?page.at(-1).seq:null});
    }

  }
  fail(404,'NOT_FOUND');
}
