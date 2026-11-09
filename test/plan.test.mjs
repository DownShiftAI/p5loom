import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlan } from "../src/plan.js";
import { describePlan } from "../src/describe.js";
import { SPEC_VERSION } from "../src/spec.js";

const spec = (over = {}) => ({
  version: SPEC_VERSION,
  seed: 2024,
  theme: "light",
  canvas: { width: 300, height: 200 },
  elements: [
    { type: "rect", x: 0, y: 0, w: 1, h: 1, fill: "bg" },
    { type: "circle", x: 0.5, y: 0.5, r: 0.25, fill: "accent" },
    { type: "line", points: [[0, 1], [1, 0]], stroke: "fg", weight: 2 },
    { type: "random-dots", count: 40, fill: "muted", radius: [1, 4] },
    ...(over.extra ?? []),
  ],
  ...over.top,
});

test("the plan starts with the background and maps coordinates to pixels", () => {
  const plan = buildPlan(spec());
  assert.equal(plan.ops[0].op, "background");
  assert.equal(plan.ops[0].colour, plan.theme.bg);
  const circle = plan.ops.find((o) => o.op === "circle" && o.fill === plan.theme.accent);
  assert.equal(circle.x, 150);
  assert.equal(circle.y, 100);
  assert.equal(circle.d, 2 * 0.25 * 200);
});

test("the same spec always gives the identical plan", () => {
  assert.deepEqual(buildPlan(spec()), buildPlan(spec()));
});

test("a different seed moves the random dots but not the shapes", () => {
  const a = buildPlan(spec());
  const b = buildPlan(spec({ top: { seed: 7 } }));
  const dotsA = a.ops.filter((o) => o.op === "circle" && o.fill === a.theme.muted);
  const dotsB = b.ops.filter((o) => o.op === "circle" && o.fill === b.theme.muted);
  assert.equal(dotsA.length, 40);
  assert.notDeepEqual(dotsA.map((d) => d.x), dotsB.map((d) => d.x));
  assert.deepEqual(a.ops.filter((o) => o.op === "rect"), b.ops.filter((o) => o.op === "rect"));
});

test("switching theme changes colours only, never positions", () => {
  const light = buildPlan(spec());
  const dark = buildPlan(spec({ top: { theme: "dark" } }));
  assert.notEqual(light.ops[0].colour, dark.ops[0].colour);
  const pos = (plan) => plan.ops.map((o) => [o.x, o.y, o.d, o.w, o.h]);
  assert.deepEqual(pos(light), pos(dark));
});

test("a line keeps its points in pixels", () => {
  const plan = buildPlan(spec());
  const line = plan.ops.find((o) => o.op === "line");
  assert.deepEqual(line.points, [[0, 200], [300, 0]]);
});

test("random dots respect their radius bounds", () => {
  const plan = buildPlan(spec());
  for (const o of plan.ops.filter((x) => x.op === "circle" && x.fill === plan.theme.muted)) {
    assert.ok(o.d / 2 >= 1 && o.d / 2 < 4, `radius ${o.d / 2}`);
  }
});

test("buildPlan refuses an invalid spec", () => {
  assert.throws(() => buildPlan(spec({ top: { seed: -1 } })), /invalid spec/);
});

test("description counts elements and names the theme", () => {
  const s = spec();
  const d = describePlan(buildPlan(s), s);
  assert.equal(
    d,
    "Visualization 300 by 200 pixels, light theme: 1 rect element, 1 circle element, 1 line element, 1 random-dots element, 40 generated dots.",
  );
});

test("description for an empty canvas says so", () => {
  const s = spec({ top: { seed: 0 }, extra: [] });
  s.elements = [];
  assert.match(describePlan(buildPlan(s), s), /no elements/);
});
