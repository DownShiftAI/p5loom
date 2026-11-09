import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSpec } from "../src/spec.js";
import { buildPlan } from "../src/plan.js";
import { describePlan } from "../src/describe.js";
import { resolveSpec, controlDefaults, valueOf } from "../src/controls.js";
import { renderSvg } from "../src/svg.js";
import { readFileSync } from "node:fs";

const demo = () => JSON.parse(readFileSync(new URL("../examples/controls-demo.json", import.meta.url), "utf8"));
const slider = (id, over = {}) => ({ id, type: "slider", label: id, min: 0, max: 1, step: 0.1, value: 0.5, ...over });
const base = (over = {}) => ({
  version: 1,
  seed: 1,
  canvas: { width: 200, height: 100 },
  elements: [{ type: "circle", x: 0.5, y: 0.5, r: 0.2, fill: "accent" }],
  ...over,
});

test("the controls demo validates and every control has a default", () => {
  const s = demo();
  assert.deepEqual(validateSpec(s), []);
  assert.deepEqual(controlDefaults(s), { seed: 7, dots: 220, radius: 0.2, tint: "muted", horizon: true, theme: "dark" });
});

test("a bound number takes the control's value; a bound token takes the chosen token", () => {
  const s = demo();
  const r = resolveSpec(s, { radius: 0.35, tint: "fg" });
  const circle = r.elements.find((e) => e.type === "circle");
  assert.equal(circle.r, 0.35);
  const dots = r.elements.find((e) => e.type === "random-dots");
  assert.equal(dots.fill, "fg");
  assert.equal(dots.count, 220);
  assert.equal(r.controls, undefined, "the resolved spec carries no controls");
});

test("a toggle hides the element it names while it is off", () => {
  const s = demo();
  assert.ok(resolveSpec(s, {}).elements.some((e) => e.type === "line"));
  assert.ok(!resolveSpec(s, { horizon: false }).elements.some((e) => e.type === "line"));
});

test("the seed and the theme can be bound too", () => {
  const s = demo();
  const r = resolveSpec(s, { seed: 42, theme: "light" });
  assert.equal(r.seed, 42);
  assert.equal(r.theme, "light");
  const plan = buildPlan(s, { seed: 42, theme: "light" });
  assert.equal(plan.themeName, "light");
  assert.equal(plan.seed, 42);
});

test("the same control values always give the identical plan", () => {
  const s = demo();
  assert.deepEqual(buildPlan(s, { dots: 80, seed: 3 }), buildPlan(s, { dots: 80, seed: 3 }));
});

test("values are snapped to the step and clamped to the range", () => {
  const c = slider("x", { min: 0, max: 10, step: 2, value: 4 });
  assert.equal(valueOf(c, { x: 5.1 }), 6);
  assert.equal(valueOf(c, { x: 99 }), 10);
  assert.equal(valueOf(c, { x: -4 }), 0);
  assert.equal(valueOf(c, { x: "lots" }), 4, "a value of the wrong type falls back to the default");
});

test("a select only accepts its options; anything else falls back to the default", () => {
  const c = { id: "t", type: "select", label: "t", options: ["accent", "fg"], value: "fg" };
  assert.equal(valueOf(c, { t: "accent" }), "accent");
  assert.equal(valueOf(c, { t: "#ff00ff" }), "fg");
});

test("a binding to a missing control is refused by name", () => {
  const s = demo();
  s.elements[1].r = { control: "nope" };
  assert.match(validateSpec(s).join(" "), /control "nope" is not defined/);
});

test("a number field cannot follow a select or a toggle", () => {
  const s = demo();
  s.elements[1].r = { control: "tint" };
  assert.match(validateSpec(s).join(" "), /control "tint" is a select; a number field needs a slider/);
});

test("a slider whose range leaves the field's allowed range is refused", () => {
  const s = base({ controls: [slider("big", { min: 0, max: 2, step: 0.1, value: 1 })] });
  s.elements[0].r = { control: "big" };
  assert.match(validateSpec(s).join(" "), /runs from 0 to 2; the field allows 0 to 1/);
});

test("a count bound to a slider must have whole-number steps and a minimum of at least 1", () => {
  const s = base({ controls: [slider("n", { min: 0, max: 50, step: 1, value: 10 })] });
  s.elements = [{ type: "random-dots", count: { control: "n" } }];
  assert.match(validateSpec(s).join(" "), /control "n" runs from 0 to 50; the field allows 1 to 100000/);
});

test("a token field needs a select whose options are all tokens", () => {
  const s = base({ controls: [{ id: "c", type: "select", label: "c", options: ["accent", "pink"], value: "accent" }] });
  s.elements[0].fill = { control: "c" };
  assert.match(validateSpec(s).join(" "), /must be a select whose options are all theme tokens/);
});

test("when must name a toggle", () => {
  const s = demo();
  s.elements[3].when = "dots";
  assert.match(validateSpec(s).join(" "), /"dots" is not a toggle/);
  s.elements[3].when = "absent";
  assert.match(validateSpec(s).join(" "), /must name a toggle control/);
});

test("controls themselves are checked: ids, duplicates, ranges, defaults and options", () => {
  const bad = base({
    controls: [
      { id: "Bad Id", type: "toggle", label: "x", value: true },
      slider("a", { min: 5, max: 1, step: 1, value: 3 }),
      slider("b", { min: 0, max: 1, step: 0.1, value: 2 }),
      { id: "c", type: "select", label: "c", options: ["one"], value: "one" },
      { id: "c", type: "toggle", label: "dup", value: false },
    ],
  });
  const p = validateSpec(bad).join("\n");
  assert.match(p, /controls\[0\]\.id/);
  assert.match(p, /controls\[1\]: a slider needs numeric min and max/);
  assert.match(p, /controls\[2\]\.value: must be between min and max/);
  assert.match(p, /controls\[3\]\.options: 2 to 12 strings/);
  assert.match(p, /controls\[4\]\.id: "c" is used twice/);
});

test("controls are capped at twelve, and code-like control values are refused", () => {
  const many = base({ controls: Array.from({ length: 13 }, (_, i) => slider(`s${i}`)) });
  assert.match(validateSpec(many).join(" "), /controls: at most 12/);
  const coded = base({ controls: [{ id: "x", type: "toggle", label: "x", value: true, onclick: "alert(1)" }] });
  assert.match(validateSpec(coded).join(" "), /onclick/);
});

test("the description reflects the controls that are on", () => {
  const s = demo();
  assert.match(describePlan(buildPlan(s, { horizon: false }), s), /1 random-dots element, 1 circle element, 1 rect element, 220 generated dots/);
});

test("renderSvg writes one SVG per plan, labelled with the description", () => {
  const s = demo();
  const plan = buildPlan(s);
  const svg = renderSvg(plan);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="960" height="560"/);
  assert.match(svg, /role="img" aria-label="Visualization 960 by 560 pixels, dark theme/);
  assert.equal((svg.match(/<circle /g) ?? []).length, 220 + 1);
  assert.doesNotMatch(svg, /<script|on[a-z]+=/i);
});
