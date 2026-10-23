import {api,authenticated,identityBar,escapeHtml as esc,dialog} from '/shared/client.js';
import {describeCountValue} from '/shared/count-display.js';
const root=document.querySelector('#supervision'),message=document.querySelector('#message');
const names={open:'Abierto',review:'En revisión',closed:'Cerrado',pending:'Pendiente',partial:'Avance',counted:'Contado',excluded:'Excluido',rectify:'Rectificación',annul:'Anulación',activation:'Activación',state:'Estado',direct:'Guardado',add:'Suma',overwrite:'Sobrescritura'};
let user,cycle,scopes=[],items=[],cursor=null,mode='items',generation=0,pendingCommand=null;
const qs=()=>new URLSearchParams({cycle:document.querySelector('#cycle').value,scope:document.querySelector('#scope').value});
function styleButtons(host){for(const b of host.querySelectorAll('button')){b.classList.add('button');if(!b.classList.contains('button-danger'))b.classList.add(b.hasAttribute('data-confirm')?'button-primary':'button-secondary');}}
function notice(text){message.hidden=!text;message.textContent=text;if(text)message.focus();}
function locationName(id){return scopes.find(s=>s.id===id)?.name||id;}
function value(r,unit){return !r||r.status==='pending'?'Sin conteo vigente':describeCountValue(r,unit);}
function recordMarkup(r,unit){return `<p>${esc(value(r,unit))}</p>${r?.note?`<p>Nota: ${esc(r.note)}</p>`:''}`;}
async function refresh(){
  const ticket=++generation;notice('');root.setAttribute('aria-busy','true');
  document.querySelector('#results').textContent='Cargando…';
  try{
    const data=await authenticated('/api/admin/supervision?'+qs());if(ticket!==generation)return;
    if(data.user.id!==user.id){location.reload();return;} user=data.user;cycle=data.cycle;scopes=data.scopes;
    document.querySelector('#cycle-state').textContent=`Actualizado ${new Date(data.updatedAt).toLocaleString('es-CL')}`;
    document.querySelector('#stats').innerHTML=data.groups.map(g=>`<section class="supervision-card"><h2>${esc(locationName(g.areaId))}</h2><p>${g.counted} contados / ${g.total} activos</p><progress max="${g.total||1}" value="${g.counted}" aria-label="Progreso de ${esc(locationName(g.areaId))}"></progress><p>${g.pending} pendientes · ${g.partial} con avance · ${g.excluded} excluidos</p></section>`).join('');
    renderCycleActions();cursor=null;items=[];await loadPage(false,ticket);
  }catch(e){if(ticket===generation){document.querySelector('#results').textContent='No se pudo cargar el inventario.';notice(e.message);}}
  finally{if(ticket===generation)root.setAttribute('aria-busy','false');}
}
async function loadPage(append=false,ticket=generation){
  const params=qs();if(append&&cursor!==null)params.set('cursor',cursor);
  if(mode==='items'){params.set('status',document.querySelector('#status').value);params.set('q',document.querySelector('#search').value);}
  else if(mode==='history'){
    for(const key of ['item','location','author','action']){const v=document.querySelector('#history-'+key).value.trim();if(v)params.set(key,v);}
    for(const key of ['from','to']){const v=document.querySelector('#history-'+key).value;if(v)params.set(key,new Date(v).toISOString());}
  }
  const endpoint=mode==='items'?'items':mode==='history'?'history':'events';
  const data=await authenticated('/api/admin/supervision/'+endpoint+'?'+params);if(ticket!==generation)return;
  const list=data.items||data.history||data.events;cursor=data.nextCursor;
  const results=document.querySelector('#results');if(!append)results.innerHTML='';
  if(mode==='items'){
    items.push(...list);
    results.insertAdjacentHTML('beforeend',list.map(i=>`<article class="supervision-card"><h3>${esc(i.name)}</h3><p>${esc(locationName(i.locationId))} · ${esc(i.unit||'Unidad pendiente')}</p><p class="supervision-status" data-state="${i.status}">${i.active?names[i.status]:'Excluido del conteo'}</p>${recordMarkup(i.record,i.unit)}<div class="supervision-actions"><button type="button" data-history="${esc(i.id)}" data-location="${esc(i.locationId)}">Ver historial</button>${itemActions(i)}</div></article>`).join(''));
    for(const b of results.querySelectorAll('[data-history]'))b.onclick=()=>{document.querySelector('#history-item').value=b.dataset.history;document.querySelector('#history-location').value=b.dataset.location;setMode('history');};
    bindItemActions();
  }else{
    results.insertAdjacentHTML('beforeend',list.map(h=>`<article class="supervision-card"><h3>${esc(h.product||names[h.kind]||h.kind)}</h3><p>${esc(names[h.action||h.kind]||h.action||h.kind)} · ${esc(new Date(h.createdAt||h.created_at).toLocaleString('es-CL'))}</p><p>Autor: ${esc(h.after?.authorName||h.authorId||h.user_id)}${h.authorId?` · ID ${esc(h.authorId)}`:''}</p>${h.locationId?`<p>${esc(locationName(h.locationId))}</p>`:''}${h.before||h.after?`<p>Antes: ${esc(value(h.before,h.after?.unit))}<br>Después: ${esc(value(h.after,h.after?.unit))}</p>`:''}${h.after?.note?`<p>Nota: ${esc(h.after.note)}</p>`:''}${h.reason?`<p>Motivo: ${esc(h.reason)}</p>`:''}</article>`).join(''));
  }
  if(!list.length&&!append)results.textContent='Sin resultados para estos filtros.';
  document.querySelector('#more').hidden=cursor==null;styleButtons(root);
}
function setMode(next){mode=next;for(const b of root.querySelectorAll('[data-mode]'))b.setAttribute('aria-pressed',String(b.dataset.mode===mode));document.querySelector('#item-filters').hidden=mode!=='items';document.querySelector('#history-filters').hidden=mode!=='history';refresh();}
function effective(scope){return cycle.scopeStates?.find(s=>s.scope_id===scope)?.state||cycle.state;}
function renderCycleActions(){
 const host=document.querySelector('#cycle-actions');
 host.innerHTML=`<p>Estado global: ${names[cycle.state]} · Servicio: ${names[effective('servicio')]}</p>`;
 const controls=document.createElement('details');controls.className='supervision-card';controls.innerHTML='<summary>Gestionar revisión, cierre o reapertura</summary>';host.append(controls);
 for(const scope of user.role==='admin'?['','servicio']:['servicio']){
  const box=document.createElement('div');box.className='supervision-actions';
  box.innerHTML=`<span>${scope?'Servicio':'Todo el inventario'}:</span>${['review','closed','open'].map(state=>`<button type="button" data-state="${state}">${{review:'Pasar a revisión',closed:'Cerrar',open:'Reabrir'}[state]}</button>`).join('')}`;
  for(const b of box.querySelectorAll('button')){const current=scope?effective(scope):cycle.state,overrides=!scope&&cycle.scopeStates?.length;b.disabled=(b.dataset.state===current&&!overrides)||(b.dataset.state==='closed'&&current!=='review'&&!overrides)||(b.dataset.state==='review'&&current==='closed'&&!overrides);b.onclick=()=>changeDialog({kind:'state',scope,state:b.dataset.state},null);}
  controls.append(box);
 }
 if(pendingCommand){const b=document.createElement('button');b.textContent='Reintentar cambio pendiente';b.onclick=()=>submitCommand(pendingCommand);host.append(b);}
 styleButtons(host);
}
function itemActions(i){if(effective(i.locationId.startsWith('servicio:')?'servicio':'')==='closed')return '<p>Reabre este alcance antes de modificar.</p>';return `${i.active?'<button type="button" data-change="rectify">Rectificar</button>'+ (i.record&&i.record.status!=='pending'?'<button type="button" data-change="annul" class="button-danger">Anular conteo</button>':''):''}${user.role==='admin'?`<button type="button" data-change="activation">${i.active?'Excluir de este inventario':'Volver a activar'}</button>`:''}`;}
function bindItemActions(){
 const cards=[...document.querySelectorAll('#results article')];
 cards.forEach((card,index)=>{for(const b of card.querySelectorAll('[data-change]'))b.onclick=()=>changeDialog({kind:b.dataset.change},items[index]);});
}
function changeDialog(change,item){
 if(pendingCommand){notice('Hay un envío de resultado incierto. Reinténtalo antes de iniciar otro cambio.');return;}
 const titles={rectify:'Rectificar conteo',annul:'Anular conteo',activation:item?.active?'Excluir producto':'Activar producto',state:change.state==='open'?'Reabrir':change.state==='review'?'Pasar a revisión':'Cerrar'};
 const b={id:crypto.randomUUID(),cycleId:cycle.id,expectedRevision:cycle.revision,...change,confirm:true};
 if(item)Object.assign(b,{itemId:item.id,locationId:item.locationId,expectedVersion:item.record?.version||0});
 if(change.kind==='activation')b.active=!item.active;
 const el=dialog(titles[change.kind],`<p>${esc(cycle.name)} · ${esc(item?item.name:change.scope?'Servicio':'Todo el inventario')}</p>${item?`<p>Vigente: ${esc(value(item.record,item.unit))} · versión ${b.expectedVersion}</p>`:''}${change.kind==='annul'?'<p>Volverá a pendiente. El conteo anterior y su historial se conservarán.</p>':''}${change.kind==='activation'?'<p>Solo afecta este inventario. Conserva conteos y referencias Excel; excluir no confirma cero.</p>':''}${change.kind==='state'?`<p>${change.scope?'Solo cambia Servicio. Las demás áreas conservan su estado.':'Cambia todas las áreas y sustituye los estados particulares de Servicio.'} ${change.state==='review'?'Detendrá el conteo normal; se permiten correcciones de supervisión.':change.state==='closed'?'Exige todos los productos activos contados. El servidor no conoce borradores de dispositivos desconectados.':'Habilitará de nuevo el conteo en este alcance.'}</p>`:''}<form id="change-form">${change.kind==='rectify'?`<label>Cantidad<input name="quantity" inputmode="decimal" type="number" min="0" max="1000000" step="0.001" value="${item.record?.quantity??''}" required></label><label>Estado<select name="status"><option value="counted">Contado</option><option value="partial" ${item.status==='partial'?'selected':''}>Avance</option></select></label><label><input type="checkbox" name="outOfStock"> Sin stock (cero contado)</label><label>Nota<textarea name="note" maxlength="1000">${esc(item.record?.note||'')}</textarea></label><p id="change-preview" aria-live="polite"></p>`:''}<label>Motivo<textarea name="reason" minlength="3" maxlength="500" placeholder="actualizacion/revision item" required></textarea></label>${change.kind==='state'&&change.state==='closed'?'<label><input type="checkbox" name="ack" required> Revisé con los participantes que no quedan borradores sin enviar en este alcance.</label>':''}<p data-command-error role="alert"></p><div class="supervision-actions"><button type="button" data-cancel autofocus>Cancelar</button><button type="submit" data-confirm>Confirmar cambio</button></div></form>`);
 el.classList.add('supervision-modal');styleButtons(el);const form=el.querySelector('form');
 el.querySelector('[data-cancel]').onclick=()=>el.close();
 const preview=()=>{if(change.kind!=='rectify')return;const f=new FormData(form),zero=f.has('outOfStock');form.elements.quantity.disabled=zero;form.elements.status.disabled=zero;el.querySelector('#change-preview').textContent=`Resultado propuesto: ${zero?'Sin stock · cero confirmado':`${f.get('quantity')} ${item.unit||'(unidad pendiente)'} · ${names[f.get('status')]}`}`;};form.oninput=preview;preview();
 form.onsubmit=async e=>{e.preventDefault();const f=new FormData(form);b.reason=String(f.get('reason')).trim();if(change.kind==='rectify')Object.assign(b,{quantity:f.has('outOfStock')?0:Number(f.get('quantity')),status:f.has('outOfStock')?'counted':f.get('status'),note:String(f.get('note')),outOfStock:f.has('outOfStock')});if(change.kind==='state'&&change.state==='closed')b.acknowledgeDrafts=f.has('ack');
  for(const c of form.elements)c.disabled=true;
  const done=await submitCommand(b);if(done)el.close();else{el.querySelector('[data-command-error]').textContent=message.textContent;if(!pendingCommand){for(const c of form.elements)c.disabled=false;preview();}else{el.querySelector('[data-cancel]').disabled=false;el.querySelector('[data-cancel]').textContent='Cerrar y conservar envío';}}
 };
}
function pendingKey(){return `inventory-supervision-pending:${user.id}`;}
async function submitCommand(b){
 try{
  // Retain the operation ID and reviewed payload before sending. Never replay automatically.
  sessionStorage.setItem(pendingKey(),JSON.stringify(b));pendingCommand=b;
  await api('/api/admin/supervision/command',b);
  pendingCommand=null;sessionStorage.removeItem(pendingKey());await refresh();notice('Cambio guardado.');return true;
 }catch(e){
  if(e.status&&e.status<500){pendingCommand=null;sessionStorage.removeItem(pendingKey());}
  notice(e.message+(pendingCommand?' Resultado incierto: conserva este envío y reinténtalo con el mismo ID.':''));renderCycleActions();return false;
 }
}

try{
 const data=await authenticated('/api/admin/supervision/cycles');user=data.user;try{pendingCommand=JSON.parse(sessionStorage.getItem(pendingKey())||'null');}catch{pendingCommand=null;}identityBar(user,async()=>{await refresh();return 'Sincronizado';});
 root.innerHTML=`<label>Inventario<select id="cycle">${data.cycles.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} · ${names[c.state]}</option>`).join('')}</select></label><p id="cycle-state" role="status"></p><div id="cycle-actions" class="supervision-actions"></div><div class="supervision-filters"><label>Ámbito<select id="scope"><option value="">Todo mi alcance</option></select></label><button type="button" id="refresh">Actualizar</button></div><div id="stats" class="supervision-stats"></div><div class="supervision-tabs"><button type="button" data-mode="items" aria-pressed="true">Productos</button><button type="button" data-mode="history" aria-pressed="false">Historial</button>${user.role==='admin'?'<button type="button" data-mode="events" aria-pressed="false">Cambios administrativos</button>':''}</div><form id="filters"><div id="item-filters" class="supervision-filters"><label>Estado<select id="status"><option value="">Todos</option>${['pending','partial','counted','excluded'].map(s=>`<option value="${s}">${names[s]}</option>`).join('')}</select></label><label>Buscar producto<input id="search" type="search" maxlength="100"></label></div><div id="history-filters" class="supervision-filters" hidden>${`<input id="history-item" type="hidden"><label>Ubicación<select id="history-location"><option value="">Todas</option></select></label><label>Autor<select id="history-author"><option value="">Todos</option></select></label>`}<label>Acción<select id="history-action"><option value="">Todas</option>${['direct','add','overwrite','rectify','annul'].map(s=>`<option value="${s}">${names[s]}</option>`).join('')}</select></label><label>Desde<input id="history-from" type="datetime-local"></label><label>Hasta<input id="history-to" type="datetime-local"></label></div><button type="submit">Aplicar filtros</button><button type="button" id="clear-filters">Limpiar filtros</button></form><section id="results" aria-live="polite"></section><button type="button" id="more" hidden>Cargar más</button>`;
 styleButtons(root);
 root.querySelector('#cycle').onchange=async()=>{root.querySelector('#scope').value='';root.querySelector('#history-item').value='';const d=await authenticated('/api/admin/supervision/authors?'+qs());root.querySelector('#history-author').innerHTML='<option value="">Todos</option>'+d.authors.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('');await refresh();};root.querySelector('#scope').onchange=refresh;root.querySelector('#refresh').onclick=refresh;
 root.querySelector('#clear-filters').onclick=()=>{root.querySelector('#filters').reset();root.querySelector('#history-item').value='';refresh();};
 root.querySelector('#filters').onsubmit=e=>{e.preventDefault();refresh();};
 for(const b of root.querySelectorAll('[data-mode]'))b.onclick=()=>setMode(b.dataset.mode);
 root.querySelector('#more').onclick=async e=>{e.target.disabled=true;try{await loadPage(true);}catch(err){notice(err.message);}finally{e.target.disabled=false;}};
 const originalRefresh=refresh;
 // Populate scopes once from the server projection; every read revalidates them.
 if(data.cycles.length){const d=await authenticated('/api/admin/supervision?'+qs());scopes=d.scopes;root.querySelector('#scope').insertAdjacentHTML('beforeend',scopes.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join(''));root.querySelector('#history-location').insertAdjacentHTML('beforeend',scopes.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join(''));const authorData=await authenticated('/api/admin/supervision/authors?'+qs());root.querySelector('#history-author').insertAdjacentHTML('beforeend',authorData.authors.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join(''));await originalRefresh();}
 else{root.textContent='No hay inventarios disponibles.';root.setAttribute('aria-busy','false');}
}catch(e){root.textContent='Supervisión no disponible.';root.setAttribute('aria-busy','false');notice(e.message);}
