// The Dawnshift design tokens, as used on dawnshift.co (dawnshift-website/app/globals.css). Values are the same HSL
// triplets, so the site reads as one family with the company site. Change them here only; the build writes tokens.css.
//
// Dark is the default. Light is the same palette turned over: paper becomes the ink, night becomes the page.

export const DARK = {
  night: "0 0% 0%",
  ink: "228 38% 6%",
  paper: "43 33% 91%",
  fg: "43 33% 91%",
  surface: "228 30% 9%",
  line: "228 24% 15%",
  mute: "230 8% 58%",
  dawn: "39 100% 56%",
  ember: "14 77% 58%",
  "on-dawn": "228 38% 6%",
  hairline: "rgba(255, 255, 255, 0.14)",
};

export const LIGHT = {
  night: "43 30% 95%",
  ink: "228 38% 6%",
  paper: "228 36% 12%",
  fg: "228 36% 12%",
  surface: "0 0% 100%",
  line: "40 14% 82%",
  mute: "228 10% 38%",
  dawn: "24 85% 50%",
  ember: "12 72% 52%",
  "on-dawn": "228 36% 12%",
  hairline: "rgba(0, 0, 0, 0.12)",
};

// Plain HSL-to-hex, so the contrast tests can measure the real colours. HSL in the form "h s% l%".
export function hslToHex(triplet) {
  const [h, s, l] = triplet.trim().split(/\s+/).map((v) => parseFloat(v));
  const sat = s / 100;
  const light = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}
