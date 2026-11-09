// Theme tokens. A spec never uses raw colours: it names a token, and the theme decides the colour.
// That is what makes light and dark work with no per-sketch changes.

export const TOKENS = ["bg", "fg", "accent", "muted", "grid"];

export const THEMES = {
  light: { bg: "#f6f4ee", fg: "#1a1a1a", accent: "#b85c12", muted: "#5e5e5e", grid: "#dcd8cf" },
  dark: { bg: "#000000", fg: "#f0ebe0", accent: "#ffb020", muted: "#9aa0aa", grid: "#2a2f3a" },
};

function channel(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function parseHex(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new TypeError(`not a 6-digit hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// WCAG relative luminance and contrast ratio.
export function luminance(hex) {
  const [r, g, b] = parseHex(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function resolveTheme(name = "light") {
  const t = THEMES[name];
  if (!t) throw new RangeError(`unknown theme "${name}"; use one of: ${Object.keys(THEMES).join(", ")}`);
  return { ...t };
}
