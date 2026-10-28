import { validPassword, dummyHash } from './password.js';
import {checkPasswordWithService,hashPasswordWithService} from './password-service.js';
import { json, fail, body } from './http.js';
import { permissionsSQL } from './authorization.js';
import { resolveCycle } from './inventory-cycles.js';
import { homeURL } from '../shared/navigation.js';
const actorCTE = permissionsSQL({ column: 'id' });
const hex = (bytes) =>
  Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
export const digest = async (s) =>
  hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const token = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const now = () => Math.floor(Date.now() / 1000);
const cookieName = (env) =>
  env.APP_ENV === "local"
    ? "inventory_session_local"
    : "__Host-inventory_session";
const cookie = (env, value, age = 43200) =>
  `${cookieName(env)}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${env.APP_ENV === "local" ? "" : "; Secure"}`;
export function userDTO(u) {
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
export async function auth(req, env) {
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
    "SELECT u.*,s.expires session_expires FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.hash=? AND s.expires>? AND u.active=1 AND u.deleted_at IS NULL",
  )
    .bind(hash, now())
    .first();
  if (!u) fail(401, "SESSION_REQUIRED", "La sesión terminó. Inicia sesión.");
  return { u, hash };
}
export async function quota(db, key, max) {
  const window = Math.floor(now() / 900);
  const r = await db
    .prepare(
      "INSERT INTO attempts(key,window,n) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET n=CASE WHEN window=excluded.window THEN n+1 ELSE 1 END, window=excluded.window RETURNING n",
    )
    .bind(key, window)
    .first();
  if (r.n > max)
    fail(429, "RATE_LIMIT", "Demasiados intentos. Espera 15 minutos.", { retryAfter: 900 });
  return window;
}

export async function login(req, env, event, modernCycles) {
  const db = env.DB;

  const b = await body(req);
  const username =
    typeof b.username === "string" ? b.username.toLowerCase().trim() : "";
  // Reserve durable budgets before expensive bcrypt verification. A username
  // alone must never let other networks lock an account globally.
  const ipKey = "ip:" + await digest(req.headers.get("cf-connecting-ip") || "local");
  const accountKey = "login-ip-user:" + await digest(ipKey + "\0" + username);
  const ipWindow = await quota(db, ipKey, 100);
  const accountWindow = await quota(db, accountKey, 10);
  const u = await db
    .prepare("SELECT * FROM users WHERE username=? AND deleted_at IS NULL")
    .bind(username)
    .first();
  const valid =
    typeof b.password === "string" &&
    new TextEncoder().encode(b.password).length <= 72;
  const match = await checkPasswordWithService(env,
    valid ? b.password : "invalid-password",
    u?.password_hash || dummyHash, ipKey.slice(3),
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
  // Successful use does not consume the failed-login budget. Release exactly
  // this request's reservations, without erasing concurrent failures or reducing
  // a new time window if verification crossed the fifteen-minute boundary.
  await db.prepare("UPDATE attempts SET n=MAX(0,n-1) WHERE (key=? AND window=?) OR (key=? AND window=?)")
    .bind(ipKey, ipWindow, accountKey, accountWindow).run();
  event.actor = u.id;
  event.measure?.phase("cycle");
  const loginCycle = await resolveCycle(db, hash, null, env.ACTIVE_CYCLE_ID,modernCycles);
  event.measure?.phase("handler");
  if(event.measure)event.measure.admin=u.role==="admin";
  const navigation = await db.prepare(actorCTE + `SELECT sc.* FROM scopes sc WHERE EXISTS(SELECT 1 FROM scope_closure cl JOIN catalog_items ci ON ci.location_id=cl.descendant JOIN cycles cy ON cy.catalog_version=ci.version WHERE cy.id=?2 AND cl.ancestor=sc.id AND ci.location_id IN(SELECT id FROM allowed))`).bind(hash, loginCycle || "").all();
  return json({ user: userDTO(u), homeUrl: homeURL(navigation.results) }, 200, { "Set-Cookie": cookie(env, raw) });
}

export async function logout(db, hash, env) {

  await db.prepare("DELETE FROM sessions WHERE hash=?").bind(hash).run();
  return json({ ok: true }, 200, { "Set-Cookie": cookie(env, "", 0) });
}

export async function changePassword(req, db, env, { u, hash }, event) {

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
    !(await checkPasswordWithService(env,b.currentPassword,u.password_hash,await digest(u.id)))
  )
    fail(400, "INVALID_PASSWORD", "Contraseña actual incorrecta.");
  const h = await hashPasswordWithService(env,b.newPassword,await digest(u.id));
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
