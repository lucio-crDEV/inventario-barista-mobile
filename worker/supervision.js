import { cyclesEnabled, warningData } from './inventory-cycles.js';
import { cycleItemsSQL } from './inventory-sql.js';
// Operational inventory supervision, separate from technical usage metrics.
const actor = `WITH actor AS (SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id
 WHERE s.hash=?1 AND s.expires>unixepoch() AND u.active=1 AND u.deleted_at IS NULL AND u.must_change=0 AND u.role IN ('admin','service_lead')),
 allowed AS (SELECT p.scope_id FROM inventory_permissions p JOIN actor a ON a.id=p.user_id) `;
const inventory = cycleItemsSQL();
const parse = value => value ? JSON.parse(value) : null;
export function historyDTO(h) {
  const after = parse(h.after_record), before = parse(h.before_record), entered = parse(h.entered_record);
  return {seq:h.seq,operationId:h.operation_id,itemId:h.item_id,locationId:h.location_id,authorId:h.user_id,
    authorName:after?.authorName || h.author_name || '',action:h.action,createdAt:h.created_at,product:h.product,unit:h.unit || after?.unit,
    reason:h.reason || '',before,entered,after};
}
export function workerHistoryDTO(h) {
  const after=parse(h.after_record);
  return {authorName:after?.authorName || h.author_name || '',createdAt:h.created_at,quantity:after?.quantity ?? null,unit:after?.unit || '',status:after?.status || 'pending'};
}
export async function supervisionRequest(req, db, url, {u,hash,metadataRevision=0}, {json,fail,body,userDTO,digest}) {
  if (!['admin','service_lead'].includes(u.role)) fail(403,'SUPERVISOR_REQUIRED','No tienes acceso a supervisión.');
  const p=url.pathname, q=url.searchParams;
  if (p==='/api/admin/supervision/cycles' && req.method==='GET') {
    const rows=await db.prepare(actor+`SELECT c.* FROM cycles c WHERE EXISTS(SELECT 1 FROM catalog_items ci WHERE ci.version=c.catalog_version AND ci.location_id IN(SELECT scope_id FROM allowed)) ORDER BY c.rowid DESC LIMIT 100`).bind(hash).all();
    return json({user:userDTO(u),cycles:rows.results});
  }
  if(p==='/api/admin/supervision/command' && req.method==='POST') {
    const b=await body(req);
    // Preserve the original fingerprint field order and optional legacy checkbox:
    // a retry accepted before migration must recover exactly its original result.
    const legacyKeys=['id','cycleId','expectedRevision','kind','itemId','locationId','expectedVersion','quantity','status','note','outOfStock','active','scope','state','reason','confirm','acknowledgeDrafts'];
    const oldKeys=[...legacyKeys,'expectedActivityRevision','confirmWarnings','confirmationRevision'];
    const keys=[...oldKeys,'allowIncomplete','completionRevision'];
    if(('allowIncomplete' in b && typeof b.allowIncomplete!=='boolean') || ('completionRevision' in b && (!Number.isSafeInteger(b.completionRevision)||b.completionRevision<1)) || (('allowIncomplete' in b || 'completionRevision' in b) && (b.kind!=='state'||b.state!=='closed')) || (b.allowIncomplete===true && !Number.isSafeInteger(b.completionRevision)))fail(400,'INVALID_COMMAND');
    if(('confirmWarnings' in b&&typeof b.confirmWarnings!=='boolean')||('confirmationRevision' in b&&(!Number.isSafeInteger(b.confirmationRevision)||b.confirmationRevision<1)))fail(400,'INVALID_COMMAND');
    if(Object.keys(b).some(k=>!keys.includes(k))||!/^[-a-zA-Z0-9]{16,80}$/.test(b.id||'')||typeof b.cycleId!=='string'||b.cycleId.length>150||!b.cycleId||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<1||!['rectify','annul','activation','state'].includes(b.kind)||b.confirm!==true||('reason' in b && typeof b.reason!=='string')) fail(400,'INVALID_COMMAND','Revisa los datos del cambio.');
    if('expectedActivityRevision' in b && (!Number.isSafeInteger(b.expectedActivityRevision)||b.expectedActivityRevision<0))fail(400,'INVALID_COMMAND');
    const reason=(b.reason || '').trim();
    if(reason.length>500 || (reason.length>0 && reason.length<3) || (b.kind==='state'&&b.state==='open'&&reason.length<3)) fail(400,'REASON_REQUIRED','Escribe un motivo de 3 a 500 caracteres para reabrir.');
    if(u.role==='service_lead' && (b.kind==='activation'||(b.kind==='state' && b.scope!=='servicio'))) fail(403,'FORBIDDEN');
    if(b.kind==='state'){
      if(!['','servicio'].includes(b.scope)||!['open','review','closed'].includes(b.state)) fail(400,'INVALID_TRANSITION','Selecciona un cambio de estado válido.');
    }else{
      if(['itemId','locationId'].some(k=>typeof b[k]!=='string'||!b[k]||b[k].length>150)||!Number.isSafeInteger(b.expectedVersion)||b.expectedVersion<0) fail(400,'INVALID_ITEM');
      if(b.kind==='activation'&&(typeof b.active!=='boolean'||('expectedActivityRevision' in b && (!Number.isSafeInteger(b.expectedActivityRevision)||b.expectedActivityRevision<0))))fail(400,'INVALID_COMMAND');
      if(b.kind==='rectify' && (typeof b.quantity!=='number'||!Number.isFinite(b.quantity)||b.quantity<0||b.quantity>1000000||Math.abs(b.quantity*1000-Math.round(b.quantity*1000))>1e-6||!['counted','partial'].includes(b.status)||typeof b.note!=='string'||b.note.length>1000||typeof b.outOfStock!=='boolean'||(b.outOfStock&&(b.quantity!==0||b.status!=='counted'))))fail(400,'INVALID_COUNT');
    }
    const fingerprint=await digest(JSON.stringify(('allowIncomplete' in b||'completionRevision' in b?keys:'confirmWarnings' in b||'confirmationRevision' in b?oldKeys:'expectedActivityRevision' in b?[...legacyKeys,'expectedActivityRevision']:legacyKeys).map(k=>b[k]??null)));
    const modernCycles=await cyclesEnabled(db);
    const completionEnabled=!!await db.prepare("SELECT 1 ok FROM pragma_table_info('supervision_commands') WHERE name='allow_incomplete'").first();
    if(('allowIncomplete' in b||'completionRevision' in b)&&!completionEnabled)fail(503,'FINALIZATION_NOT_READY','La opción de finalizar con pendientes aún no está disponible.');
    try{
      await db.prepare(`INSERT INTO supervision_commands(id,fingerprint,user_id,session_hash,user_revision,cycle_id,expected_revision,kind,item_id,location_id,expected_version,q,status,note,out_of_stock,active,new_state,scope_id,reason,expected_activity_revision${modernCycles?',confirm_warnings,confirmation_revision':''}${completionEnabled?',allow_incomplete,completion_revision':''}) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?${modernCycles?',?,?':''}${completionEnabled?',?,?':''})`).bind(b.id,fingerprint,u.id,hash,u.revision,b.cycleId,b.expectedRevision,b.kind,b.itemId||'',b.locationId||'',b.expectedVersion||0,b.kind==='rectify'?Math.round(b.quantity*1000):0,b.kind==='rectify'?b.status:'counted',b.kind==='rectify'?b.note:'',b.kind==='rectify'&&b.outOfStock?1:0,b.active===false?0:1,b.state||'',b.scope||'',reason,b.expectedActivityRevision??-1,...(modernCycles?[b.confirmWarnings===true?1:0,b.confirmationRevision??-1]:[]),...(completionEnabled?[b.allowIncomplete===true?1:0,b.completionRevision??-1]:[])).run();
    }catch(e){
      const code=['COMPLETION_CHANGED','CONFIRMATION_REQUIRED','CONFIRMATION_CHANGED','FORBIDDEN','ADMIN_REOPEN_REQUIRED','REASON_REQUIRED','ID_REUSED','CYCLE_CHANGED','ACTIVITY_CHANGED','STALE','CYCLE_CLOSED','ITEM_INACTIVE','INVALID_TRANSITION','PENDING_ITEMS','INVALID_SCOPE'].find(c=>e.message.includes(c));
      if(['PENDING_ITEMS','COMPLETION_CHANGED'].includes(code)&&completionEnabled){
        const counts=await db.prepare(`SELECT sum(active=1 AND status='pending') pending,sum(active=1 AND status='partial') partial FROM ${cycleItemsSQL({cycle:'?1'})} WHERE (?2='' OR location_id IN(SELECT descendant FROM scope_closure WHERE ancestor=?3))`).bind(b.cycleId,b.scope||'',b.scope||'').first();
        const current=await db.prepare('SELECT completion_revision FROM cycles WHERE id=?').bind(b.cycleId).first();
        fail(409,code,code==='COMPLETION_CHANGED'?'Los conteos cambiaron. Revisa los pendientes antes de finalizar.':'Quedan productos sin completar.',{completion:{pending:Number(counts.pending)||0,partial:Number(counts.partial)||0},completionRevision:current.completion_revision});
      }
      if(code?.startsWith('CONFIRMATION_'))fail(409,code,'Revisa los avisos y confirma la reapertura.',await warningData(db,{kind:'activate',cycleId:b.cycleId}));
      if(code)fail(['FORBIDDEN','ADMIN_REOPEN_REQUIRED'].includes(code)?403:409,code,({ADMIN_REOPEN_REQUIRED:'Solo un Administrador puede reabrir un inventario finalizado.',PENDING_ITEMS:'Hay productos activos pendientes o en avance. Deben estar contados antes de finalizar.',CYCLE_CHANGED:'El inventario cambió. Actualiza y revisa antes de confirmar.',ACTIVITY_CHANGED:'La actividad del producto cambió. Actualiza antes de continuar.',STALE:'El producto cambió. Actualiza y revisa su versión.'})[code]||'No se pudo aplicar el cambio. Actualiza y revisa el estado del inventario.');
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
      if(u.role!=='admin')fail(403,'FORBIDDEN');
      const before=Number(q.get('cursor')||0);if(!Number.isSafeInteger(before)||before<0)fail(400,'INVALID_CURSOR');
      const rows=await db.prepare(actor+`SELECT m.rowid seq,m.kind,m.reason,m.created_at,m.user_id,u.name authorName,m.scope_id,m.result FROM supervision_commands m JOIN users u ON u.id=m.user_id WHERE m.cycle_id=?2 AND EXISTS(SELECT 1 FROM actor WHERE role='admin') AND (?3=0 OR m.rowid<?3) ORDER BY m.rowid DESC LIMIT 51`).bind(hash,cycle,before).all();
      const page=rows.results.slice(0,50);return json({events:page.map(m=>({...m,result:JSON.parse(m.result)})),nextCursor:rows.results.length>50?page.at(-1).seq:null});
    }
    if (p==='/api/admin/supervision') {
      // Materialize only this cycle's permitted rows once; both rollups reuse it.
      // Area selection affects groups, while scopeGroups retains its global scope contract.
      const metadata=await db.batch([
        db.prepare(actor+`SELECT s.* FROM scopes s WHERE s.id IN(SELECT scope_id FROM allowed) ORDER BY s.id`).bind(hash),
        db.prepare(actor+`SELECT cs.scope_id,cs.state FROM cycle_scope_states cs WHERE cs.cycle_id=?2 AND cs.scope_id IN(SELECT scope_id FROM allowed) ORDER BY cs.scope_id`).bind(hash,cycle),
        db.prepare(actor+`SELECT a.*,(SELECT coalesce(max(h.seq),0) FROM history h WHERE h.cycle_id=?2 AND h.location_id IN(SELECT scope_id FROM allowed)) history_cursor FROM actor a`).bind(hash,cycle),
      ]);
      const currentActor=metadata[2].results[0];
      if(!currentActor)fail(403,'FORBIDDEN');
      const version=await digest(JSON.stringify([currentActor.id,currentActor.revision,metadataRevision,cy,scope,metadata[0].results,metadata[1].results,currentActor.history_cursor]));
      if(q.get('version')===version)return json({user:userDTO(currentActor),version,unchanged:true});
      const data=await db.prepare(actor.trimEnd()+`, permitted_items AS MATERIALIZED (
          SELECT i.area_id,i.location_id,i.active,i.status FROM ${inventory} i
          WHERE i.location_id IN(SELECT scope_id FROM allowed))
          SELECT 'area' kind,i.area_id group_id,sum(i.active) total,sum(i.active=0) excluded,
          sum(i.active=1 AND i.status='counted') counted,sum(i.active=1 AND i.status='partial') partial,sum(i.active=1 AND i.status='pending') pending
          FROM permitted_items i WHERE (?3='' OR i.location_id IN(SELECT descendant FROM scope_closure WHERE ancestor=?3)) GROUP BY i.area_id
          UNION ALL
          SELECT 'scope' kind,sc.ancestor group_id,sum(i.active) total,sum(i.active=0) excluded,
          sum(i.active=1 AND i.status='counted') counted,sum(i.active=1 AND i.status='partial') partial,sum(i.active=1 AND i.status='pending') pending
          FROM permitted_items i JOIN scope_closure sc ON sc.descendant=i.location_id
          WHERE sc.ancestor IN(SELECT scope_id FROM allowed) GROUP BY sc.ancestor`).bind(hash,cycle,scope).all();
      const groups=data.results.filter(x=>x.kind==='area').map(({kind,group_id,...x})=>({areaId:group_id,...x}));
      const scopeGroups=data.results.filter(x=>x.kind==='scope').map(({kind,group_id,...x})=>({scopeId:group_id,...x}));
      return json({user:userDTO(currentActor),version,cycle:{...cy,scopeStates:metadata[1].results},scopes:metadata[0].results,groups,scopeGroups,updatedAt:new Date().toISOString()});
    }
    const cursor=Number(q.get('cursor')||0);
    if (!Number.isSafeInteger(cursor)||cursor<0) fail(400,'INVALID_CURSOR');
    if (p==='/api/admin/supervision/items') {
      const status=q.get('status')||'',search=q.get('q')||'',item=q.get('item')||'';
      if (!['','pending','partial','counted','excluded'].includes(status)||search.length>100||item.length>150) fail(400,'INVALID_FILTER');
      const rows=await db.prepare(actor+`SELECT i.* FROM ${cycleItemsSQL({records:true})} i WHERE i.cycle_id=?2 AND i.location_id IN(SELECT scope_id FROM allowed) ${within}
       AND (?4='' OR (?4='excluded' AND i.active=0) OR (i.active=1 AND i.status=?4))
       AND instr(lower(json_extract(i.data,'$.name')),lower(?5))>0 AND i.position>?6 AND (?7='' OR i.id=?7) ORDER BY i.position LIMIT 51`).bind(hash,cycle,scope,status,search,cursor,item).all();
      const page=rows.results.slice(0,50);
      return json({items:page.map(x=>({id:x.id,locationId:x.location_id,areaId:x.area_id,name:JSON.parse(x.data).name,unit:x.unit,active:!!x.active,status:x.status,record:parse(x.record),activityRevision:x.activity_revision,activityChangedAt:x.activity_changed_at,inactiveSince:x.inactive_since})),nextCursor:rows.results.length>50?page.at(-1).position:null});
    }
    if (p==='/api/admin/supervision/history') {
      if(q.has('from')||q.has('to'))fail(400,'INVALID_FILTER','El historial se organiza por inventario.');
      const item=q.get('item')||'',location=q.get('location')||'',author=q.get('author')||'',category=q.get('category')||q.get('action')||'',search=q.get('q')||'';
      const categories={'':'',count:'count',counts:'count',direct:'count',add:'count',correction:'correction',corrections:'correction',overwrite:'correction',rectify:'correction',annul:'annul',annulments:'annul'};
      if([item,location,author].some(x=>x.length>150)||search.length>100||!(category in categories))fail(400,'INVALID_FILTER');
      if(location && !await db.prepare(actor+`SELECT 1 ok FROM allowed WHERE scope_id=?2`).bind(hash,location).first())fail(403,'FORBIDDEN');
      if(item) {
        const rows=await db.prepare(actor+`SELECT h.*,json_extract(ci.data,'$.name') product,ci.unit,u.name author_name FROM history h JOIN cycles cy ON cy.id=h.cycle_id JOIN catalog_items ci ON ci.version=cy.catalog_version AND ci.id=h.item_id AND ci.location_id=h.location_id JOIN users u ON u.id=h.user_id
         WHERE h.cycle_id=?2 AND h.location_id IN(SELECT scope_id FROM allowed) AND (?3='' OR h.location_id IN(SELECT descendant FROM scope_closure WHERE ancestor=?3)) AND h.item_id=?4 AND (?5='' OR h.location_id=?5) AND (?6=0 OR h.seq<?6) ORDER BY h.seq DESC LIMIT 51`).bind(hash,cycle,scope,item,location,cursor).all();
        const page=rows.results.slice(0,50);return json({history:page.map(historyDTO),nextCursor:rows.results.length>50?page.at(-1).seq:null});
      }
      // Find the page by each catalog item's last indexed movement, then aggregate
      // only those 51 items. Category and author may match different movements.
      const rows=await db.prepare(actor.trimEnd()+`, history_page AS MATERIALIZED (
       SELECT ci.id item_id,ci.location_id,json_extract(ci.data,'$.name') product,ci.unit,latest.seq lastSeq
       FROM cycles cy JOIN catalog_items ci ON ci.version=cy.catalog_version
       JOIN history latest ON latest.seq=(SELECT h.seq FROM history h
         WHERE h.cycle_id=cy.id AND h.item_id=ci.id AND h.location_id=ci.location_id ORDER BY h.seq DESC LIMIT 1)
       WHERE cy.id=?2 AND ci.location_id IN(SELECT scope_id FROM allowed)
       AND (?3='' OR ci.location_id IN(SELECT descendant FROM scope_closure WHERE ancestor=?3))
       AND instr(lower(json_extract(ci.data,'$.name')),lower(?6))>0 AND (?7=0 OR latest.seq<?7)
       AND (?4='' OR EXISTS(SELECT 1 FROM history h WHERE h.cycle_id=cy.id AND h.item_id=ci.id AND h.location_id=ci.location_id
         AND ((?4='count' AND h.action IN('direct','add')) OR (?4='correction' AND h.action IN('overwrite','rectify')) OR (?4='annul' AND h.action='annul'))))
       AND (?5='' OR EXISTS(SELECT 1 FROM history h WHERE h.cycle_id=cy.id AND h.item_id=ci.id AND h.location_id=ci.location_id AND h.user_id=?5))
       ORDER BY latest.seq DESC LIMIT 51)
       SELECT p.item_id,p.location_id,p.product,p.unit,p.lastSeq,max(h.created_at) latestAt,
       sum(h.action IN('direct','add')) counts,sum(h.action IN('overwrite','rectify')) corrections,sum(h.action='annul') annulments
       FROM history_page p JOIN history h ON h.cycle_id=?2 AND h.item_id=p.item_id AND h.location_id=p.location_id
       GROUP BY p.item_id,p.location_id ORDER BY p.lastSeq DESC`).bind(hash,cycle,scope,categories[category],author,search,cursor).all();
      const page=rows.results.slice(0,50);
      return json({items:page.map(h=>({itemId:h.item_id,locationId:h.location_id,product:h.product,unit:h.unit,lastSeq:h.lastSeq,latestAt:h.latestAt,counts:{counts:h.counts,corrections:h.corrections,annulments:h.annulments}})),nextCursor:rows.results.length>50?page.at(-1).lastSeq:null});
    }
  }
  fail(404,'NOT_FOUND');
}
