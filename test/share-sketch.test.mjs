import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { encodeValues, decodeValues, paramName, PARAM_PREFIX } from "../src/share.js";
import { sketchFrameDocument, assertSketch, SKETCH_MAX_BYTES, P5_SRC } from "../src/sketch.js";
import { sandboxCsp } from "../src/policy.js";

const demo = () => JSON.parse(readFileSync(new URL("../examples/controls-demo.json", import.meta.url), "utf8"));
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// ---- share links ----

test("the share parameter name is prefixed and the key is checked", () => {
  assert.equal(paramName("hero"), `${PARAM_PREFIX}hero`);
  for (const bad of ["Hero", "1st", "a b", "", "x".repeat(40), 7]) assert.throws(() => paramName(bad), TypeError, String(bad));
});

test("only the values that differ from the defaults are written, and no change means no token", () => {
  const s = demo();
  assert.equal(encodeValues(s, {}), "");
  assert.equal(encodeValues(s, { dots: 220 }), "", "the default value is not written");
  const token = encodeValues(s, { dots: 50, horizon: false });
  assert.match(token, /^[A-Za-z0-9_-]+$/, "the token is URL-safe base64");
  assert.deepEqual(decodeValues(s, token), { dots: 50, horizon: false });
});

test("a token round-trips through the same values", () => {
  const s = demo();
  const values = { seed: 42, dots: 310, radius: 0.35, tint: "fg", horizon: false, theme: "light" };
  assert.deepEqual(decodeValues(s, encodeValues(s, values)), values);
});

test("a hand-edited or hostile token can only set values the controls allow", () => {
  const s = demo();
  assert.deepEqual(decodeValues(s, b64({ dots: 99999, tint: "#ff00ff", nope: 1, horizon: "yes" })), { dots: 600, tint: "muted", horizon: true });
  assert.deepEqual(decodeValues(s, "%%%not-base64"), {});
  assert.deepEqual(decodeValues(s, b64([1, 2])), {});
  assert.deepEqual(decodeValues(s, b64("text")), {});
  assert.deepEqual(decodeValues(s, undefined), {});
  assert.deepEqual(decodeValues(s, "x".repeat(5000)), {}, "oversized tokens are ignored");
});

// ---- sketches (code mode) ----

test("a sketch must be non-empty, under the size limit, and must not end its own script", () => {
  assert.throws(() => assertSketch("   "), TypeError);
  assert.throws(() => assertSketch("x".repeat(SKETCH_MAX_BYTES + 1)), RangeError);
  assert.throws(() => assertSketch("let a = 1;</script><script>alert(1)"), /'<\/script' is not allowed/);
  assert.equal(assertSketch("function setup() {}"), "function setup() {}");
});

test("every sketch file in examples/sketches passes the check", () => {
  const dir = new URL("../examples/sketches/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".js"));
  assert.ok(files.length >= 1);
  for (const f of files) assert.doesNotThrow(() => assertSketch(readFileSync(new URL(f, dir), "utf8")), f);
});

test("the frame page loads p5 and the sketch from this origin only, with no inline script and no network", () => {
  const html = sketchFrameDocument({ title: "rings", scriptUrl: "/sketches/rings/sketch.js", theme: "dark" });
  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html)[1];
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /script-src https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/p5\.js\/1\.11\.3\/p5\.min\.js 'self'/);
  assert.match(csp, /connect-src 'none'/);
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/, "no inline scripts");
  assert.doesNotMatch(html, /<script>[^<]/, "no inline script in the document");
  assert.match(html, /<script src="\/sketches\/rings\/sketch\.js"><\/script>/);
  assert.match(html, /<link rel="stylesheet" href="\/sketches\/frame\.css">/);
  assert.match(html, /<meta name="description"/, "the site check needs a description on every page");
  assert.ok(html.includes(P5_SRC));
});

test("the frame refuses a theme it does not know, and a script path that is not plain", () => {
  assert.throws(() => sketchFrameDocument({ theme: "neon", scriptUrl: "/x.js" }), /theme: light or dark/);
  assert.throws(() => sketchFrameDocument({ scriptUrl: "/x.js\"><script>" }), /plain relative path/);
  assert.throws(() => sketchFrameDocument({ scriptUrl: "../../etc/x.js" }), /plain relative path/);
});

test("the sandbox policy takes an optional nonce, and without one has none", () => {
  assert.equal(sandboxCsp(P5_SRC).includes("nonce"), false);
  assert.ok(sandboxCsp(P5_SRC, "n1").includes("'nonce-n1'"));
});
