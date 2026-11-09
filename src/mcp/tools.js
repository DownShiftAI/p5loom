// The MCP tools. Each one is a thin, pure wrapper over the library: the same validation, the same plan and the same SVG
// that the browser and the docs use. Nothing here touches the network or runs a browser. A spec is data, so a client
// can send one and get back a picture, a description or a list of problems.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateSpec, ELEMENT_TYPES, SPEC_VERSION } from "../spec.js";
import { buildPlan } from "../plan.js";
import { describePlan } from "../describe.js";
import { renderSvg } from "../svg.js";
import { resolveSpec, controlDefaults, CONTROL_TYPES, MAX_CONTROLS } from "../controls.js";
import { MAX_SPEC_BYTES, MAX_ELEMENTS, MAX_POINTS } from "../policy.js";
import { TOKENS, THEMES } from "../theme.js";

const here = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = join(here, "..", "..", "examples");
const CATALOG = JSON.parse(readFileSync(join(EXAMPLES_DIR, "catalog.json"), "utf8"));

// Raised for anything the caller can fix. The server reports it as a tool error, so the model can read and retry.
export class ToolError extends Error {
  constructor(message, problems = []) {
    super(message);
    this.problems = problems;
  }
}

export const REFERENCE = `p5loom spec, version ${SPEC_VERSION}. A picture is one JSON object.

Top level
  version     must be ${SPEC_VERSION}
  seed        integer 0 to 4294967295. Fixes every random choice. Or a binding to a slider.
  theme       "light" or "dark". Or a binding to a select of light and dark.
  canvas      { width, height }: integers 16 to 4096, in CSS pixels
  elements    array, at most ${MAX_ELEMENTS}; drawn in order, later ones on top
  controls    optional array, at most ${MAX_CONTROLS}; see below

Coordinates are normalised: 0 is the left or top edge, 1 is the right or bottom edge.
Colours are theme tokens only: ${TOKENS.join(", ")}. Raw colours are refused.

Elements (type: fields)
  circle       x, y, r (r is a fraction of the smaller side), fill, stroke, weight
  rect         x, y, w, h, fill, stroke, weight
  line         points: [[x, y], ...] (2 to ${MAX_POINTS}), stroke, weight
  scatter      data: [[x, y], ...] (1 to ${MAX_POINTS}), r (pixels, default 3), fill
  random-dots  count (1 to ${MAX_POINTS}), radius: [min, max] pixels, fill
  Any element may add "when": "<toggle id>" to hide it while the toggle is off.

Controls
  Each control: { id, type, label, ... }. id is lowercase letters, digits and hyphens.
  slider: min, max, step, value (numeric, min below max)
  toggle: value (true or false)
  select: options (2 to 12 strings), value (one of them)
  A field follows a control with a binding: { "control": "<id>" }.
    Number fields: x, y, r, w, h, weight, count, and the top-level seed (whole-number slider).
    Token fields: fill, stroke (a select whose options are all theme tokens).
    Theme: a select whose options are light and dark.
  The slider's whole range must fit the field: a coordinate's slider runs inside 0 to 1.

Limits: the spec is at most ${MAX_SPEC_BYTES / 1024} KB as JSON. A spec with code, functions or javascript:, data: or
vbscript: strings is refused. It is data, not code.`;

const SPEC_SCHEMA = { type: "object", description: "A p5loom spec (see p5loom_reference)." };
const VALUES_SCHEMA = {
  type: "object",
  description: "Control values by control id, for example {\"radius\": 0.3, \"horizon\": false}. Omit to use the defaults.",
  additionalProperties: true,
};

function requireSpec(args) {
  if (!args || typeof args.spec !== "object" || args.spec === null || Array.isArray(args.spec)) {
    throw new ToolError("spec: send the spec as a JSON object, not a string");
  }
  return args.spec;
}

function valuesFrom(args) {
  const v = args?.values;
  if (v === undefined || v === null) return {};
  if (typeof v !== "object" || Array.isArray(v)) throw new ToolError("values: send control values as a JSON object keyed by control id");
  return v;
}

// A spec that must be valid before anything else happens. Returns the problems as a tool error.
function validSpec(args) {
  const spec = requireSpec(args);
  const problems = validateSpec(spec);
  if (problems.length) throw new ToolError(`invalid spec (${problems.length} ${problems.length === 1 ? "problem" : "problems"})`, problems);
  return spec;
}

function planFor(args) {
  const spec = validSpec(args);
  const values = valuesFrom(args);
  let plan;
  try {
    plan = buildPlan(spec, values);
  } catch (e) {
    throw new ToolError(e.message.split("\n")[0], e.message.split("\n").slice(1).map((l) => l.replace(/^- /, "")));
  }
  return { spec, values, plan };
}

export const TOOLS = [
  {
    name: "p5loom_reference",
    description: "The p5loom spec format in one page: fields, element types, coordinates, colours, controls, bindings and limits. Read this before writing a spec.",
    inputSchema: { type: "object", properties: {} },
    run: () => ({ text: REFERENCE }),
  },
  {
    name: "p5loom_element_types",
    description: "The element types a spec can use, with the fields each one takes.",
    inputSchema: { type: "object", properties: {} },
    run: () => ({
      data: {
        elementTypes: ELEMENT_TYPES,
        controlTypes: CONTROL_TYPES,
        tokens: TOKENS,
        themes: Object.keys(THEMES),
        limits: { maxElements: MAX_ELEMENTS, maxPoints: MAX_POINTS, maxControls: MAX_CONTROLS, maxSpecBytes: MAX_SPEC_BYTES },
      },
    }),
  },
  {
    name: "p5loom_validate",
    description: "Check a spec without drawing it. Returns valid true, or the list of problems with the field that caused each one.",
    inputSchema: { type: "object", properties: { spec: SPEC_SCHEMA }, required: ["spec"] },
    run: (args) => {
      const spec = requireSpec(args);
      const problems = validateSpec(spec);
      return { data: { valid: problems.length === 0, problems } };
    },
  },
  {
    name: "p5loom_list_controls",
    description: "The controls a spec declares, with their types, ranges, options and default values.",
    inputSchema: { type: "object", properties: { spec: SPEC_SCHEMA }, required: ["spec"] },
    run: (args) => {
      const spec = validSpec(args);
      return {
        data: {
          controls: (spec.controls ?? []).map((c) => ({ ...c })),
          defaults: controlDefaults(spec),
        },
      };
    },
  },
  {
    name: "p5loom_resolve",
    description: "The spec that would actually be drawn for the given control values: bindings replaced, hidden elements removed. Use it to see what a control change does.",
    inputSchema: { type: "object", properties: { spec: SPEC_SCHEMA, values: VALUES_SCHEMA }, required: ["spec"] },
    run: (args) => {
      const spec = validSpec(args);
      return { data: resolveSpec(spec, valuesFrom(args)) };
    },
  },
  {
    name: "p5loom_describe",
    description: "The text description a screen reader would read for this picture, with counts of each element and of the generated dots.",
    inputSchema: { type: "object", properties: { spec: SPEC_SCHEMA, values: VALUES_SCHEMA }, required: ["spec"] },
    run: (args) => {
      const { spec, plan } = planFor(args);
      return { data: { description: describePlan(plan, spec), width: plan.width, height: plan.height, drawingOperations: plan.ops.length } };
    },
  },
  {
    name: "p5loom_render_svg",
    description: "Draw the picture as an SVG document (returned as text). Save it as a .svg file or embed it in a page. Uses the same plan as the browser, so the picture matches.",
    inputSchema: { type: "object", properties: { spec: SPEC_SCHEMA, values: VALUES_SCHEMA }, required: ["spec"] },
    run: (args) => {
      const { plan } = planFor(args);
      return { text: renderSvg(plan) };
    },
  },
  {
    name: "p5loom_list_examples",
    description: "The example pictures that ship with p5loom, with a title and a line on what each one teaches.",
    inputSchema: { type: "object", properties: {} },
    run: () => ({ data: CATALOG.map(({ id, title, summary, teaches }) => ({ id, title, summary, teaches })) }),
  },
  {
    name: "p5loom_get_example",
    description: "A complete example spec by id. Start from one of these when writing a new picture.",
    inputSchema: { type: "object", properties: { id: { type: "string", description: "An id from p5loom_list_examples." } }, required: ["id"] },
    run: (args) => {
      const id = String(args?.id ?? "");
      if (!/^[a-z0-9-]{1,64}$/.test(id)) throw new ToolError("id: lowercase letters, digits and hyphens");
      if (!CATALOG.some((e) => e.id === id)) {
        throw new ToolError(`no example "${id}"; use one of ${CATALOG.map((e) => e.id).join(", ")}`);
      }
      return { data: JSON.parse(readFileSync(join(EXAMPLES_DIR, `${id}.json`), "utf8")) };
    },
  },
];

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

// The MCP result for a tool call. Unknown names are a protocol error (thrown); failures in a known tool are reported
// inside the result with isError, so the model sees what to fix.
export function callTool(name, args) {
  const tool = BY_NAME.get(name);
  if (!tool) throw new RangeError(`unknown tool "${name}"`);
  try {
    const out = tool.run(args ?? {});
    const text = out.text ?? JSON.stringify(out.data, null, 2);
    return { content: [{ type: "text", text }] };
  } catch (e) {
    if (!(e instanceof ToolError)) throw e;
    const body = e.problems.length ? `${e.message}:\n- ${e.problems.join("\n- ")}` : e.message;
    return { content: [{ type: "text", text: body }], isError: true };
  }
}

export function toolList() {
  return TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
}
