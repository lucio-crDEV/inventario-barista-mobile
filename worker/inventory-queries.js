import { catalogScope } from '../shared/deployment-domain.js';
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
  const areaSQL=area?" AND json_extract(ci.data,'$.areaId')=?3":'';
  const bindings=[hash,cycle,...(area?[area]:[])];
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
          `SELECT ci.data, ${itemActiveSQL} operational_active FROM cycles cy JOIN catalog_items ci ON ci.version=cy.catalog_version LEFT JOIN item_activity st ON st.area_id=json_extract(ci.data,'$.areaId') AND st.item_id=ci.id WHERE cy.id=?2 AND ci.location_id IN (SELECT id FROM allowed) ${areaSQL}`,
      )
      .bind(...bindings),
    db
      .prepare(
        actorCTE +
          `SELECT cr.record FROM count_records cr JOIN catalog_items ci ON ci.id=cr.item_id AND ci.location_id=cr.location_id AND ci.version=(SELECT catalog_version FROM cycles WHERE id=?2) WHERE cr.cycle_id=?2 AND cr.location_id IN (SELECT id FROM allowed) ${areaSQL}`,
      )
      .bind(...bindings),
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
      return projectItem(r);
    }),
    counts: results[2].results.map((r) => JSON.parse(r.record)),
    scopes: results[3].results.map(scope => catalogScope(scope, results[0].results[0]?.catalog_version)),
    cursor: results[4].results[0].cursor,
  };
}

const itemFields = ['id','name','category','countCategory','countCategoryOrder','areaId',
  'sectorId','zoneId','unit','order','active','locationId'];
function projectItem(row) {
  const item=JSON.parse(row.data);
  item.active=!!row.operational_active;
  return Object.fromEntries(itemFields.map(key=>[key,item[key]]));
}
// SQLite lower() handles ASCII only. Fold the additional uppercase letters used
// by the approved Spanish catalogs before matching a literal substring.
export const searchNameSQL = [...'ÁÉÍÓÚÜÑÀÈÌÒÙÂÊÎÔÛÄËÏÖÇ'].reduce(
  (sql,letter)=>`replace(${sql},'${letter}','${letter.toLocaleLowerCase()}')`,
  "lower(json_extract(ci.data,'$.name'))",
);
async function visibleScope(db,hash,cycle,scope) {
  if(!scope)return;
  const row=await db.prepare(actorCTE+`SELECT 1 ok FROM scopes s WHERE s.id=?3
    AND EXISTS(SELECT 1 FROM scope_closure cl JOIN catalog_items ci ON ci.location_id=cl.descendant
      JOIN cycles cy ON cy.catalog_version=ci.version WHERE cy.id=?2 AND cl.ancestor=s.id
      AND ci.location_id IN(SELECT id FROM allowed))`).bind(hash,cycle,scope).first();
  if(!row)fail(403,'FORBIDDEN');
}
const filteredItemsSQL = `FROM cycles cy JOIN catalog_items ci ON ci.version=cy.catalog_version
  LEFT JOIN item_activity st ON st.area_id=json_extract(ci.data,'$.areaId') AND st.item_id=ci.id`;
const itemFilterSQL = `WHERE cy.id=?2 AND ci.location_id IN(SELECT id FROM allowed)
  AND (?3='' OR ci.location_id IN(SELECT descendant FROM scope_closure WHERE ancestor=?3))
  AND ${itemActiveSQL}=1 AND instr(${searchNameSQL},?4)>0`;
export async function searchItems(db,hash,cycle,{scope='',query=''}={}) {
  await visibleScope(db,hash,cycle,scope);
  const rows=await db.prepare(actorCTE+`SELECT ci.data,${itemActiveSQL} operational_active
    ${filteredItemsSQL} ${itemFilterSQL}`).bind(hash,cycle,scope,query.toLocaleLowerCase()).all();
  return rows.results.map(projectItem);
}
export async function summarizeItems(db,hash,cycle,{scope='',query=''}={}) {
  await visibleScope(db,hash,cycle,scope);
  return await db.prepare(actorCTE+`SELECT count(*) total,
    coalesce(sum(c.status='counted' AND c.voided=0 AND c.author IS NOT NULL),0) counted
    ${filteredItemsSQL}
    LEFT JOIN counts c ON c.cycle_id=cy.id AND c.item_id=ci.id AND c.location_id=ci.location_id
    ${itemFilterSQL}`).bind(hash,cycle,scope,query.toLocaleLowerCase()).first();
}
