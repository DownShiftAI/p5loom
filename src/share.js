// Control values in a URL. Only the values that differ from the defaults are written, so a link to the defaults is
// short and a picture with no changes has no parameter at all. Pure: the browser glue is in index.js.
//   ?p5loom-<key>=<token>     token is base64url of a JSON object of { controlId: value }

import { controlDefaults, valueOf } from "./controls.js";

export const PARAM_PREFIX = "p5loom-";
const KEY_RE = /^[a-z][a-z0-9-]{0,31}$/;

// btoa and atob exist in browsers and in Node, so this module needs no Buffer.
const b64url = (bytes) => {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64url = (s) => {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

export function paramName(key) {
  if (typeof key !== "string" || !KEY_RE.test(key)) throw new TypeError("shareKey: lowercase letters, digits and hyphens, starting with a letter");
  return `${PARAM_PREFIX}${key}`;
}

// The token for the values that differ from the defaults. Returns "" when nothing differs.
export function encodeValues(spec, values) {
  const defaults = controlDefaults(spec);
  const changed = {};
  for (const c of Array.isArray(spec.controls) ? spec.controls : []) {
    const v = valueOf(c, values);
    if (v !== defaults[c.id]) changed[c.id] = v;
  }
  return Object.keys(changed).length ? b64url(new TextEncoder().encode(JSON.stringify(changed))) : "";
}

// Values from a token. Anything unknown, malformed or out of range is dropped, and what is left goes through the
// control's own rules, so a hand-edited link can never produce a value the spec would refuse.
export function decodeValues(spec, token) {
  if (typeof token !== "string" || token.length === 0 || token.length > 4096) return {};
  let raw;
  try {
    raw = JSON.parse(new TextDecoder().decode(fromB64url(token)));
  } catch {
    return {};
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const c of Array.isArray(spec.controls) ? spec.controls : []) {
    if (Object.prototype.hasOwnProperty.call(raw, c.id)) out[c.id] = valueOf(c, raw);
  }
  return out;
}
