// The site's words. Each page is an HTML fragment rendered inside site/layout.mjs. Numbers that describe the library
// (limits, contrast ratios, token values) are read from the library itself, so the docs cannot drift from the code.

import { THEMES, TOKENS, contrast } from "../src/theme.js";
import { MAX_SPEC_BYTES, MAX_ELEMENTS, MAX_POINTS } from "../src/policy.js";
import { ELEMENT_TYPES, SPEC_VERSION } from "../src/spec.js";
import { EXAMPLES } from "./examples.mjs";
import { HOME } from "./home.mjs";
import { CONTROLS_PAGE, MCP_PAGE, CHARTS_PAGE, INTEGRATIONS_PAGE, CODE_MODE_PAGE } from "./pages-extra.mjs";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Code blocks are escaped once here, so samples can show angle brackets and ampersands safely.
const code = (text) => `<pre class="code"><code>${esc(text.replace(/^\n/, "").replace(/\n\s*$/, ""))}</code></pre>`;
// Swatch classes (sw-light-bg and so on) are generated from the theme table in the build, so no inline styles are needed.
const swatch = (t, k) => `<span class="sw sw-${t}-${k}" aria-hidden="true"></span>`;
const ratio = (a, b) => contrast(THEMES[a][b[0]], THEMES[a][b[1]]).toFixed(2);
const demo = (id, caption) =>
  `<figure class="demo"><div class="demo-stage" data-demo="${id}" role="group" aria-label="${esc(caption)}"></div><figcaption>${esc(caption)}</figcaption></figure>`;

export const SECTIONS = [
  { href: "/", label: "Overview" },
  { href: "/docs/getting-started.html", label: "Docs" },
  { href: "/playground.html", label: "Playground" },
  { href: "/docs/examples.html", label: "Examples" },
  { href: "/docs/mcp.html", label: "MCP" },
  { href: "/docs/security.html", label: "Security" },
];

// Every docs page, in reading order. Shown as the second row on the home page and on every docs page.
export const DOCS = [
  { href: "/docs/getting-started.html", label: "Getting started" },
  { href: "/docs/spec.html", label: "Spec" },
  { href: "/docs/elements.html", label: "Elements" },
  { href: "/docs/controls.html", label: "Controls" },
  { href: "/docs/charts.html", label: "Charts" },
  { href: "/docs/themes.html", label: "Themes" },
  { href: "/docs/accessibility.html", label: "Accessibility" },
  { href: "/docs/api.html", label: "API" },
  { href: "/docs/integrations.html", label: "Integrations" },
  { href: "/docs/code-mode.html", label: "Code mode" },
  { href: "/docs/examples.html", label: "Examples" },
  { href: "/docs/mcp.html", label: "MCP" },
  { href: "/docs/security.html", label: "Security" },
];

const helloSpec = `{
  "version": 1,
  "seed": 1,
  "theme": "light",
  "canvas": { "width": 480, "height": 320 },
  "elements": [
    { "type": "circle", "x": 0.5, "y": 0.5, "r": 0.3, "fill": "accent" }
  ]
}`;

const mountSample = `<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.3/p5.min.js"></script>
<div id="chart"></div>
<script type="module">
  import { mount } from "https://p5loom.dawnshift.co/lib/index.js";

  const spec = { /* a spec object, see the Spec page */ };
  const handle = mount(document.getElementById("chart"), spec, { p5 });
  // handle.description is the text alternative. handle.destroy() removes the picture.
</script>`;

export const PAGES = [
  HOME,
  CONTROLS_PAGE,
  CHARTS_PAGE,
  INTEGRATIONS_PAGE,
  CODE_MODE_PAGE,
  MCP_PAGE,
  {
    path: "/docs/getting-started.html",
    title: "Getting started",
    description: "Install p5loom, write a spec, and mount it on a page with p5.js.",
    demos: true,
    body: `
<h1>Getting started</h1>
<p class="lede">You need a page with p5.js and one module from p5loom. There is no build step.</p>

<h2>1. Load p5.js</h2>
<p>p5loom uses the p5 constructor you give it, so load p5.js first. The site uses the 1.11.3 build from cdnjs:</p>
${code(`<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.3/p5.min.js"></script>`)}

<h2>2. Get the library</h2>
<p>The package is not yet on npm. Until it is, copy the <code>src/</code> folder of the repository next to your page, or use the copy this site serves at <code>/lib/</code>:</p>
${code(`<script type="module">
  import { mount, validateSpec } from "/lib/index.js";
</script>`)}
<p>Once published, the import becomes <code>import { mount } from "p5loom"</code>. Nothing else changes.</p>

<h2>3. Write a spec</h2>
<p>A spec is a JSON object. This one draws a circle in the accent colour:</p>
${code(helloSpec)}
${demo("hello-circle", "The spec above, mounted live on this page.")}

<h2>4. Mount it</h2>
${code(mountSample)}
<p><code>mount</code> validates the spec first. If it is wrong it throws an error whose <code>problems</code> property lists every problem, not just the first.</p>

<h2>5. Check before you draw</h2>
<p>To check a spec without drawing anything, call <code>validateSpec</code>. It returns an array of problem strings, empty when the spec is valid. This is what the playground uses.</p>
${code(`import { validateSpec } from "/lib/index.js";

const problems = validateSpec(spec);
if (problems.length) console.log(problems.join("\\n"));`)}

<h2>What to read next</h2>
<p>The <a href="/docs/spec.html">spec reference</a> lists every field. The <a href="/docs/elements.html">elements page</a> shows each of the five types. If you are building something that accepts specs from users or from a model, read the <a href="/docs/security.html">security model</a> first.</p>
`,
  },
  {
    path: "/docs/spec.html",
    title: "Spec reference",
    description: "Every field of the p5loom spec, its allowed values and its limits.",
    body: `
<h1>Spec reference</h1>
<p class="lede">Version ${SPEC_VERSION}. A spec is one JSON object. Unknown top-level keys are ignored, but keys that look like code are refused wherever they appear.</p>

<h2>Top level</h2>
<table>
  <thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Meaning</th></tr></thead>
  <tbody>
    <tr><td><code>version</code></td><td>${SPEC_VERSION}</td><td>yes</td><td>The spec format. Only ${SPEC_VERSION} is accepted today.</td></tr>
    <tr><td><code>seed</code></td><td>integer, 0 to 4294967295</td><td>yes</td><td>Fixes every random choice. Same seed, same picture.</td></tr>
    <tr><td><code>theme</code></td><td><code>"light"</code> or <code>"dark"</code></td><td>no, default light</td><td>Which colour tokens to use. See <a href="/docs/themes.html">themes</a>.</td></tr>
    <tr><td><code>canvas.width</code></td><td>integer, 16 to 4096</td><td>yes</td><td>Width in CSS pixels.</td></tr>
    <tr><td><code>canvas.height</code></td><td>integer, 16 to 4096</td><td>yes</td><td>Height in CSS pixels.</td></tr>
    <tr><td><code>elements</code></td><td>array, at most ${MAX_ELEMENTS}</td><td>yes</td><td>The things to draw, in order. Later elements draw on top.</td></tr>
  </tbody>
</table>

<h2>Coordinates</h2>
<p>Positions are normalised. <code>0</code> is the left or top edge of the canvas and <code>1</code> is the right or bottom edge, so a spec does not change when the canvas size does. Sizes that name a radius, a width or a weight of a shape are relative to the canvas where the element says so, and are pixels where the element says pixels. Each element's section below says which.</p>

<h2>Colours</h2>
<p>A spec never contains a colour. It names a token: <code>${TOKENS.map((t) => `"${t}"`).join(", ")}</code>. The theme decides the value. A raw colour such as <code>"#ff00ff"</code> is refused with a message that lists the tokens.</p>

<h2>Limits</h2>
<table>
  <thead><tr><th>Limit</th><th>Value</th></tr></thead>
  <tbody>
    <tr><td>Whole spec, as JSON text</td><td>${(MAX_SPEC_BYTES / 1024).toFixed(0)} KB</td></tr>
    <tr><td>Elements</td><td>${MAX_ELEMENTS}</td></tr>
    <tr><td>Points in one line or scatter, or dots in one random-dots element</td><td>${MAX_POINTS.toLocaleString("en-GB")}</td></tr>
    <tr><td>Canvas side</td><td>16 to 4096 pixels</td></tr>
  </tbody>
</table>
<p>A spec over the size limit is refused before any other check runs, so an oversized document cannot make the validator slow.</p>

<h2>Refused on purpose</h2>
<ul>
  <li>Keys named <code>code</code>, <code>script</code>, <code>eval</code>, <code>function</code>, <code>src</code>, <code>href</code>, <code>onload</code>, <code>onclick</code>, <code>html</code> or <code>innerHTML</code>, at any depth.</li>
  <li>Strings beginning <code>javascript:</code>, <code>data:</code> or <code>vbscript:</code>.</li>
  <li>Functions of any kind.</li>
  <li>Non-finite numbers (NaN, Infinity) where a number is expected.</li>
</ul>

<h2>A complete example</h2>
${code(`{
  "version": 1,
  "seed": 2024,
  "theme": "light",
  "canvas": { "width": 640, "height": 400 },
  "elements": [
    { "type": "rect", "x": 0, "y": 0, "w": 1, "h": 1, "stroke": "grid", "weight": 1 },
    { "type": "random-dots", "count": 900, "fill": "accent", "radius": [1, 4] }
  ]
}`)}
<p>Each element is described on the <a href="/docs/elements.html">elements page</a>.</p>
`,
  },
  {
    path: "/docs/elements.html",
    title: "Elements",
    description: "The five p5loom element types, with live examples and their fields.",
    demos: true,
    body: `
<h1>Elements</h1>
<p class="lede">There are ${ELEMENT_TYPES.length} element types: ${ELEMENT_TYPES.map((t) => `<code>${t}</code>`).join(", ")}. Each one below has a live example.</p>

<h2>circle</h2>
<p>A filled or outlined circle. <code>x</code> and <code>y</code> are the centre, <code>r</code> is the radius as a fraction of the smaller canvas side.</p>
<table><thead><tr><th>Field</th><th>Meaning</th></tr></thead><tbody>
  <tr><td><code>x</code>, <code>y</code></td><td>Centre, normalised 0 to 1.</td></tr>
  <tr><td><code>r</code></td><td>Radius, normalised 0 to 1 of the smaller side.</td></tr>
  <tr><td><code>fill</code>, <code>stroke</code>, <code>weight</code></td><td>Token names and outline width (0 to 64 px).</td></tr>
</tbody></table>
${demo("hello-circle", "circle: one accent circle.")}

<h2>rect</h2>
<p>A rectangle from its top-left corner, with size as fractions of the canvas.</p>
<table><thead><tr><th>Field</th><th>Meaning</th></tr></thead><tbody>
  <tr><td><code>x</code>, <code>y</code></td><td>Top-left corner, normalised.</td></tr>
  <tr><td><code>w</code>, <code>h</code></td><td>Width and height, normalised.</td></tr>
  <tr><td><code>fill</code>, <code>stroke</code>, <code>weight</code></td><td>As for circle.</td></tr>
</tbody></table>
${demo("bars", "rect: six bars and a baseline line.")}

<h2>line</h2>
<p>A polyline through <code>points</code>. Each point is a pair of normalised coordinates. Lines are always stroked; the colour defaults to <code>fg</code>.</p>
<table><thead><tr><th>Field</th><th>Meaning</th></tr></thead><tbody>
  <tr><td><code>points</code></td><td>2 or more pairs <code>[x, y]</code>.</td></tr>
  <tr><td><code>stroke</code>, <code>weight</code></td><td>Colour token and width in pixels.</td></tr>
</tbody></table>
${demo("grid-lines", "line: three grid lines and one accent series.")}

<h2>scatter</h2>
<p>Points drawn as small circles. Use it for data. The radius is in pixels, not a fraction, so dots stay readable on any canvas size.</p>
<table><thead><tr><th>Field</th><th>Meaning</th></tr></thead><tbody>
  <tr><td><code>data</code></td><td>1 or more pairs <code>[x, y]</code>, normalised.</td></tr>
  <tr><td><code>r</code></td><td>Dot radius in pixels, 0 to 100. Default 3.</td></tr>
  <tr><td><code>fill</code></td><td>Token. Default accent.</td></tr>
</tbody></table>
${demo("scatter-trend", "scatter with a trend line in muted ink.")}

<h2>random-dots</h2>
<p>A number of dots placed by the spec's seed. Positions and radii come from the seeded generator, so they are the same every time the seed is the same. Changing the seed moves the dots and nothing else.</p>
<table><thead><tr><th>Field</th><th>Meaning</th></tr></thead><tbody>
  <tr><td><code>count</code></td><td>Integer 1 to ${MAX_POINTS.toLocaleString("en-GB")}.</td></tr>
  <tr><td><code>radius</code></td><td><code>[min, max]</code> in pixels, each 0 to 100. Default <code>[1, 3]</code>.</td></tr>
  <tr><td><code>fill</code></td><td>Token. Default accent.</td></tr>
</tbody></table>
${demo("random-field", "random-dots: 900 dots from seed 2024.")}

<h2>Drawing order</h2>
<p>The background is painted first, then each element in array order. A later element covers an earlier one. There is no z-index: reorder the array instead.</p>
`,
  },
  {
    path: "/docs/themes.html",
    title: "Themes and contrast",
    description: "The colour tokens, both themes, and the contrast ratios the library tests for.",
    demos: true,
    body: `
<h1>Themes and contrast</h1>
<p class="lede">A theme is a table of five colours, one per token. Specs name tokens; they never name colours. Switching theme changes colours only. Positions, sizes and the random sequence stay exactly the same.</p>

<h2>The tokens</h2>
<table>
  <thead><tr><th>Token</th><th>Light</th><th>Dark</th><th>Used for</th></tr></thead>
  <tbody>
    <tr><td><code>bg</code></td><td>${swatch("light", "bg")} ${THEMES.light.bg}</td><td>${swatch("dark", "bg")} ${THEMES.dark.bg}</td><td>Background, and the fill of a full-canvas rect.</td></tr>
    <tr><td><code>fg</code></td><td>${swatch("light", "fg")} ${THEMES.light.fg}</td><td>${swatch("dark", "fg")} ${THEMES.dark.fg}</td><td>Default line colour and primary ink.</td></tr>
    <tr><td><code>accent</code></td><td>${swatch("light", "accent")} ${THEMES.light.accent}</td><td>${swatch("dark", "accent")} ${THEMES.dark.accent}</td><td>The thing you want to notice. Default for fills.</td></tr>
    <tr><td><code>muted</code></td><td>${swatch("light", "muted")} ${THEMES.light.muted}</td><td>${swatch("dark", "muted")} ${THEMES.dark.muted}</td><td>Secondary ink: trend lines, context.</td></tr>
    <tr><td><code>grid</code></td><td>${swatch("light", "grid")} ${THEMES.light.grid}</td><td>${swatch("dark", "grid")} ${THEMES.dark.grid}</td><td>Guide lines and frames. Decorative, so it is held to a lower bar.</td></tr>
  </tbody>
</table>

<h2>Measured contrast</h2>
<p>These ratios are computed from the table above by the library's own WCAG code. The test suite fails the build if one drops below its bar.</p>
<table>
  <thead><tr><th>Pair</th><th>Light</th><th>Dark</th><th>Bar</th></tr></thead>
  <tbody>
    <tr><td>fg on bg (body text)</td><td>${ratio("light", ["bg", "fg"])}:1</td><td>${ratio("dark", ["bg", "fg"])}:1</td><td>4.5:1</td></tr>
    <tr><td>muted on bg (secondary text)</td><td>${ratio("light", ["bg", "muted"])}:1</td><td>${ratio("dark", ["bg", "muted"])}:1</td><td>4.5:1</td></tr>
    <tr><td>accent on bg (graphics)</td><td>${ratio("light", ["bg", "accent"])}:1</td><td>${ratio("dark", ["bg", "accent"])}:1</td><td>3:1</td></tr>
  </tbody>
</table>

<h2>Demo: the same spec in both themes</h2>
<p>Both pictures below use one spec with <code>theme</code> switched. Their shapes match pixel for pixel; only colours differ.</p>
<div class="pair-demo">
  ${demo("dark-poster", "dark theme.")}
</div>
<p>Use the theme button at the top of the page to see the whole site switch too. The site uses the same tokens.</p>

<h2>Adding a theme</h2>
<p>Themes are defined in <code>src/theme.js</code>. A new theme must define all five tokens as six-digit hex colours. The test suite checks each token exists and meets the contrast bars, so a theme that is hard to read cannot be added quietly.</p>
`,
  },
  {
    path: "/docs/accessibility.html",
    title: "Accessibility",
    description: "What p5loom does for screen readers, contrast, motion and keyboard users, and what it leaves to you.",
    body: `
<h1>Accessibility</h1>
<p class="lede">A chart that is only a picture tells a sighted reader something and tells everyone else nothing. p5loom gives every picture a text alternative built from the spec, and holds its colours to contrast ratios.</p>

<h2>What the library does</h2>
<ul>
  <li><strong>Role and label.</strong> The canvas gets <code>role="img"</code> and an <code>aria-label</code> that is the picture's description, for example "Visualization 640 by 400 pixels, light theme: 1 line element, 1 scatter element, 12 generated dots."</li>
  <li><strong>Visible-to-screen-readers caption.</strong> The same description is also placed in a <code>figcaption</code> that is hidden from sight but read by assistive technology, so readers that skip images still get it.</li>
  <li><strong>Counts, not claims.</strong> The description says what is drawn. It does not say what it means. Describing the meaning of data is your job, because only you know what the data is.</li>
  <li><strong>Contrast.</strong> Body text is held to 4.5:1 and graphics to 3:1 in both themes. See <a href="/docs/themes.html">the measured ratios</a>.</li>
  <li><strong>Motion.</strong> Pictures are drawn once. Nothing animates, so there is nothing to pause for reduced-motion users. The site also honours the reduced-motion setting for its own transitions.</li>
  <li><strong>Resolution.</strong> The canvas is drawn at up to 2x device pixel density, so lines stay sharp on high-density screens without costing a 4x canvas.</li>
</ul>

<h2>What you still need to do</h2>
<ul>
  <li>Put the important numbers in the page text, next to the picture. A description of counts is not a data table.</li>
  <li>Give the figure a heading that says what it is about, and a sentence that says what to notice.</li>
  <li>If a picture carries information only in colour, add a second cue: a label, a pattern or a shape. The library gives you two colours that are distinct from each other, not a legend.</li>
  <li>Test your page with a screen reader before you ship it. The library's text alternatives are checked by tests; how they read aloud in your layout is not.</li>
</ul>

<h2>Keyboard</h2>
<p>The site and the playground are fully keyboard operable. Every control is a real button, link or field, and focus is visible. The playground's editor is a plain text area, so standard editing keys work.</p>
`,
  },
  {
    path: "/docs/api.html",
    title: "API",
    description: "The exported functions of p5loom: mount, validateSpec, buildPlan, describePlan, the random generator and the theme helpers.",
    body: `
<h1>API</h1>
<p class="lede">Everything is exported from <code>index.js</code>, plus the modules below for finer use. There are no classes to construct.</p>

<h2>mount(element, spec, { p5 })</h2>
<p>Validates the spec, builds the plan, and draws it into a new <code>figure</code> appended to <code>element</code>. Returns a handle.</p>
<table><thead><tr><th>Argument</th><th>Meaning</th></tr></thead><tbody>
  <tr><td><code>element</code></td><td>A DOM element to append the picture to.</td></tr>
  <tr><td><code>spec</code></td><td>A spec object. Refused with a list of problems if invalid.</td></tr>
  <tr><td><code>{ p5 }</code></td><td>The p5 constructor. Required; there is no global lookup.</td></tr>
</tbody></table>
<p>The handle has three properties:</p>
<ul>
  <li><code>plan</code>: the drawing plan, see <code>buildPlan</code>.</li>
  <li><code>description</code>: the text alternative.</li>
  <li><code>destroy()</code>: removes the picture and its caption.</li>
</ul>
<p>It throws a <code>TypeError</code> with a <code>message</code> that lists every problem when the spec is invalid. Call it from the browser: it needs a document.</p>

<h2>validateSpec(spec)</h2>
<p>Returns an array of problem strings. Empty means valid. It never throws, even for junk input, so it is safe to call on untrusted data.</p>
${code(`validateSpec({ version: 1, seed: -1, canvas: { width: 8, height: 8 }, elements: [] });
// [ "seed: must be an integer from 0 to 4294967295",
//   "canvas.width: integer from 16 to 4096",
//   "canvas.height: integer from 16 to 4096" ]`)}

<h2>assertValidSpec(spec)</h2>
<p>Returns the spec if valid, otherwise throws a <code>TypeError</code>. The error has a <code>problems</code> array.</p>

<h2>buildPlan(spec)</h2>
<p>Pure. Validates the spec and returns <code>{ width, height, themeName, theme, ops }</code>, where <code>ops</code> is the ordered list of drawing operations in pixels. The same spec always gives the same plan, so you can test a picture without a browser.</p>
${code(`buildPlan(spec).ops[0];
// { op: "background", colour: "#fbfaf7" }`)}

<h2>describePlan(plan, spec)</h2>
<p>Returns the sentence used as the text alternative. It counts elements by type and adds the number of generated dots.</p>

<h2>createRng(seed)</h2>
<p>The seeded generator the library uses. Returns <code>next()</code> (a number from 0 up to but not including 1), <code>range(min, max)</code> and <code>int(min, max)</code>. Exposed so your own code can draw the same random numbers as a spec.</p>

<h2>Themes</h2>
<ul>
  <li><code>THEMES</code>: the two theme tables, keyed <code>light</code> and <code>dark</code>.</li>
  <li><code>TOKENS</code>: the five token names.</li>
  <li><code>resolveTheme(name)</code>: a copy of a theme table. Throws for an unknown name.</li>
  <li><code>contrast(a, b)</code>, <code>luminance(hex)</code>, <code>parseHex(hex)</code>: WCAG helpers.</li>
</ul>

<h2>Policy</h2>
<ul>
  <li><code>MAX_SPEC_BYTES</code>, <code>MAX_ELEMENTS</code>, <code>MAX_POINTS</code>: the limits in the <a href="/docs/spec.html">spec reference</a>.</li>
  <li><code>sandboxCsp(scriptSrc)</code>: the Content-Security-Policy string for a sandboxed frame. Reserved for a future code mode. Not used by the spec renderer.</li>
</ul>

<h2>Import paths</h2>
${code(`import { mount, validateSpec, buildPlan, describePlan } from "p5loom";
import { createRng } from "p5loom/rng";
import { THEMES, contrast } from "p5loom/theme";`)}
<p>Subpath imports are <code>spec</code>, <code>plan</code>, <code>theme</code>, <code>rng</code> and <code>policy</code>. Until the package is on npm, import from the <code>src/</code> files directly.</p>
`,
  },
  {
    path: "/docs/examples.html",
    title: "Examples",
    description: "Six worked examples: each one is a real spec you can open in the playground or copy.",
    demos: true,
    body: `
<h1>Examples</h1>
<p class="lede">Each example is a complete spec. Open one in the playground to change it, or copy the JSON.</p>
<div class="examples">
${EXAMPLES.map(
  (e) => `  <article class="example">
    ${demo(e.id, e.title)}
    <div>
      <h2>${esc(e.title)}</h2>
      <p>${esc(e.summary)}</p>
      <p class="teaches">Shows: ${e.teaches.map(esc).join(", ")}.</p>
      <p><a class="btn ghost small" href="/playground.html#example=${e.id}">Open in playground</a> <a href="/examples/${e.id}.json">View JSON</a></p>
    </div>
  </article>`,
).join("\n")}
</div>
`,
  },
  {
    path: "/playground.html",
    title: "Playground",
    description: "Edit a p5loom spec and see the picture, its description and every validation problem as you type.",
    demos: true,
    modules: ["/assets/playground.js"],
    body: `
<h1>Playground</h1>
<p class="lede">Edit the spec on the left. The picture on the right is drawn by the same library you would use in your page. Problems are listed as you type. Nothing you write leaves the page.</p>
<div class="playground">
  <section class="pg-edit" aria-labelledby="pg-spec-label">
    <div class="pg-toolbar">
      <label id="pg-spec-label" for="pg-example">Example</label>
      <select id="pg-example"><option value="">Loading examples…</option></select>
      <button type="button" id="pg-theme" class="ghost small">Switch theme</button>
      <button type="button" id="pg-format" class="ghost small">Format</button>
      <button type="button" id="pg-reset" class="ghost small">Reset</button>
      <button type="button" id="pg-share" class="ghost small">Copy share link</button>
    </div>
    <textarea id="pg-spec" spellcheck="false" aria-describedby="pg-status" rows="24"></textarea>
    <div id="pg-status" class="pg-status" role="status" aria-live="polite"></div>
    <ul id="pg-problems" class="pg-problems" aria-label="Problems in the spec"></ul>
  </section>
  <section class="pg-view" aria-labelledby="pg-view-h">
    <h2 id="pg-view-h">Picture</h2>
    <div id="pg-stage" class="pg-stage"></div>
    <p id="pg-desc" class="pg-desc"></p>
    <dl class="pg-facts">
      <div><dt>Drawing operations</dt><dd id="pg-ops">–</dd></div>
      <div><dt>Generated dots</dt><dd id="pg-dots">–</dd></div>
      <div><dt>Spec size</dt><dd id="pg-bytes">–</dd></div>
    </dl>
  </section>
</div>
<p class="pg-note">The spec is saved in the URL only when you press Copy share link. The fragment after the # is never sent to the server.</p>
`,
  },
  {
    path: "/docs/security.html",
    title: "Security model",
    description: "Why a p5loom spec cannot run code, what is refused, what the site sends, and what is still open.",
    body: `
<h1>Security model</h1>
<p class="lede">A spec is data. Data can be stored, shared and generated by a model without someone reviewing each one, so the library is built to refuse anything that would make a spec behave like a program.</p>

<h2>What a spec cannot do</h2>
<ul>
  <li>Contain a function, a script or a reference to one. Keys named <code>code</code>, <code>script</code>, <code>eval</code>, <code>function</code>, <code>src</code>, <code>href</code>, <code>html</code>, <code>innerHTML</code> and the <code>on…</code> event names are refused at any depth.</li>
  <li>Contain a string that starts <code>javascript:</code>, <code>data:</code> or <code>vbscript:</code>.</li>
  <li>Set colours. Only tokens, so no CSS value or URL can reach the page through a colour.</li>
  <li>Exceed the size, element or point limits. These are checked before the spec is walked, so a hostile document costs little to refuse.</li>
  <li>Reach the network. The library makes no requests and the site's Content-Security-Policy allows none from a picture.</li>
</ul>

<h2>How the library draws</h2>
<p>The spec becomes a plan of numbers and token names. Only then does the p5 adapter run, and it calls p5 drawing functions with numbers and colours from the theme table. The description is set as text content, never as HTML.</p>

<h2>The site</h2>
<ul>
  <li>Every page loads its scripts from the same origin, plus the pinned p5.js build on cdnjs. There are no inline scripts and no inline event handlers, so the Content-Security-Policy can stay strict.</li>
  <li>The playground runs the same library as your page and sends nothing anywhere. Spec text is written into the editor with text APIs, never as markup.</li>
  <li>Share links put the spec in the URL fragment. Browsers do not send fragments to servers, so the site does not receive what you share.</li>
  <li>No cookies, no analytics and no accounts.</li>
</ul>

<h2>Open items</h2>
<ul>
  <li>A code mode, where a sketch is run, is not built. If it is, it will run in a sandboxed frame with the <code>sandboxCsp</code> policy and no network. Until then, the library does not execute anything you give it.</li>
  <li>The p5.js build is pinned to 1.11.3 by URL. Updating it is a deliberate change, reviewed like any dependency.</li>
  <li>The package is not yet published, so there is no supply chain to audit beyond the repository.</li>
</ul>

<h2>Reporting a problem</h2>
<p>Report security problems to the Dawnshift maintainers privately, not in a public issue. Include a spec that reproduces the problem, if you can.</p>
`,
  },
  {
    path: "/docs/roadmap.html",
    title: "Roadmap",
    description: "What p5loom does today, what is planned, and the Rust performance work that is gated on measurements.",
    body: `
<h1>Roadmap</h1>
<p class="lede">What exists, what is next, and what is deliberately not yet built. Items move down this page only when they ship.</p>

<h2>Shipped</h2>
<ul>
  <li>Spec version 1 with five element types.</li>
  <li>Light and dark themes with measured contrast.</li>
  <li>Seeded random generation.</li>
  <li>Validation with a complete list of problems.</li>
  <li>Text alternatives for every picture.</li>
  <li>This documentation site, with a playground that runs the library itself.</li>
</ul>

<h2>Next</h2>
<ul>
  <li>Publish to npm, then remove the private flag from the package.</li>
  <li>Text labels and axis ticks as element types, so charts need no separate caption.</li>
  <li>A legend element that pairs tokens with words, to help colour-only pictures.</li>
  <li>A React wrapper that mounts and destroys a picture with component lifecycle.</li>
</ul>

<h2>Later, and only if measurement justifies it</h2>
<p>The plan builder is plain JavaScript. A Rust core is a candidate for speed on very large specs, and the route is known:</p>
<ul>
  <li><strong>In the browser:</strong> WebAssembly, built with wasm-bindgen, for the plan builder only. p5 stays in JavaScript.</li>
  <li><strong>In Node or Electron:</strong> a native addon through napi-rs, for batch rendering on a server.</li>
  <li><strong>The gate:</strong> the Rust build ships only if a benchmark on real specs beats the JavaScript plan builder by a margin that matters, including the cost of loading the module. If it does not, it stays out.</li>
</ul>
<p>Nothing in Rust has been written. Today the library is JavaScript end to end.</p>

<h2>Not planned</h2>
<ul>
  <li>Running arbitrary sketches inside the spec format. Code mode, if it comes, is a separate sandboxed feature.</li>
  <li>Raw colours in specs. Tokens are the point.</li>
</ul>
`,
  },
];

export const NOT_FOUND = {
  path: "/404.html",
  title: "Page not found",
  description: "This page does not exist on p5loom.",
  body: `
<h1>Page not found</h1>
<p class="lede">The page you asked for is not here. Start from the <a href="/">overview</a>, or try the <a href="/playground.html">playground</a>.</p>
`,
};
