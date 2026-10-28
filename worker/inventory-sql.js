// Keep read projections relational: nesting count_records in a LEFT JOIN can
// materialize counts from every historical inventory before filtering a cycle.
export const itemActiveSQL = `coalesce(st.active,CASE WHEN json_extract(ci.data,'$.active')=0 THEN 0 ELSE 1 END)`;
export function countRecordSQL(c = 'c', u = 'cu') {
  return `json_object('itemId',${c}.item_id,'locationId',${c}.location_id,'cycleId',${c}.cycle_id,
    'quantity',CASE WHEN ${c}.voided=1 THEN NULL ELSE ${c}.q/1000.0 END,'unit',${c}.unit,
    'status',CASE WHEN ${c}.voided=1 THEN 'pending' ELSE ${c}.status END,'note',${c}.note,
    'outOfStock',json(CASE WHEN ${c}.out_of_stock=1 THEN 'true' ELSE 'false' END),
    'authorId',${c}.author,'authorName',${u}.name,'version',${c}.version,'countedAt',${c}.updated_at)`;
}
export function cycleItemsSQL({ records = false, cycle = '?2' } = {}) {
  return `(SELECT ci.rowid position,cy.id cycle_id,ci.id,ci.location_id,ci.unit,ci.data,
    json_extract(ci.data,'$.areaId') area_id,${itemActiveSQL} active,
    coalesce(st.revision,0) activity_revision,st.changed_at activity_changed_at,st.inactive_since,
    CASE WHEN c.voided=1 THEN 'pending' ELSE coalesce(c.status,'pending') END status
    ${records ? `,CASE WHEN cu.id IS NULL THEN NULL ELSE ${countRecordSQL()} END record` : ''}
    FROM cycles cy JOIN catalog_items ci ON ci.version=cy.catalog_version
    LEFT JOIN item_activity st ON st.area_id=json_extract(ci.data,'$.areaId') AND st.item_id=ci.id
    LEFT JOIN counts c ON c.cycle_id=cy.id AND c.item_id=ci.id AND c.location_id=ci.location_id AND c.author IS NOT NULL
    ${records ? 'LEFT JOIN users cu ON cu.id=c.author' : ''}
    WHERE cy.id=${cycle})`;
}
