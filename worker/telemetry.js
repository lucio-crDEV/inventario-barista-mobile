// Operational metadata only: never pass requests, payloads or session secrets here.
const routes = new Set(["login", "logout", "password", "profile", "me", "status", "navigation", "bootstrap", "sync", "search", "summary", "record", "history", "count", "metrics"]);
export function routeName(path) {
  if (path === "/api/admin/metrics") return "metrics";
  if (/^\/api\/admin\/users(?:\/[a-f0-9-]+(?:\/(?:password|delete))?)?$/.test(path)) return "admin-users";
  const name = path.startsWith("/api/") ? path.slice(5) : "";
  return routes.has(name) ? name : "unknown";
}
const seen = new Map();
const limits = new Map();
function boundedSet(map, key, value) {
  if (map.size >= 4096 && !map.has(key)) map.delete(map.keys().next().value);
  map.set(key, value);
}
export function allowRequest(actor, route, time = Date.now()) {
  const expensive = ["bootstrap", "summary", "search", "admin-users", "metrics"].includes(route);
  const key = `${actor}:${expensive ? "heavy" : "normal"}`;
  const window = Math.floor(time / 60000);
  const previous = limits.get(key);
  const n = previous?.window === window ? previous.n + 1 : 1;
  boundedSet(limits, key, { window, n });
  return n <= (expensive ? 60 : 180);
}
export function logEvent(event) {
  try { console.log(JSON.stringify({ type: "inventory-request", ...event })); } catch { /* Logging must not affect inventory. */ }
}
export async function observe(db, event, time = Date.now()) {
  if (!db || event.route === "unknown") return;
  const actor = event.actor || "anonymous";
  const scope = event.scope || "none";
  const outcome = String(event.status);
  const key = `${actor}:${event.route}:${scope}:${outcome}`;
  const bucket = Math.floor(time / 300000);
  const exactEvent = event.status < 400 && ["login", "logout", "password"].includes(event.route);
  if (!exactEvent && seen.get(key) === bucket) return;
  if (!exactEvent) boundedSet(seen, key, bucket);
  try {
    await db.prepare(`INSERT INTO activity_hourly(hour,actor,route,scope,outcome,observations,last_seen)
      VALUES(?,?,?,?,?,1,?) ON CONFLICT(hour,actor,route,scope,outcome)
      DO UPDATE SET observations=observations+1,last_seen=max(last_seen,excluded.last_seen)`)
      .bind(Math.floor(time / 3600000) * 3600, actor, event.route, scope, outcome, Math.floor(time / 1000)).run();
  } catch {
    // Optional telemetry may be unavailable; never retry or fail an accepted count.
    logEvent({ requestId: event.requestId, route: event.route, outcome: "telemetry-unavailable" });
  }
}
export async function metrics(db, hash) {
  // Authorization is revalidated in the query, not just in the HTTP handler.
  const result = await db.prepare(`WITH actor AS (
    SELECT u.id FROM users u JOIN sessions s ON s.user_id=u.id
    WHERE s.hash=? AND s.expires>unixepoch() AND u.role='admin'
    AND u.active=1 AND u.deleted_at IS NULL AND u.must_change=0)
    SELECT hour,route,scope,outcome,sum(observations) observations,
    count(DISTINCT CASE WHEN actor!='anonymous' THEN actor END) accounts,
    max(last_seen) last_seen FROM activity_hourly
    WHERE hour>=CAST((unixepoch()-86400)/3600 AS INTEGER)*3600 AND EXISTS(SELECT 1 FROM actor)
    GROUP BY hour,route,scope,outcome ORDER BY hour DESC LIMIT 1000`).bind(hash).all();
  const summary = await db.prepare(`SELECT
    count(DISTINCT CASE WHEN a.actor!='anonymous' THEN a.actor END) accounts24h,
    count(DISTINCT CASE WHEN a.actor!='anonymous' AND a.last_seen>=unixepoch()-300 THEN a.actor END) activeAccounts5m
    FROM activity_hourly a WHERE a.hour>=CAST((unixepoch()-86400)/3600 AS INTEGER)*3600
    AND EXISTS(SELECT 1 FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=?
      AND s.expires>unixepoch() AND u.role='admin' AND u.active=1 AND u.deleted_at IS NULL AND u.must_change=0)`)
    .bind(hash).first();
  const audit = await db.prepare(`SELECT actor,target,action,created_at FROM admin_audit
    WHERE EXISTS(SELECT 1 FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=?
    AND s.expires>unixepoch() AND u.role='admin' AND u.active=1 AND u.deleted_at IS NULL AND u.must_change=0)
    ORDER BY id DESC LIMIT 100`).bind(hash).all();
  const sessions = await db.prepare(`SELECT count(*) unexpiredSessions FROM sessions
    WHERE expires>unixepoch() AND EXISTS(SELECT 1 FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=?
    AND s.expires>unixepoch() AND u.role='admin' AND u.active=1 AND u.deleted_at IS NULL AND u.must_change=0)`)
    .bind(hash).first();
  return { generatedAt: new Date().toISOString(), windowHours: 24, includesPartialFirstHour: true, sampled: true,
    ...summary, ...sessions, hourly: result.results, possiblyTruncated: result.results.length === 1000, recentAdminEvents: audit.results, limit: 1000,
    note: "Observaciones temporales aproximadas; no solicitudes, sesiones ni personas exactas." };
}
