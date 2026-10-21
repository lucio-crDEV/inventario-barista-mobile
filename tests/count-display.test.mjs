import { test } from "node:test";
import assert from "node:assert/strict";
import { describeCountValue } from "../shared/count-display.js";
test("La comparación distingue ausencia, cero en avance, cero contado y Sin stock", () => {
  assert.equal(describeCountValue(null, "KG"), "Sin conteo");
  assert.equal(
    describeCountValue(
      { quantity: 0, status: "partial", outOfStock: false },
      "KG",
    ),
    "0 KG · en avance",
  );
  assert.equal(
    describeCountValue(
      { quantity: 0, status: "counted", outOfStock: false },
      "KG",
    ),
    "0 KG · cero confirmado",
  );
  assert.equal(
    describeCountValue(
      { quantity: 0, status: "counted", outOfStock: true },
      "KG",
    ),
    "Sin stock · cero confirmado",
  );
  assert.equal(
    describeCountValue({ quantity: 3, status: "counted" }, ""),
    "3 (unidad pendiente)",
  );
});
