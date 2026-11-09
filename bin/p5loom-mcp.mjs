#!/usr/bin/env node
// Runs the p5loom MCP server.
//
//   p5loom-mcp                          stdio (Claude Desktop, Claude Code, Cursor, VS Code, ...). No token needed.
//   p5loom-mcp --http [port]            HTTP at http://127.0.0.1:<port>/mcp (default port 7340), no token,
//                                       loopback only.
//   p5loom-mcp --http [port] --host <h> HTTP on another address. A token is required.
//   p5loom-mcp --new-token              print a new random token (for P5LOOM_MCP_TOKEN) and exit.
//
// Tokens come from the environment: P5LOOM_MCP_TOKEN=<token> for one caller named "default", or
// P5LOOM_MCP_TOKENS="name=token,name=token" for several. With any token set, every HTTP request must send
// "Authorization: Bearer <token>".
//
// Options for HTTP: --rate <requests per minute> (default 120), --burst <n> (default 30).
// Logs and the audit trail go to stderr. Stdout carries protocol messages only.

import { serveStdio, serveHttp } from "../src/mcp/server.js";
import { newToken, tokensFromEnv } from "../src/mcp/auth.js";

const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  if (i < 0) return fallback;
  const v = args[i + 1];
  return v && !v.startsWith("--") ? v : fallback;
};

if (args.includes("--help") || args.includes("-h")) {
  console.log(`p5loom MCP server

  p5loom-mcp                          stdio transport
  p5loom-mcp --http [port]            HTTP at /mcp on 127.0.0.1 (default port 7340)
  p5loom-mcp --http [port] --host <h> HTTP on another address (requires a token)
  p5loom-mcp --new-token              print a new token and exit
  options: --rate <per minute> --burst <n>

  P5LOOM_MCP_TOKEN=<token>            one token, caller "default"
  P5LOOM_MCP_TOKENS=a=<t1>,b=<t2>     several tokens, one per caller

Logs and the audit trail go to stderr. Stdout carries protocol messages only.`);
  process.exit(0);
}

if (args.includes("--new-token")) {
  process.stdout.write(`${newToken()}\n`);
  process.exit(0);
}

if (args.includes("--http")) {
  const port = Number(value("--http", "7340"));
  const host = value("--host", "127.0.0.1");
  const tokens = tokensFromEnv();
  const rate = { perMinute: Number(value("--rate", "120")), burst: Number(value("--burst", "30")) };
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error("p5loom MCP: the port must be a number from 0 to 65535");
    process.exit(2);
  }
  serveHttp({ port, host, tokens, rate }).then(
    ({ url, auth }) => {
      const mode = auth.mode === "token" ? `token auth, ${auth.names().length} caller(s)` : "open, loopback only";
      console.error(`p5loom MCP listening at ${url}/mcp (${mode})`);
    },
    (err) => {
      console.error(`p5loom MCP could not start: ${err.message}`);
      process.exit(1);
    },
  );
} else {
  serveStdio();
  console.error("p5loom MCP on stdio");
}
