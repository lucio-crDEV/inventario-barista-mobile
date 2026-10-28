import {hashPasswordWithService} from './password-service.js';
import { allowedArea } from '../shared/deployment-domain.js';
import { exportJobRequest, exportJobPath } from './export-jobs.js';
import { exportSnapshotRequest } from './export-snapshots.js';
import { observeRequest, receiveTelemetry } from './observability.js';
import { requestMetrics } from './request-metrics.js';
import { supervisionRequest, historyDTO, workerHistoryDTO } from "./supervision.js";
import { accountRequest } from "./accounts.js";
import { routeName, allowRequest, logEvent } from "./telemetry.js";
import { deploymentState } from "./runtime-readiness.js";
import { resolveCycle, inventoryCyclesRequest } from "./inventory-cycles.js";
import { json, fail, body, secured, errorResponse } from './http.js';
import { auth, login, logout, changePassword, userDTO, quota, digest } from './session.js';
import { permissionsSQL } from './authorization.js';
import { boot, current, allowedItem, searchItems, summarizeItems } from './inventory-queries.js';
import { saveCount } from './counts.js';
const actorCTE = permissionsSQL({ column: 'id' });
async function api(req, env, url, event) {
  event.measure?.phase("preflight");
  if (
    !env.DB ||
    !env.APP_ORIGIN ||
    !["local", "production"].includes(env.APP_ENV)
  )
    fail(503, "NOT_CONFIGURED", "Entorno sin configuración válida.");
  if (
    url.origin !== env.APP_ORIGIN ||
    (env.APP_ENV === "production" && url.protocol !== "https:") ||
    (env.APP_ENV === "local" &&
      !["127.0.0.1", "localhost"].includes(url.hostname))
  )
    fail(503, "NOT_CONFIGURED");
  let modernCycles, catalogVersion, metadataRevision;
  try {
    const state=await deploymentState(env.DB,env,event.dbIdentity||env.DB,url.pathname);
    modernCycles=state.modern;catalogVersion=state.catalogVersion;metadataRevision=state.metadataRevision;
  } catch(error) {
    fail(503,'NOT_INITIALIZED','El inventario aún no está habilitado. Contacta al administrador.');
  }
  event.measure?.phase("auth");
  if (
    req.method !== "GET" &&
    (req.headers.get("origin") !== env.APP_ORIGIN ||
      req.headers.get("sec-fetch-site") === "cross-site")
  )
    fail(403, "ORIGIN_REJECTED");
  const db = env.DB,
    p = url.pathname;
  if (p === "/api/login" && req.method === "POST")
    return login(req, env, event, modernCycles);
  const { u, hash } = await auth(req, env);
  event.actor = u.id;
  event.measure?.phase("handler");
  if(event.measure)event.measure.admin=u.role==="admin";
  if (p !== "/api/logout" && !allowRequest(u.id, event.route))
    fail(429, "RATE_LIMIT", "Demasiadas solicitudes. Espera un minuto.", { retryAfter: 60 });
  if (p === "/api/logout" && req.method === "POST")
    return logout(db, hash, env);
  if (p === "/api/me" && req.method === "GET")
    return json({ user: userDTO(u) });
  if (p === "/api/password" && req.method === "POST")
    return changePassword(req, db, env, { u, hash }, event);
  if (u.must_change)
    fail(
      403,
      "PASSWORD_CHANGE_REQUIRED",
      "Debes cambiar tu contraseña temporal.",
    );
  if (p === "/api/status" && req.method === "GET")
    return json({ ready: true, stage: "3A", increment: "usuarios-servicio" });
  if (p === "/api/admin/metrics" && req.method === "GET") {
    // Root and persistent metrics are deferred. No current role may read them.
    fail(403, "ROOT_NOT_ENABLED", "Las métricas técnicas están reservadas a Root, todavía no habilitado.");
  }
  event.measure?.phase("cycle");
  const selectedCycle = ["/api/navigation","/api/bootstrap","/api/sync","/api/search","/api/summary","/api/record","/api/history","/api/realtime"].includes(p) ? await resolveCycle(db, hash, url.searchParams.get("cycle"), env.ACTIVE_CYCLE_ID,modernCycles) : null;
  event.measure?.phase("handler");
  if (p === "/api/navigation" && req.method === "GET") {
    const scopes = await db
      .prepare(
        actorCTE +
          `SELECT s.* FROM scopes s WHERE EXISTS(SELECT 1 FROM scope_closure cl JOIN catalog_items ci ON ci.location_id=cl.descendant JOIN cycles cy ON cy.catalog_version=ci.version WHERE cy.id=?2 AND cl.ancestor=s.id AND ci.location_id IN(SELECT id FROM allowed))`,
      )
      .bind(hash, selectedCycle || "")
      .all();
    return json({ user: userDTO(u), scopes: scopes.results, cycleId: selectedCycle,realtime:!!env.REALTIME });
  }
  if ((p.startsWith("/api/admin/") || p === "/api/profile") && req.method === "POST" && req.headers.get("X-Inventory-User") !== u.id)
    fail(409, "IDENTITY_CHANGED", "La cuenta de esta pestaña cambió. Recarga antes de guardar.");
  if (p === '/api/admin/exports' || exportJobPath.test(p))
    return exportJobRequest(req,env,url,{u,hash});
  if (p === '/api/admin/export-snapshots' || p.startsWith('/api/admin/export-snapshots/'))
    return exportSnapshotRequest(req,db,url,{u,hash});
  if (modernCycles && (p === '/api/cycles' || p === '/api/admin/cycles' || p === '/api/admin/cycles/command' || p === '/api/admin/supervision/cycles'))
    return inventoryCyclesRequest(req,db,url,{u,hash},{json,fail,body,userDTO,digest},catalogVersion);
  if (p === "/api/admin/supervision" || p.startsWith("/api/admin/supervision/"))
    return supervisionRequest(req,db,url,{u,hash,metadataRevision},{json:p==='/api/admin/supervision'&&req.method==='GET'?(data,status,headers)=>json({...data,realtime:!!env.REALTIME},status,headers):json,fail,body,userDTO,digest});
  if (p.startsWith("/api/admin/") || p === "/api/profile")
    return accountRequest(req, db, p, { u, hash }, { body, fail, json, userDTO, quota, event, hashPassword:async value=>hashPasswordWithService(env,value,await digest(u.id)) });
  if(p==='/api/realtime') {
    if(!env.REALTIME)fail(503,'REALTIME_UNAVAILABLE');
    if(req.method!=='GET'||req.headers.get('upgrade')?.toLowerCase()!=='websocket')fail(426,'WEBSOCKET_REQUIRED');
    if(req.headers.get('origin')!==env.APP_ORIGIN)fail(403,'ORIGIN_REJECTED');
    if(url.searchParams.get('cycle')&&!selectedCycle)fail(403,'FORBIDDEN');
    const scopes=await db.prepare(actorCTE+'SELECT id FROM allowed').bind(hash).all();
    const context={userId:u.id,revision:u.revision,accessRevision:metadataRevision,expires:u.session_expires,cycleId:url.searchParams.has('cycle')?selectedCycle||'':'',scopeIds:scopes.results.map(row=>row.id)};
    const stub=env.REALTIME.get(env.REALTIME.idFromName('inventory'));
    return stub.fetch(new Request('https://realtime.internal/connect',{headers:{Upgrade:'websocket','X-Inventory-Context':JSON.stringify(context)}}));
  }
  const cycle = selectedCycle || "";
  if (p === "/api/bootstrap" && req.method === "GET") {
    const area=url.searchParams.get("area")||"";
    if(area&&!allowedArea(area))fail(400,'INVALID_AREA');
    const data = await boot(db, hash, cycle,area);
    event.scope = [...new Set(data.items.map(x => x.areaId))].sort().join(",") || "none";
    return json({ ...data, user: userDTO(u),realtime:!!env.REALTIME });
  }
  if (p === "/api/sync" && req.method === "GET") {
    const cursor = Number(url.searchParams.get("cursor") || 0);
    if (!Number.isSafeInteger(cursor) || cursor < 0)
      fail(400, "INVALID_CURSOR");
    const [rows,cycleRows]=await db.batch([
      db.prepare(actorCTE+`SELECT seq,after_record FROM history WHERE cycle_id=?2 AND seq>?3 AND location_id IN (SELECT id FROM allowed) ORDER BY seq LIMIT 250`).bind(hash,cycle,cursor),
      db.prepare(actorCTE+`SELECT revision FROM cycles WHERE id=?2 AND EXISTS(SELECT 1 FROM allowed)`).bind(hash,cycle),
    ]);
    return json({
      user: userDTO(u),
      cycleRevision: cycleRows.results[0]?.revision,
      changes: rows.results.map((x) => JSON.parse(x.after_record)),
      cursor: rows.results.at(-1)?.seq ?? cursor,
    });
  }
  if ((p === "/api/search" || p === "/api/summary") && req.method === "GET") {
    const options = {scope:url.searchParams.get('scope') || '',query:url.searchParams.get('q') || ''};
    return json(p === '/api/search'
      ? {items:await searchItems(db,hash,cycle,options)}
      : await summarizeItems(db,hash,cycle,options));
  }

  if ((p === "/api/record" || p === "/api/history") && req.method === "GET") {
    const item = url.searchParams.get("item"),
      location = url.searchParams.get("location");
    await allowedItem(db, hash, cycle, item, location);
    event.scope = location;
    if (p === "/api/record")
      return json({ record: await current(db, hash, cycle, item, location) });
    const cursor=Number(url.searchParams.get('cursor')||0);
    if(!Number.isSafeInteger(cursor)||cursor<0)fail(400,'INVALID_CURSOR');
    const manager=['admin','service_lead'].includes(u.role),limit=manager?51:10;
    const rows=await db.prepare(actorCTE+`SELECT h.*,u.name author_name,json_extract(ci.data,'$.name') product,ci.unit FROM history h JOIN users u ON u.id=h.user_id JOIN cycles cy ON cy.id=h.cycle_id JOIN catalog_items ci ON ci.version=cy.catalog_version AND ci.id=h.item_id AND ci.location_id=h.location_id WHERE h.cycle_id=?2 AND h.item_id=?3 AND h.location_id=?4 AND h.location_id IN(SELECT id FROM allowed) AND (?5=0 OR h.seq<?5) ${manager?"AND EXISTS(SELECT 1 FROM actor WHERE role IN('admin','service_lead'))":''} ORDER BY h.seq DESC LIMIT ${limit}`).bind(hash,cycle,item,location,manager?cursor:0).all();
    const page=rows.results.slice(0,manager?50:10);
    return json({history:page.map(manager?historyDTO:workerHistoryDTO),nextCursor:manager&&rows.results.length>50?page.at(-1).seq:null});
  }
  if (p === "/api/count" && req.method === "POST")
    return saveCount(req, db, { u, hash }, event);
  fail(404, "NOT_FOUND");
}
export default {
  async fetch(req, env, ctx) {
    const started = Date.now();
    const url = new URL(req.url);
    const event = { requestId: crypto.randomUUID(), route: routeName(url.pathname), method: ["GET", "POST"].includes(req.method) ? req.method : "other", status: 500 };
    Object.defineProperty(event,'dbIdentity',{value:env.DB});
    const measured=env.METRICS_ENABLED==='1'&&env.DB&&url.pathname.startsWith('/api/')&&url.pathname!=='/api/telemetry';
    if(measured)Object.defineProperty(event,'measure',{value:requestMetrics(env.DB)});
    const finish = (res) => {
      event.status = res.status;
      if (event.measure) ctx?.waitUntil?.(observeRequest(env,{
        route:event.route,method:event.method,status:event.status,errorCode:event.errorCode,
        elapsedMs:Date.now()-started,diagnostics:event.measure.finish(),
      }));
      const response = secured(res, req);
      response.headers.set("X-Request-ID", event.requestId);
      // Expose request-local diagnostics only to an authenticated administrator.
      if(event.measure?.admin && res.status<400)response.headers.set('Server-Timing',event.measure.serverTiming());

      if (url.pathname.startsWith("/api/") && url.pathname!=="/api/telemetry") {
        // Bounded metadata only; no usage persistence or per-poll database writes.
        if (res.status >= 400 || ["login", "logout", "password", "profile", "admin-users"].includes(event.route))
          logEvent({ ...event, at: new Date().toISOString(), elapsedMs: Date.now() - started });
      }
      return response;
    };
    try {
      let res;
      if (url.pathname === '/api/telemetry') res = await receiveTelemetry(req,env);
      else if (url.pathname.startsWith("/api/")) res = await api(req, event.measure ? {...env,DB:event.measure.DB} : env, url, event);
      else if (
        !/^\/(?:assets\/[\w.-]+\.(?:css|js)$|$|pages\/admin\/supervision$|index\.html$|theme\.(?:css|js)$|shared\/[\w.-]+\.(?:js|css)$|pages\/(?:inventario|cuenta|admin)\/(?:[\w.-]+\.(?:html|css|js))?$)/.test(
          url.pathname,
        )
      )
        res = json({ code: "NOT_FOUND" }, 404);
      else {
        const protectedHTML = /^(?:\/(?:index\.html)?|\/pages\/(?:inventario|admin)(?:\/(?:[\w.-]+\.html|supervision)?)?)$/.test(url.pathname);
        if (protectedHTML) {
          let identity;
          try { identity = await auth(req, env); }
          catch (error) { if (error.status !== 401) throw error; }
          if (!identity || identity.u.must_change) {
            res = new Response(null, {status: 302, headers: {Location: '/pages/cuenta/', 'Cache-Control': 'no-store'}});
          }
        }
        if (!res) res = await env.ASSETS.fetch(req);
        if (res.headers.get('content-type')?.includes('text/html')) {
          res = new Response(res.body, res);
          res.headers.set('Cache-Control', 'no-store');
        }
      }
      return finish(res);
    } catch (e) {
      event.errorCode = e.status ? e.code : e.name;
      return finish(errorResponse(e));
    }
  },
};
