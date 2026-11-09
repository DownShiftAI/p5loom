// Code mode: a p5.js sketch you wrote, run in a sandboxed frame.
//
// A sketch is a file, served from its own path (/sketches/<name>/sketch.js) with a frame page beside it. The frame is
// an iframe with sandbox="allow-scripts" and no allow-same-origin, so it has an opaque origin: it cannot read the host
// page, its cookies or storage. Its document carries a Content-Security-Policy that allows scripts only from the
// pinned p5.js build and from its own sketch file, and no network at all (connect-src 'none').
//
// Why a file and not an inline script: a frame inherits the policy of the page that embeds it. The site's policy has
// no nonce for an inline sketch, so an inline script would be refused. A file from the same origin is allowed.
//
// The sandbox protects the page that hosts a sketch, not against a sketch that loops forever: a runaway sketch
// freezes its own frame and nothing else. Use code mode for sketches the page's author wrote.

import { sandboxCsp } from "./policy.js";
import { THEMES } from "./theme.js";

export const SKETCH_MAX_BYTES = 32 * 1024;
export const P5_SRC = "https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.3/p5.min.js";
const SIZE_MIN = 16;
const SIZE_MAX = 4096;
const NAME_RE = /^[a-z][a-z0-9-]{0,39}$/;

// Checks a sketch's text before it is written to disk. Refused: empty, too large, or text that would end a script.
export function assertSketch(code) {
  if (typeof code !== "string" || code.trim().length === 0) throw new TypeError("code: a non-empty string of p5.js code");
  const bytes = new TextEncoder().encode(code).length;
  if (bytes > SKETCH_MAX_BYTES) throw new RangeError(`sketch is ${bytes} bytes; the limit is ${SKETCH_MAX_BYTES}`);
  if (/<\/script/i.test(code)) throw new TypeError("code: the text '</script' is not allowed");
  return code;
}

// The frame page for one sketch file. Pure: the caller writes it to disk or serves it.
export function sketchFrameDocument({ title = "p5.js sketch", scriptUrl = "sketch.js", theme = "dark", p5Src = P5_SRC } = {}) {
  if (!THEMES[theme]) throw new RangeError("theme: light or dark");
  if (typeof scriptUrl !== "string" || /[<>"'\s]/.test(scriptUrl) || scriptUrl.includes("..")) throw new RangeError("scriptUrl: a plain relative path");
  // The frame's own stylesheet is allowed. frame-ancestors is not honoured in a meta element, so it stays in the header.
  const csp = sandboxCsp(`${p5Src} 'self'`).replace("style-src 'unsafe-inline'", "style-src 'self'").replace("; frame-ancestors 'none'", "");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<title>${title.replace(/[<>&]/g, "")}</title>
<link rel="stylesheet" href="/sketches/frame.css">
<meta name="description" content="A p5.js sketch, run in a sandboxed frame.">
<meta name="robots" content="noindex">
</head>
<body data-theme="${theme}">
<script src="${p5Src}"></script>
<script src="${scriptUrl}"></script>
</body>
</html>
`;
}

// Puts a sketch frame under element. Browser only. src is a same-origin path under /sketches/.
export function mountSketch(element, { src, width, height, title = "p5.js sketch" }) {
  if (typeof document === "undefined") throw new Error("mountSketch needs a browser document");
  if (!element || typeof element.appendChild !== "function") throw new TypeError("mountSketch needs a DOM element");
  if (typeof src !== "string" || !/^\/sketches\/[a-z][a-z0-9-]{0,39}\/$/.test(src)) throw new RangeError("src: /sketches/<name>/");
  for (const [name, v] of [["width", width], ["height", height]]) {
    if (!Number.isInteger(v) || v < SIZE_MIN || v > SIZE_MAX) throw new RangeError(`${name}: a whole number from ${SIZE_MIN} to ${SIZE_MAX}`);
  }
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-scripts");
  frame.setAttribute("referrerpolicy", "no-referrer");
  frame.setAttribute("title", title);
  frame.width = String(width);
  frame.height = String(height);
  frame.src = src;
  element.appendChild(frame);
  return {
    frame,
    destroy() {
      frame.remove();
    },
  };
}

export { NAME_RE as SKETCH_NAME_RE };
