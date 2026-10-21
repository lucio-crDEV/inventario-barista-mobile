import test from "node:test";
import assert from "node:assert/strict";
import { validPassword } from "../worker/password.js";

test("Contraseñas: mínimo ocho caracteres, límite UTF-8 sin truncamiento", () => {
  assert.equal(validPassword("Clave-0"), false);
  assert.equal(validPassword("Clave-08"), true);
  assert.equal(validPassword("á".repeat(8)), true);
  assert.equal(validPassword("😀".repeat(7)), false);
  assert.equal(validPassword("a".repeat(72)), true);
  assert.equal(validPassword("a".repeat(73)), false);
  assert.equal(validPassword("á".repeat(37)), false);
  assert.equal(validPassword(null), false);
});
