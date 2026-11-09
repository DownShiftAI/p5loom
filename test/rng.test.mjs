import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "../src/rng.js";

test("same seed gives the same sequence", () => {
  const a = createRng(42);
  const b = createRng(42);
  for (let i = 0; i < 1000; i += 1) assert.equal(a.next(), b.next());
});

test("different seeds give different sequences", () => {
  const a = createRng(1).next();
  const b = createRng(2).next();
  assert.notEqual(a, b);
});

test("values stay in [0, 1)", () => {
  const r = createRng(7);
  for (let i = 0; i < 10000; i += 1) {
    const v = r.next();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test("range and int respect their bounds", () => {
  const r = createRng(99);
  for (let i = 0; i < 2000; i += 1) {
    const f = r.range(2, 5);
    assert.ok(f >= 2 && f < 5);
    const n = r.int(3, 6);
    assert.ok(Number.isInteger(n) && n >= 3 && n <= 6);
  }
});

test("bad seeds are refused", () => {
  for (const bad of [-1, 1.5, NaN, 2 ** 32, "7", null]) {
    assert.throws(() => createRng(bad), RangeError, `seed ${String(bad)} should be refused`);
  }
});

test("known first value for seed 0 (regression pin)", () => {
  // Pins the algorithm: changing it would silently change every saved picture.
  assert.equal(createRng(0).next(), createRng(0).next());
  const first = createRng(0).next();
  assert.ok(Math.abs(first - 0.26642920868471265) < 1e-12, `got ${first}`);
});
