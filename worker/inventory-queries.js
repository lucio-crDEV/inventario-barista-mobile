import { fail } from './http.js';
import { permissionsSQL } from './authorization.js';
import { itemActiveSQL } from './inventory-sql.js';
const actorCTE = permissionsSQL({ column: 'id' });
const parseRecord = (r) => (r ? JSON.parse(r.record) : null);
export async function current(db, hash, cycle, item, location) {
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
export async function allowedItem(db, hash, cycle, item, location) {
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
export async function boot(db, hash, cycle, area="") {
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
          `SELECT ci.data, ${itemActiveSQL} operational_active FROM cycles cy JOIN catalog_items ci ON ci.version=cy.catalog_version LEFT JOIN item_activity st ON st.area_id=json_extract(ci.data,'$.areaId') AND st.item_id=ci.id WHERE cy.id=?2 AND ci.location_id IN (SELECT id FROM allowed) AND (?3='' OR json_extract(ci.data,'$.areaId')=?3)`,
      )
      .bind(hash, cycle,area),
    db
      .prepare(
        actorCTE +
          `SELECT cr.record FROM count_records cr JOIN catalog_items ci ON ci.id=cr.item_id AND ci.location_id=cr.location_id AND ci.version=(SELECT catalog_version FROM cycles WHERE id=?2) WHERE cr.cycle_id=?2 AND cr.location_id IN (SELECT id FROM allowed) AND (?3='' OR json_extract(ci.data,'$.areaId')=?3)`,
      )
      .bind(hash, cycle,area),
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
    db.prepare(actorCTE+`SELECT cs.scope_id,cs.state FROM cycle_scope_states cs WHERE cs.cycle_id=?2 AND EXISTS(SELECT 1 FROM scope_closure cl WHERE cl.ancestor=cs.scope_id AND cl.descendant IN(SELECT id FROM allowed))`).bind(hash,cycle),
  ]);
  return {
    cycle: results[0].results[0] ? {...results[0].results[0],scopeStates:results[5].results} : null,
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
