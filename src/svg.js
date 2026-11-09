// SVG output for a plan. Pure: no p5, no DOM, no browser. The same plan that p5 draws becomes an SVG file, so a picture
// can be saved, embedded in a document, or returned to an AI client without running a browser.

import { describePlan } from "./describe.js";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Two decimals is finer than a pixel at any size the library allows.
const n = (v) => String(Number(v.toFixed(2)));

// Fill and stroke attributes for one op. Colours are theme hex values, never user text.
function paint(op) {
  const fill = op.fill ? `fill="${op.fill}"` : `fill="none"`;
  const stroke = op.stroke && op.weight > 0 ? `stroke="${op.stroke}" stroke-width="${n(op.weight)}"` : `stroke="none"`;
  return `${fill} ${stroke}`;
}

export function renderSvg(plan, description = describePlan(plan)) {
  const { width, height, ops } = plan;
  const parts = [];
  for (const op of ops) {
    if (op.op === "background") {
      parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="${op.colour}"/>`);
    } else if (op.op === "circle") {
      parts.push(`<circle cx="${n(op.x)}" cy="${n(op.y)}" r="${n(op.d / 2)}" ${paint(op)}/>`);
    } else if (op.op === "rect") {
      parts.push(`<rect x="${n(op.x)}" y="${n(op.y)}" width="${n(op.w)}" height="${n(op.h)}" ${paint(op)}/>`);
    } else if (op.op === "text") {
      const anchor = op.align === "center" ? "middle" : op.align === "right" ? "end" : "start";
      parts.push(`<text x="${n(op.x)}" y="${n(op.y)}" font-size="${n(op.size)}" fill="${op.fill}" text-anchor="${anchor}" font-family="sans-serif">${esc(op.text)}</text>`);
    } else if (op.op === "line") {
      const points = op.points.map(([x, y]) => `${n(x)},${n(y)}`).join(" ");
      parts.push(`<polyline points="${points}" fill="none" stroke="${op.stroke}" stroke-width="${n(op.weight)}"/>`);
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(description)}">` +
    `<title>${esc(description)}</title>${parts.join("")}</svg>\n`
  );
}
