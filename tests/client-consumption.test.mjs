import test from 'node:test';
import assert from 'node:assert/strict';
import { createAPI } from '../shared/api-request.js';
import { startPolling } from '../shared/polling.js';
const response = data => new Response(JSON.stringify(data), { headers: {'content-type':'application/json'} });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise,resolve}; };

test('GETs coalesce only while pending by full path and user, with independent results', async () => {
  const calls = [], gate = deferred(); let user = 'one';
  const api = createAPI({ identity: () => user, fetch: async (path, options) => { calls.push({path, options}); await gate.promise; return response({items:[{id:user}]}); } });
  const a = api('/api/bootstrap?area=cocina'), b = api('/api/bootstrap?area=cocina');
  const c = api('/api/bootstrap?area=panaderia');
  user = 'two'; const d = api('/api/bootstrap?area=cocina');
  assert.equal(calls.length, 3); assert.equal(calls[0].options.cache, 'no-store');
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  gate.resolve();
  const [one, two] = await Promise.all([a,b,c,d]);
  one.items[0].id = 'changed'; assert.notEqual(two.items[0].id, 'changed');
  await api('/api/bootstrap?area=cocina'); assert.equal(calls.length, 4);
});

test('writes invalidate pending GET sharing and are never coalesced; rejected GETs are evicted', async () => {
  const gate = deferred(), calls = []; let fail = false;
  const api = createAPI({identity: () => 'user', fetch: async (path, options) => {
    calls.push([path,options.method]); await gate.promise;
    if(fail) throw new Error('offline'); return response({ok:true});
  }});
  const reads = [api('/api/me')], writes = [api('/api/profile', {}),api('/api/profile', {})];
  reads.push(api('/api/me')); assert.equal(calls.length,4);
  gate.resolve(); await Promise.all([...reads,...writes]);
  fail = true; await assert.rejects(api('/api/me')); await assert.rejects(api('/api/me'));
  assert.equal(calls.length,6);
});

function pollingFixture(task) {
  const doc = Object.assign(new EventTarget(),{hidden:false}), win = new EventTarget(), timers = new Map();
  let time = 0, serial = 0;
  const tick = startPolling(task,{document:doc,window:win,now:()=>time,
    setTimer(fn,delay) { const id=++serial;timers.set(id,{fn,at:time+delay});return id; },clearTimer(id){timers.delete(id);} });
  return {doc,win,tick,timers,async advance(ms){time+=ms;const due=[...timers].filter(([,timer])=>timer.at<=time);for(const [id,timer] of due){timers.delete(id);await timer.fn();}},
    visibility(hidden){doc.hidden=hidden;doc.dispatchEvent(new Event('visibilitychange'));}};
}

test('poll timer and visibility share pending read; hidden and stopped pages do not schedule reads', async () => {
  let count=0; const gate=deferred(), f=pollingFixture(async()=>{count++;await gate.promise;});
  const first=f.tick();f.visibility(false);await Promise.resolve();assert.equal(count,1);
  f.visibility(true);assert.equal(f.timers.size,0);gate.resolve();await first;assert.equal(f.timers.size,0);
  await f.advance(10000);assert.equal(count,1);
  f.visibility(false);await f.tick();assert.equal(count,2);
  f.tick.stop();await f.advance(10000);f.visibility(false);await f.tick();assert.equal(count,2);
});

test('active polling stays five seconds, retries back off and pagehide/pageshow resume safely', async()=>{
  let count=0, fail=false;const f=pollingFixture(async()=>{count++;if(fail)throw Object.assign(Error('limited'),{retryAfter:30});});
  await f.advance(5000);assert.equal(count,1);await f.advance(4999);assert.equal(count,1);await f.advance(1);assert.equal(count,2);
  fail=true;await f.advance(5000);assert.equal(count,3);f.visibility(false);await f.tick();assert.equal(count,3);
  await f.advance(29999);assert.equal(count,3);fail=false;await f.advance(1);assert.equal(count,4);
  f.win.dispatchEvent(new Event('pagehide'));await f.advance(20000);assert.equal(count,4);
  f.win.dispatchEvent(new Event('pageshow'));await f.tick();assert.equal(count,5);f.tick.stop();
});

test('realtime pause preserves forced catchup, waits for older reads and resume restores fallback', async()=>{
  let count=0;const gate=deferred(),f=pollingFixture(async()=>{count++;if(count===1)await gate.promise;});
  const old=f.tick();await Promise.resolve();f.tick.pause();
  const catchup=f.tick.refresh({afterPending:true});await Promise.resolve();assert.equal(count,1);
  gate.resolve();await old;await catchup;assert.equal(count,2);
  await f.advance(10000);assert.equal(count,2);f.tick.resume();await f.advance(5000);assert.equal(count,3);
  f.tick.stop();
});
