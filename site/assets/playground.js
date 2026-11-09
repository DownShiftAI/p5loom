// Playground: edit a spec, see the picture, its description and every problem. Runs the library in the page.
// All spec text is read and written with text APIs. Nothing typed here is ever parsed as HTML or executed.

import { validateSpec, buildPlan, describePlan, mount } from "/lib/index.js";

const $ = (id) => document.getElementById(id);
const editor = $("pg-spec");
const select = $("pg-example");
const status = $("pg-status");
const problems = $("pg-problems");
const stage = $("pg-stage");
const desc = $("pg-desc");
const opsOut = $("pg-ops");
const dotsOut = $("pg-dots");
const bytesOut = $("pg-bytes");

const MAX_BYTES = 512 * 1024;
let handle = null;
let timer = null;
let exampleIndex = [];

function setStatus(text, tone) {
  status.textContent = text;
  status.className = `pg-status ${tone}`;
}

function listProblems(items) {
  problems.replaceChildren(
    ...items.map((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      return li;
    }),
  );
}

function clearStage(message) {
  if (handle) {
    handle.destroy();
    handle = null;
  }
  const note = document.createElement("p");
  note.className = "msg";
  note.textContent = message;
  stage.replaceChildren(note);
}

function countDots(spec) {
  return spec.elements.filter((e) => e && e.type === "random-dots").reduce((n, e) => n + (e.count | 0), 0);
}

function render() {
  const text = editor.value;
  const bytes = new TextEncoder().encode(text).length;
  bytesOut.textContent = `${bytes.toLocaleString("en-GB")} of ${MAX_BYTES.toLocaleString("en-GB")} bytes`;

  let spec;
  try {
    spec = JSON.parse(text);
  } catch (err) {
    listProblems([`Not valid JSON: ${err.message}`]);
    setStatus("The text is not JSON yet.", "bad");
    clearStage("Fix the JSON to see the picture.");
    desc.textContent = "";
    opsOut.textContent = "–";
    dotsOut.textContent = "–";
    return;
  }

  const found = validateSpec(spec);
  listProblems(found);
  if (found.length) {
    setStatus(`${found.length} ${found.length === 1 ? "problem" : "problems"} to fix.`, "bad");
    clearStage("The picture appears when the spec is valid.");
    desc.textContent = "";
    opsOut.textContent = "–";
    dotsOut.textContent = "–";
    return;
  }

  const plan = buildPlan(spec);
  const description = describePlan(plan, spec);
  setStatus("Valid. The picture below is drawn from this spec.", "ok");
  desc.textContent = description;
  opsOut.textContent = plan.ops.length.toLocaleString("en-GB");
  dotsOut.textContent = countDots(spec).toLocaleString("en-GB");

  if (typeof window.p5 !== "function") {
    clearStage("p5.js did not load, so the picture cannot be drawn. The spec itself is checked above.");
    return;
  }
  if (handle) handle.destroy();
  handle = null;
  stage.replaceChildren();
  try {
    handle = mount(stage, spec, { p5: window.p5 });
  } catch (err) {
    clearStage(`The picture could not be drawn: ${err.message}`);
  }
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(render, 220);
}

function encodeShare(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeShare(token) {
  const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "="));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

async function loadExample(id) {
  const res = await fetch(`/examples/${id}.json`, { credentials: "omit" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return JSON.stringify(await res.json(), null, 2);
}

async function start() {
  try {
    const res = await fetch("/examples/index.json", { credentials: "omit" });
    exampleIndex = res.ok ? await res.json() : [];
  } catch {
    exampleIndex = [];
  }
  select.replaceChildren(
    ...exampleIndex.map((e) => {
      const opt = document.createElement("option");
      opt.value = e.id;
      opt.textContent = e.title;
      return opt;
    }),
  );

  const hash = location.hash.replace(/^#/, "");
  let loaded = null;
  try {
    if (hash.startsWith("spec=")) {
      loaded = decodeShare(hash.slice(5));
    } else if (hash.startsWith("example=")) {
      const id = hash.slice(8);
      loaded = await loadExample(id);
      select.value = id;
    }
  } catch {
    loaded = null;
  }
  if (!loaded) {
    const first = exampleIndex[0]?.id ?? "hello-circle";
    loaded = await loadExample(first);
    select.value = first;
  }
  editor.value = loaded;
  render();
}

editor.addEventListener("input", schedule);

select.addEventListener("change", async () => {
  try {
    editor.value = await loadExample(select.value);
    history.replaceState(null, "", `#example=${select.value}`);
    render();
  } catch (err) {
    setStatus(`That example could not be loaded: ${err.message}`, "bad");
  }
});

$("pg-theme").addEventListener("click", () => {
  let spec;
  try {
    spec = JSON.parse(editor.value);
  } catch {
    setStatus("Fix the JSON before switching the theme.", "bad");
    return;
  }
  if (!spec || typeof spec !== "object") return;
  spec.theme = spec.theme === "dark" ? "light" : "dark";
  editor.value = JSON.stringify(spec, null, 2);
  render();
});

$("pg-format").addEventListener("click", () => {
  try {
    editor.value = JSON.stringify(JSON.parse(editor.value), null, 2);
    render();
  } catch {
    setStatus("Fix the JSON before formatting.", "bad");
  }
});

$("pg-reset").addEventListener("click", async () => {
  const id = select.value || exampleIndex[0]?.id || "hello-circle";
  try {
    editor.value = await loadExample(id);
    render();
  } catch (err) {
    setStatus(`Reset failed: ${err.message}`, "bad");
  }
});

$("pg-share").addEventListener("click", async () => {
  const url = `${location.origin}${location.pathname}#spec=${encodeShare(editor.value)}`;
  history.replaceState(null, "", `#spec=${encodeShare(editor.value)}`);
  try {
    await navigator.clipboard.writeText(url);
    setStatus("Share link copied. It holds the spec in the fragment, which stays in your browser.", "ok");
  } catch {
    setStatus(`Copy this link: ${url}`, "ok");
  }
});

start().catch((err) => setStatus(`The playground could not start: ${err.message}`, "bad"));
