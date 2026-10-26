import { api, dialog, escapeHtml as esc } from './client.js';
import { cycleLabel, cycleTypeNames } from './cycles.js';
import { recommendation, relativeInventoryDate, localDay } from './inventory-calendar.js';
import { showNotice } from './notices.js';
import { openInventoryPicker, inventoryStatus, closeAccountMenu } from './inventory-picker.js';
let identity = '', mounting, pendingMount=false;
const pendingKey = user => `inventory-cycle-pending:${user.id}`;
function readPending(user) { try { return JSON.parse(sessionStorage.getItem(pendingKey(user)) || 'null'); } catch { return null; } }
function retainPending(user,command) { sessionStorage.setItem(pendingKey(user),JSON.stringify(command)); }
function clearPending(user) { sessionStorage.removeItem(pendingKey(user)); }
function styles() {
  if (document.querySelector('link[data-inventory-context]')) return;
  const link = document.createElement('link'); link.rel='stylesheet'; link.href='/shared/inventory-context.css'; link.dataset.inventoryContext=''; document.head.append(link);
}
export function mountInventoryContext(user) {
  if (user.mustChange || identity===user.id && (pendingMount || document.querySelector('.inventory-context-bar'))) return mounting;
  identity=user.id;
  pendingMount=true;
  mounting=mount(user).catch(()=>{ identity=''; }).finally(()=>{pendingMount=false;});
  return mounting;
}
async function mount(user) {
  styles();
  const data = await api('/api/cycles');
  const query = new URLSearchParams(location.search), selected = query.get('inventory') || data.defaultCycleId;
  const current = data.cycles.find(c=>c.id === selected);
  const header = document.querySelector('main > .app-header, main > .home-header, main > .view-header');
  if (!header) return;
  const management = location.pathname.includes('/admin/supervision');
  const host = document.createElement('section'); host.className='inventory-context-bar'; host.setAttribute('aria-label','Inventario seleccionado');
  host.innerHTML=`<button type="button" class="inventory-selector" data-select aria-haspopup="dialog"><span class="inventory-selection"><small>Inventario seleccionado</small><span class="inventory-selection-value"><strong>${current ? esc(cycleLabel(current)) : 'Seleccionar inventario'}</strong>${inventoryStatus(current)}</span></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>${user.role==='admin'?'<button type="button" class="inventory-create-action" data-new><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Crear inventario</span></button>':''}`;
  host.querySelector('[data-select]').onclick=()=>openInventoryPicker(data.cycles,current,{includePrepared:management});
  host.querySelector('[data-new]')?.addEventListener('click',()=>{closeAccountMenu();inventoryDialog(user,data.cycles);});
  if (!['/','/index.html'].includes(location.pathname)) {
    host.classList.add('in-account-menu');
    document.querySelector('#settings-drawer .sync-controls')?.after(host);
  } else header.after(host);
  document.addEventListener('inventory:cycle-updated',event=>{
    if(!host.isConnected || !current || event.detail?.id!==current.id)return;
    Object.assign(current,event.detail);
    host.querySelector('.inventory-selection-value').innerHTML=`<strong>${esc(cycleLabel(current))}</strong>${inventoryStatus(current)}`;
  });
  const home=document.querySelector('[data-go-home]');
  if(home){const url=new URL('/',location.origin);if(current && current.lifecycle!=='prepared')url.searchParams.set('inventory',current.id);home.href=url.pathname+url.search;}
  if (current) for (const link of document.querySelectorAll('a[href*="/pages/inventario/"],.settings-action[href],.identity-profile,.header-back-button[href]')) {
    if(link.matches('[data-go-home]'))continue;
    const url = new URL(link.href); if (!url.searchParams.has('inventory')) {url.searchParams.set('inventory',current.id);link.href=url;}
  }
  if (user.role !== 'admin' || location.pathname !== '/') return;
  const rec = recommendation(); let dismissed=false;
  const key=`inventory-opening-notice:${user.id}:${rec.day}`;
  try {dismissed=localStorage.getItem(key)==='closed';} catch {}
  if (!rec.message || dismissed) return;
  const notice=document.createElement('aside');notice.className='inventory-opening-notice';notice.setAttribute('aria-label','Recomendación de inventario');
  notice.innerHTML=`<button type="button" class="inventory-notice-close" aria-label="Descartar recomendación"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button><p>${esc(rec.message)}</p><button type="button" class="inventory-link-action" data-open>Crear inventario</button>`;
  (host.isConnected?host:header).after(notice);
  notice.querySelector('[data-open]').onclick=()=>inventoryDialog(user,data.cycles,null,rec.type);
  const dismiss=()=>{try {localStorage.setItem(key,'closed');}catch{}const h=notice.getBoundingClientRect().height; if (matchMedia('(prefers-reduced-motion: reduce)').matches || !notice.animate) {notice.remove();return;} notice.animate([{height:`${h}px`,opacity:1,marginBottom:'12px'},{height:'0px',opacity:0,marginBottom:'0px',paddingTop:'0px',paddingBottom:'0px'}],{duration:180,easing:'ease-out'}).finished.finally(()=>notice.remove());};
  notice.querySelector('.inventory-notice-close').onclick=dismiss;
  window.addEventListener('storage',e=>{if(e.key===key&&e.newValue==='closed'&&notice.isConnected)dismiss();});
}
export function inventoryDialog(user,cycles,existing=null,type='weekly') {
  if (user.role !== 'admin') return;
  if (readPending(user)) return recoverInventoryCommand(user);
  styles();
  const create=!existing;
  const latest=cycles.find(c=>c.lifecycle!=='deleted');
  const latestDate=latest?.created_at || (latest?.period?latest.period+'T12:00:00Z':'');
  const lastLabel=latestDate ? relativeInventoryDate(latestDate) : latest ? 'fecha no disponible' : 'sin anteriores';
  const command={id:crypto.randomUUID(),kind:create?'create':existing.lifecycle==='prepared'?'activate':'delete',cycleId:create?crypto.randomUUID():existing.id,...(!create?{expectedRevision:existing.revision}:{})};
  const prepared=existing?.lifecycle==='prepared';
  const el=dialog(create?'Crear inventario':'Opciones del inventario',`<form class="inventory-form"><p data-cycle-error class="feedback-message" role="alert" hidden></p>${create?`<fieldset class="inventory-types"><legend>Tipo</legend><div class="inventory-type-options">${Object.keys(cycleTypeNames).map(id=>`<label><input type="radio" name="type" value="${id}" ${id===type?'checked':''}><span>${id==='both'?'Ambos':cycleTypeNames[id]}</span></label>`).join('')}</div></fieldset><p class="inventory-opening-date">${localDay().split('-').reverse().join('/')}</p><label class="inventory-check"><input type="checkbox" name="activate" checked>Activar inmediatamente</label>`:`<div class="inventory-options-context"><strong>${esc(cycleLabel(existing))}</strong><div><span>${esc(cycleTypeNames[existing.type] || 'Inventario')}</span>${inventoryStatus(existing)}</div></div><section data-activation ${prepared?'':'hidden'}><h3>Activar inventario</h3><p>El equipo podrá comenzar a contar en este inventario.</p></section><section data-delete-confirm hidden><p>Se retirará de la lista. Sus conteos y su historial se conservan.</p></section>`}<section data-warnings class="inventory-warning" role="alert" hidden></section><div class="inventory-submit-row" ${!create&&!prepared?'hidden':''}>${create?`<small>últ. inventario: ${esc(lastLabel)}</small>`:''}<button class="button button-primary" type="submit">${create?'Crear inventario':prepared?'Activar inventario':'Eliminar inventario'}</button></div>${create?'':`<section class="inventory-options-danger" data-delete-option><h3>Eliminar inventario</h3><p>Retíralo de la lista conservando sus conteos e historial.</p><button type="button" class="inventory-danger-button" data-delete>Eliminar inventario</button></section>`}<button type="button" class="inventory-link-action" data-cancel autofocus>${create?'Cancelar':'Cerrar'}</button></form>${create?'':'<button type="button" class="inventory-options-close" data-options-close aria-label="Cerrar opciones del inventario"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>'}`);
  el.classList.add('inventory-cycle-dialog');
  const form=el.querySelector('form'),error=el.querySelector('[data-cycle-error]'),warning=el.querySelector('[data-warnings]'),submit=form.querySelector('[type=submit]');
  let busy=false,uncertain=false,deleting=false;
  const cancel=form.querySelector('[data-cancel]'),row=form.querySelector('.inventory-submit-row');
  if(!create)el.classList.add('inventory-options-dialog');
  el.querySelector('[data-options-close]')?.addEventListener('click',()=>el.close());
  function deletionStep(confirm) {
    deleting=confirm;
    Object.assign(command,{id:crypto.randomUUID(),kind:confirm?'delete':prepared?'activate':'delete'});
    delete command.confirm;delete command.confirmWarnings;delete command.confirmationRevision;
    warning.hidden=true;error.hidden=true;
    form.querySelector('[data-activation]').hidden=confirm||!prepared;
    form.querySelector('[data-delete-option]').hidden=confirm;
    form.querySelector('[data-delete-confirm]').hidden=!confirm;
    row.hidden=!confirm&&!prepared;
    submit.textContent=confirm?'Eliminar inventario':'Activar inventario';
    submit.classList.toggle('inventory-danger-button',confirm);
    submit.classList.toggle('button-primary',!confirm);
    if(confirm)row.prepend(cancel);else form.append(cancel);
    cancel.textContent=confirm?'Cancelar':'Cerrar';
    el.querySelector('h2').textContent=confirm?'Eliminar inventario':'Opciones del inventario';
    if(confirm)cancel.focus({preventScroll:true});else form.querySelector('[data-delete]').focus({preventScroll:true});
  }
  form.querySelector('[data-delete]')?.addEventListener('click',()=>{if(!busy&&!uncertain)deletionStep(true);});
  cancel.onclick=()=>{if(deleting&&!busy&&!uncertain)deletionStep(false);else el.close();};

  form.addEventListener('input',()=>{if(!uncertain){command.confirmWarnings=false;delete command.confirmationRevision;warning.hidden=true;submit.textContent=create?'Crear inventario':command.kind==='activate'?'Activar inventario':'Eliminar inventario';}});
  form.onsubmit=async event=>{
    event.preventDefault();if(busy||!create&&!prepared&&!deleting)return;busy=true;error.hidden=true;
    const deleteOption=form.querySelector('[data-delete]');if(deleteOption)deleteOption.disabled=true;
    if(!uncertain){if(create)Object.assign(command,{name:localDay().split('-').reverse().join('/'),type:form.elements.type.value,period:localDay(),activate:form.elements.activate.checked});else if(command.kind==='delete')command.confirm=true;}
    submit.disabled=true;submit.textContent=uncertain?'Comprobando…':'Guardando…';
    for(const input of form.querySelectorAll('input,select'))input.disabled=true;
    try {retainPending(user,command);await api('/api/admin/cycles/command',command);clearPending(user);showNotice(create?'Inventario creado.':command.kind==='activate'?'Inventario activado.':'Inventario eliminado.');location.reload();}
    catch(e){
      if(e.status && e.status<500 && ![408,429].includes(e.status)) clearPending(user);
      if(['CONFIRMATION_REQUIRED','CONFIRMATION_CHANGED'].includes(e.code)){
        warning.hidden=false;warning.textContent=(e.warnings||[]).map(w=>w.message).join(' ')||e.message;command.confirmWarnings=true;command.confirmationRevision=e.confirmationRevision;submit.textContent='Continuar de todas formas';uncertain=false;
      } else {uncertain=!e.status || e.status>=500 || [408,429].includes(e.status);error.hidden=false;error.textContent=e.message || 'No se pudo confirmar el cambio.';submit.textContent=uncertain?'Reintentar confirmación':create?'Crear inventario':'Reintentar';}
    }finally{busy=false;submit.disabled=false;if(deleteOption)deleteOption.disabled=uncertain;for(const input of form.querySelectorAll('input,select'))input.disabled=uncertain;}
  };
}

function recoverInventoryCommand(user) {
  const pending=readPending(user);if(!pending)return;
  styles();const el=dialog('Confirmar cambio pendiente','<p>Comprueba el resultado del último cambio antes de iniciar otro.</p><p role="alert" data-error hidden></p><div class="inventory-dialog-actions"><button type="button" data-close autofocus>Cerrar</button><button type="button" data-retry>Comprobar resultado</button></div>');
  el.querySelector('[data-close]').onclick=()=>el.close();
  const retry=el.querySelector('[data-retry]');retry.onclick=async()=>{retry.disabled=true;try{await api('/api/admin/cycles/command',pending);clearPending(user);location.reload();}catch(e){if(e.status&&e.status<500&&![408,429].includes(e.status)){clearPending(user);retry.hidden=true;}const message=el.querySelector('[data-error]');message.hidden=false;message.textContent=e.message||'No se pudo comprobar. Inténtalo de nuevo.';}finally{retry.disabled=false;}};
}
