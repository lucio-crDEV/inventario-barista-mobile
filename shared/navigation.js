// UX only: callers use the scopes already filtered by the server.
export function scopeURL(id) {
  if (!id) return "/";
  const [area, sector, zone] = id.split(":");
  const q = new URLSearchParams({ area });
  if (sector) q.set("sector", sector);
  if (zone && sector === "garzones") q.set("zone", zone);
  return "/pages/inventario/?" + q;
}
export function homeScope(scopes) {
  const roots = scopes.filter(s => !s.parent);
  if (roots.length !== 1) return null;
  const root = roots[0];
  if (root.id !== "servicio") return root.id;
  const sectors = scopes.filter(s => s.parent === "servicio");
  // Garzones always keeps its zone selector, even with a single assigned zone.
  return sectors.length === 1 ? sectors[0].id : root.id;
}
export const homeURL = scopes => scopeURL(homeScope(scopes));
export function canonicalScope(id, scopes) {
  if (!id) return homeScope(scopes);
  if (id === "servicio") {
    const children = scopes.filter(s => s.parent === id);
    if (children.length === 1) return children[0].id;
  }
  return id;
}
