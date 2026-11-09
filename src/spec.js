// The spec format (version 1). A spec is plain JSON. validateSpec returns a list of problems, or an empty list.
// Coordinates are normalised: 0 is the left or top edge, 1 is the right or bottom edge. Colours are theme tokens.
// Controls (optional) let a field follow an interactive input: see controls.js.

import { TOKENS } from "./theme.js";
import { assertNoCode, assertSize, MAX_ELEMENTS, MAX_POINTS } from "./policy.js";
import { BINDABLE, THEME_NAMES, MAX_SEED, isBinding, checkBinding, validateControls } from "./controls.js";
import { CHART_TYPES, validateData, checkChart } from "./chart.js";

export const SPEC_VERSION = 1;
export const ELEMENT_TYPES = ["circle", "rect", "line", "scatter", "random-dots"];
const ALL_TYPES = [...ELEMENT_TYPES, ...CHART_TYPES];

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

function checkColour(problems, value, path, byId) {
  if (value === undefined) return;
  if (isBinding(value)) return checkBinding(problems, value, path, { kind: "token" }, byId);
  if (!TOKENS.includes(value)) problems.push(`${path}: "${value}" is not a theme token (${TOKENS.join(", ")})`);
}

// A number field: either a literal inside the rule's range, or a binding to a slider whose range fits.
function checkNumber(problems, value, path, rule, byId, message) {
  if (isBinding(value)) return checkBinding(problems, value, path, rule, byId);
  const ok = isNum(value) && value >= rule.lo && value <= rule.hi && (!rule.int || Number.isInteger(value));
  if (!ok) problems.push(message ?? `${path}: ${rule.int ? "needs an integer" : "must be"} from ${rule.lo} to ${rule.hi}`);
}

function checkElement(problems, el, path, byId, tables) {
  if (!el || typeof el !== "object" || Array.isArray(el)) {
    problems.push(`${path}: must be an object`);
    return;
  }
  if (!ALL_TYPES.includes(el.type)) {
    problems.push(`${path}.type: "${el.type}" is not one of ${ALL_TYPES.join(", ")}`);
    return;
  }
  if (el.when !== undefined) {
    if (typeof el.when !== "string" || !byId[el.when]) problems.push(`${path}.when: must name a toggle control`);
    else if (byId[el.when].type !== "toggle") problems.push(`${path}.when: control "${el.when}" is not a toggle`);
  }
  if (CHART_TYPES.includes(el.type)) {
    checkChart(problems, el, path, tables, {
      token: (v, p) => (v === undefined ? problems.push(`${p}: a theme token is needed`) : checkColour(problems, v, p, byId)),
      number: (v, p, lo, hi, msg, int) => checkNumber(problems, v, p, { kind: "number", lo, hi, int: Boolean(int) }, byId, msg),
    });
    return;
  }
  const rules = BINDABLE[el.type];
  checkColour(problems, el.fill, `${path}.fill`, byId);
  checkColour(problems, el.stroke, `${path}.stroke`, byId);
  if (el.weight !== undefined) checkNumber(problems, el.weight, `${path}.weight`, rules.weight ?? { kind: "number", lo: 0, hi: 64 }, byId, `${path}.weight: must be a number from 0 to 64`);
  switch (el.type) {
    case "circle":
      checkNumber(problems, el.x, `${path}.x`, rules.x, byId);
      checkNumber(problems, el.y, `${path}.y`, rules.y, byId);
      checkNumber(problems, el.r, `${path}.r`, rules.r, byId);
      break;
    case "rect":
      for (const k of ["x", "y", "w", "h"]) checkNumber(problems, el[k], `${path}.${k}`, rules[k], byId);
      break;
    case "line":
      if (!Array.isArray(el.points) || el.points.length < 2 || el.points.length > MAX_POINTS) {
        problems.push(`${path}.points: needs 2 to ${MAX_POINTS} points`);
      } else {
        el.points.forEach((p, i) => {
          if (!Array.isArray(p) || p.length !== 2 || !isNum(p[0]) || !isNum(p[1]) || p[0] < 0 || p[0] > 1 || p[1] < 0 || p[1] > 1) {
            problems.push(`${path}.points[${i}]: must be [x, y] from 0 to 1`);
          }
        });
      }
      break;
    case "scatter":
      if (!Array.isArray(el.data) || el.data.length === 0 || el.data.length > MAX_POINTS) {
        problems.push(`${path}.data: needs 1 to ${MAX_POINTS} points`);
      } else {
        el.data.forEach((p, i) => {
          if (!Array.isArray(p) || p.length !== 2 || !isNum(p[0]) || !isNum(p[1]) || p[0] < 0 || p[0] > 1 || p[1] < 0 || p[1] > 1) {
            problems.push(`${path}.data[${i}]: must be [x, y] from 0 to 1`);
          }
        });
      }
      if (el.r !== undefined) checkNumber(problems, el.r, `${path}.r`, rules.r, byId, `${path}.r: must be from 0 to 100 pixels`);
      break;
    case "random-dots":
      checkNumber(problems, el.count, `${path}.count`, rules.count, byId);
      if (el.radius !== undefined && (!Array.isArray(el.radius) || el.radius.length !== 2 || !el.radius.every((n) => isNum(n) && n > 0 && n <= 100))) {
        problems.push(`${path}.radius: needs [min, max] pixels from 0 to 100`);
      }
      break;
  }
}

// Returns an array of problem strings. An empty array means the spec is valid.
export function validateSpec(spec) {
  const problems = [];
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) return ["spec: must be an object"];
  try {
    assertNoCode(spec);
    assertSize(JSON.stringify(spec));
  } catch (e) {
    return [e.message];
  }
  if (spec.version !== SPEC_VERSION) problems.push(`version: must be ${SPEC_VERSION}`);
  const byId = validateControls(spec, problems);
  const tables = validateData(spec, problems);
  if (isBinding(spec.seed)) {
    checkBinding(problems, spec.seed, "seed", { kind: "seed" }, byId);
  } else if (!Number.isInteger(spec.seed) || spec.seed < 0 || spec.seed > MAX_SEED) {
    problems.push(`seed: must be an integer from 0 to ${MAX_SEED}`);
  }
  if (isBinding(spec.theme)) {
    checkBinding(problems, spec.theme, "theme", { kind: "theme" }, byId);
  } else if (spec.theme !== undefined && !THEME_NAMES.includes(spec.theme)) {
    problems.push(`theme: must be one of ${THEME_NAMES.join(", ")}`);
  }
  const c = spec.canvas;
  if (!c || typeof c !== "object") {
    problems.push("canvas: required");
  } else {
    if (!Number.isInteger(c.width) || c.width < 16 || c.width > 4096) problems.push("canvas.width: integer from 16 to 4096");
    if (!Number.isInteger(c.height) || c.height < 16 || c.height > 4096) problems.push("canvas.height: integer from 16 to 4096");
  }
  if (!Array.isArray(spec.elements)) {
    problems.push("elements: must be an array");
  } else {
    if (spec.elements.length > MAX_ELEMENTS) problems.push(`elements: at most ${MAX_ELEMENTS}`);
    spec.elements.slice(0, MAX_ELEMENTS).forEach((el, i) => checkElement(problems, el, `elements[${i}]`, byId, tables));
  }
  return problems;
}

export function assertValidSpec(spec) {
  const problems = validateSpec(spec);
  if (problems.length) {
    const err = new TypeError(`invalid spec:\n- ${problems.join("\n- ")}`);
    err.problems = problems;
    throw err;
  }
  return spec;
}
