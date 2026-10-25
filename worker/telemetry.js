// Persistent metrics require explicit METRICS_ENABLED=1 after migration 0009.
// Operational metadata only: never pass requests, payloads or session secrets here.
const routes = new Set(["login", "logout", "password", "profile", "me", "status", "navigation", "bootstrap", "sync", "search", "summary", "record", "history", "count", "metrics", "cycles", "inventory-management"]);
export function routeName(path) {
  if (path === "/api/cycles") return "cycles";
  if (path === "/api/admin/cycles" || path === "/api/admin/cycles/command") return "inventory-management";
  if (path === "/api/admin/supervision" || path.startsWith("/api/admin/supervision/")) return "supervision";
  if (path === "/api/admin/metrics") return "metrics";
  if (/^\/api\/admin\/users(?:\/[a-f0-9-]+(?:\/(?:password|delete))?)?$/.test(path)) return "admin-users";
  const name = path.startsWith("/api/") ? path.slice(5) : "";
  return routes.has(name) ? name : "unknown";
}
const limits = new Map();
function boundedSet(map, key, value) {
  if (map.size >= 4096 && !map.has(key)) map.delete(map.keys().next().value);
  map.set(key, value);
}
export function allowRequest(actor, route, time = Date.now()) {
  const expensive = ["bootstrap", "summary", "search", "admin-users", "metrics", "supervision", "cycles", "inventory-management"].includes(route);
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

// Authorized 2026-10-25: opt-in, approximate daily request/feature aggregates.
// Isolate shutdown can lose the current minute. These are not exact user counts,
// concurrency, browser latency or CPU. No extra client tracking endpoint/cookie.
const pending = new Map();
let nextFlush = 0;
let failures = 0;
const metricRoutes = new Set([...routes, "supervision", "admin-users", "unknown"]);
export async function recordMetric(env, event, now = Date.now()) {
  if (env.METRICS_ENABLED !== "1" || !env.DB) return;
  const route = metricRoutes.has(event.route) ? event.route : "unknown";
  const method = ["GET", "POST"].includes(event.method) ? event.method : "other";
  const status = Math.floor(Number(event.status) / 100);
  if (status < 1 || status > 5 || !Number.isFinite(status)) return;
  const elapsed = Math.max(0, Math.min(60000, Math.round(Number(event.elapsedMs) || 0)));
  const day = new Date(now).toISOString().slice(0, 10);
  const key = `${day}|${route}|${method}|${status}`;
  const row = pending.get(key) || { day, route, method, status, requests: 0, elapsed: 0, slow: 0 };
  row.requests++; row.elapsed += elapsed; row.slow += elapsed >= 1000 ? 1 : 0;
  // Bound even a long-lived isolate that repeatedly fails its flush.
  if (pending.size >= 512 && !pending.has(key)) pending.delete(pending.keys().next().value);
  pending.set(key, row);
  if (now < nextFlush) return;
  nextFlush = now + 60000;
  const rows = [...pending.values()];
  pending.clear();
  try {
    // Maximum possible daily route cardinality is small; indexed retention in
    // bounded chunks never touches inventory, history, operation IDs or accounts.
    await env.DB.batch(rows.map(r => env.DB.prepare(`INSERT INTO usage_daily
      (day,route,method,status_class,requests,elapsed_ms,slow_requests) VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(day,route,method,status_class) DO UPDATE SET
      requests=requests+excluded.requests,elapsed_ms=elapsed_ms+excluded.elapsed_ms,
      slow_requests=slow_requests+excluded.slow_requests`).bind(r.day,r.route,r.method,r.status,r.requests,r.elapsed,r.slow)));
    // At most once per flush; range uses the leading primary-key day.
    await env.DB.prepare("DELETE FROM usage_daily WHERE (day,route,method,status_class) IN (SELECT day,route,method,status_class FROM usage_daily WHERE day < ? LIMIT 1000)")
      .bind(new Date(now - 90 * 86400000).toISOString().slice(0,10)).run();
    failures = 0;
  } catch {
    // Never retry ambiguous batches: avoiding duplicates matters more than
    // pretending these approximate observations are complete.
    if (failures++ === 0) logEvent({ type: "usage-metrics-unavailable" });
  }
}
