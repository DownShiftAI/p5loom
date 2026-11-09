// The code-mode page: runs each sketch in a sandboxed frame. Each sketch is a file of the page's own author.
import { mountSketch } from "/lib/sketch.js";

const NAME = /^[a-z][a-z0-9-]{0,39}$/;

for (const el of document.querySelectorAll("[data-sketch]")) {
  const name = el.getAttribute("data-sketch");
  if (!NAME.test(name)) {
    el.textContent = "This sketch name is not valid.";
    continue;
  }
  try {
    mountSketch(el, { src: `/sketches/${name}/`, width: 320, height: 180, title: "A p5.js sketch in a sandboxed frame" });
  } catch (err) {
    el.textContent = `The sketch could not be started: ${err.message}`;
  }
}
