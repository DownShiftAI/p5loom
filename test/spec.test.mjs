import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSpec, assertValidSpec, SPEC_VERSION } from "../src/spec.js";
import { MAX_ELEMENTS, MAX_POINTS } from "../src/policy.js";

const base = () => ({
  version: SPEC_VERSION,
  seed: 1,
  theme: "light",
  canvas: { width: 640, height: 400 },
  elements: [{ type: "circle", x: 0.5, y: 0.5, r: 0.2, fill: "accent" }],
});

test("a minimal valid spec has no problems", () => {
  assert.deepEqual(validateSpec(base()), []);
});

test("every element type validates with its required fields", () => {
  const s = base();
  s.elements = [
    { type: "circle", x: 0.1, y: 0.1, r: 0.05, fill: "accent" },
    { type: "rect", x: 0.1, y: 0.1, w: 0.3, h: 0.2, stroke: "fg", weight: 2 },
    { type: "line", points: [[0, 0], [1, 1], [0.5, 0.2]], stroke: "muted", weight: 1 },
    { type: "scatter", data: [[0.2, 0.3], [0.8, 0.9]], r: 4, fill: "accent" },
    { type: "random-dots", count: 50, fill: "accent", radius: [1, 3] },
  ];
  assert.deepEqual(validateSpec(s), []);
});

test("missing or wrong version is refused", () => {
  const s = base();
  delete s.version;
  assert.match(validateSpec(s).join(" "), /version: must be 1/);
});

test("non-integer, negative and out-of-range seeds are refused", () => {
  for (const seed of [1.5, -3, 2 ** 32, "4", undefined]) {
    const s = base();
    s.seed = seed;
    assert.ok(validateSpec(s).some((p) => p.startsWith("seed:")), `seed ${String(seed)} should be refused`);
  }
});

test("raw colours are refused; only theme tokens are allowed", () => {
  const s = base();
  s.elements[0].fill = "#ff00ff";
  assert.match(validateSpec(s).join(" "), /"#ff00ff" is not a theme token/);
});

test("coordinates outside 0 to 1 are refused", () => {
  for (const x of [-0.1, 1.01, NaN, Infinity, "0.5"]) {
    const s = base();
    s.elements[0].x = x;
    assert.ok(validateSpec(s).some((p) => p.includes("elements[0].x")), `x=${String(x)} should be refused`);
  }
});

test("unknown element types are refused with the list", () => {
  const s = base();
  s.elements[0].type = "spiral";
  assert.match(validateSpec(s).join(" "), /"spiral" is not one of circle, rect, line, scatter, random-dots/);
});

test("canvas size limits are enforced", () => {
  const s = base();
  s.canvas = { width: 8, height: 5000 };
  const p = validateSpec(s).join(" ");
  assert.match(p, /canvas.width/);
  assert.match(p, /canvas.height/);
});

test("too many elements and points are refused", () => {
  const s = base();
  s.elements = Array.from({ length: MAX_ELEMENTS + 1 }, () => ({ type: "circle", x: 0, y: 0, r: 0.1 }));
  assert.match(validateSpec(s).join(" "), new RegExp(`at most ${MAX_ELEMENTS}`));
  const t = base();
  t.elements = [{ type: "random-dots", count: MAX_POINTS + 1 }];
  assert.match(validateSpec(t).join(" "), /elements\[0\]\.count: needs an integer from 1 to 100000/);
});

test("code-like keys are refused anywhere in the spec", () => {
  for (const key of ["code", "script", "eval", "function", "onclick", "innerHTML"]) {
    const s = base();
    s[key] = "alert(1)";
    assert.ok(validateSpec(s).some((p) => p.includes(key)), `${key} should be refused`);
  }
});

test("javascript: and data: URLs are refused as strings", () => {
  const s = base();
  s.elements[0].fill = "javascript:alert(1)";
  assert.ok(validateSpec(s).some((p) => p.includes("URL-like code")));
  const t = base();
  t.label = "data:text/html,<script>";
  assert.ok(validateSpec(t).some((p) => p.includes("URL-like code")));
});

test("a function anywhere in the spec is refused", () => {
  const s = base();
  s.elements[0].r = () => 0.2;
  assert.ok(validateSpec(s).some((p) => p.includes("functions are not allowed")));
});

test("an oversized spec is refused before field checks", () => {
  const s = base();
  s.note = "x".repeat(600 * 1024);
  assert.match(validateSpec(s).join(" "), /spec is \d+ bytes; the limit is/);
});

test("assertValidSpec throws with every problem listed", () => {
  const s = base();
  s.seed = -1;
  s.elements[0].fill = "pink";
  try {
    assertValidSpec(s);
    assert.fail("should have thrown");
  } catch (e) {
    assert.equal(e.problems.length, 2);
    assert.match(e.message, /invalid spec/);
  }
});

test("random junk never throws, it only returns problems (fuzz)", () => {
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const junk = () => pick([null, undefined, 0, -1, 1.5, "x", true, [], {}, [1, 2], { a: 1 }, NaN, "#fff", "accent"]);
  for (let i = 0; i < 3000; i += 1) {
    const s = {
      version: pick([1, 2, junk()]),
      seed: pick([0, 1, junk()]),
      theme: pick(["light", "dark", junk()]),
      canvas: pick([{ width: 100, height: 100 }, junk()]),
      elements: pick([[{ type: pick(["circle", "rect", "line", "scatter", "random-dots", "nope"]), x: junk(), points: junk(), data: junk(), count: junk() }], junk()]),
    };
    assert.doesNotThrow(() => validateSpec(s));
    assert.ok(Array.isArray(validateSpec(s)));
  }
});
