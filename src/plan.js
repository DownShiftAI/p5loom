// The drawing plan: a pure function from a valid spec and its control values to a flat list of draw operations in
// pixels. No p5, no DOM. The p5 adapter and the SVG writer only replay these operations, so the same spec and values
// always give the same plan, and the plan can be tested without a browser.

import { assertValidSpec, validateSpec } from "./spec.js";
import { createRng } from "./rng.js";
import { resolveTheme } from "./theme.js";
import { resolveSpec } from "./controls.js";
import { planChart } from "./chart.js";

export function buildPlan(spec, values = {}) {
  assertValidSpec(spec);
  const resolved = resolveSpec(spec, values);
  const problems = validateSpec(resolved);
  if (problems.length) throw new TypeError(`control values give an invalid picture:\n- ${problems.join("\n- ")}`);

  const { width, height } = resolved.canvas;
  const themeName = resolved.theme ?? "light";
  const theme = resolveTheme(themeName);
  const rng = createRng(resolved.seed);
  const px = (x) => x * width;
  const py = (y) => y * height;
  const ops = [{ op: "background", colour: theme.bg }];

  for (const el of resolved.elements) {
    const fill = el.fill ? theme[el.fill] : undefined;
    const stroke = el.stroke ? theme[el.stroke] : undefined;
    const weight = el.weight ?? 1;
    switch (el.type) {
      case "circle":
        ops.push({ op: "circle", x: px(el.x), y: py(el.y), d: 2 * el.r * Math.min(width, height), fill, stroke, weight });
        break;
      case "rect":
        ops.push({ op: "rect", x: px(el.x), y: py(el.y), w: el.w * width, h: el.h * height, fill, stroke, weight });
        break;
      case "line":
        ops.push({ op: "line", points: el.points.map(([x, y]) => [px(x), py(y)]), stroke: stroke ?? theme.fg, weight });
        break;
      case "scatter":
        for (const [x, y] of el.data) {
          ops.push({ op: "circle", x: px(x), y: py(y), d: 2 * (el.r ?? 3), fill: fill ?? theme.accent, stroke: undefined, weight: 0 });
        }
        break;
      case "axes":
      case "bars":
      case "points":
      case "path":
      case "text":
      case "legend":
        for (const op of planChart(el, resolved.data ?? {}, width, height, theme)) ops.push(op);
        break;
      case "random-dots": {
        const [rmin, rmax] = el.radius ?? [1, 3];
        for (let i = 0; i < el.count; i += 1) {
          const x = rng.next();
          const y = rng.next();
          const r = rng.range(rmin, rmax);
          ops.push({ op: "circle", x: px(x), y: py(y), d: 2 * r, fill: fill ?? theme.accent, stroke: undefined, weight: 0 });
        }
        break;
      }
    }
  }
  return { width, height, themeName, theme, seed: resolved.seed, elements: resolved.elements, ops };
}
