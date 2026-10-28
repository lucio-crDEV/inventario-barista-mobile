import { databaseErrorCode } from './db-errors.js';
import { body, fail, json } from './http.js';
import { digest } from './session.js';
import { permissionsSQL } from './authorization.js';
import { current, allowedItem } from './inventory-queries.js';
import { countFields, validCountCommand } from './count-contract.js';
const actorCTE = permissionsSQL({ column: 'id' });
export async function saveCount(req, db, { u, hash }, event) {

  if (req.headers.get("X-Inventory-User") !== u.id)
    fail(
      409,
      "IDENTITY_CHANGED",
      "La cuenta cambió. Inicia sesión de nuevo; el borrador permanece aislado.",
    );
  const b = await body(req);
  const keys = countFields;
  if (!validCountCommand(b))
    fail(400, 'INVALID_COUNT', 'Cantidad o registro inválidos. Máximo tres decimales.');
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
    const code = databaseErrorCode(e, [
      "FORBIDDEN",
      "ID_REUSED",
      "CYCLE_CLOSED",
      "INVALID_ITEM_UNIT",
      "STALE",
      "FOREIGN_RECORD",
      "INVALID_ZERO",
      "QUANTITY_LIMIT",
      "ITEM_INACTIVE",
    ]);
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
