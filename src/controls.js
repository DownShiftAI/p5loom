// Controls: interactive inputs declared in the spec. A slider, toggle or select lives in spec.controls, and a field of
// an element can follow one with a binding: { "control": "<id>" }. Everything here is pure. The browser renders the
// inputs (index.js), and the MCP server reads them, but the rules and the resolution live in this file.
//
// Rules, in short:
//   - A control has a unique id, a label, and a type: slider (numeric), toggle (boolean) or select (one of some strings).
//   - A binding may only sit on a field that accepts that kind of value, and the control's whole range must fit the
//     field's allowed range. So a slider bound to a unit coordinate must run inside 0 to 1, checked at validation time.
//   - A toggle named in an element's "when" hides that element while it is false.
//   - Values are snapped to the slider's step and clamped to its range, so every resolved value is one the spec allows.

import { TOKENS } from "./theme.js";
import { MAX_POINTS } from "./policy.js";

export const CONTROL_TYPES = ["slider", "toggle", "select"];
export const THEME_NAMES = ["light", "dark"];
export const MAX_CONTROLS = 12;
export const MAX_SEED = 0xffffffff;

const ID_RE = /^[a-z][a-z0-9-]{0,31}$/;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

// Which fields of which element types may follow a control, and the range each must stay inside.
const NUM = (lo, hi, int = false) => ({ kind: "number", lo, hi, int });
const TOKEN = { kind: "token" };
export const BINDABLE = {
  circle: { x: NUM(0, 1), y: NUM(0, 1), r: NUM(0, 1), weight: NUM(0, 64), fill: TOKEN, stroke: TOKEN },
  rect: { x: NUM(0, 1), y: NUM(0, 1), w: NUM(0, 1), h: NUM(0, 1), weight: NUM(0, 64), fill: TOKEN, stroke: TOKEN },
  line: { weight: NUM(0, 64), stroke: TOKEN },
  scatter: { r: NUM(0.01, 100), fill: TOKEN },
  "random-dots": { count: NUM(1, MAX_POINTS, true), fill: TOKEN },
};

// A binding is an object whose only key is "control".
export function isBinding(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 1 && typeof v.control === "string";
}

// Checks spec.controls. Returns a map of id -> control for the controls that are well formed. Problems are pushed.
export function validateControls(spec, problems) {
  const byId = {};
  if (spec.controls === undefined) return byId;
  if (!Array.isArray(spec.controls)) {
    problems.push("controls: must be an array");
    return byId;
  }
  if (spec.controls.length > MAX_CONTROLS) problems.push(`controls: at most ${MAX_CONTROLS}`);
  spec.controls.slice(0, MAX_CONTROLS).forEach((c, i) => {
    const p = `controls[${i}]`;
    if (!c || typeof c !== "object" || Array.isArray(c)) {
      problems.push(`${p}: must be an object`);
      return;
    }
    if (typeof c.id !== "string" || !ID_RE.test(c.id)) {
      problems.push(`${p}.id: lowercase letters, digits and hyphens, starting with a letter, up to 32 characters`);
      return;
    }
    if (byId[c.id]) {
      problems.push(`${p}.id: "${c.id}" is used twice`);
      return;
    }
    if (typeof c.label !== "string" || c.label.length < 1 || c.label.length > 80) problems.push(`${p}.label: 1 to 80 characters`);
    if (!CONTROL_TYPES.includes(c.type)) {
      problems.push(`${p}.type: "${c.type}" is not one of ${CONTROL_TYPES.join(", ")}`);
      return;
    }
    if (c.type === "slider") {
      if (!isNum(c.min) || !isNum(c.max) || c.min >= c.max) problems.push(`${p}: a slider needs numeric min and max with min below max`);
      else if (!isNum(c.step) || c.step <= 0 || c.step > c.max - c.min) problems.push(`${p}.step: a positive number no larger than the range`);
      else if (!isNum(c.value) || c.value < c.min || c.value > c.max) problems.push(`${p}.value: must be between min and max`);
    } else if (c.type === "toggle") {
      if (typeof c.value !== "boolean") problems.push(`${p}.value: must be true or false`);
    } else if (!Array.isArray(c.options) || c.options.length < 2 || c.options.length > 12 || !c.options.every((o) => typeof o === "string" && o.length >= 1 && o.length <= 40)) {
      problems.push(`${p}.options: 2 to 12 strings of 1 to 40 characters`);
    } else if (!c.options.includes(c.value)) {
      problems.push(`${p}.value: must be one of the options`);
    }
    byId[c.id] = c;
  });
  return byId;
}

// Checks one binding against what its field accepts. want is a BINDABLE rule, or {kind: "seed" | "theme"}.
export function checkBinding(problems, binding, path, want, byId) {
  const c = byId[binding.control];
  if (!c) {
    problems.push(`${path}: control "${binding.control}" is not defined in controls`);
    return;
  }
  if (want.kind === "number") {
    if (c.type !== "slider") {
      problems.push(`${path}: control "${c.id}" is a ${c.type}; a number field needs a slider`);
      return;
    }
    if (c.min < want.lo || c.max > want.hi) problems.push(`${path}: control "${c.id}" runs from ${c.min} to ${c.max}; the field allows ${want.lo} to ${want.hi}`);
    if (want.int && (!Number.isInteger(c.min) || !Number.isInteger(c.step))) problems.push(`${path}: control "${c.id}" needs whole-number min and step`);
  } else if (want.kind === "seed") {
    if (c.type !== "slider" || !Number.isInteger(c.min) || c.min < 0 || c.max > MAX_SEED || !Number.isInteger(c.step)) {
      problems.push(`${path}: control "${c.id}" must be a whole-number slider from 0 to ${MAX_SEED}`);
    }
  } else if (want.kind === "token") {
    if (c.type !== "select" || !c.options.every((o) => TOKENS.includes(o))) problems.push(`${path}: control "${c.id}" must be a select whose options are all theme tokens`);
  } else if (want.kind === "theme") {
    if (c.type !== "select" || !c.options.every((o) => THEME_NAMES.includes(o))) problems.push(`${path}: control "${c.id}" must be a select whose options are light and dark`);
  }
}

// The value a control takes, given the values the caller supplied. Anything unusable falls back to the default.
export function valueOf(c, values = {}) {
  if (!c) return undefined;
  const raw = Object.prototype.hasOwnProperty.call(values, c.id) ? values[c.id] : c.value;
  if (c.type === "slider") {
    const v = isNum(raw) ? raw : c.value;
    const snapped = c.min + Math.round((v - c.min) / c.step) * c.step;
    const clamped = Math.min(c.max, Math.max(c.min, snapped));
    return Number(clamped.toFixed(10));
  }
  if (c.type === "toggle") return typeof raw === "boolean" ? raw : c.value;
  return c.options.includes(raw) ? raw : c.value;
}

// The default value of every control, keyed by id.
export function controlDefaults(spec) {
  const out = {};
  for (const c of Array.isArray(spec?.controls) ? spec.controls : []) {
    if (c && typeof c.id === "string") out[c.id] = c.value;
  }
  return out;
}

// Turns a spec and control values into the spec that is actually drawn: bindings replaced by their values, hidden
// elements removed, and the controls list dropped. Assumes the spec has been validated.
export function resolveSpec(spec, values = {}) {
  const byId = {};
  for (const c of Array.isArray(spec.controls) ? spec.controls : []) if (c && typeof c.id === "string") byId[c.id] = c;
  const pick = (v) => (isBinding(v) ? valueOf(byId[v.control], values) : v);

  const out = { version: spec.version, seed: pick(spec.seed), canvas: { ...spec.canvas }, elements: [] };
  if (spec.data !== undefined) out.data = spec.data;
  if (spec.theme !== undefined) out.theme = pick(spec.theme);
  for (const el of spec.elements) {
    if (el.when !== undefined && valueOf(byId[el.when], values) === false) continue;
    const copy = {};
    for (const [key, v] of Object.entries(el)) {
      if (key !== "when") copy[key] = pick(v);
    }
    out.elements.push(copy);
  }
  return out;
}
