// Site behaviour: the theme switch, the dawn that warms with scroll, and live demos. Demos marked data-follow-theme
// take the site's theme and redraw when it changes. A demo with data-share keeps its control values in the address
// bar. Loaded as a module from the same origin.

import { mount } from "/lib/index.js";

const root = document.documentElement;
const THEME_KEY = "p5loom-theme";
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null; // private windows and blocked storage: the system setting decides
  }
}

function writeTheme(value) {
  try {
    localStorage.setItem(THEME_KEY, value);
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
}

// The theme the page is showing right now: the reader's choice, else the system setting.
function effectiveTheme() {
  const attr = root.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return systemDark.matches ? "dark" : "light";
}

const saved = readTheme();
if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);

// ---- live demos ----

const handles = new WeakMap();

function say(el, text) {
  const note = document.createElement("p");
  note.className = "msg";
  note.textContent = text;
  el.replaceChildren(note);
}

async function drawDemo(el) {
  const id = el.getAttribute("data-demo");
  if (!/^[a-z0-9-]{1,64}$/.test(id)) return say(el, "This demo id is not valid.");
  if (typeof window.p5 !== "function") {
    return say(el, "The picture needs p5.js, which did not load. The spec is still valid; see the playground.");
  }
  try {
    const res = await fetch(`/examples/${id}.json`, { credentials: "omit" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const spec = await res.json();
    if (el.hasAttribute("data-follow-theme")) spec.theme = effectiveTheme();
    handles.get(el)?.destroy();
    el.replaceChildren();
    const shareKey = el.getAttribute("data-share") ?? undefined;
    handles.set(el, mount(el, spec, { p5: window.p5, shareKey }));
  } catch (err) {
    say(el, `This picture could not be drawn: ${err.message}`);
  }
}

// Draw one after another: each one creates a p5 instance, and a burst of them stalls a phone.
async function drawAll(elements) {
  for (const el of elements) await drawDemo(el);
}

const demos = [...document.querySelectorAll("[data-demo]")];
if (demos.length) drawAll(demos);

function redrawFollowing() {
  drawAll(demos.filter((el) => el.hasAttribute("data-follow-theme")));
}

// ---- theme switch ----

function applyTheme(value) {
  root.setAttribute("data-theme", value);
}

document.getElementById("theme-toggle")?.addEventListener("click", () => {
  const next = effectiveTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  writeTheme(next);
  redrawFollowing();
});

// With no saved choice, a change of system setting changes the picture too.
systemDark.addEventListener?.("change", () => {
  if (readTheme() !== "light" && readTheme() !== "dark") redrawFollowing();
});

// ---- the dawn: the page warms as you read down it ----

let frame = 0;
function warm() {
  frame = 0;
  const span = document.documentElement.scrollHeight - window.innerHeight;
  const p = span > 0 ? Math.min(1, Math.max(0, window.scrollY / span)) : 0;
  root.style.setProperty("--dawn-p", p.toFixed(3));
}
window.addEventListener(
  "scroll",
  () => {
    if (!frame) frame = requestAnimationFrame(warm);
  },
  { passive: true },
);
window.addEventListener("resize", () => {
  if (!frame) frame = requestAnimationFrame(warm);
});
warm();
