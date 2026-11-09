// Authentication for the HTTP transport. Two modes, chosen by configuration:
//
//   open   no tokens configured. Allowed only when the server listens on a loopback address (127.0.0.1, ::1, localhost).
//          Anything else is refused at start-up, so an open server cannot be reached from the network by accident.
//   token  one or more bearer tokens configured. Every HTTP request must send "Authorization: Bearer <token>".
//
// Stdio needs no token: the process that starts it already runs as the user, the same trust a shell has.
//
// Tokens are never stored as given. The server keeps SHA-256 digests and compares digests in constant time, so a
// timing difference cannot reveal a token one character at a time.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost", "[::1]"]);
const NAME_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

export const isLoopback = (host) => LOOPBACK.has(String(host).toLowerCase());

const digest = (token) => createHash("sha256").update(token, "utf8").digest();

// Reads tokens from the environment. P5LOOM_MCP_TOKENS holds "name=token,name=token"; P5LOOM_MCP_TOKEN holds one token
// named "default". Returns [] when neither is set.
export function tokensFromEnv(env = process.env) {
  const out = [];
  if (env.P5LOOM_MCP_TOKENS) {
    for (const part of env.P5LOOM_MCP_TOKENS.split(",")) {
      const i = part.indexOf("=");
      if (i < 1) throw new TypeError("P5LOOM_MCP_TOKENS: use name=token pairs separated by commas");
      out.push({ name: part.slice(0, i).trim(), token: part.slice(i + 1).trim() });
    }
  }
  if (env.P5LOOM_MCP_TOKEN) out.push({ name: "default", token: env.P5LOOM_MCP_TOKEN.trim() });
  return out;
}

// Builds the authenticator. tokens: [{ name, token }]. Throws for weak or duplicate tokens.
export function createAuth({ tokens = [], host = "127.0.0.1", allowOpen = false } = {}) {
  const entries = [];
  const seen = new Set();
  for (const { name, token } of tokens) {
    if (!NAME_RE.test(name)) throw new TypeError(`token name "${name}": lowercase letters, digits and hyphens, up to 40`);
    if (typeof token !== "string" || token.length < 24) throw new TypeError(`token "${name}" is too short: use at least 24 characters (npm run mcp -- --new-token)`);
    if (seen.has(name)) throw new TypeError(`token name "${name}" is used twice`);
    seen.add(name);
    entries.push({ name, digest: digest(token) });
  }
  const mode = entries.length ? "token" : "open";
  if (mode === "open" && !isLoopback(host) && !allowOpen) {
    throw new TypeError(`refusing to listen on ${host} without a token: set P5LOOM_MCP_TOKEN, or listen on 127.0.0.1`);
  }
  return {
    mode,
    // The identity for a request, or null when the request is not allowed. In open mode everything is allowed.
    identify(authorization) {
      if (mode === "open") return { name: "open", mode };
      const match = /^Bearer ([\x21-\x7e]+)$/.exec(authorization ?? "");
      if (!match) return null;
      const candidate = digest(match[1]);
      let found = null;
      for (const e of entries) {
        // Every entry is compared, so the time taken does not depend on which one matched.
        if (timingSafeEqual(candidate, e.digest)) found = e.name;
      }
      return found ? { name: found, mode } : null;
    },
    names: () => entries.map((e) => e.name),
  };
}

// A new token: 32 random bytes, base64url. Printed once, by the operator, never logged by the server.
export function newToken() {
  return randomBytes(32).toString("base64url");
}
