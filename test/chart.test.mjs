import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { niceDomain, niceNum, scaleFor, formatNumber, validateData } from "../src/chart.js";
import { validateSpec } from "../src/spec.js";
import { buildPlan } from "../src/plan.js";
import { renderSvg } from "../src/svg.js";

const example = (id) => JSON.parse(readFileSync(new URL(`../examples/${id}.json`, import.meta.url), "utf8"));
const sales = [120, 180, 150, 260, 230, 310];
const rowsOf = (values) => values.map((v, i) => ({ month: `M${i + 1}`, revenue: v }));

test("nice numbers: steps are 1, 2, 5 or 10 times a power of ten, and domains round outward", () => {
  assert.equal(niceNum(62, true), 50);
  assert.equal(niceNum(0.3, true), 0.2);
  assert.deepEqual(niceDomain(0, 310, 5), { lo: 0, hi: 350, step: 50 });
  assert.deepEqual(niceDomain(120, 310, 5), { lo: 100, hi: 350, step: 50 });
});

test("a flat range still gets a usable domain", () => {
  const d = niceDomain(5, 5, 5);
  assert.ok(d.lo < 5 && d.hi > 5 && d.step > 0);
});

test("a band scale gives each category its own slot, in order of first appearance", () => {
  const rows = [{ m: "Feb" }, { m: "Jan" }, { m: "Feb" }];
  const s = scaleFor(rows, "m", "band");
  assert.deepEqual(s.labels, ["Feb", "Jan"]);
  assert.equal(s.slot, 0.5);
  assert.equal(s.position("Feb"), 0.25);
  assert.equal(s.position("Jan"), 0.75);
});

test("a linear scale puts its domain's ends at 0 and 1, with ticks at the steps", () => {
  const s = scaleFor(rowsOf(sales), "revenue", "linear", { includeZero: true });
  assert.equal(s.position(s.lo), 0);
  assert.equal(s.position(s.hi), 1);
  assert.deepEqual(s.ticks.map((t) => t.text), ["0", "50", "100", "150", "200", "250", "300", "350"]);
  assert.equal(s.baseline, 0);
});

test("a log scale spans whole powers of ten and rejects zero or negative values", () => {
  const rows = [{ v: 12 }, { v: 16000 }];
  const s = scaleFor(rows, "v", "log");
  assert.equal(s.lo, 10);
  assert.equal(s.hi, 100000);
  assert.deepEqual(s.ticks.map((t) => t.text), ["10", "100", "1000", "10k", "100k"]);
  assert.ok(s.position(100) > s.position(10));
  assert.throws(() => scaleFor([{ v: 0 }], "v", "log"), /above zero/);
});

test("numbers are shortened for axis labels", () => {
  assert.equal(formatNumber(16000), "16k");
  assert.equal(formatNumber(2500000), "2.5M");
  assert.equal(formatNumber(0.25), "0.25");
});

test("the bar chart example validates, and its bars rise with the data", () => {
  const spec = example("bar-chart");
  assert.deepEqual(validateSpec(spec), []);
  const plan = buildPlan(spec);
  const bars = plan.ops.filter((o) => o.op === "rect" && o.fill === plan.theme.accent);
  assert.equal(bars.length, 6);
  const heights = bars.map((b) => b.h);
  assert.ok(heights[5] > heights[0], "310 is taller than 120");
  assert.ok(Math.abs(heights[0] / heights[5] - 120 / 310) < 0.02, "heights are proportional from a zero baseline");
});

test("axes draw tick labels and the field names as titles", () => {
  const plan = buildPlan(example("bar-chart"));
  const texts = plan.ops.filter((o) => o.op === "text").map((o) => o.text);
  for (const t of ["0", "100", "300", "Jan", "Jun", "month", "revenue", "Revenue by month"]) assert.ok(texts.includes(t), t);
});

test("the log scatter example validates; its points sit on a log axis", () => {
  const spec = example("log-scatter");
  assert.deepEqual(validateSpec(spec), []);
  const plan = buildPlan(spec);
  const circles = plan.ops.filter((o) => o.op === "circle");
  assert.equal(circles.length, 7);
  assert.ok(plan.ops.some((o) => o.op === "text" && o.text === "Page"), "the legend label is drawn");
});

test("a table is checked: name, rows, fields and value types", () => {
  const problems = [];
  validateData({ data: { "Bad Name": [{ a: 1 }] } }, problems);
  validateData({ data: { t: [] } }, problems);
  validateData({ data: { t: [{ a: true }] } }, problems);
  validateData({ data: { t: [{ A: 1 }] } }, problems);
  const text = problems.join("\n");
  assert.match(text, /table names are lowercase/);
  assert.match(text, /needs 1 to 1000 rows/);
  assert.match(text, /a number, or text of 1 to 60 characters/);
  assert.match(text, /field names are lowercase/);
});

test("a chart element must name a table, and its fields must exist in every row", () => {
  const spec = example("bar-chart");
  spec.elements[1].table = "nope";
  assert.match(validateSpec(spec).join(" "), /"nope" is not a data table/);
  const missing = example("bar-chart");
  missing.data.sales[2] = { month: "Mar" };
  assert.match(validateSpec(missing).join(" "), /row 2 of "sales" has no field "revenue"/);
});

test("a number axis needs numbers, and a log axis needs values above zero", () => {
  const spec = example("log-scatter");
  spec.data.pages[0].visits = 0;
  assert.match(validateSpec(spec).join(" "), /needs values above zero on a log axis/);
  const text = example("log-scatter");
  text.data.pages[0].visits = "many";
  assert.match(validateSpec(text).join(" "), /"visits" needs numbers on a log axis|needs numbers on a log axis|a number, or text/);
});

test("a frame must be four fractions with left before right and top above bottom", () => {
  const spec = example("bar-chart");
  spec.elements[0].frame = [0.9, 0.1, 0.1, 0.9];
  assert.match(validateSpec(spec).join(" "), /frame: \[left, top, right, bottom\] from 0 to 1/);
});

test("bars need a band x scale and a numeric y scale", () => {
  const spec = example("bar-chart");
  spec.elements[1].yScale = "band";
  assert.match(validateSpec(spec).join(" "), /bars need a linear or log y scale/);
});

test("text and legend elements are checked, and their colours must be tokens", () => {
  const spec = example("log-scatter");
  spec.elements[3].items = [];
  spec.elements.push({ type: "text", x: 0.5, y: 0.5, text: "", size: 2, align: "middle" });
  const text = validateSpec(spec).join("\n");
  assert.match(text, /items: needs 1 to 8 items/);
  assert.match(text, /text: 1 to 80 characters/);
  assert.match(text, /size: must be a number from 6 to 72 pixels/);
  assert.match(text, /align: left, center or right/);
});

test("the SVG writer keeps text anchors and escapes the words", () => {
  const spec = example("bar-chart");
  spec.elements.push({ type: "text", x: 0.5, y: 0.9, text: "a < b & \"c\"", align: "right" });
  const svg = renderSvg(buildPlan(spec));
  assert.match(svg, /text-anchor="end"[^>]*>a &lt; b &amp; &quot;c&quot;<\/text>/);
  assert.match(svg, /text-anchor="middle" font-family="sans-serif">Jan<\/text>/);
});

test("a chart that uses a control still follows it", () => {
  const spec = example("bar-chart");
  spec.controls = [{ id: "scale", type: "toggle", label: "Show axes", value: true }];
  spec.elements[0].when = "scale";
  assert.deepEqual(validateSpec(spec), []);
  const plan = buildPlan(spec, { scale: false });
  assert.ok(!plan.ops.some((o) => o.op === "text" && o.text === "revenue"));
});
