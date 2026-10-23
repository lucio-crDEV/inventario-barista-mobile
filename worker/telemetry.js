// Persistent usage telemetry is disabled by decision of 2026-10-23.
// Operational metadata only: never pass requests, payloads or session secrets here.
const routes = new Set(["login", "logout", "password", "profile", "me", "status", "navigation", "bootstrap", "sync", "search", "summary", "record", "history", "count", "metrics"]);
export function routeName(path) {
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
