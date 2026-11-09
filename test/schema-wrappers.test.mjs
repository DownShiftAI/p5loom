import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import React from "react";
import { renderToString } from "react-dom/server";
import { h, defineComponent, createSSRApp } from "vue";
import { renderToString as renderVue } from "vue/server-renderer";
import { validateSpec } from "../src/spec.js";
import { p5LoomComponent } from "../src/react.js";
import { p5LoomVueComponent } from "../src/vue.js";
import { defineP5Loom } from "../src/element.js";

const schema = JSON.parse(readFileSync(new URL("../schema/p5loom-spec-1.schema.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const check = ajv.compile(schema);
const examples = readdirSync(new URL("../examples/", import.meta.url))
  .filter((f) => f.endsWith(".json") && f !== "catalog.json")
  .map((f) => [f, JSON.parse(readFileSync(new URL(`../examples/${f}`, import.meta.url), "utf8"))]);
const base = () => ({ version: 1, seed: 1, canvas: { width: 100, height: 100 }, elements: [] });

const invalid = {
  "wrong version": { ...base(), version: 2 },
  "raw colour": { ...base(), elements: [{ type: "circle", x: 0.5, y: 0.5, r: 0.2, fill: "#ff00ff" }] },
  "coordinate outside the unit square": { ...base(), elements: [{ type: "circle", x: 1.5, y: 0.5, r: 0.2 }] },
  "no canvas": { version: 1, seed: 1, elements: [] },
  "unknown element type": { ...base(), elements: [{ type: "spiral" }] },
  "extra property on an element": { ...base(), elements: [{ type: "circle", x: 0.5, y: 0.5, r: 0.2, onclick: "x" }] },
  "a bad control id": { ...base(), controls: [{ id: "Bad Id", type: "toggle", label: "x", value: true }] },
  "a binding with a second key": { ...base(), elements: [{ type: "circle", x: { control: "a", extra: 1 }, y: 0.5, r: 0.2 }] },
  "a data table with a bad name": { ...base(), data: { "Bad Name": [{ a: 1 }] } },
};

test("the JSON Schema compiles as draft 2020-12", () => {
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(typeof check, "function");
});

for (const [file, spec] of examples) {
  test(`the schema and the validator both accept ${file}`, () => {
    assert.equal(check(spec), true, JSON.stringify(check.errors?.slice(0, 2)));
    assert.deepEqual(validateSpec(spec), []);
  });
}

for (const [name, spec] of Object.entries(invalid)) {
  test(`the schema and the validator both refuse: ${name}`, () => {
    assert.equal(check(spec), false, "the schema should refuse this");
    assert.ok(validateSpec(spec).length > 0, "the validator should refuse this");
  });
}

test("a bound slider whose range does not fit the field is refused by the validator, not the schema", () => {
  const spec = {
    ...base(),
    controls: [{ id: "big", type: "slider", label: "big", min: 0, max: 2, step: 0.1, value: 1 }],
    elements: [{ type: "circle", x: 0.5, y: 0.5, r: { control: "big" } }],
  };
  assert.equal(check(spec), true, "the schema describes the shape");
  assert.match(validateSpec(spec).join(" "), /runs from 0 to 2; the field allows 0 to 1/);
});

test("the React component renders its container on the server, and the picture waits for the browser", () => {
  const P5Loom = p5LoomComponent(React);
  const html = renderToString(React.createElement(P5Loom, { spec: base(), className: "chart" }));
  assert.match(html, /<div class="chart"><\/div>/);
  assert.throws(() => p5LoomComponent({}), /needs React/);
});

test("the Vue component renders its container on the server, and rejects a missing helper", async () => {
  const P5Loom = p5LoomVueComponent({ h, defineComponent });
  const app = createSSRApp({ render: () => h(P5Loom, { spec: base() }) });
  const html = await renderVue(app);
  assert.match(html, /<div><\/div>/);
  assert.throws(() => p5LoomVueComponent({}), /needs \{ h, defineComponent \}/);
});

test("the web component is refused where there are no custom elements", () => {
  assert.throws(() => defineP5Loom({ p5: function p5() {} }), /needs a browser with custom elements/);
});
