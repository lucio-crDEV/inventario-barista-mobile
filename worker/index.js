import { observeRequest, receiveTelemetry } from './observability.js';
import {
  hashPassword,
  checkPassword,
  validPassword,
  dummyHash,
} from "./password.js";
import { supervisionRequest, historyDTO, workerHistoryDTO } from "./supervision.js";
import { accountRequest } from "./accounts.js";
import { homeURL } from "../shared/navigation.js";
import { routeName, allowRequest, logEvent, recordMetric } from "./telemetry.js";
import { readinessSQL, fastReadinessSQL } from "./readiness.js";
import { cyclesEnabled, resolveCycle, inventoryCyclesRequest, cycleSchemaSQL } from "./inventory-cycles.js";
const json = (data, status = 200, headers = {}) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
const fail = (status, code, message = code, extra = {}) => {
  throw Object.assign(Error(message), { status, code, ...extra });
};
const hex = (bytes) =>
  Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
const digest = async (s) =>
  hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const token = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const now = () => Math.floor(Date.now() / 1000);
const actorCTE = `WITH actor AS (SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.hash=?1 AND s.expires>unixepoch() AND u.active=1 AND u.deleted_at IS NULL AND u.must_change=0),
 allowed AS (SELECT p.scope_id id FROM inventory_permissions p JOIN actor a ON a.id=p.user_id) `;
const cookieName = (env) =>
  env.APP_ENV === "local"
    ? "inventory_session_local"
    : "__Host-inventory_session";
const cookie = (env, value, age = 43200) =>
  `${cookieName(env)}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${env.APP_ENV === "local" ? "" : "; Secure"}`;
async function body(req) {
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    fail(415, "JSON_REQUIRED");
  const reader = req.body?.getReader();
  const chunks = [];
  let size = 0;
  if (Number(req.headers.get("content-length")) > 16384) fail(413, "TOO_LARGE");
  if (reader) {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        fail(413, "TOO_LARGE");
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const raw = new TextDecoder().decode(bytes);
  try {
    const b = JSON.parse(raw);
    if (!b || typeof b !== "object" || Array.isArray(b))
      fail(400, "INVALID_JSON");
    return b;
  } catch {
    fail(400, "INVALID_JSON");
  }
}
function userDTO(u) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    active: !!u.active,
    mustChange: !!u.must_change,
    revision: u.revision,
  };
}
async function auth(req, env) {
  const raw = req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(cookieName(env) + "="))
    ?.split("=")[1];
  if (!raw || !/^[a-f0-9]{64}$/.test(raw))
    fail(401, "SESSION_REQUIRED", "Inicia sesión para continuar.");
  const hash = await digest(raw);
  const u = await env.DB.prepare(
    "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.hash=? AND s.expires>? AND u.active=1 AND u.deleted_at IS NULL",
  )
    .bind(hash, now())
    .first();
  if (!u) fail(401, "SESSION_REQUIRED", "La sesión terminó. Inicia sesión.");
  return { u, hash };
}
async function quota(db, key, max) {
  const window = Math.floor(now() / 900);
  const r = await db
    .prepare(
      "INSERT INTO attempts(key,window,n) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET n=CASE WHEN window=excluded.window THEN n+1 ELSE 1 END, window=excluded.window RETURNING n",
    )
    .bind(key, window)
    .first();
  if (r.n > max)
    fail(429, "RATE_LIMIT", "Demasiados intentos. Espera 15 minutos.", { retryAfter: 900 });
}
const parseRecord = (r) => (r ? JSON.parse(r.record) : null);
async function current(db, hash, cycle, item, location) {
  return parseRecord(
    await db
      .prepare(
        actorCTE +
          `SELECT cr.record FROM count_records cr WHERE cr.cycle_id=?2 AND cr.item_id=?3 AND cr.location_id=?4 AND cr.location_id IN (SELECT id FROM allowed)`,
      )
      .bind(hash, cycle, item, location)
      .first(),
  );
}
async function allowedItem(db, hash, cycle, item, location) {
  const x = await db
    .prepare(
      actorCTE +
        `SELECT ci.* FROM catalog_items ci JOIN cycles cy ON cy.catalog_version=ci.version WHERE cy.id=?2 AND ci.id=?3 AND ci.location_id=?4 AND ci.location_id IN (SELECT id FROM allowed)`,
    )
    .bind(hash, cycle, item, location)
    .first();
  if (!x)
    fail(403, "FORBIDDEN", "No tienes acceso a este producto o ubicación.");
  return x;
}
async function boot(db, hash, cycle) {
  const results = await db.batch([
    db
      .prepare(
        actorCTE +
          `SELECT cy.* FROM cycles cy WHERE cy.id=?2 AND EXISTS(SELECT 1 FROM allowed)`,
      )
      .bind(hash, cycle),
    db
      .prepare(
        actorCTE +
          `SELECT i.data, i.active operational_active FROM supervision_items i WHERE i.cycle_id=?2 AND i.location_id IN (SELECT id FROM allowed)`,
      )
      .bind(hash, cycle),
    db
      .prepare(
        actorCTE +
          `SELECT cr.record FROM count_records cr WHERE cr.cycle_id=?2 AND cr.location_id IN (SELECT id FROM allowed)`,
      )
      .bind(hash, cycle),
    db
      .prepare(
        actorCTE +
          `SELECT s.* FROM scopes s WHERE EXISTS(SELECT 1 FROM scope_closure cl JOIN catalog_items ci ON ci.location_id=cl.descendant JOIN cycles cy ON cy.catalog_version=ci.version WHERE cy.id=?2 AND cl.ancestor=s.id AND ci.location_id IN(SELECT id FROM allowed))`,
      )
      .bind(hash, cycle),
    db
      .prepare(
        actorCTE +
          `SELECT coalesce(max(seq),0) cursor FROM history WHERE cycle_id=?2 AND location_id IN (SELECT id FROM allowed)`,
      )
      .bind(hash, cycle),
  ]);
  return {
    cycle: results[0].results[0] ? {...results[0].results[0],scopeStates:(await db.prepare(actorCTE+`SELECT cs.scope_id,cs.state FROM cycle_scope_states cs WHERE cs.cycle_id=?2 AND EXISTS(SELECT 1 FROM scope_closure cl WHERE cl.ancestor=cs.scope_id AND cl.descendant IN(SELECT id FROM allowed))`).bind(hash,cycle).all()).results} : null,
    items: results[1].results.map((r) => {
      const x = JSON.parse(r.data);
      x.active = !!r.operational_active;
      return Object.fromEntries(
        [
          "id",
          "name",
          "category",
          "countCategory",
          "countCategoryOrder",
          "areaId",
          "sectorId",
          "zoneId",
          "unit",
          "order",
          "active",
          "locationId",
        ].map((k) => [k, x[k]]),
      );
    }),
    counts: results[2].results.map((r) => JSON.parse(r.record)),
    scopes: results[3].results.map(s => results[0].results[0]?.catalog_version === "inventory-v2-2026-10-21" && s.id === "servicio:armado-linea-coperia" ? { ...s, name: "Armado / Línea / Copería (ciclo anterior)" } : s),
    cursor: results[4].results[0].cursor,
  };
}
async function api(req, env, url, event) {
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
  let modernCycles, catalogVersion;
  try {
  modernCycles = await cyclesEnabled(env.DB);
  catalogVersion = modernCycles ? (env.ACTIVE_CATALOG_VERSION || (env.ACTIVE_CYCLE_ID ? (await env.DB.prepare('SELECT catalog_version FROM cycles WHERE id=?').bind(env.ACTIVE_CYCLE_ID).first())?.catalog_version : null) || (await env.DB.prepare("SELECT version FROM catalog_items WHERE version IN ('inventory-v3-2026-10-22','inventory-v2-2026-10-21') ORDER BY version DESC LIMIT 1").first())?.version) : null;
    let readiness = ["/api/login", "/api/me", "/api/status", "/api/bootstrap"].includes(url.pathname) ? readinessSQL : fastReadinessSQL;
    if (modernCycles) readiness = readiness.replace('FROM cycles c WHERE c.id=?', 'FROM (SELECT ? catalog_version) c WHERE 1=1') + cycleSchemaSQL;
    const ready = await env.DB.prepare(
      readiness,
    )
      .bind(modernCycles ? catalogVersion : (env.ACTIVE_CYCLE_ID || ""))
      .first();
    if (!ready)
      fail(
        503,
        "NOT_INITIALIZED",
        "El inventario aún no está habilitado. Contacta al administrador.",
      );
  } catch (e) {
    if (e.status) throw e;

    fail(
      503,
      "NOT_INITIALIZED",
      "El inventario aún no está habilitado. Contacta al administrador.",
    );
  }
  if (
    req.method !== "GET" &&
    (req.headers.get("origin") !== env.APP_ORIGIN ||
      req.headers.get("sec-fetch-site") === "cross-site")
  )
    fail(403, "ORIGIN_REJECTED");
  const db = env.DB,
    p = url.pathname;
  if (p === "/api/login" && req.method === "POST") {
    const b = await body(req);
    const username =
      typeof b.username === "string" ? b.username.toLowerCase().trim() : "";
    await quota(
      db,
      "ip:" + (await digest(req.headers.get("cf-connecting-ip") || "local")),
      100,
    );
    await quota(db, "user:" + (await digest(username)), 10);
    const u = await db
      .prepare("SELECT * FROM users WHERE username=? AND deleted_at IS NULL")
      .bind(username)
      .first();
    const valid =
      typeof b.password === "string" &&
      new TextEncoder().encode(b.password).length <= 72;
    const match = await checkPassword(
      valid ? b.password : "invalid-password",
      u?.password_hash || dummyHash,
    );
    if (!u || !match || !u.active || !valid)
      fail(401, "INVALID_LOGIN", "Usuario o contraseña incorrectos.");
    const raw = token(),
      hash = await digest(raw);
    // Password/reset/disable may race verification: compare the verified hash atomically.
    const inserted = await db
      .prepare(
        "INSERT INTO sessions SELECT ?,id,? FROM users WHERE id=? AND password_hash=? AND username=? AND active=1 AND deleted_at IS NULL",
      )
      .bind(hash, now() + 43200, u.id, u.password_hash, u.username)
      .run();
    if (!inserted.meta.changes)
      fail(401, "INVALID_LOGIN", "Usuario o contraseña incorrectos.");
    event.actor = u.id;
    const loginCycle = await resolveCycle(db, hash, null, env.ACTIVE_CYCLE_ID);
    const navigation = await db.prepare(actorCTE + `SELECT sc.* FROM scopes sc WHERE EXISTS(SELECT 1 FROM scope_closure cl JOIN catalog_items ci ON ci.location_id=cl.descendant JOIN cycles cy ON cy.catalog_version=ci.version WHERE cy.id=?2 AND cl.ancestor=sc.id AND ci.location_id IN(SELECT id FROM allowed))`).bind(hash, loginCycle || "").all();
    return json({ user: userDTO(u), homeUrl: homeURL(navigation.results) }, 200, { "Set-Cookie": cookie(env, raw) });
  }
  const { u, hash } = await auth(req, env);
  event.actor = u.id;
  if (p !== "/api/logout" && !allowRequest(u.id, event.route))
    fail(429, "RATE_LIMIT", "Demasiadas solicitudes. Espera un minuto.", { retryAfter: 60 });
  if (p === "/api/logout" && req.method === "POST") {
    await db.prepare("DELETE FROM sessions WHERE hash=?").bind(hash).run();
    return json({ ok: true }, 200, { "Set-Cookie": cookie(env, "", 0) });
  }
  if (p === "/api/me" && req.method === "GET")
    return json({ user: userDTO(u) });
  if (p === "/api/password" && req.method === "POST") {
    await quota(db, "password:" + u.id, 10);
    const b = await body(req);
    if (!validPassword(b.newPassword))
      fail(
        400,
        "PASSWORD_POLICY",
        "Usa al menos 8 caracteres. Si es muy larga, elige una contraseña más corta.",
      );
    if (
      typeof b.currentPassword !== "string" ||
      new TextEncoder().encode(b.currentPassword).length > 72 ||
      !(await checkPassword(b.currentPassword, u.password_hash))
    )
      fail(400, "INVALID_PASSWORD", "Contraseña actual incorrecta.");
    const h = await hashPassword(b.newPassword);
    const result = await db
      .prepare(
        "UPDATE users SET password_hash=?,must_change=0,revision=revision+1 WHERE id=? AND password_hash=? AND active=1 AND EXISTS(SELECT 1 FROM sessions WHERE hash=? AND expires>unixepoch())",
      )
      .bind(h, u.id, u.password_hash, hash)
      .run();
    if (!result.meta.changes) fail(401, "SESSION_REQUIRED");
    event.sessionsRevoked = true;
    return json({ ok: true, loginRequired: true }, 200, {
      "Set-Cookie": cookie(env, "", 0),
    });
  }
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
  const selectedCycle = await resolveCycle(db, hash, url.searchParams.get("cycle"), env.ACTIVE_CYCLE_ID);
  if (p === "/api/navigation" && req.method === "GET") {
    const scopes = await db
      .prepare(
        actorCTE +
          `SELECT s.* FROM scopes s WHERE EXISTS(SELECT 1 FROM scope_closure cl JOIN catalog_items ci ON ci.location_id=cl.descendant JOIN cycles cy ON cy.catalog_version=ci.version WHERE cy.id=?2 AND cl.ancestor=s.id AND ci.location_id IN(SELECT id FROM allowed))`,
      )
      .bind(hash, selectedCycle || "")
      .all();
    return json({ user: userDTO(u), scopes: scopes.results, cycleId: selectedCycle });
  }
  if ((p.startsWith("/api/admin/") || p === "/api/profile") && req.method === "POST" && req.headers.get("X-Inventory-User") !== u.id)
    fail(409, "IDENTITY_CHANGED", "La cuenta de esta pestaña cambió. Recarga antes de guardar.");
  if (modernCycles && (p === '/api/cycles' || p === '/api/admin/cycles' || p === '/api/admin/cycles/command' || p === '/api/admin/supervision/cycles'))
    return inventoryCyclesRequest(req,db,url,{u,hash},{json,fail,body,userDTO,digest},catalogVersion);
  if (p === "/api/admin/supervision" || p.startsWith("/api/admin/supervision/"))
    return supervisionRequest(req,db,url,{u,hash},{json,fail,body,userDTO,digest});
  if (p.startsWith("/api/admin/") || p === "/api/profile")
    return accountRequest(req, db, p, { u, hash }, { body, fail, json, userDTO, quota, event });
  const cycle = selectedCycle || "";
  if (p === "/api/bootstrap" && req.method === "GET") {
    const data = await boot(db, hash, cycle);
    event.scope = [...new Set(data.items.map(x => x.areaId))].sort().join(",") || "none";
    return json({ ...data, user: userDTO(u) });
  }
  if (p === "/api/sync" && req.method === "GET") {
    const cursor = Number(url.searchParams.get("cursor") || 0);
    if (!Number.isSafeInteger(cursor) || cursor < 0)
      fail(400, "INVALID_CURSOR");
    const rows = await db
      .prepare(
        actorCTE +
          `SELECT seq,after_record FROM history WHERE cycle_id=?2 AND seq>?3 AND location_id IN (SELECT id FROM allowed) ORDER BY seq LIMIT 250`,
      )
      .bind(hash, cycle, cursor)
      .all();
    return json({
      user: userDTO(u),
      cycleRevision: (await db.prepare(actorCTE+`SELECT revision FROM cycles WHERE id=?2 AND EXISTS(SELECT 1 FROM allowed)`).bind(hash,cycle).first())?.revision,
      changes: rows.results.map((x) => JSON.parse(x.after_record)),
      cursor: rows.results.at(-1)?.seq ?? cursor,
    });
  }
  if ((p === "/api/search" || p === "/api/summary") && req.method === "GET") {
    const data = await boot(db, hash, cycle),
      scope = url.searchParams.get("scope");
    if (scope && !data.scopes.some((x) => x.id === scope))
      fail(403, "FORBIDDEN");
    const items = data.items.filter(
      (x) =>
        (x.active && (!scope ||
          x.locationId === scope ||
          x.locationId.startsWith(scope + ":"))) &&
        x.name
          .toLocaleLowerCase()
          .includes((url.searchParams.get("q") || "").toLocaleLowerCase()),
    );
    if (p === "/api/search") return json({ items });
    const ids = new Set(items.map((x) => x.id));
    return json({
      total: items.length,
      counted: data.counts.filter(
        (c) => ids.has(c.itemId) && c.status === "counted",
      ).length,
    });
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
  if (p === "/api/count" && req.method === "POST") {
    if (req.headers.get("X-Inventory-User") !== u.id)
      fail(
        409,
        "IDENTITY_CHANGED",
        "La cuenta cambió. Inicia sesión de nuevo; el borrador permanece aislado.",
      );
    const b = await body(req);
    const keys = [
      "id",
      "cycleId",
      "itemId",
      "locationId",
      "expectedVersion",
      "action",
      "quantity",
      "unit",
      "status",
      "note",
      "outOfStock",
    ];
    if (
      ["cycleId", "itemId", "locationId"].some(
        (k) => typeof b[k] !== "string" || !b[k] || b[k].length > 150,
      ) ||
      Object.keys(b).some((k) => !keys.includes(k)) ||
      keys.some((k) => !(k in b)) ||
      typeof b.id !== "string" ||
      !/^[a-zA-Z0-9-]{16,80}$/.test(b.id) ||
      !Number.isSafeInteger(b.expectedVersion) ||
      b.expectedVersion < 0 ||
      !["direct", "add", "overwrite"].includes(b.action) ||
      typeof b.quantity !== "number" ||
      !Number.isFinite(b.quantity) ||
      b.quantity < 0 ||
      b.quantity > 1000000 ||
      Math.abs(b.quantity * 1000 - Math.round(b.quantity * 1000)) > 1e-6 ||
      !["partial", "counted"].includes(b.status) ||
      typeof b.note !== "string" ||
      b.note.length > 1000 ||
      typeof b.outOfStock !== "boolean" ||
      typeof b.unit !== "string"
    )
      fail(
        400,
        "INVALID_COUNT",
        "Cantidad o registro inválidos. Máximo tres decimales.",
      );
    await allowedItem(db, hash, b.cycleId, b.itemId, b.locationId);
    event.scope = b.locationId;
    const canonical = JSON.stringify(keys.map((k) => b[k])),
      fingerprint = await digest(canonical);
    try {
      await db
        .prepare(
          "INSERT INTO operations(id,fingerprint,user_id,session_hash,cycle_id,item_id,location_id,expected_version,action,q,unit,status,note,out_of_stock) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          b.id,
          fingerprint,
          u.id,
          hash,
          b.cycleId,
          b.itemId,
          b.locationId,
          b.expectedVersion,
          b.action,
          Math.round(b.quantity * 1000),
          b.unit,
          b.status,
          b.note,
          b.outOfStock ? 1 : 0,
        )
        .run();
    } catch (e) {
      const code = [
        "FORBIDDEN",
        "ID_REUSED",
        "CYCLE_CLOSED",
        "INVALID_ITEM_UNIT",
        "STALE",
        "FOREIGN_RECORD",
        "INVALID_ZERO",
        "QUANTITY_LIMIT",
        "ITEM_INACTIVE",
      ].find((c) => e.message.includes(c));
      if (code)
        fail(
          code === "FORBIDDEN"
            ? 403
            : ["STALE", "FOREIGN_RECORD", "ID_REUSED"].includes(code)
              ? 409
              : 400,
          code,
          code,
          {
            current: await current(db, hash, b.cycleId, b.itemId, b.locationId),
          },
        );
      throw e;
    }
    const result = await db
      .prepare(
        actorCTE +
          `SELECT o.result FROM operations o WHERE o.id=?2 AND o.user_id IN (SELECT id FROM actor) AND o.location_id IN (SELECT id FROM allowed)`,
      )
      .bind(hash, b.id)
      .first();
    if (!result) fail(403, "FORBIDDEN");
    return json({ operationId: b.id, record: JSON.parse(result.result) });
  }
  fail(404, "NOT_FOUND");
}
function secured(res) {
  const headers = new Headers(res.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "same-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  return new Response(res.body, { status: res.status, headers });
}
export default {
  async fetch(req, env, ctx) {
    const started = Date.now();
    const url = new URL(req.url);
    const event = { requestId: crypto.randomUUID(), route: routeName(url.pathname), method: ["GET", "POST"].includes(req.method) ? req.method : "other", status: 500 };
    const finish = (res) => {
      event.status = res.status;
      if (env.METRICS_ENABLED === "1" && url.pathname.startsWith("/api/") && url.pathname!=="/api/telemetry") ctx?.waitUntil?.(recordMetric(env, { route: event.route, method: event.method, status: event.status, elapsedMs: Date.now() - started }));
      if (env.METRICS_ENABLED === "1" && url.pathname.startsWith('/api/') && url.pathname!=='/api/telemetry') ctx?.waitUntil?.(observeRequest(env,{...event,elapsedMs:Date.now()-started}));
      const response = secured(res);
      response.headers.set("X-Request-ID", event.requestId);

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
      else if (url.pathname.startsWith("/api/")) res = await api(req, env, url, event);
      else if (
        !/^\/(?:$|pages\/admin\/supervision$|index\.html$|theme\.(?:css|js)$|shared\/[\w.-]+\.(?:js|css)$|pages\/(?:inventario|cuenta|admin)\/(?:[\w.-]+\.(?:html|css|js))?$)/.test(
          url.pathname,
        )
      )
        res = json({ code: "NOT_FOUND" }, 404);
      else res = await env.ASSETS.fetch(req);
      return finish(res);
    } catch (e) {
      event.errorCode = e.status ? e.code : e.name;
      const known = e.status || /LAST_ADMIN|UNIQUE constraint/.test(e.message);
      return finish(
        json(
          {
            code:
              e.code ||
              (/LAST_ADMIN/.test(e.message)
                ? "LAST_ADMIN"
                : /UNIQUE constraint/.test(e.message)
                  ? "DUPLICATE"
                  : "SERVER_ERROR"),
            message: e.status
              ? e.message
              : /LAST_ADMIN/.test(e.message)
                ? "Debe quedar un administrador activo."
                : "No se pudo completar la operación.",
            ...(e.current !== undefined ? { current: e.current } : {}),
            ...(e.warnings !== undefined ? { warnings: e.warnings, confirmationRevision: e.confirmationRevision } : {}),
          },
          e.status || (known ? 409 : 500),
          e.retryAfter ? { "Retry-After": String(e.retryAfter) } : {},
        ),
      );
    }
  },
};
