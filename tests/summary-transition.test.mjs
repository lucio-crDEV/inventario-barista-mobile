import test from "node:test";
import assert from "node:assert/strict";
import { showSummaryTransition } from "../pages/inventario/summary-transition.js";

function fixture(withSummary = true) {
  const summary = {
    children: [],
    prepend(child) { this.children.unshift(child); }
  };
  const container = {
    ownerDocument: {
      createElement() {
        return {
          attributes: {},
          setAttribute(key, value) { this.attributes[key] = value; },
          remove() { summary.children = summary.children.filter(child => child !== this); }
        };
      }
    },
    querySelector(selector) {
      return withSummary && selector === ".summary-view" ? summary : null;
    }
  };
  return { container, summary };
}

test("el resumen está disponible durante el acento breve y este se retira", () => {
  const { container, summary } = fixture();
  let cleanup;
  const indicator = showSummaryTransition(container, {
    schedule(callback, delay) {
      assert.equal(delay, 800);
      cleanup = callback;
    }
  });
  assert.equal(summary.children[0], indicator);
  assert.equal(indicator.attributes["aria-hidden"], "true");
  assert.match(indicator.innerHTML, /Preparando resumen/);
  cleanup();
  assert.equal(summary.children.length, 0);
});

test("movimiento reducido y vistas distintas omiten el acento", () => {
  const reduced = fixture();
  assert.equal(showSummaryTransition(reduced.container, { reducedMotion: true }), null);
  assert.equal(reduced.summary.children.length, 0);
  const other = fixture(false);
  assert.equal(showSummaryTransition(other.container), null);
});
