// Public entry point.
//   import { mount, validateSpec, buildPlan, describePlan, renderSvg } from "p5loom";
//   const handle = mount(element, spec, { p5, values, shareKey, onChange });
//   handle.set("radius", 0.4);      // moves the control, redraws, announces, and updates the share link
//   handle.destroy();

import { validateSpec, assertValidSpec, SPEC_VERSION, ELEMENT_TYPES } from "./spec.js";
import { buildPlan } from "./plan.js";
import { describePlan } from "./describe.js";
import { replayPlan } from "./p5-adapter.js";
import { controlDefaults, resolveSpec, valueOf } from "./controls.js";
import { renderSvg } from "./svg.js";
import { CHART_TYPES } from "./chart.js";
import { paramName, encodeValues, decodeValues } from "./share.js";
import { sketchFrameDocument, mountSketch, assertSketch, SKETCH_MAX_BYTES } from "./sketch.js";

export {
  validateSpec,
  assertValidSpec,
  buildPlan,
  describePlan,
  renderSvg,
  resolveSpec,
  controlDefaults,
  SPEC_VERSION,
  ELEMENT_TYPES,
  CHART_TYPES,
  sketchFrameDocument,
  mountSketch,
  assertSketch,
  SKETCH_MAX_BYTES,
};

let uid = 0;
const ANNOUNCE_DELAY_MS = 400;

// What a screen reader should say for a control's value.
function spoken(c, v) {
  if (c.type === "toggle") return `${c.label}: ${v ? "on" : "off"}`;
  return `${c.label}: ${v}`;
}

// The controls panel: one row per control, each labelled and focusable. Built with DOM calls only.
function buildPanel(controls, state, onChange) {
  uid += 1;
  const group = document.createElement("div");
  group.className = "p5loom-controls";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "Controls");
  for (const c of controls) {
    const row = document.createElement("div");
    row.className = `p5loom-control p5loom-control-${c.type}`;
    const id = `p5loom-${uid}-${c.id}`;
    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = c.label;
    row.appendChild(label);
    let input;
    let out = null;
    if (c.type === "slider") {
      input = document.createElement("input");
      input.type = "range";
      input.min = String(c.min);
      input.max = String(c.max);
      input.step = String(c.step);
      input.value = String(state.values[c.id]);
      out = document.createElement("output");
      out.textContent = input.value;
      input.addEventListener("input", () => {
        out.textContent = input.value;
        input.setAttribute("aria-valuetext", input.value);
        onChange(c.id, Number(input.value));
      });
    } else if (c.type === "toggle") {
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = state.values[c.id] === true;
      input.addEventListener("change", () => onChange(c.id, input.checked));
    } else {
      input = document.createElement("select");
      for (const o of c.options) {
        const opt = document.createElement("option");
        opt.value = o;
        opt.textContent = o;
        input.appendChild(opt);
      }
      input.value = String(state.values[c.id]);
      input.addEventListener("change", () => onChange(c.id, input.value));
    }
    input.id = id;
    row.appendChild(input);
    if (out) row.appendChild(out);
    group.appendChild(row);
    state.inputs[c.id] = { input, out, type: c.type };
  }
  return group;
}

// Writes a value into an existing control, without firing its event.
function syncPanel(state, id) {
  const ref = state.inputs[id];
  if (!ref) return;
  const v = state.values[id];
  if (ref.type === "toggle") ref.input.checked = v === true;
  else {
    ref.input.value = String(v);
    if (ref.out) {
      ref.out.textContent = ref.input.value;
      ref.input.setAttribute("aria-valuetext", ref.input.value);
    }
  }
}

// Only the values of controls that exist: anything else the caller passed is ignored.
function pickKnown(spec, values) {
  const out = {};
  for (const c of Array.isArray(spec.controls) ? spec.controls : []) {
    if (Object.prototype.hasOwnProperty.call(values, c.id)) out[c.id] = valueOf(c, values);
  }
  return out;
}

// The address this page is at, with the share parameter replaced (or removed when there is nothing to share).
function writeShareParam(name, token) {
  try {
    const url = new URL(window.location.href);
    if (token) url.searchParams.set(name, token);
    else url.searchParams.delete(name);
    window.history.replaceState(window.history.state, "", url.toString());
  } catch {
    /* sandboxed pages may refuse history changes: the picture still works without the link */
  }
}

function readShareParam(name) {
  try {
    return new URL(window.location.href).searchParams.get(name);
  } catch {
    return null;
  }
}

export function mount(element, spec, { p5, values = {}, shareKey, onChange } = {}) {
  if (typeof document === "undefined") throw new Error("mount needs a browser document");
  if (!element || typeof element.appendChild !== "function") throw new TypeError("mount needs a DOM element");
  if (typeof p5 !== "function") throw new TypeError("mount needs the p5 constructor: mount(el, spec, { p5 })");
  assertValidSpec(spec);
  const shareName = shareKey === undefined ? null : paramName(shareKey);

  const controls = Array.isArray(spec.controls) ? spec.controls : [];
  const fromUrl = shareName ? decodeValues(spec, readShareParam(shareName)) : {};
  const state = {
    values: { ...controlDefaults(spec), ...pickKnown(spec, values), ...fromUrl },
    inputs: {},
    plan: null,
    description: "",
    timer: null,
    announceTimer: null,
  };

  const wrap = document.createElement("figure");
  wrap.className = "p5loom";
  wrap.style.margin = "0";
  const caption = document.createElement("figcaption");
  caption.className = "p5loom-sr-only";
  wrap.appendChild(caption);

  // Changes are announced once the reader has stopped moving a slider, not on every step.
  const live = document.createElement("div");
  live.className = "p5loom-sr-only";
  live.setAttribute("role", "status");
  live.setAttribute("aria-live", "polite");
  wrap.appendChild(live);

  if (controls.length) wrap.appendChild(buildPanel(controls, state, (id, v) => set(id, v)));
  const host = document.createElement("div");
  host.className = "p5loom-canvas";
  wrap.appendChild(host);
  element.appendChild(wrap);

  function refresh() {
    state.plan = buildPlan(spec, state.values);
    state.description = describePlan(state.plan);
    caption.textContent = state.description;
    const canvas = host.querySelector("canvas");
    if (canvas) canvas.setAttribute("aria-label", state.description);
  }
  refresh();

  let instance = null;
  instance = new p5((p) => {
    p.setup = () => {
      const canvas = p.createCanvas(state.plan.width, state.plan.height);
      canvas.elt.setAttribute("role", "img");
      canvas.elt.setAttribute("aria-label", state.description);
      p.draw = () => replayPlan(p, state.plan);
      replayPlan(p, state.plan);
    };
  }, host);

  function announce(id) {
    clearTimeout(state.announceTimer);
    state.announceTimer = setTimeout(() => {
      const c = controls.find((x) => x.id === id);
      if (c) live.textContent = spoken(c, state.values[id]);
    }, ANNOUNCE_DELAY_MS);
  }

  // Share links are written after a short pause too, so a slider drag makes one history entry, not dozens.
  function scheduleShare() {
    if (!shareName) return;
    clearTimeout(state.timer);
    state.timer = setTimeout(() => writeShareParam(shareName, encodeValues(spec, state.values)), 250);
  }

  function set(id, value) {
    const c = controls.find((x) => x.id === id);
    if (!c) throw new RangeError(`no control called "${id}"`);
    state.values[id] = valueOf(c, { [id]: value });
    syncPanel(state, id);
    refresh();
    instance.redraw();
    announce(id);
    scheduleShare();
    wrap.dispatchEvent(new CustomEvent("p5loom-change", { detail: { id, value: state.values[id], values: { ...state.values } }, bubbles: true }));
    if (typeof onChange === "function") onChange({ ...state.values }, id);
    return state.values[id];
  }

  // A link that carries values is written once at the start, so it always reproduces this picture.
  if (shareName && Object.keys(fromUrl).length) scheduleShare();

  return {
    plan: () => state.plan,
    description: () => state.description,
    values: () => ({ ...state.values }),
    set,
    destroy() {
      clearTimeout(state.timer);
      clearTimeout(state.announceTimer);
      instance.remove();
      wrap.remove();
    },
  };
}
