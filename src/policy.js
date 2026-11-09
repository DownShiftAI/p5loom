// Safety policy. A spec is data, never code. These checks run before anything else touches a spec.

export const MAX_SPEC_BYTES = 512 * 1024;
export const MAX_ELEMENTS = 5000;
export const MAX_POINTS = 100000;

// Keys that would only make sense if a spec were code. Refused anywhere in the document.
const CODE_KEYS = new Set(["code", "script", "eval", "function", "src", "href", "onload", "onclick", "html", "innerHTML"]);

export function assertNoCode(value, path = "spec") {
  if (typeof value === "string") {
    if (/^\s*(javascript|data|vbscript):/i.test(value)) {
      throw new TypeError(`${path}: URL-like code is not allowed in a spec`);
    }
    return;
  }
  if (typeof value === "function") throw new TypeError(`${path}: functions are not allowed in a spec`);
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (CODE_KEYS.has(k)) throw new TypeError(`${path}.${k}: this key is not allowed in a spec`);
      assertNoCode(v, `${path}.${k}`);
    }
  }
}

export function assertSize(json) {
  const bytes = new TextEncoder().encode(json).length;
  if (bytes > MAX_SPEC_BYTES) {
    throw new RangeError(`spec is ${bytes} bytes; the limit is ${MAX_SPEC_BYTES}`);
  }
}

// Content-Security-Policy for the sandboxed iframe used by code mode. No network, no inline script except the
// nonce-tagged one the renderer writes itself. Scripts come only from the pinned library URL, given by the host.
export function sandboxCsp(scriptSrc, nonce) {
  const scripts = nonce ? `${scriptSrc} 'nonce-${nonce}'` : scriptSrc;
  return [
    "default-src 'none'",
    `script-src ${scripts}`,
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "connect-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
}
