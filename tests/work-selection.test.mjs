import test from "node:test";
import assert from "node:assert/strict";
import { nextWorkIndex, isOutOfStockCount, feedbackToneForCount } from "../pages/inventario/work-selection.js";

const group = [{ id: "a" }, { id: "b" }, { id: "c" }];

test("al reabrir un grupo se omiten los contados y se prioriza trabajo pendiente", () => {
  assert.equal(nextWorkIndex(group, { a: { status: "counted" }, b: { status: "partial" } }), 1);
  assert.equal(nextWorkIndex(group, { a: { status: "counted" }, b: { status: "counted" } }), 2);
  assert.equal(nextWorkIndex(group, { a: { status: "counted" }, b: { status: "counted" }, c: { status: "counted" } }), 0);
});

test("sin stock distingue el cero explícito de un cero contado normal", () => {
  assert.equal(isOutOfStockCount({ status: "counted", quantity: 0, outOfStock: true }), true);
  assert.equal(isOutOfStockCount({ status: "counted", quantity: 0 }), false);
  assert.equal(isOutOfStockCount({ status: "partial", quantity: 0, outOfStock: true }), false);
});

test("el aviso usa el tono de la acción realizada", () => {
  assert.equal(feedbackToneForCount("counted"), "counted");
  assert.equal(feedbackToneForCount("partial"), "advance");
  assert.equal(feedbackToneForCount("counted", true), "counted");
});
