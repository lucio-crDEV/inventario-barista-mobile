import { inventoryDialog } from '/shared/inventory-context.js';
import { authenticated, identityBar, escapeHtml as esc, dialog, setSync } from '/shared/client.js';
import { readCommand, submitCommand as sendSupervisionCommand } from '/shared/supervision-command.js';
import { describeCountValue } from '/shared/count-display.js';
import { stateNames, actionNames, progressParts, dateTime, calendarDay, mayReopen, movementQuantity } from './supervision-ui.js';

import { showNotice } from '/shared/notices.js';
const root = document.querySelector('#supervision');
const message = document.querySelector('#message');
const state = { mode: 'areas', cycleId: '', scope: '', status: '', search: '', category: '', author: '',
  location: '', pageCount: 1, openProducts: [], openHistory: [], scroll: 0, drafts: {}, openScopes: [] };
let user, cycle, scopes = [], groups = [], scopeGroups = [], products = [], historyItems = [], cursor = null;
let generation = 0, pendingCommand = null, sending = false, loading = false, timer, searchTimer;
let commandDialog = null, restoreScroll = null, restoring = false;
const details = new Map();
const $ = selector => root.querySelector(selector);
const key = item => `${item.id || item.itemId}\u001f${item.locationId}`;
const storageKey = () => `inventory-supervision-view:${user.id}`;
const locationName = id => scopes.find(scope => scope.id === id)?.name || id;
const areaOf = item => item.areaId || (item.locationId?.startsWith('servicio') ? 'servicio' : item.locationId?.split(':')[0]);
const recordValue = (record, unit) => !record || record.status === 'pending' ? 'Sin conteo' : describeCountValue(record, unit);
const effective = scope => cycle.scopeStates?.find(item => item.scope_id === scope)?.state || cycle.state;
const currentScope = () => user.role === 'service_lead' || state.scope === 'servicio' || state.scope.startsWith('servicio:') ? 'servicio' : '';
const params = () => new URLSearchParams({ cycle: state.cycleId, scope: state.scope });

function notice(text, tone = 'error', focus = false) {
  if (tone === 'success' && text) { showNotice(text); message.hidden = true; return; }
  message.hidden = !text; message.textContent = text; message.dataset.tone = tone;
  if (text && focus) message.focus({ preventScroll: true });
}
function snapshot() {
  state.scroll = window.scrollY;
  state.openScopes = [...root.querySelectorAll('details[data-scope][open]')].map(el => el.dataset.scope);
  state.openProducts = [...root.querySelectorAll('details[data-product][open]')].map(el => el.dataset.product);
  state.openHistory = [...root.querySelectorAll('details[data-history][open]')].map(el => el.dataset.history);
  const value = JSON.parse(JSON.stringify(state));
  try { sessionStorage.setItem(storageKey(), JSON.stringify(value)); } catch {}
  history.replaceState({ ...history.state, supervision: { userId: user.id, value } }, '');
}
function restore(saved) {
  if (!saved || typeof saved !== 'object') return;
  for (const field of ['cycleId', 'scope', 'status', 'search', 'category', 'author', 'location']) {
    if (typeof saved[field] === 'string') state[field] = saved[field].slice(0, 150);
  }
  if (['areas', 'items', 'history', 'events'].includes(saved.mode)) state.mode = saved.mode;
  if (Number.isSafeInteger(saved.pageCount)) state.pageCount = Math.min(30, Math.max(1, saved.pageCount));
  for (const field of ['openProducts', 'openHistory', 'openScopes']) if (Array.isArray(saved[field])) state[field] = saved[field].filter(x => typeof x === 'string').slice(0, 1000);
  if (saved.drafts && typeof saved.drafts === 'object') state.drafts = saved.drafts;
  if (state.mode === 'areas') state.scope = '';
  restoreScroll = Math.max(0, Number(saved.scroll) || 0);
}
function ring(group) {
  const p = progressParts(group);
  return `<span class="supervision-ring" role="img" aria-label="${p.percent}% con registro: ${p.counted} contados, ${p.partial} con avance, ${p.total} activos"><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="ring-base" cx="22" cy="22" r="18" pathLength="100"/><circle class="ring-counted" cx="22" cy="22" r="18" pathLength="100" stroke-dasharray="${p.countedPercent} 100"/><circle class="ring-partial" cx="22" cy="22" r="18" pathLength="100" stroke-dasharray="${p.partialPercent} 100" stroke-dashoffset="-${p.countedPercent}"/></svg><span>${p.percent}%</span></span>`;
}
function skeleton() { return '<div class="skeleton-stack" aria-hidden="true"><div class="skeleton-card"><span class="skeleton skeleton-line"></span><span class="skeleton skeleton-line"></span></div><div class="skeleton-card"><span class="skeleton skeleton-line"></span></div></div>'; }
function renderShell(cycles) {
  root.innerHTML = `<section class="supervision-context" aria-label="Inventario seleccionado"><label class="supervision-cycle-label">Inventario<select id="cycle">${cycles.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label><p id="cycle-state" class="supervision-updated" role="status"></p><div id="cycle-actions"></div><div id="inventory-management"></div></section><div class="supervision-tabs" role="tablist" aria-label="Vistas de supervisión">${[['areas','Áreas'],['items','Productos'],['history','Historial']].map(([id,title]) => `<button type="button" id="tab-${id}" role="tab" data-mode="${id}" aria-controls="supervision-panel" aria-selected="false">${title}</button>`).join('')}</div><section id="supervision-panel" role="tabpanel"><div class="supervision-tools"><label id="scope-filter">Área<select id="scope"><option value="">${user.role === 'admin' ? 'Todas las áreas' : 'Servicio y subáreas'}</option></select></label><label id="status-filter">Estado<select id="status"><option value="">Todos los productos</option>${['pending','partial','counted','excluded'].map(id => `<option value="${id}">${stateNames[id]}</option>`).join('')}</select></label></div><a id="scope-summary" class="supervision-scope-summary" hidden></a><div id="list-tools"><label class="supervision-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input id="search" type="search" maxlength="100" placeholder="Buscar producto" aria-label="Buscar producto"></label><div id="history-filters"><div class="supervision-pills" aria-label="Tipo de movimientos">${[['','Todos'],['count','Conteos'],['correction','Correcciones'],['annul','Anulaciones']].map(([id,title]) => `<button type="button" data-category="${id}" aria-pressed="false">${title}</button>`).join('')}</div><details class="supervision-extra-filters"><summary>Ubicación y autor</summary><div class="supervision-tools"><label>Ubicación<select id="history-location"><option value="">Todas las ubicaciones</option></select></label><label>Autor<select id="history-author"><option value="">Todos</option></select></label></div></details></div></div><div class="supervision-list-heading"><h2 id="result-title">Avance por área</h2><span id="result-count"></span></div><section id="results" aria-label="Resultados de supervisión"></section><div class="supervision-list-footer"><button type="button" class="button button-secondary" id="more" hidden>Cargar más</button><button type="button" class="supervision-text-action" id="clear-filters" hidden>Limpiar filtros</button></div></section>${user.role === 'admin' ? '<button class="supervision-text-action supervision-admin-events" type="button" id="admin-events">Actividad administrativa</button>' : ''}`;
  $('#cycle').value = state.cycleId;
  $('#status').value = state.status; $('#search').value = state.search;
  $('#cycle').onchange = async event => { state.cycleId = event.target.value; state.scope = ''; resetList(); details.clear(); await refresh({ reset: true, authors: true }); };
  $('#scope').onchange = async event => { state.scope = event.target.value; resetList(); await refresh({ reset: true }); };
  $('#status').onchange = event => { state.status = event.target.value; changeFilters(); };
  $('#search').oninput = event => { state.search = event.target.value; clearTimeout(searchTimer); searchTimer = setTimeout(changeFilters, 250); };
  for (const [selector, field] of [['#history-location','location'],['#history-author','author']]) $(selector).onchange = event => { state[field] = event.target.value; changeFilters(); };
  for (const button of root.querySelectorAll('[data-mode]')) button.onclick = () => setMode(button.dataset.mode);
  for (const button of root.querySelectorAll('[data-category]')) button.onclick = () => { state.category = button.dataset.category; changeFilters(); };
  root.querySelector('.supervision-tabs').onkeydown = event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const tabs = [...root.querySelectorAll('[role="tab"]')], at = tabs.indexOf(document.activeElement); if (at < 0) return;
    event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (at + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].click(); tabs[next].focus();
  };
  $('#clear-filters').onclick = () => { Object.assign(state, {status:'',search:'',category:'',author:'',location:''}); $('#status').value = ''; $('#search').value = ''; $('#history-author').value = ''; $('#history-location').value = ''; changeFilters(); };
  $('#more').onclick = () => loadMore();
  if ($('#admin-events')) $('#admin-events').onclick = () => setMode(state.mode === 'events' ? 'areas' : 'events');
  updateMode();
}
function renderManagement(cycles) {
  const el = $('#inventory-management'); if (!el || user.role !== 'admin') return;
  el.innerHTML = '<button type="button" class="supervision-text-action" id="create-inventory">Crear inventario</button><button type="button" class="supervision-text-action" id="manage-inventory">Opciones del inventario</button>';
  $('#create-inventory').onclick = () => inventoryDialog(user, cycles);
  $('#manage-inventory').onclick = () => inventoryDialog(user, cycles, cycle || cycles.find(c=>c.id === state.cycleId));
}
function updateMode() {
  for (const button of root.querySelectorAll('[data-mode]')) { const selected = button.dataset.mode === state.mode; button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected || state.mode === 'events' && button.dataset.mode === 'areas' ? 0 : -1; }
  $('#supervision-panel').setAttribute('aria-labelledby', state.mode === 'events' ? 'admin-events' : `tab-${state.mode}`);
  $('#scope-filter').hidden = ['areas','events'].includes(state.mode);
  $('#status-filter').hidden = state.mode !== 'items'; $('#list-tools').hidden = !['items','history'].includes(state.mode);
  $('#history-filters').hidden = state.mode !== 'history';
  for (const button of root.querySelectorAll('[data-category]')) button.setAttribute('aria-pressed', String(button.dataset.category === state.category));
  $('#result-title').textContent = { areas:'Avance por área',items:'Productos',history:'Productos con movimientos',events:'Actividad administrativa' }[state.mode];
  $('#admin-events')?.setAttribute('aria-pressed', String(state.mode === 'events'));
  $('#clear-filters').hidden = ![state.status,state.search,state.category,state.author,state.location].some(Boolean) || state.mode === 'areas';
}
function resetList() { state.pageCount = 1; state.openProducts = []; state.openHistory = []; cursor = null; }
async function changeFilters() { resetList(); details.clear(); updateMode(); await refresh({ reset: true }); }
async function setMode(next) { if (state.mode === next) return; snapshot(); state.mode = next; if (next === 'areas') state.scope = ''; resetList(); updateMode(); await refresh({ reset: true }); }
function renderScopes() {
  for (const id of ['#scope','#history-location']) {
    const el = $(id), value = id === '#scope' ? state.scope : state.location;
    const options = scopes.map(scope => `<option value="${esc(scope.id)}">${esc(scope.name)}</option>`).join('');
    el.innerHTML = `<option value="">${id === '#scope' ? user.role === 'admin' ? 'Todas las áreas' : 'Servicio y subáreas' : 'Todas las ubicaciones'}</option>${options}`;
    el.value = value; if (id === '#scope' && el.value !== state.scope) state.scope = '';
  }
}
async function refresh({ reset = false, quiet = false, authors = false } = {}) {
  if (loading && quiet || sending && quiet || document.hidden && quiet || document.querySelector('dialog[open]') && quiet) return;
  if (quiet && ['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
  const ticket = ++generation; loading = true;
  const y = window.scrollY;
  const focused = quiet ? focusSnapshot() : null;
  if (!reset && !restoring) snapshot();
  if (!quiet) { root.setAttribute('aria-busy', 'true'); $('#results').innerHTML = skeleton(); }
  try {
    const data = await authenticated('/api/admin/supervision?' + params());
    if (ticket !== generation) return;
    if (data.user.id !== user.id || data.user.role !== user.role) { location.reload(); return; }
    user = data.user; cycle = data.cycle; scopes = data.scopes; groups = data.groups; scopeGroups = data.scopeGroups || [];
    renderScopes();
    $('#cycle-state').textContent = `Actualizado ${dateTime(data.updatedAt)}`;
    renderCycleActions(); renderScopeSummary();
    if (authors) {
      const authorData = await authenticated('/api/admin/supervision/authors?' + params());
      if (ticket !== generation) return;
      $('#history-author').innerHTML = '<option value="">Todos</option>' + authorData.authors.map(author => `<option value="${esc(author.id)}">${esc(author.name)}</option>`).join('');
      $('#history-author').value = state.author;
    }
    if (state.mode === 'areas') { cursor = null; renderAreas(); }
    else await fetchPages(reset ? 1 : state.pageCount, ticket);
    if (ticket !== generation) return;
    updateMode(); setSync(pendingCommand ? 'Cambio pendiente de confirmar' : 'Sincronizado', pendingCommand ? 'pending' : 'synced');
    if (quiet || restoreScroll !== null) window.scrollTo({ top: restoreScroll ?? y, behavior: 'instant' });
    restoreScroll = null;
    if (focused) restoreFocus(focused);
    snapshot();
  } catch (error) {
    if (ticket !== generation) return;
    if (!quiet) $('#results').innerHTML = '<p class="supervision-empty">No se pudo cargar el inventario. Puedes volver a elegir una vista para reintentar.</p>';
    notice(error.message); setSync('No se pudo actualizar', 'error');
  } finally { if (ticket === generation) { loading = false; root.setAttribute('aria-busy','false'); } }
}
function focusSnapshot() {
  const active = document.activeElement;
  if (!root.contains(active)) return null;
  if (active.id) return {id:active.id};
  const card = active.closest('[data-product],[data-history]');
  if (card) return {product:card.dataset.product,history:card.dataset.history,summary:active.tagName === 'SUMMARY',change:active.dataset.change,itemHistory:active.hasAttribute('data-item-history'),active:active.hasAttribute('data-active'),moreHistory:active.hasAttribute('data-more-history')};
  if (active.dataset.transition) return {transition:active.dataset.transition,scope:active.dataset.scope};
  return null;
}
function restoreFocus(saved) {
  let target;
  if (saved.id) target = document.getElementById(saved.id);
  else if (saved.transition) target = [...root.querySelectorAll('[data-transition]')].find(button => button.dataset.transition === saved.transition && button.dataset.scope === saved.scope);
  else {
    const card = [...root.querySelectorAll('[data-product],[data-history]')].find(el => saved.product ? el.dataset.product === saved.product : el.dataset.history === saved.history);
    if (card) target = saved.summary ? card.querySelector('summary') : saved.change ? [...card.querySelectorAll('[data-change]')].find(button => button.dataset.change === saved.change) : saved.itemHistory ? card.querySelector('[data-item-history]') : saved.active ? card.querySelector('[data-active]') : saved.moreHistory ? card.querySelector('[data-more-history]') : null;
  }
  target?.focus({preventScroll:true});
}
function renderCycleActions() {
  const scopesToShow = cycle.lifecycle === 'prepared' ? [] : user.role === 'admin' ? ['', 'servicio'] : ['servicio'];
  $('#cycle-actions').innerHTML = scopesToShow.map(scope => {
    const current = scope ? effective(scope) : cycle.state, title = scope ? 'Servicio' : 'Inventario Global';
    const canOpen = mayReopen(user.role, current);
    return `<div class="supervision-lifecycle"><div><span>${title}</span><strong data-state="${current}">${stateNames[current]}</strong></div><div class="supervision-state-actions">${current === 'open' ? `<button type="button" class="supervision-text-action" data-transition="review" data-scope="${scope}">Cerrar</button>` : ''}${current === 'review' ? `<button type="button" class="supervision-text-action" data-transition="closed" data-scope="${scope}">Finalizar y enviar</button>` : ''}${canOpen ? `<button type="button" class="supervision-text-action" data-transition="open" data-scope="${scope}">Reabrir</button>` : ''}</div></div>`;
  }).join('') + (pendingCommand ? '<div class="supervision-pending"><span>Hay un cambio cuyo resultado falta confirmar.</span><button type="button" id="retry-command" class="button button-secondary">Reintentar cambio pendiente</button></div>' : '');
  for (const button of root.querySelectorAll('[data-transition]')) { button.disabled = !!pendingCommand || sending; button.onclick = () => changeDialog({ kind:'state', scope:button.dataset.scope, state:button.dataset.transition }); }
  if ($('#retry-command')) { $('#retry-command').disabled = sending; $('#retry-command').onclick = () => submitCommand(pendingCommand); }
}
function summaryUrl(scope) {
  const [area, sector, zone] = scope.split(':');
  const query = new URLSearchParams({area, inventory:state.cycleId, summary:'1', from:'supervision'});
  if (sector) query.set('sector', sector); if (zone) query.set('zone',zone);
  return '/pages/inventario/?' + query;
}
function renderScopeSummary() {
  const link = $('#scope-summary');
  link.hidden = !state.scope || state.mode === 'areas' || state.mode === 'events' || !groups.length;
  if (link.hidden) return;
  const totals = groups.reduce((sum, group) => ({total:sum.total + group.total,counted:sum.counted + group.counted,partial:sum.partial + group.partial}), {total:0,counted:0,partial:0});
  link.href = summaryUrl(state.scope);
  link.innerHTML = `${ring(totals)}<span><strong>${esc(locationName(state.scope))}</strong><small>${totals.counted} contados · ${totals.partial} con avance</small></span><span class="supervision-scope-link">Ver resumen ›</span>`;
  link.onclick = () => snapshot();
}
function renderAreas() {
  $('#result-count').textContent = `${groups.length} ${groups.length === 1 ? 'área' : 'áreas'}`;
  const chevron = '<svg class="supervision-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';
  const content = (id,g) => `${ring(g)}<span><strong>${esc(locationName(id))}</strong><small>${g.counted} contados · ${g.partial} con avance</small><small>${g.pending} pendientes · ${g.excluded} inactivos</small></span>`;
  const branch = (id,g) => {
    const children = scopes.filter(s => s.parent === id && scopeGroups.some(g => g.scopeId === s.id));
    if (!children.length) return `<a class="supervision-area-row" data-area="${esc(id.split(':')[0])}" href="${esc(summaryUrl(id))}">${content(id,g)}${chevron}</a>`;
    return `<details class="supervision-area-branch" data-scope="${esc(id)}" ${state.openScopes.includes(id) ? 'open' : ''}><summary class="supervision-area-row" data-area="${esc(id.split(':')[0])}">${content(id,g)}${chevron}</summary><div class="supervision-children">${children.map(child => branch(child.id,scopeGroups.find(g=>g.scopeId === child.id))).join('')}</div></details>`;
  };
  $('#results').innerHTML = groups.length ? `<div class="supervision-area-list">${groups.map(group => branch(group.areaId,group)).join('')}</div><p class="supervision-legend"><span><i class="state-dot counted"></i>Contado</span><span><i class="state-dot partial"></i>Avance</span><span><i class="state-dot pending"></i>Pendiente</span></p>` : '<p class="supervision-empty">No hay productos disponibles en esta área.</p>';
  for (const link of root.querySelectorAll('#results a')) link.onclick = () => snapshot();
  for (const branch of root.querySelectorAll('details[data-scope]')) branch.addEventListener('toggle', () => snapshot());
  $('#more').hidden = true;
}
function listParams(atCursor = null) {
  const query = params(); if (atCursor !== null) query.set('cursor', atCursor);
  if (state.search) query.set('q', state.search);
  if (state.mode === 'items') { if (state.status) query.set('status',state.status); }
  if (state.mode === 'history') for (const [field,name] of [['category','category'],['author','author'],['location','location']]) if (state[field]) query.set(name,state[field]);
  return query;
}
async function fetchPages(count, ticket) {
  let next = null, list = [];
  const endpoint = state.mode === 'items' ? 'items' : state.mode === 'history' ? 'history' : 'events';
  for (let page = 0; page < count; page++) {
    const data = await authenticated(`/api/admin/supervision/${endpoint}?` + listParams(next));
    if (ticket !== generation) return;
    list.push(...(data.items || data.events || [])); next = data.nextCursor;
    if (next == null) { state.pageCount = page + 1; break; }
  }
  cursor = next;
  if (state.mode === 'items') { products = list; renderProducts(); }
  else if (state.mode === 'history') {
    for (const item of list) { const previous = historyItems.find(old => key(old) === key(item)); if (previous && previous.lastSeq !== item.lastSeq) details.delete(key(item)); }
    historyItems = list; renderHistory();
  }
  else renderEvents(list);
  $('#more').hidden = cursor == null;
}
async function loadMore() {
  if (loading || cursor == null) return;
  snapshot(); const y = window.scrollY; state.pageCount++;
  $('#more').disabled = true;
  try { await refresh({ quiet:true }); window.scrollTo({ top:y, behavior:'instant' }); }
  finally { $('#more').disabled = false; }
}
function itemActions(item) {
  const closed = effective(areaOf(item) === 'servicio' ? 'servicio' : '') === 'closed';
  return `${user.role === 'admin' ? `<label class="supervision-activity"><span>Producto en ${esc(locationName(areaOf(item)))}</span><span class="supervision-switch"><input type="checkbox" role="switch" data-active="${esc(key(item))}" ${item.active ? 'checked' : ''} ${closed || pendingCommand || sending ? 'disabled' : ''} aria-label="Producto activo en ${esc(locationName(areaOf(item)))}"><span aria-hidden="true"></span><b>${item.active ? 'Activo' : 'Inactivo'}</b></span></label>` : ''}${!item.active ? `<p class="supervision-muted">${item.inactiveSince ? `Inactivo desde ${esc(dateTime(item.inactiveSince))}. ` : ''}No aparece en el conteo normal.</p>` : ''}${closed ? '<p class="supervision-muted">Finalizado. Un Administrador debe reabrir antes de modificar.</p>' : item.active ? `<div class="supervision-item-actions"><button type="button" class="button button-secondary" data-change="rectify">Corregir total</button>${item.record && item.record.status !== 'pending' ? '<button type="button" class="button button-danger" data-change="annul">Anular conteo</button>' : ''}</div>` : ''}<button type="button" class="supervision-text-action" data-item-history>Ver historial</button>`;
}
function renderProducts() {
  $('#result-count').textContent = `${products.length} cargados`;
  $('#results').innerHTML = products.length ? `<div class="supervision-rows">${products.map(item => `<details class="supervision-product" data-product="${esc(key(item))}" ${state.openProducts.includes(key(item)) ? 'open' : ''}><summary><span><strong>${esc(item.name)}</strong><small><i class="state-dot ${item.active ? item.status : 'inactive'}" aria-hidden="true"></i>${item.active ? stateNames[item.status] : 'Inactivo'} · ${esc(locationName(item.locationId))}</small></span><span class="supervision-row-value">${esc(recordValue(item.record, item.unit))}<svg class="supervision-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></span></summary><div class="supervision-product-detail">${item.record?.note ? `<p class="supervision-note">${esc(item.record.note)}</p>` : ''}${itemActions(item)}</div></details>`).join('')}</div>` : '<p class="supervision-empty">Sin productos para estos filtros.</p>';
  for (const card of root.querySelectorAll('details[data-product]')) {
    const item = products.find(i => key(i) === card.dataset.product);
    card.ontoggle = () => snapshot();
    for (const button of card.querySelectorAll('[data-change]')) { button.disabled = !!pendingCommand || sending; button.onclick = () => changeDialog({kind:button.dataset.change}, item); }
    const toggle = card.querySelector('[data-active]');
    if (toggle) toggle.onchange = () => {
      const command = {id:crypto.randomUUID(),cycleId:cycle.id,expectedRevision:cycle.revision,kind:'activation',itemId:item.id,locationId:item.locationId,expectedVersion:item.record?.version || 0,confirm:true,active:toggle.checked};
      if (Number.isSafeInteger(item.activityRevision)) command.expectedActivityRevision = item.activityRevision;
      toggle.disabled = true; submitCommand(command);
    };
    card.querySelector('[data-item-history]').onclick = () => openProductHistory(item);
  }
}
function historySummary(item) {
  const counts = item.counts || {};
  return [[counts.counts,'conteos'],[counts.corrections,'correcciones'],[counts.annulments,'anulaciones']].filter(([n]) => n).map(([n,label]) => `${n} ${label}`).join(' · ');
}
function renderHistory() {
  $('#result-count').textContent = `${historyItems.length} ítems cargados`;
  $('#results').innerHTML = historyItems.length ? `<div class="supervision-rows">${historyItems.map(item => `<details class="supervision-history-item" data-history="${esc(key(item))}" ${state.openHistory.includes(key(item)) ? 'open' : ''}><summary><span><strong>${esc(item.product)}</strong><small>${esc(locationName(item.locationId))}</small><small>${esc(historySummary(item))}</small></span><svg class="supervision-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></summary><div class="supervision-history-detail">${details.has(key(item)) ? chronology(details.get(key(item)).rows, item.unit) + moreHistoryMarkup(details.get(key(item)).cursor) : skeleton()}</div></details>`).join('')}</div>` : '<p class="supervision-empty">Sin movimientos para estos filtros.</p>';
  for (const card of root.querySelectorAll('details[data-history]')) {
    const item = historyItems.find(i => key(i) === card.dataset.history);
    card.ontoggle = () => { snapshot(); if (card.open && !details.has(key(item))) loadHistory(item, card.querySelector('.supervision-history-detail')); };
    if (card.open && !details.has(key(item))) loadHistory(item, card.querySelector('.supervision-history-detail'));
    bindHistoryMore(card.querySelector('.supervision-history-detail'),item);
  }
}
function chronology(rows, unit) {
  if (!rows.length) return '<p class="supervision-muted">Sin movimientos.</p>';
  let day = '';
  return '<ol class="supervision-timeline">' + rows.map(event => {
    const nextDay = calendarDay(event.createdAt), heading = nextDay === day ? '' : `<li class="supervision-day">${esc(nextDay)}</li>`; day = nextDay;
    return `${heading}<li class="supervision-movement"><p><strong>${esc(movementQuantity({...event,unit:event.unit || unit}))}</strong><span> · ${esc(event.authorName || event.after?.authorName || 'Usuario')}</span></p><p class="supervision-movement-meta">${esc(actionNames[event.action] || event.action)} · <time datetime="${esc(event.createdAt)}">${esc(dateTime(event.createdAt))}</time></p><p class="supervision-before-after">Antes: ${esc(recordValue(event.before, event.unit || unit))}<br>Después: ${esc(recordValue(event.after, event.unit || unit))}</p>${event.after?.note ? `<p class="supervision-note">${esc(event.after.note)}</p>` : ''}${event.reason ? `<p class="supervision-muted">Motivo: ${esc(event.reason)}</p>` : ''}</li>`;
  }).join('') + '</ol>';
}
function moreHistoryMarkup(next) { return next == null ? '' : '<button type="button" class="supervision-text-action" data-more-history>Movimientos anteriores</button>'; }
function bindHistoryMore(host,item) { const button = host.querySelector('[data-more-history]'); if (button) button.onclick = () => loadHistory(item,host,true); }
async function loadHistory(item, host, append = false) {
  const id = key(item), ticket = generation, existing = details.get(id), query = params();
  query.delete('scope'); query.set('item', item.id || item.itemId); query.set('location',item.locationId);
  if (append && existing?.cursor != null) query.set('cursor',existing.cursor);
  const button = host.querySelector('[data-more-history]'); if (button) button.disabled = true;
  try {
    const data = await authenticated('/api/admin/supervision/history?' + query);
    if (!host.isConnected || ticket !== generation) return;
    const entry = {rows:append ? [...existing.rows,...data.history] : data.history,cursor:data.nextCursor}; details.set(id,entry);
    host.innerHTML = chronology(entry.rows,item.unit) + moreHistoryMarkup(entry.cursor); bindHistoryMore(host,item); snapshot();
  } catch (error) { if (!host.isConnected) return; host.innerHTML = `<p role="alert">${esc(error.message)}</p><button type="button" class="supervision-text-action" data-history-retry>Reintentar</button>`; host.querySelector('button').onclick = () => loadHistory(item,host,append); }
}
function openProductHistory(item) {
  const canAnnul = item.active && item.record && item.record.status !== 'pending' && effective(areaOf(item) === 'servicio' ? 'servicio' : '') !== 'closed';
  const el = dialog('Historial del producto', `<p class="supervision-muted">${esc(item.name)} · ${esc(locationName(item.locationId))}</p><div class="supervision-history-dialog">${skeleton()}</div><div class="supervision-dialog-actions">${canAnnul ? '<button type="button" class="button button-danger" data-annul-history>Anular conteo</button>' : ''}<button type="button" class="button button-secondary" data-close autofocus>Cerrar</button></div>`);
  el.classList.add('supervision-modal'); el.querySelector('[data-close]').onclick = () => el.close();
  if (el.querySelector('[data-annul-history]')) { el.querySelector('[data-annul-history]').disabled = !!pendingCommand || sending; el.querySelector('[data-annul-history]').onclick = () => { el.close(); changeDialog({kind:'annul'},item); }; }
  const host = el.querySelector('.supervision-history-dialog'); loadHistory(item,host);
}
function renderEvents(events) {
  $('#result-count').textContent = `${events.length} cambios cargados`;
  $('#results').innerHTML = events.length ? '<div class="supervision-rows">' + events.map(event => `<article class="supervision-event"><strong>${esc(actionNames[event.kind] || event.kind)}${event.kind === 'state' && stateNames[event.result?.scopeState] ? ' · ' + esc(stateNames[event.result.scopeState]) : ''}</strong><p>${esc(event.authorName || event.user_id || 'Usuario')} · ${esc(event.scope_id ? locationName(event.scope_id) : 'Inventario Global')} · ${esc(dateTime(event.created_at))}</p>${event.reason ? `<p class="supervision-note">${esc(event.reason)}</p>` : ''}</article>`).join('') + '</div>' : '<p class="supervision-empty">Sin cambios administrativos.</p>';
}
function changeDialog(change,item) {
  if (pendingCommand || sending) { notice('Reintenta el cambio pendiente antes de iniciar otro.'); return; }
  const reopen = change.kind === 'state' && change.state === 'open';
  const edit = change.kind === 'rectify', annul = change.kind === 'annul';
  const scopeName = change.scope ? 'Servicio' : 'Inventario Global';
  const titles = {rectify:'Corregir total',annul:'Anular conteo',state:reopen ? 'Reabrir inventario' : change.state === 'review' ? 'Cerrar conteo' : 'Finalizar y enviar'};
  const descriptions = annul ? `Esta acción cambia el ítem de ${stateNames[item.status]?.toLowerCase() || 'contado'} a pendiente.` : edit ? 'Indica el total correcto para este producto.' : reopen ? `Se habilitará nuevamente el conteo de ${scopeName}. Indica el motivo de reapertura.` : change.state === 'review' ? `Se pausará el conteo ${change.scope ? 'de Servicio' : 'de todas las áreas'} para que los encargados completen la revisión antes del envío final. Puedes reabrirlo cuando lo necesites.` : `Estás por enviar ${change.scope ? 'Servicio' : 'el inventario global'} cerrado y revisado. Quedará finalizado en la app.`;
  const command = {id:crypto.randomUUID(),cycleId:cycle.id,expectedRevision:cycle.revision,...change,confirm:true};
  if (item) Object.assign(command,{itemId:item.id,locationId:item.locationId,expectedVersion:item.record?.version || 0});
  const draftKey = `${state.cycleId}:${item ? key(item) : change.scope || 'global'}:${change.kind}:${change.state || ''}`;
  const el = dialog(titles[change.kind], `<p class="supervision-dialog-context">${esc(item ? item.name + ' · ' + locationName(item.locationId) : scopeName)}</p><p>${esc(descriptions)}</p><form id="change-form">${edit ? `<label>Total (${esc(item.unit || 'unidad pendiente')})<input name="quantity" inputmode="decimal" type="number" min="0" max="1000000" step="0.001" value="${item.record?.quantity ?? ''}" required></label><label>Estado<select name="status"><option value="counted">Contado</option><option value="partial" ${item.status === 'partial' ? 'selected' : ''}>Avance</option></select></label><label class="supervision-check"><input type="checkbox" name="outOfStock" ${item.record?.outOfStock ? 'checked' : ''}>Sin stock (cero contado)</label><label>Nota (opcional)<textarea name="note" maxlength="1000">${esc(item.record?.note || '')}</textarea></label><p id="change-preview" class="supervision-preview" aria-live="polite"></p>` : ''}${reopen ? '<div class="supervision-reasons"><button type="button" data-reason="Revisar o corregir conteos">Revisar conteos</button><button type="button" data-reason="Completar el conteo de productos">Completar productos</button></div>' : ''}${reopen || edit || annul ? `<label>Motivo${reopen ? '' : ' (opcional)'}<textarea name="reason" ${reopen ? 'minlength="3" required' : ''} maxlength="500" placeholder="${reopen ? 'Elige una sugerencia o escribe otro motivo' : annul ? 'Por ejemplo: producto contado por error' : 'Por ejemplo: ajuste tras revisar el conteo'}"></textarea></label>` : ''}<p data-command-error role="alert"></p><div class="supervision-dialog-actions"><button type="button" class="button button-secondary" data-cancel autofocus>Cancelar</button><button type="submit" class="button ${annul ? 'button-danger' : 'button-primary'}" data-confirm>${edit ? 'Guardar' : annul ? 'Anular' : reopen ? 'Reabrir' : change.state === 'review' ? 'Cerrar' : 'Finalizar y enviar'}</button></div></form>`);
  el.classList.add('supervision-modal'); el.querySelector('h2').after(el.querySelector('[data-command-error]')); commandDialog = el;
  const form = el.querySelector('form');
  const saveDraft = () => { const data = Object.fromEntries(new FormData(form)); if (edit) data.outOfStock = form.elements.outOfStock.checked; state.drafts[draftKey] = data; snapshot(); };
  const draft = state.drafts[draftKey];
  if (draft) for (const field of [...form.elements]) { if (!field.name || draft[field.name] == null) continue; if (field.type === 'checkbox') field.checked = !!draft[field.name]; else field.value = draft[field.name]; }
  const preview = () => { if (!edit) return; const zero = form.elements.outOfStock.checked; form.elements.quantity.disabled = zero; form.elements.status.disabled = zero; el.querySelector('#change-preview').textContent = `Resultado: ${zero ? 'Sin stock · cero contado' : `${form.elements.quantity.value || '—'} ${item.unit || ''} · ${stateNames[form.elements.status.value]}`}`; };
  form.oninput = () => { preview(); saveDraft(); }; preview();
  for (const button of el.querySelectorAll('[data-reason]')) button.onclick = () => { form.elements.reason.value = button.dataset.reason; form.elements.reason.focus(); saveDraft(); };
  el.querySelector('[data-cancel]').onclick = () => el.close();
  el.addEventListener('close', () => { if (commandDialog === el) commandDialog = null; }, {once:true});
  form.onsubmit = async event => {
    event.preventDefault(); saveDraft();
    if (form.elements.reason) command.reason = form.elements.reason.value.trim();
    if (edit) Object.assign(command,{quantity:form.elements.outOfStock.checked ? 0 : Number(form.elements.quantity.value),status:form.elements.outOfStock.checked ? 'counted' : form.elements.status.value,note:form.elements.note.value,outOfStock:form.elements.outOfStock.checked});
    for (const field of form.elements) field.disabled = true;
    el.querySelector('[data-cancel]').disabled = false;
    const done = await submitCommand(command);
    if (done) { delete state.drafts[draftKey]; snapshot(); if (el.open) el.close(); }
    else if (el.isConnected) {
      el.querySelector('[data-command-error]').textContent = message.textContent;
      if (!pendingCommand) { for (const field of form.elements) field.disabled = false; preview(); }
      else { el.querySelector('[data-cancel]').textContent = 'Cerrar'; }
    }
  };
}
async function submitCommand(command) {
  if (sending) return false;
  sending = true;
  try {
    // Retain the exact reviewed payload/operation ID. A retry is always explicit.
    pendingCommand = command;
    renderCycleActions();
    await sendSupervisionCommand(user.id,command);
    pendingCommand = null; details.clear();
    sending = false; await refresh(); notice('Cambio guardado.','success'); return true;
  } catch (error) {
    pendingCommand = error.pending || readCommand(user.id);
    if (['CONFIRMATION_REQUIRED','CONFIRMATION_CHANGED'].includes(error.code) && commandDialog?.open) {
      command.confirmWarnings=true;command.confirmationRevision=error.confirmationRevision;
      const button=commandDialog.querySelector('[data-confirm]'); if(button)button.textContent='Continuar de todas formas';
      notice((error.warnings || []).map(w=>w.message).join(' ') || error.message, 'error');
    } else notice(pendingCommand ? 'Resultado incierto. Reintenta para confirmar el cambio.' : error.message, 'error', true);
    renderCycleActions(); return false;
  } finally { sending = false; if (cycle) renderCycleActions(); }
}
function scheduleRefresh() {
  clearTimeout(timer); if (document.hidden) return;
  timer = setTimeout(async () => { await refresh({quiet:true}); scheduleRefresh(); }, 20000);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else { refresh({quiet:true}); scheduleRefresh(); } });
window.addEventListener('pagehide', () => { if (user) snapshot(); clearTimeout(timer); });
window.addEventListener('pageshow', event => { if (event.persisted && user) { refresh({quiet:true}); scheduleRefresh(); } });
window.addEventListener('scroll', () => { if (user && !restoring) { clearTimeout(window.supervisionScrollTimer); window.supervisionScrollTimer = setTimeout(snapshot, 150); } }, {passive:true});

try {
  const data = await authenticated('/api/admin/supervision/cycles'); user = data.user;
  if (history.state?.supervision?.userId === user.id) restore(history.state.supervision.value);
  else { try { restore(JSON.parse(sessionStorage.getItem(storageKey()) || 'null')); } catch {} }
  if (!data.cycles.some(c => c.id === state.cycleId)) state.cycleId = data.defaultCycleId || data.cycles[0]?.id || '';
  if (user.role !== 'admin' && state.mode === 'events') state.mode = 'areas';
  pendingCommand = readCommand(user.id);
  identityBar(user,async () => { await refresh({quiet:true}); return pendingCommand ? 'Cambio pendiente de confirmar' : 'Sincronizado'; });
  if (!state.cycleId) { root.innerHTML = '<p class="supervision-empty">No hay inventarios disponibles.</p>' + (user.role === 'admin' ? '<button class="button button-primary" id="create-inventory">Crear inventario</button>' : ''); root.setAttribute('aria-busy','false'); if ($('#create-inventory')) $('#create-inventory').onclick = () => inventoryDialog(user, data.cycles); }
  else { restoring = true; renderShell(data.cycles); renderManagement(data.cycles); await refresh({authors:true}); restoring = false; scheduleRefresh(); }
} catch (error) { root.textContent = 'Panel de supervisión no disponible.'; root.setAttribute('aria-busy','false'); notice(error.message); }
