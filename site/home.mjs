// The home page: the Dawnshift horizon. A headline that rises on load, a sunrise drawn by p5loom itself, and the
// plain facts about the library below it. Numbers come from the library, never typed in here.

import { MAX_POINTS } from "../src/policy.js";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const sunrise = (caption) =>
  `<figure class="demo"><div class="demo-stage" data-demo="sunrise" data-follow-theme role="group" aria-label="${esc(caption)}"></div><figcaption>${esc(caption)}</figcaption></figure>`;

export const HOME = {
  path: "/",
  title: "Overview",
  description: "p5loom turns a plain JSON spec into a themed, seeded, accessible p5.js visualisation.",
  demos: true,
  body: `
<section class="hero" aria-labelledby="hero-title">
  <div class="hero-grid">
    <div class="hero-copy">
      <p class="kicker">Open source. MIT licence. Built on p5.js.</p>
      <h1 id="hero-title"><span class="rise"><span>Describe the picture.</span></span><span class="rise"><span>p5loom draws it.</span></span></h1>
      <p class="lede">A picture is a short JSON spec. The spec is data, not code, so it can be stored, shared and checked before anything draws. Colours are theme tokens, so light and dark just work. Randomness comes from a seed, so a saved spec is a saved picture. Every picture ships with a text description for screen readers.</p>
      <div class="hero-actions">
        <a class="btn" href="/playground.html">Open the playground</a>
        <a class="btn btn-line" href="/docs/getting-started.html">Read the quick start</a>
      </div>
    </div>
    <div class="hero-art">
      ${sunrise("A sunrise drawn from a spec: random dots for stars, a sun on the horizon.")}
    </div>
  </div>
  <div class="horizon-line" aria-hidden="true"></div>
</section>

<section aria-labelledby="why-title">
  <div class="bar"><strong id="why-title">Why a spec</strong><span>Data, not code</span></div>
  <div class="pair">
    <div class="pair-text">
      <p>A spec can be saved, diffed, shared in a link, written by a model, and checked before anything draws. It cannot run code. There is no function, script or URL in it that a browser would act on.</p>
      <p>The library turns a spec into a plan of drawing operations first. Only then does p5.js touch a canvas. The tests check the plan without a browser.</p>
    </div>
    <figure class="demo pair-demo">
      <div class="demo-stage" data-demo="hello-circle" data-follow-theme role="group" aria-label="A single accent circle, drawn from a spec."></div>
      <figcaption>The smallest spec: one circle, one token.</figcaption>
    </figure>
  </div>
</section>

<section aria-labelledby="what-title">
  <div class="bar"><strong id="what-title">What you get</strong><span>Five element types, two themes</span></div>
  <div class="cards">
    <article class="card"><h3>Five element types</h3><p>Circle, rectangle, line, scatter and seeded random dots. Enough for charts, diagrams and generative art, and small enough to read in one sitting.</p></article>
    <article class="card"><h3>Two themes, one layout</h3><p>Light and dark share every coordinate. A theme changes colours only. Body text and accents meet WCAG contrast in both.</p></article>
    <article class="card"><h3>Reproducible</h3><p>A seed fixes the random sequence on every platform. The library never calls Math.random, so a saved spec is a saved picture.</p></article>
    <article class="card"><h3>Accessible by default</h3><p>Each canvas gets a role, a label and a visually hidden caption built from the spec's counts. It says what is there, not what it means.</p></article>
    <article class="card"><h3>Safe to accept from anywhere</h3><p>Specs are validated before use. Code-like keys, function values and script or data URLs are refused. The size is capped at 512 KB.</p></article>
    <article class="card"><h3>No dependencies</h3><p>Plain ES modules. The library needs only p5.js on the page, and the site serves its own fonts.</p></article>
  </div>
</section>

<section aria-labelledby="next-title">
  <div class="bar"><strong id="next-title">Where to go next</strong><span>Up to ${MAX_POINTS.toLocaleString("en-GB")} points a shape</span></div>
  <ul class="next">
    <li><a href="/docs/getting-started.html"><span>Getting started</span><strong>Put a picture on a page in five minutes.</strong></a></li>
    <li><a href="/docs/spec.html"><span>Spec reference</span><strong>Every field, its limits and what it means.</strong></a></li>
    <li><a href="/docs/elements.html"><span>Elements</span><strong>The five element types, each with a live example.</strong></a></li>
    <li><a href="/docs/themes.html"><span>Themes and contrast</span><strong>The tokens, and the contrast ratios the tests hold.</strong></a></li>
    <li><a href="/docs/api.html"><span>API</span><strong>mount, validateSpec, buildPlan and the rest.</strong></a></li>
    <li><a href="/playground.html"><span>Playground</span><strong>Edit a spec and watch the picture change.</strong></a></li>
  </ul>
</section>
`,
};
