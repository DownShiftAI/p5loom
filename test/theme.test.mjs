import { test } from "node:test";
import assert from "node:assert/strict";
import { THEMES, TOKENS, contrast, luminance, parseHex, resolveTheme } from "../src/theme.js";

test("black and white give the WCAG maximum contrast of 21", () => {
  assert.ok(Math.abs(contrast("#000000", "#ffffff") - 21) < 1e-9);
});

test("luminance of white is 1 and of black is 0", () => {
  assert.ok(Math.abs(luminance("#ffffff") - 1) < 1e-9);
  assert.equal(luminance("#000000"), 0);
});

test("contrast is symmetric", () => {
  assert.equal(contrast("#1a1a1a", "#fbfaf7"), contrast("#fbfaf7", "#1a1a1a"));
});

test("every theme defines every token as a hex colour", () => {
  for (const [name, t] of Object.entries(THEMES)) {
    for (const tok of TOKENS) {
      assert.ok(/^#[0-9a-f]{6}$/i.test(t[tok]), `${name}.${tok} is not a hex colour`);
    }
  }
});

test("body text meets WCAG AA (4.5:1) in every theme", () => {
  for (const [name, t] of Object.entries(THEMES)) {
    const ratio = contrast(t.fg, t.bg);
    assert.ok(ratio >= 4.5, `${name}: fg on bg is ${ratio.toFixed(2)}, needs 4.5`);
  }
});

test("accent meets the non-text contrast of 3:1 against the background", () => {
  for (const [name, t] of Object.entries(THEMES)) {
    const ratio = contrast(t.accent, t.bg);
    assert.ok(ratio >= 3, `${name}: accent on bg is ${ratio.toFixed(2)}, needs 3`);
  }
});

test("muted text meets 4.5:1 against the background", () => {
  for (const [name, t] of Object.entries(THEMES)) {
    const ratio = contrast(t.muted, t.bg);
    assert.ok(ratio >= 4.5, `${name}: muted on bg is ${ratio.toFixed(2)}, needs 4.5`);
  }
});

test("resolveTheme returns a copy, not the shared table", () => {
  const t = resolveTheme("light");
  t.bg = "#ff0000";
  assert.notEqual(THEMES.light.bg, "#ff0000");
});

test("unknown theme names are refused with the list", () => {
  assert.throws(() => resolveTheme("neon"), /use one of: light, dark/);
});

test("parseHex refuses short or malformed colours", () => {
  for (const bad of ["#fff", "red", "#gggggg", "123456"]) {
    assert.throws(() => parseHex(bad), TypeError);
  }
});
