// A Model Context Protocol server for p5loom, with no dependencies.
//
// Transports:
//   stdio  one JSON-RPC message per line on stdin, replies on stdout. The process is trusted as its user; no token.
//   http   POST /mcp with one JSON-RPC message or a batch, JSON replies. Two modes, see auth.js:
//            open   no tokens, loopback address only
//            token  every request needs "Authorization: Bearer <token>"
//          Every HTTP caller is rate limited (ratelimit.js). Origins that are not local are refused, so a web page
//          cannot use a local server as a relay.
//
// Every tool call is written to the audit log as one JSON line on stderr: which caller, which tool, whether it
// succeeded, and how long it took. Arguments are never logged.

import { createInterface } from "node:readline";
import { createServer } from "node:http";
import { callTool, toolList } from "./tools.js";
import { listResources, readResource, ResourceError } from "./resources.js";
import { listPrompts, getPrompt } from "./prompts.js";
import { createAuth, tokensFromEnv } from "./auth.js";
import { createRateLimiter } from "./ratelimit.js";

export const SERVER_INFO = { name: "p5loom", version: "0.1.0" };
const SUPPORTED = ["2025-06-18", "2025-03-26", "2024-11-05"];
const INSTRUCTIONS =
  "p5loom turns a JSON spec into a p5.js picture. Read p5loom://reference or call p5loom_reference first. " +
  "Validate a spec before drawing it. p5loom_render_svg returns the picture as SVG text; p5loom_describe returns its text " +
  "alternative. Prompts make-chart, design-controls and review-spec walk through common tasks.";
const MAX_BATCH = 50;
const MAX_BODY = 1024 * 1024;

const error = (id, code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

function defaultAudit(entry) {
  console.error(JSON.stringify({ audit: true, ...entry }));
}

// One message in, one reply out. Returns null for notifications, which take no reply.
// ctx: { identity: string, audit: function(entry) | null }
export function handle(msg, ctx = {}) {
  const identity = ctx.identity ?? "anonymous";
  if (!msg || typeof msg !== "object" || Array.isArray(msg) || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return error(msg?.id, -32600, "invalid request: expected a JSON-RPC 2.0 message with a method");
  }
  const notification = msg.id === undefined;
  if (msg.method.startsWith("notifications/")) return null;
  try {
    let result;
    switch (msg.method) {
      case "initialize": {
        const asked = msg.params?.protocolVersion;
        result = {
          protocolVersion: SUPPORTED.includes(asked) ? asked : SUPPORTED[0],
          capabilities: { tools: {}, resources: {}, prompts: {} },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        };
        break;
      }
      case "ping":
        result = {};
        break;
      case "tools/list":
        result = { tools: toolList() };
        break;
      case "tools/call": {
        const name = msg.params?.name;
        if (typeof name !== "string") return notification ? null : error(msg.id, -32602, "tools/call needs a tool name");
        const started = Date.now();
        result = callTool(name, msg.params?.arguments ?? {});
        if (ctx.audit) ctx.audit({ t: new Date().toISOString(), identity, tool: name, ok: !result.isError, ms: Date.now() - started });
        break;
      }
      case "resources/list":
        result = { resources: listResources() };
        break;
      case "resources/read": {
        const uri = msg.params?.uri;
        result = { contents: [readResource(uri)] };
        break;
      }
      case "prompts/list":
        result = { prompts: listPrompts() };
        break;
      case "prompts/get":
        result = getPrompt(msg.params?.name, msg.params?.arguments ?? {});
        break;
      default:
        return notification ? null : error(msg.id, -32601, `method not found: ${msg.method}`);
    }
    return notification ? null : { jsonrpc: "2.0", id: msg.id, result };
  } catch (e) {
    const code = e instanceof ResourceError ? e.code : -32602;
    return notification ? null : error(msg.id, code, e.message);
  }
}

// A single message or a batch. A batch answers with an array of the replies that are not notifications.
export function handleAny(input, ctx = {}) {
  if (Array.isArray(input)) {
    if (input.length === 0) return error(null, -32600, "empty batch");
    if (input.length > MAX_BATCH) return error(null, -32600, `a batch holds at most ${MAX_BATCH} messages`);
    const replies = input.map((m) => handle(m, ctx)).filter((r) => r !== null);
    return replies.length ? replies : null;
  }
  return handle(input, ctx);
}

// stdio: newline-delimited JSON. Anything written to stdout must be a protocol message, so logs go to stderr.
export function serveStdio({ input = process.stdin, output = process.stdout, audit = defaultAudit } = {}) {
  const rl = createInterface({ input, crlfDelay: Infinity });
  rl.on("line", (line) => {
    const text = line.trim();
    if (!text) return;
    let reply;
    try {
      reply = handleAny(JSON.parse(text), { identity: "stdio", audit });
    } catch {
      reply = error(null, -32700, "parse error: the line is not JSON");
    }
    if (reply !== null) output.write(`${JSON.stringify(reply)}\n`);
  });
  return rl;
}

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function localOrigin(origin) {
  try {
    return LOCAL.test(new URL(origin).host);
  } catch {
    return false;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new RangeError("request body is larger than 1 MB"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// http: POST /mcp. Options:
//   tokens      [{ name, token }]; none means open mode (loopback only). Default: read from the environment.
//   host        the address to listen on. Default 127.0.0.1.
//   rate        { perMinute, burst } for every caller. Default 120 a minute, bursts of 30.
//   audit       a function for audit entries, or false to turn the audit log off.
// Returns { server, url, auth } once listening.
export function serveHttp({ port = 7340, host = "127.0.0.1", tokens = tokensFromEnv(), rate = {}, audit = defaultAudit, now, allowOpen = false } = {}) {
  const auth = createAuth({ tokens, host, allowOpen });
  const limiter = createRateLimiter({ perMinute: rate.perMinute ?? 120, burst: rate.burst ?? 30, now });
  const auditFn = audit === false ? null : audit;

  const server = createServer(async (req, res) => {
    const base = `http://${req.headers.host ?? `${host}:${port}`}`;
    const send = (status, body, headers = {}) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
      res.end(body === undefined ? undefined : JSON.stringify(body));
    };
    const origin = req.headers.origin;
    if (origin && !localOrigin(origin)) return send(403, error(null, -32000, "origin not allowed"));
    const path = new URL(req.url ?? "/", "http://x").pathname;

    if (path === "/.well-known/oauth-protected-resource") {
      if (req.method !== "GET") return send(405, error(null, -32000, "use GET"), { Allow: "GET" });
      return send(200, { resource: `${base}/mcp`, resource_name: "p5loom", bearer_methods_supported: ["header"] });
    }
    if (path !== "/mcp") return send(404, error(null, -32000, "not found: the endpoint is /mcp"));
    if (req.method !== "POST") return send(405, error(null, -32000, "use POST /mcp"), { Allow: "POST" });

    const caller = auth.identify(req.headers.authorization);
    if (!caller) {
      return send(401, error(null, -32001, "unauthorized: send Authorization: Bearer <token>"), {
        "WWW-Authenticate": `Bearer realm="p5loom", resource_metadata="${base}/.well-known/oauth-protected-resource"`,
      });
    }
    const slot = limiter.take(caller.name);
    if (!slot.allowed) {
      return send(429, error(null, -32002, "too many requests: slow down and try again"), { "Retry-After": String(slot.retryAfter) });
    }

    let reply;
    try {
      const text = await readBody(req);
      reply = handleAny(JSON.parse(text), { identity: caller.name, audit: auditFn });
    } catch (e) {
      return send(400, error(null, -32700, e instanceof SyntaxError ? "parse error: the body is not JSON" : e.message));
    }
    if (reply === null) {
      res.writeHead(202);
      return res.end();
    }
    return send(200, reply);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve({ server, url: `http://${host}:${server.address().port}`, auth }));
  });
}
