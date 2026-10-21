import {
  hashPassword,
  checkPassword,
  validPassword,
  dummyHash,
} from "./password.js";
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
const actorCTE = `WITH actor AS (SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.hash=?1 AND s.expires>unixepoch() AND u.active=1 AND u.must_change=0),
 allowed AS (SELECT sc.id FROM scopes sc, actor a WHERE a.role='admin' OR EXISTS(SELECT 1 FROM grants g JOIN scope_closure cl ON cl.ancestor=g.scope_id WHERE g.user_id=a.id AND cl.descendant=sc.id)) `;
const cookieName = (env) =>
  env.APP_ENV === "local"
    ? "inventory_session_local"
    : "__Host-inventory_session";
const cookie = (env, value, age = 43200) =>
  `${cookieName(env)}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${env.APP_ENV === "local" ? "" : "; Secure"}`;
async function body(req) {
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    fail(415, "JSON_REQUIRED");
  const raw = await req.text();
  if (raw.length > 16384) fail(413, "TOO_LARGE");
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
    "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.hash=? AND s.expires>? AND u.active=1",
  )
    .bind(hash, now())
    .first();
  if (!u) fail(401, "SESSION_REQUIRED", "La sesión terminó. Inicia sesión.");
  return { u, hash };
}
function adminGuard(db, hash) {
  return db
    .prepare(
      `INSERT INTO guards SELECT CASE WHEN EXISTS(SELECT 1 FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.hash=? AND s.expires>unixepoch() AND u.role='admin' AND u.active=1 AND u.must_change=0) THEN 1 ELSE 0 END`,
    )
    .bind(hash);
}
async function auditBatch(db, hash, actor, target, action, detail, stmts) {
  await db.batch([
    adminGuard(db, hash),
    ...stmts,
    db
      .prepare(
        "INSERT INTO admin_audit(actor,target,action,detail) VALUES(?,?,?,?)",
      )
      .bind(actor, target, action, JSON.stringify(detail)),
    db.prepare("DELETE FROM guards"),
  ]);
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
    fail(429, "RATE_LIMIT", "Demasiados intentos. Espera 15 minutos.");
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
          `SELECT ci.data FROM catalog_items ci JOIN cycles cy ON ci.version=cy.catalog_version WHERE cy.id=?2 AND ci.location_id IN (SELECT id FROM allowed)`,
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
          `SELECT s.* FROM scopes s WHERE EXISTS(SELECT 1 FROM scope_closure cl JOIN allowed a ON a.id=cl.descendant WHERE cl.ancestor=s.id)`,
      )
      .bind(hash),
    db
      .prepare(
        actorCTE +
          `SELECT coalesce(max(seq),0) cursor FROM history WHERE cycle_id=?2 AND location_id IN (SELECT id FROM allowed)`,
      )
      .bind(hash, cycle),
  ]);
  return {
    cycle: results[0].results[0] || null,
    items: results[1].results.map((r) => {
      const x = JSON.parse(r.data);
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
    scopes: results[3].results,
    cursor: results[4].results[0].cursor,
  };
}
async function api(req, env, url) {
  if (
    !env.DB ||
    !env.APP_ORIGIN ||
    !["local", "production"].includes(env.APP_ENV) ||
    !env.ACTIVE_CYCLE_ID
  )
    fail(503, "NOT_CONFIGURED", "Entorno sin configuración válida.");
  if (
    url.origin !== env.APP_ORIGIN ||
    (env.APP_ENV === "production" && url.protocol !== "https:") ||
    (env.APP_ENV === "local" &&
      !["127.0.0.1", "localhost"].includes(url.hostname))
  )
    fail(503, "NOT_CONFIGURED");
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
      .prepare("SELECT * FROM users WHERE username=?")
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
    await db
      .prepare(
        "INSERT INTO sessions SELECT ?,id,? FROM users WHERE id=? AND password_hash=? AND active=1",
      )
      .bind(hash, now() + 43200, u.id, u.password_hash)
      .run();
    return json({ user: userDTO(u) }, 200, { "Set-Cookie": cookie(env, raw) });
  }
  const { u, hash } = await auth(req, env);
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
        "Usa al menos 12 caracteres y como máximo 72 bytes.",
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
  if (p.startsWith("/api/admin/")) {
    if (u.role !== "admin") fail(403, "ADMIN_REQUIRED");
    if (p === "/api/admin/users" && req.method === "GET") {
      const rows = await db.batch([
        db.prepare(
          "SELECT id,username,name,role,active,must_change,revision FROM users ORDER BY username",
        ),
        db.prepare("SELECT * FROM grants"),
        db.prepare("SELECT * FROM scopes"),
      ]);
      return json({
        users: rows[0].results.map((x) => ({
          ...userDTO(x),
          grants: rows[1].results
            .filter((g) => g.user_id === x.id)
            .map((g) => g.scope_id),
        })),
        scopes: rows[2].results,
      });
    }
    if (p === "/api/admin/users" && req.method === "POST") {
      const b = await body(req);
      if (
        !/^[a-z0-9._-]{3,40}$/.test(b.username) ||
        typeof b.name !== "string" ||
        !b.name.trim() ||
        b.name.length > 80 ||
        !validPassword(b.password) ||
        !["worker", "admin"].includes(b.role)
      )
        fail(400, "INVALID_USER");
      const id = crypto.randomUUID(),
        h = await hashPassword(b.password);
      await auditBatch(
        db,
        hash,
        u.id,
        id,
        "create",
        { username: b.username, name: b.name, role: b.role },
        [
          db
            .prepare(
              "INSERT INTO users(id,username,name,password_hash,role) VALUES(?,?,?,?,?)",
            )
            .bind(id, b.username, b.name.trim(), h, b.role),
        ],
      );
      return json({ id }, 201);
    }
    const match = p.match(/^\/api\/admin\/users\/([a-f0-9-]+)(\/password)?$/);
    if (match && req.method === "POST") {
      const target = match[1],
        b = await body(req);
      if (
        !(await db
          .prepare("SELECT id FROM users WHERE id=?")
          .bind(target)
          .first())
      )
        fail(404, "USER_NOT_FOUND");
      if (match[2]) {
        if (!validPassword(b.password)) fail(400, "PASSWORD_POLICY");
        const h = await hashPassword(b.password);
        await auditBatch(db, hash, u.id, target, "reset-password", {}, [
          db
            .prepare(
              "UPDATE users SET password_hash=?,must_change=1,revision=revision+1 WHERE id=?",
            )
            .bind(h, target),
        ]);
      } else {
        if (
          typeof b.name !== "string" ||
          !b.name.trim() ||
          b.name.length > 80 ||
          typeof b.active !== "boolean" ||
          !["worker", "admin"].includes(b.role) ||
          !Array.isArray(b.grants) ||
          b.grants.length > 20 ||
          new Set(b.grants).size !== b.grants.length
        )
          fail(400, "INVALID_USER");
        const validScopes = (
          await db.prepare("SELECT id FROM scopes").all()
        ).results.map((x) => x.id);
        if (b.grants.some((x) => !validScopes.includes(x)))
          fail(400, "INVALID_SCOPE");
        await auditBatch(
          db,
          hash,
          u.id,
          target,
          "update-user",
          { name: b.name, active: b.active, role: b.role, grants: b.grants },
          [
            db
              .prepare(
                "UPDATE users SET name=?,active=?,role=?,revision=revision+1 WHERE id=?",
              )
              .bind(b.name.trim(), b.active ? 1 : 0, b.role, target),
            db.prepare("DELETE FROM grants WHERE user_id=?").bind(target),
            ...b.grants.map((s) =>
              db.prepare("INSERT INTO grants VALUES(?,?)").bind(target, s),
            ),
          ],
        );
      }
      return json({ ok: true });
    }
    fail(404, "NOT_FOUND");
  }
  const cycle = url.searchParams.get("cycle") || env.ACTIVE_CYCLE_ID;
  if (p === "/api/bootstrap" && req.method === "GET")
    return json({ ...(await boot(db, hash, cycle)), user: userDTO(u) });
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
        (!scope ||
          x.locationId === scope ||
          x.locationId.startsWith(scope + ":")) &&
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
    if (p === "/api/record")
      return json({ record: await current(db, hash, cycle, item, location) });
    const rows = await db
      .prepare(
        actorCTE +
          `SELECT h.* FROM history h WHERE h.cycle_id=?2 AND h.item_id=?3 AND h.location_id=?4 AND h.location_id IN (SELECT id FROM allowed) ORDER BY seq DESC LIMIT 100`,
      )
      .bind(hash, cycle, item, location)
      .all();
    return json({
      history: rows.results.map((x) => ({
        ...x,
        before_record: JSON.parse(x.before_record),
        entered_record: JSON.parse(x.entered_record),
        after_record: JSON.parse(x.after_record),
      })),
    });
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
export default {
  async fetch(req, env) {
    try {
      const url = new URL(req.url);
      let res;
      if (url.pathname.startsWith("/api/")) res = await api(req, env, url);
      else if (
        !/^\/(?:$|index\.html$|theme\.(?:css|js)$|shared\/[\w.-]+\.(?:js|css)$|pages\/(?:inventario|cuenta|admin)\/(?:[\w.-]+\.(?:html|css|js))?$)/.test(
          url.pathname,
        )
      )
        res = json({ code: "NOT_FOUND" }, 404);
      else res = await env.ASSETS.fetch(req);
      const headers = new Headers(res.headers);
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("Referrer-Policy", "same-origin");
      headers.set("X-Frame-Options", "DENY");
      headers.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      );
      return new Response(res.body, { status: res.status, headers });
    } catch (e) {
      const known = e.status || /LAST_ADMIN|UNIQUE constraint/.test(e.message);
      if (!known) console.error("API failure", e.message);
      return json(
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
        },
        e.status || (known ? 409 : 500),
      );
    }
  },
};
