// The pages added with controls, charts, integrations, code mode and the MCP server. Tool and resource lists are read
// from the server's own registries, so the pages always match what a client sees.

import { TOOLS } from "../src/mcp/tools.js";
import { PROMPTS } from "../src/mcp/prompts.js";
import { listResources } from "../src/mcp/resources.js";
import { CONTROL_TYPES, MAX_CONTROLS } from "../src/controls.js";
import { CHART_TYPES, MAX_TABLES, MAX_ROWS } from "../src/chart.js";
import { SKETCH_MAX_BYTES } from "../src/sketch.js";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const code = (text) => `<pre class="code"><code>${esc(text.replace(/^\n/, "").replace(/\n\s*$/, ""))}</code></pre>`;
const demo = (id, caption, share) =>
  `<figure class="demo"><div class="demo-stage" data-demo="${id}"${share ? ` data-share="${share}"` : ""} role="group" aria-label="${esc(caption)}"></div><figcaption>${esc(caption)}</figcaption></figure>`;

const controlsSpec = `{
  "version": 1,
  "seed": 7,
  "canvas": { "width": 640, "height": 400 },
  "controls": [
    { "id": "dots", "type": "slider", "label": "Stars", "min": 10, "max": 600, "step": 10, "value": 200 },
    { "id": "horizon", "type": "toggle", "label": "Show the horizon", "value": true },
    { "id": "tint", "type": "select", "label": "Star colour", "options": ["accent", "muted", "fg"], "value": "muted" }
  ],
  "elements": [
    { "type": "random-dots", "count": { "control": "dots" }, "fill": { "control": "tint" }, "radius": [0.6, 1.8] },
    { "type": "line", "points": [[0, 0.8], [1, 0.8]], "stroke": "accent", "weight": 1.5, "when": "horizon" }
  ]
}`;

const barSpec = `{
  "version": 1,
  "seed": 1,
  "canvas": { "width": 640, "height": 400 },
  "data": {
    "sales": [
      { "month": "Jan", "revenue": 120 },
      { "month": "Feb", "revenue": 180 },
      { "month": "Mar", "revenue": 150 }
    ]
  },
  "elements": [
    { "type": "axes", "table": "sales", "x": "month", "y": "revenue" },
    { "type": "bars", "table": "sales", "x": "month", "y": "revenue", "fill": "accent" }
  ]
}`;

const claudeDesktop = `{
  "mcpServers": {
    "p5loom": {
      "command": "node",
      "args": ["/path/to/p5loom/bin/p5loom-mcp.mjs"]
    }
  }
}`;

const claudeCode = `claude mcp add p5loom -- node /path/to/p5loom/bin/p5loom-mcp.mjs`;

const httpOpen = `node /path/to/p5loom/bin/p5loom-mcp.mjs --http 7340
# open: no token, 127.0.0.1 only. Point a local client at http://127.0.0.1:7340/mcp`;

const httpToken = `export P5LOOM_MCP_TOKEN="$(node /path/to/p5loom/bin/p5loom-mcp.mjs --new-token)"
node /path/to/p5loom/bin/p5loom-mcp.mjs --http 7340 --host 0.0.0.0
# every request now needs: Authorization: Bearer <that token>`;

const multiToken = `P5LOOM_MCP_TOKENS="ci=<token-a>,laptop=<token-b>" node bin/p5loom-mcp.mjs --http 7340 --host 0.0.0.0 --rate 60 --burst 10`;

const reactSample = `import React from "react";
import { p5LoomComponent } from "p5loom/react";

const P5Loom = p5LoomComponent(React);

export function Revenue({ spec, dots, onChange }) {
  return <P5Loom spec={spec} values={{ dots }} onChange={onChange} />;
}`;

const vueSample = `<script setup>
import { h, defineComponent } from "vue";
import { p5LoomVueComponent } from "p5loom/vue";

const P5Loom = p5LoomVueComponent({ h, defineComponent });
</script>

<template>
  <P5Loom :spec="spec" :values="{ dots: 300 }" @change="save" />
</template>`;

const elementSample = `<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.3/p5.min.js"></script>
<script type="module">
  import { defineP5Loom } from "/lib/element.js";
  defineP5Loom();
</script>

<p5-loom src="/examples/bar-chart.json" share-key="revenue"></p5-loom>`;

const sketchSample = `function setup() {
  createCanvas(320, 180);
  noStroke();
}

function draw() {
  background(0);
  fill(255, 176, 32);
  circle(mouseX, height / 2, 60);
}`;

export const CONTROLS_PAGE = {
  path: "/docs/controls.html",
  title: "Controls",
  description: "Sliders, toggles and selects in a p5loom spec, bound to the fields they change. The state can live in the URL.",
  demos: true,
  modules: [],
  body: `
<h1>Controls</h1>
<p class="lede">A spec can declare controls: a slider, a toggle or a select. The library draws the inputs next to the picture and redraws when one changes. Inputs are ordinary labelled form controls, so they work with a keyboard, and every change is announced to a screen reader once the reader stops moving.</p>

<div class="bar"><strong>Try it</strong><span>Move the slider, switch the horizon. The link updates.</span></div>
${demo("controls-demo", "A sunrise with a seed, a star count, a star colour, a theme and a horizon toggle.", "controls-demo")}

<div class="bar"><strong>Declare a control</strong><span>Three types</span></div>
${code(controlsSpec)}
<table>
  <thead><tr><th>Type</th><th>Fields</th><th>Value</th></tr></thead>
  <tbody>
    <tr><td><code>slider</code></td><td><code>min</code>, <code>max</code>, <code>step</code>, <code>value</code></td><td>A number from min to max, snapped to the step.</td></tr>
    <tr><td><code>toggle</code></td><td><code>value</code></td><td><code>true</code> or <code>false</code>.</td></tr>
    <tr><td><code>select</code></td><td><code>options</code> (2 to 12 strings), <code>value</code></td><td>One of the options.</td></tr>
  </tbody>
</table>
<p>Every control has an <code>id</code> (lowercase letters, digits and hyphens), a <code>label</code> of up to 80 characters, and a type from ${CONTROL_TYPES.map((t) => `<code>${t}</code>`).join(", ")}. A spec can hold up to ${MAX_CONTROLS}.</p>

<div class="bar"><strong>Bind a field</strong><span>{ "control": "id" }</span></div>
<p>A field follows a control by naming it. The control's whole range must fit the field, so a coordinate can only follow a slider that runs inside 0 to 1. The validator says so when it does not.</p>
<table>
  <thead><tr><th>Field</th><th>Follows</th></tr></thead>
  <tbody>
    <tr><td><code>x</code>, <code>y</code>, <code>w</code>, <code>h</code>, <code>r</code></td><td>a slider inside 0 to 1 (<code>r</code> on a scatter is pixels, up to 100)</td></tr>
    <tr><td><code>weight</code></td><td>a slider inside 0 to 64</td></tr>
    <tr><td><code>count</code></td><td>a whole-number slider with a minimum of 1</td></tr>
    <tr><td><code>seed</code></td><td>a whole-number slider from 0 to 4294967295</td></tr>
    <tr><td><code>fill</code>, <code>stroke</code></td><td>a select whose options are all theme tokens</td></tr>
    <tr><td><code>theme</code></td><td>a select whose options are <code>light</code> and <code>dark</code></td></tr>
    <tr><td><code>when</code> on an element</td><td>a toggle: the element is hidden while it is off</td></tr>
  </tbody>
</table>

<div class="bar"><strong>Share the state</strong><span>A link that reproduces this picture</span></div>
<p>Pass a <code>shareKey</code> to <code>mount</code> (or a <code>share-key</code> attribute) and the values that differ from the defaults are written to the address bar as one parameter, <code>p5loom-&lt;key&gt;</code>. Opening that link draws the same picture. A hand-edited value is checked against the control's range and step, so a link can never set a value the spec would refuse.</p>

<div class="bar"><strong>From code</strong><span>mount returns a handle</span></div>
${code(`import { mount } from "p5loom";

const handle = mount(element, spec, {
  p5,
  shareKey: "revenue",                       // optional: put the values in the address bar
  onChange: (values, id) => save(values),    // optional
});
handle.set("dots", 400);                     // moves the slider, redraws, announces, updates the link
handle.values();                             // { dots: 400, horizon: true, tint: "muted" }
handle.plan();                               // the drawing plan for the current values
handle.destroy();`)}
<p>Each change also dispatches a <code>p5loom-change</code> event on the picture, with the values as its detail.</p>

<div class="bar"><strong>Keep it reproducible</strong><span>Values are data too</span></div>
<p>The picture is a function of the spec and the control values, and nothing else. Values are snapped to the step and clamped to the range. Two readers with the same spec and values see the same picture, and an AI client can reproduce any state a person left the page in.</p>
`,
};

export const CHARTS_PAGE = {
  path: "/docs/charts.html",
  title: "Charts",
  description: "Data tables, bars, points, paths, axes, text and legends in p5loom, with band, linear and log scales computed from the data.",
  demos: true,
  body: `
<h1>Charts</h1>
<p class="lede">A chart is described by its numbers and the names of its fields. The library works out the scales, the ticks and the positions, so a chart is a table and a few elements that read from it, not a list of hand-placed coordinates.</p>

<div class="bar"><strong>Bars from a table</strong><span>Zero baseline by default</span></div>
${demo("bar-chart", "Six months of revenue, drawn as bars on a band x axis and a linear y axis from zero.")}
${code(barSpec)}

<div class="bar"><strong>Scales</strong><span>band, linear, log</span></div>
<table>
  <thead><tr><th>Scale</th><th>For</th><th>What it does</th></tr></thead>
  <tbody>
    <tr><td><code>band</code></td><td>text categories (the default x of bars)</td><td>Each category gets its own slot, in the order it first appears.</td></tr>
    <tr><td><code>linear</code></td><td>numbers (the default y)</td><td>Nice steps (1, 2 or 5 times a power of ten). Starts at zero unless <code>"zero": false</code>.</td></tr>
    <tr><td><code>log</code></td><td>numbers above zero that span powers of ten</td><td>Whole powers of ten. Set with <code>xScale</code> or <code>yScale</code>.</td></tr>
  </tbody>
</table>
${demo("log-scatter", "Visits against time on a log x axis, with points, a path and a legend.")}

<div class="bar"><strong>Elements</strong><span>${CHART_TYPES.length} chart element types</span></div>
<table>
  <thead><tr><th>Element</th><th>Reads</th><th>Draws</th></tr></thead>
  <tbody>
    <tr><td><code>axes</code></td><td><code>table</code>, <code>x</code>, <code>y</code></td><td>Axis lines, ticks, tick labels, field names as titles, optional grid.</td></tr>
    <tr><td><code>bars</code></td><td><code>table</code>, <code>x</code>, <code>y</code></td><td>One bar per row from the baseline.</td></tr>
    <tr><td><code>points</code></td><td><code>table</code>, <code>x</code>, <code>y</code></td><td>One dot per row. <code>r</code> in pixels.</td></tr>
    <tr><td><code>path</code></td><td><code>table</code>, <code>x</code>, <code>y</code></td><td>A polyline through the rows, in order or sorted by x.</td></tr>
    <tr><td><code>text</code></td><td><code>text</code>, <code>x</code>, <code>y</code></td><td>A label, with <code>size</code>, <code>fill</code> and <code>align</code>.</td></tr>
    <tr><td><code>legend</code></td><td><code>items</code></td><td>Swatches and labels, one per item, up to 8.</td></tr>
  </tbody>
</table>
<p>Optional on every table element: <code>frame</code> (where the plot sits, as four fractions of the canvas), <code>xScale</code>, <code>yScale</code>, <code>zero</code>, and <code>fill</code> or <code>stroke</code> as a theme token.</p>

<div class="bar"><strong>Limits</strong><span>Kept small on purpose</span></div>
<p>Up to ${MAX_TABLES} tables, each of up to ${MAX_ROWS} rows, with up to 8 fields per row. A field holds a number or a line of text up to 60 characters. A table that does not match its element (a missing field, text on a log axis, a value of zero on a log axis) is refused with the row that caused it.</p>
`,
};

export const INTEGRATIONS_PAGE = {
  path: "/docs/integrations.html",
  title: "Integrations",
  description: "Use p5loom as a web component, or from React or Vue, without changing how the picture is described.",
  demos: true,
  modules: ["/assets/integrations.js"],
  body: `
<h1>Integrations</h1>
<p class="lede">The picture is the same whatever draws it: a spec, mounted. p5loom ships a web component for any page, and small wrappers for React and Vue. Each wrapper takes the framework as an argument, so the library itself has no dependency on any of them.</p>

<div class="bar"><strong>Web component</strong><span>Any page, no framework</span></div>
<p>Define the element once, then use it like an image. <code>src</code> fetches a spec; <code>spec</code> takes one inline.</p>
${code(elementSample)}
<figure class="demo">
  <div class="demo-stage live-element" role="group" aria-label="A p5-loom element drawing the bar chart from its src attribute.">
    <p5-loom src="/examples/bar-chart.json" share-key="bar"></p5-loom>
  </div>
  <figcaption>The element above, drawing the bar chart from its src attribute.</figcaption>
</figure>

<div class="bar"><strong>React</strong><span>A component that mounts on the client</span></div>
${code(reactSample)}
<p>The picture is drawn after the component mounts, never during server rendering. A new spec remounts it. New values are applied with <code>set</code>, so a slider drag does not rebuild the picture.</p>

<div class="bar"><strong>Vue 3</strong><span>A component with a change event</span></div>
${code(vueSample)}
<p>Changing <code>spec</code> remounts the picture. Changing <code>values</code> applies them. <code>@change</code> receives the values after every change.</p>

<div class="bar"><strong>Import paths</strong><span>Pick what you need</span></div>
${code(`import { mount } from "p5loom";
import { defineP5Loom } from "p5loom/element";
import { p5LoomComponent } from "p5loom/react";
import { p5LoomVueComponent } from "p5loom/vue";`)}
`,
};

export const CODE_MODE_PAGE = {
  path: "/docs/code-mode.html",
  title: "Code mode",
  description: "Run a p5.js sketch you wrote, inside a sandboxed frame with no network and a strict content policy.",
  demos: false, // p5.js runs inside the sketch frames, not on this page
  modules: ["/assets/sketch-demo.js"],
  body: `
<h1>Code mode</h1>
<p class="lede">A spec is data. Sometimes a picture needs a program: an animation, a simulation, a sketch you wrote by hand. Code mode runs a p5.js sketch in a sandboxed frame, so the page that hosts it stays in control.</p>

<div class="bar"><strong>Try it</strong><span>Move the pointer over the frame</span></div>
<figure class="demo">
  <div class="demo-stage" data-sketch="rings" role="group" aria-label="A p5.js sketch running in a sandboxed frame. A circle follows the pointer."></div>
  <figcaption>A sketch in a sandboxed frame. It follows the pointer inside the frame only.</figcaption>
</figure>
${code(sketchSample)}

<div class="bar"><strong>What the frame cannot do</strong><span>The sandbox and the policy</span></div>
<ul>
  <li>It has an opaque origin: <code>sandbox="allow-scripts"</code> and nothing else. It cannot read the host page, its cookies or storage.</li>
  <li>It makes no network requests (<code>connect-src 'none'</code>), opens no popups, and submits no forms.</li>
  <li>Its one inline script carries a per-frame nonce. Scripts come only from the pinned p5.js build.</li>
  <li>The text <code>&lt;/script</code> is refused in the sketch, so the sketch cannot end its own script early.</li>
  <li>The sketch is limited to ${Math.round(SKETCH_MAX_BYTES / 1024)} KB.</li>
</ul>

<div class="bar"><strong>Use it for code you wrote</strong><span>Not for visitors' code</span></div>
<p>The sandbox protects the page that hosts a sketch. It does not protect against a sketch that loops forever, which freezes its own frame and nothing else. Run code mode for sketches the page's author wrote. Do not run code that a visitor typed in, unless you have decided that is a product you want to run.</p>
`,
};

export const MCP_PAGE = {
  path: "/docs/mcp.html",
  title: "MCP server",
  description: "Connect p5loom to Claude, Cursor, VS Code or any MCP client. Open for local use, token-protected for everything else, with rate limits.",
  body: `
<h1>MCP server</h1>
<p class="lede">p5loom ships a Model Context Protocol server. Any MCP client can validate a spec, see what it draws, change its controls, and get the picture back as SVG. It also serves the spec reference, the JSON Schema and the examples as resources, and three prompts for common tasks. The server has no dependencies.</p>

<div class="bar"><strong>Connect from your computer</strong><span>Standard input and output</span></div>
<p>Desktop and IDE clients run the server as a process. It is trusted as the user who starts it, so no token is needed. For Claude Desktop, edit <code>claude_desktop_config.json</code>:</p>
${code(claudeDesktop)}
<p>For Claude Code:</p>
${code(claudeCode)}
<p>Cursor, VS Code and other clients take the same command and arguments in their own MCP settings.</p>

<div class="bar"><strong>Over HTTP, open</strong><span>No token, this computer only</span></div>
<p>For a client that wants a URL on this machine. The server binds to 127.0.0.1 and refuses to start without a token on any other address.</p>
${code(httpOpen)}

<div class="bar"><strong>Over HTTP, with a token</strong><span>Required for any other address</span></div>
<p>Set a token and every request must present it as <code>Authorization: Bearer &lt;token&gt;</code>. A request without it gets <code>401</code> and a <code>WWW-Authenticate</code> challenge that points at the discovery document. Tokens are stored as SHA-256 digests and compared in constant time. A token must be at least 24 characters.</p>
${code(httpToken)}
<p>Several callers, each with its own token, so one can be revoked without affecting the others. The name appears in the audit log.</p>
${code(multiToken)}

<div class="bar"><strong>Rate limits</strong><span>Every HTTP caller</span></div>
<p>Each caller has a bucket: a burst of <code>--burst</code> requests (default 30) that refills at <code>--rate</code> a minute (default 120). A caller over its limit gets <code>429</code> with <code>Retry-After</code>. Other callers are not affected. Stdio is not rate limited, because the local user is already trusted.</p>

<div class="bar"><strong>Audit trail</strong><span>One line per tool call, on stderr</span></div>
<p>Each call writes who (the caller's name, or <code>stdio</code>, or <code>open</code>), which tool, whether it succeeded, and how long it took. Arguments are never written, so a spec or a token in a request does not reach the log.</p>

<div class="bar"><strong>Tools</strong><span>${TOOLS.length} tools, all pure</span></div>
<table>
  <thead><tr><th>Tool</th><th>What it does</th></tr></thead>
  <tbody>
${TOOLS.map((t) => `    <tr><td><code>${esc(t.name)}</code></td><td>${esc(t.description)}</td></tr>`).join("\n")}
  </tbody>
</table>

<div class="bar"><strong>Resources</strong><span>${listResources().length} documents to read</span></div>
<table>
  <thead><tr><th>URI</th><th>What it is</th></tr></thead>
  <tbody>
${listResources()
  .slice(0, 3)
  .map((r) => `    <tr><td><code>${esc(r.uri)}</code></td><td>${esc(r.description)}</td></tr>`)
  .join("\n")}
    <tr><td><code>p5loom://examples/&lt;id&gt;</code></td><td>Each example spec, by id.</td></tr>
  </tbody>
</table>

<div class="bar"><strong>Prompts</strong><span>${PROMPTS.length} tasks</span></div>
<table>
  <thead><tr><th>Prompt</th><th>What it does</th></tr></thead>
  <tbody>
${PROMPTS.map((p) => `    <tr><td><code>${esc(p.name)}</code></td><td>${esc(p.description)}</td></tr>`).join("\n")}
  </tbody>
</table>
<p>Pasted material is fenced as data inside each prompt, so text in it cannot change the instructions.</p>

<div class="bar"><strong>Safety</strong><span>Data in, pictures out</span></div>
<ul>
  <li>A spec is validated before any tool draws it. Code, functions and script or data URLs are refused, as in the browser.</li>
  <li>The tools make no network calls and run no browser. Their output is SVG text or JSON.</li>
  <li>Example ids and resource URIs are checked against a fixed list before any file is read.</li>
  <li>Errors come back inside the result with the problem list, so a model can correct the spec and try again.</li>
</ul>
`,
};
