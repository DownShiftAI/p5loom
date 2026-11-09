// Data-driven charts. A spec can hold named data tables, and chart elements draw from them: bars, points, paths, axes,
// text and a legend. The scales (band, linear, log) and their ticks are computed here from the data, so a chart is
// described by its numbers and field names, not by hand-computed coordinates.
// Pure: no p5, no DOM. The plan turns these operations into pixels, exactly as for the other elements.

export const CHART_TYPES = ["axes", "bars", "points", "path", "text", "legend"];
export const TABLE_ELEMENT_TYPES = ["axes", "bars", "points", "path"];
export const SCALE_KINDS = ["band", "linear", "log"];
export const MAX_TABLES = 4;
export const MAX_ROWS = 1000;
export const MAX_FIELDS = 8;
export const MAX_LEGEND_ITEMS = 8;
export const DEFAULT_FRAME = [0.12, 0.08, 0.96, 0.86];

const NAME_RE = /^[a-z][a-z0-9-]{0,31}$/;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isText = (v) => typeof v === "string" && v.length >= 1 && v.length <= 60;

// Checks spec.data. Returns the tables that are well formed, keyed by name, and pushes problems for the rest.
export function validateData(spec, problems) {
  const tables = {};
  if (spec.data === undefined) return tables;
  if (!spec.data || typeof spec.data !== "object" || Array.isArray(spec.data)) {
    problems.push("data: must be an object of named tables");
    return tables;
  }
  const names = Object.keys(spec.data);
  if (names.length > MAX_TABLES) problems.push(`data: at most ${MAX_TABLES} tables`);
  for (const name of names.slice(0, MAX_TABLES)) {
    const p = `data.${name}`;
    if (!NAME_RE.test(name)) {
      problems.push(`${p}: table names are lowercase letters, digits and hyphens, starting with a letter`);
      continue;
    }
    const rows = spec.data[name];
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_ROWS) {
      problems.push(`${p}: needs 1 to ${MAX_ROWS} rows`);
      continue;
    }
    let ok = true;
    rows.forEach((row, i) => {
      if (!ok) return;
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        problems.push(`${p}[${i}]: must be an object`);
        ok = false;
        return;
      }
      const keys = Object.keys(row);
      if (keys.length === 0 || keys.length > MAX_FIELDS) {
        problems.push(`${p}[${i}]: needs 1 to ${MAX_FIELDS} fields`);
        ok = false;
        return;
      }
      for (const k of keys) {
        if (!NAME_RE.test(k)) {
          problems.push(`${p}[${i}].${k}: field names are lowercase letters, digits and hyphens`);
          ok = false;
          return;
        }
        if (!(isNum(row[k]) || isText(row[k]))) {
          problems.push(`${p}[${i}].${k}: a number, or text of 1 to 60 characters`);
          ok = false;
          return;
        }
      }
    });
    if (ok) tables[name] = rows;
  }
  return tables;
}

// Nice step and domain for a numeric range, the way a person would draw an axis.
export function niceNum(x, round) {
  const exp = Math.floor(Math.log10(x));
  const f = x / 10 ** exp;
  let nf;
  if (round) nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
  else nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * 10 ** exp;
}

export function niceDomain(min, max, count = 5) {
  let lo = min;
  let hi = max;
  if (lo === hi) {
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.1;
    lo -= pad;
    hi += pad;
  }
  const step = niceNum((hi - lo) / count, true);
  return { lo: Math.floor(lo / step) * step, hi: Math.ceil(hi / step) * step, step };
}

// A scale maps a data value to a unit position: 0 at the start of the axis, 1 at its end.
// kind band: categories in order of first appearance, each in its own slot. linear and log: numbers.
export function scaleFor(rows, field, kind, { includeZero = false } = {}) {
  const raw = rows.map((r) => r[field]);
  if (kind === "band") {
    const labels = [...new Set(raw.map(String))];
    const index = new Map(labels.map((l, i) => [l, i]));
    const n = labels.length;
    return {
      kind,
      labels,
      position: (v) => (index.get(String(v)) + 0.5) / n,
      slot: 1 / n,
      baseline: 0,
      ticks: labels.map((text, i) => ({ text, unit: (i + 0.5) / n })),
    };
  }
  if (!raw.every(isNum)) throw new TypeError(`field "${field}" needs numbers on a ${kind} axis`);
  let min = Math.min(...raw);
  const max = Math.max(...raw);
  if (kind === "log") {
    if (min <= 0) throw new RangeError(`field "${field}" needs values above zero on a log axis`);
    const lo = 10 ** Math.floor(Math.log10(min));
    let hi = 10 ** Math.ceil(Math.log10(max));
    if (hi === lo) hi = lo * 10;
    const span = Math.log10(hi) - Math.log10(lo);
    const unit = (v) => (Math.log10(v) - Math.log10(lo)) / span;
    const ticks = [];
    for (let e = Math.log10(lo); e <= Math.log10(hi) + 1e-9; e += 1) {
      const v = 10 ** Math.round(e);
      ticks.push({ text: formatNumber(v), unit: unit(v) });
    }
    return { kind, lo, hi, position: unit, slot: null, baseline: 0, ticks };
  }
  if (includeZero) min = Math.min(0, min);
  const { lo, hi, step } = niceDomain(min, max);
  const unit = (v) => (v - lo) / (hi - lo);
  const ticks = [];
  for (let i = 0; lo + i * step <= hi + step * 1e-9; i += 1) {
    const v = Number((lo + i * step).toPrecision(12));
    ticks.push({ text: formatNumber(v), unit: unit(v) });
  }
  return { kind, lo, hi, step, position: unit, slot: null, baseline: unit(0), ticks };
}

// Short, plain number text for axis labels.
export function formatNumber(v) {
  if (!Number.isFinite(v)) return "";
  if (Math.abs(v) >= 1e6) return `${Number((v / 1e6).toPrecision(3))}M`;
  if (Math.abs(v) >= 1e4) return `${Number((v / 1e3).toPrecision(3))}k`;
  return String(Number(v.toPrecision(6)));
}

// The x scale a chart uses when the spec does not name one: bars always use categories, and any other element uses
// categories when its x field holds text, and numbers otherwise.
function defaultX(el, rows) {
  if (el.type === "bars") return "band";
  if (typeof el.x !== "string") return "linear";
  return rows.every((r) => isNum(r[el.x])) ? "linear" : "band";
}

// Checks one chart element. Returns nothing; pushes problems. tables are the well formed data tables.
export function checkChart(problems, el, path, tables, { token, number }) {
  if (el.type === "text") {
    if (typeof el.text !== "string" || el.text.length < 1 || el.text.length > 80) problems.push(`${path}.text: 1 to 80 characters`);
    number(el.x, `${path}.x`, 0, 1);
    number(el.y, `${path}.y`, 0, 1);
    if (el.size !== undefined) number(el.size, `${path}.size`, 6, 72, "size: must be a number from 6 to 72 pixels");
    if (el.fill !== undefined) token(el.fill, `${path}.fill`);
    if (el.align !== undefined && !["left", "center", "right"].includes(el.align)) problems.push(`${path}.align: left, center or right`);
    return;
  }
  if (el.type === "legend") {
    if (!Array.isArray(el.items) || el.items.length < 1 || el.items.length > MAX_LEGEND_ITEMS) {
      problems.push(`${path}.items: needs 1 to ${MAX_LEGEND_ITEMS} items`);
    } else {
      el.items.forEach((item, i) => {
        if (!item || typeof item.label !== "string" || item.label.length < 1 || item.label.length > 40) problems.push(`${path}.items[${i}].label: 1 to 40 characters`);
        token(item?.fill, `${path}.items[${i}].fill`);
      });
    }
    number(el.x, `${path}.x`, 0, 1);
    number(el.y, `${path}.y`, 0, 1);
    return;
  }
  const rows = tables[el.table];
  if (!rows) {
    problems.push(`${path}.table: "${el.table}" is not a data table in data`);
    return;
  }
  if (el.frame !== undefined) {
    const f = el.frame;
    if (!Array.isArray(f) || f.length !== 4 || !f.every((n) => isNum(n) && n >= 0 && n <= 1) || f[0] >= f[2] || f[1] >= f[3]) {
      problems.push(`${path}.frame: [left, top, right, bottom] from 0 to 1, with left below right and top above bottom`);
    }
  }
  if (el.fill !== undefined) token(el.fill, `${path}.fill`);
  if (el.stroke !== undefined) token(el.stroke, `${path}.stroke`);
  const xKind = el.xScale ?? defaultX(el, rows);
  const yKind = el.yScale ?? "linear";
  if (!SCALE_KINDS.includes(xKind) || !SCALE_KINDS.includes(yKind)) problems.push(`${path}: scales are band, linear or log`);
  if (el.type === "bars" && xKind !== "band" && el.xScale !== undefined) problems.push(`${path}.xScale: bars need a band x scale`);
  if (!["x", "y"].every((k) => typeof el[k] === "string")) problems.push(`${path}: x and y name fields of the table`);
  if (el.type === "bars" && yKind === "band") problems.push(`${path}.yScale: bars need a linear or log y scale`);
  const fieldsOk = (field, kind) => {
    if (typeof field !== "string") return;
    const missing = rows.findIndex((r) => r[field] === undefined);
    if (missing >= 0) {
      problems.push(`${path}: row ${missing} of "${el.table}" has no field "${field}"`);
      return;
    }
    if (kind !== "band" && !rows.every((r) => isNum(r[field]))) problems.push(`${path}: field "${field}" needs numbers on a ${kind} axis`);
    if (kind === "log" && !rows.every((r) => r[field] > 0)) problems.push(`${path}: field "${field}" needs values above zero on a log axis`);
  };
  fieldsOk(el.x, xKind);
  fieldsOk(el.y, yKind);
  if (el.type === "axes" && el.yTicks !== undefined) number(el.yTicks, `${path}.yTicks`, 2, 12, "yTicks: a whole number from 2 to 12", true);
}

// Ops for a chart element, in pixels. tables: the data; width/height: the canvas; theme: the colour table.
export function planChart(el, tables, width, height, theme) {
  const rows = tables[el.table];
  const [fx0, fy0, fx1, fy1] = el.frame ?? DEFAULT_FRAME;
  const X = (u) => (fx0 + u * (fx1 - fx0)) * width;
  const Y = (u) => (fy1 - u * (fy1 - fy0)) * height;
  const ops = [];
  if (el.type === "text") {
    ops.push({
      op: "text",
      x: el.x * width,
      y: el.y * height,
      text: el.text,
      size: el.size ?? 12,
      fill: theme[el.fill ?? "fg"],
      align: el.align ?? "left",
    });
    return ops;
  }
  if (el.type === "legend") {
    el.items.forEach((item, i) => {
      const y = el.y * height + i * 18;
      ops.push({ op: "rect", x: el.x * width, y: y - 9, w: 10, h: 10, fill: theme[item.fill], stroke: undefined, weight: 0 });
      ops.push({ op: "text", x: el.x * width + 16, y: y, text: item.label, size: 12, fill: theme.fg, align: "left" });
    });
    return ops;
  }
  const xKind = el.xScale ?? defaultX(el, rows);
  const yKind = el.yScale ?? "linear";
  const xs = scaleFor(rows, el.x, xKind);
  // A linear quantity starts at zero unless the element says otherwise, so bars, points and their axes agree.
  const ys = scaleFor(rows, el.y, yKind, { includeZero: el.zero ?? true });
  const fill = el.fill ? theme[el.fill] : theme.accent;
  const stroke = el.stroke ? theme[el.stroke] : theme.accent;
  const base = Y(ys.baseline);
  const xpos = (row) => X(xs.position(row[el.x]));
  const ypos = (row) => Y(ys.position(row[el.y]));

  if (el.type === "axes") {
    const grid = el.grid !== false;
    const axis = theme.muted;
    const count = el.yTicks ?? 5;
    const yTicks = yKind === "log" ? ys.ticks : thin(ys.ticks, count);
    for (const t of yTicks) {
      const y = Y(t.unit);
      if (grid) ops.push({ op: "line", points: [[X(0), y], [X(1), y]], stroke: theme.grid, weight: 1 });
      ops.push({ op: "line", points: [[X(0) - 4, y], [X(0), y]], stroke: axis, weight: 1 });
      ops.push({ op: "text", x: X(0) - 8, y: y + 4, text: t.text, size: 11, fill: axis, align: "right" });
    }
    ops.push({ op: "line", points: [[X(0), Y(0)], [X(1), Y(0)]], stroke: axis, weight: 1 });
    ops.push({ op: "line", points: [[X(0), Y(0)], [X(0), Y(1)]], stroke: axis, weight: 1 });
    for (const t of thin(xs.ticks, 12)) {
      ops.push({ op: "line", points: [[X(t.unit), Y(0)], [X(t.unit), Y(0) + 4]], stroke: axis, weight: 1 });
      ops.push({ op: "text", x: X(t.unit), y: Y(0) + 18, text: clip(t.text), size: 11, fill: axis, align: "center" });
    }
    if (el.title !== false) {
      ops.push({ op: "text", x: X(1), y: Y(0) + 34, text: clip(el.x), size: 12, fill: theme.fg, align: "right" });
      ops.push({ op: "text", x: X(0), y: Y(1) - 8, text: clip(el.y), size: 12, fill: theme.fg, align: "left" });
    }
    return ops;
  }
  if (el.type === "bars") {
    const slot = xs.slot * (fx1 - fx0) * width;
    const w = slot * 0.6;
    for (const row of rows) {
      const x = xpos(row);
      const top = ypos(row);
      ops.push({ op: "rect", x: x - w / 2, y: Math.min(top, base), w, h: Math.abs(base - top), fill, stroke: undefined, weight: 0 });
    }
    return ops;
  }
  if (el.type === "points") {
    const r = el.r ?? 3;
    for (const row of rows) ops.push({ op: "circle", x: xpos(row), y: ypos(row), d: 2 * r, fill, stroke: undefined, weight: 0 });
    return ops;
  }
  if (el.type === "path") {
    const ordered = xs.kind === "band" ? rows : [...rows].sort((a, b) => a[el.x] - b[el.x]);
    ops.push({ op: "line", points: ordered.map((row) => [xpos(row), ypos(row)]), stroke, weight: el.weight ?? 2 });
    return ops;
  }
  return ops;
}

// Keeps at most n ticks, evenly spaced through the list, so labels never crowd.
function thin(list, n) {
  if (list.length <= n) return list;
  const step = Math.ceil(list.length / n);
  return list.filter((_, i) => i % step === 0);
}

function clip(s) {
  const t = String(s);
  return t.length > 24 ? `${t.slice(0, 23)}…` : t;
}

