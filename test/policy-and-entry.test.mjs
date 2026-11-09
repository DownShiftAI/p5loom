import { test } from "node:test";
import assert from "node:assert/strict";
import { sandboxCsp, assertNoCode, assertSize, MAX_SPEC_BYTES } from "../src/policy.js";
import { mount } from "../src/index.js";

test("sandbox CSP blocks network, framing and base changes by default", () => {
  const csp = sandboxCsp("https://cdn.jsdelivr.net/npm/p5@2.3.4/lib/p5.min.js");
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /connect-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /base-uri 'none'/);
  assert.match(csp, /script-src https:\/\/cdn\.jsdelivr\.net\/npm\/p5@2\.3\.4\/lib\/p5\.min\.js/);
});

test("assertNoCode allows plain data and refuses code-like keys nested deep", () => {
  assert.doesNotThrow(() => assertNoCode({ a: [{ b: "fine" }], n: 1 }));
  assert.throws(() => assertNoCode({ a: [{ b: { onload: "x" } }] }), /onload/);
});

test("assertSize allows the limit and refuses one byte over", () => {
  assert.doesNotThrow(() => assertSize("x".repeat(MAX_SPEC_BYTES)));
  assert.throws(() => assertSize("x".repeat(MAX_SPEC_BYTES + 1)), RangeError);
});

test("mount refuses to run outside a browser, before touching anything", () => {
  const valid = { version: 1, seed: 1, canvas: { width: 100, height: 100 }, elements: [] };
  assert.throws(() => mount({}, valid, { p5() {} }), /needs a browser document/);
});
