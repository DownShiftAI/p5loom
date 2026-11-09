#!/usr/bin/env node
// Serves a built site with the production headers, so local testing sees the same CSP the public site gets.
//   node scripts/serve-docs.mjs [--dir dist] [--port 4173]

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { HEADERS, CSP } from "../site/security-headers.mjs";

// Sketch frames are embedded by this site, so they allow their own origin as a parent. Every other page allows none.
const FRAME_HEADERS = { ...HEADERS, "Content-Security-Policy": CSP.replace("frame-ancestors 'none'", "frame-ancestors 'self'"), "X-Frame-Options": "SAMEORIGIN", "Permissions-Policy": "accelerometer=*, gyroscope=*, camera=(), microphone=(), geolocation=(), payment=(), usb=()" };

const here = dirname(fileURLToPath(import.meta.url));
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

export function startServer({ dir, port = 0, host = "127.0.0.1" }) {
  const base = resolve(dir);
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://x");
      let rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
      if (rel.includes("..")) throw new Error("bad path");
      let file = join(base, rel);
      const info = await stat(file).catch(() => null);
      if (info?.isDirectory()) file = join(file, "index.html");
      let body;
      let status = 200;
      try {
        body = await readFile(file);
      } catch {
        status = 404;
        body = await readFile(join(base, "404.html"));
      }
      const framed = /^sketches(\\|\/|$)/.test(rel);
      res.writeHead(status, {
        ...(framed ? FRAME_HEADERS : HEADERS),
        "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      res.writeHead(400, HEADERS);
      res.end("bad request");
    }
  });
  return new Promise((ok) => {
    server.listen(port, host, () => ok({ server, url: `http://${host}:${server.address().port}` }));
  });
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("serve-docs.mjs")) {
  const args = process.argv.slice(2);
  const dir = resolve(here, "..", args.includes("--dir") ? args[args.indexOf("--dir") + 1] : "dist");
  const port = Number(args.includes("--port") ? args[args.indexOf("--port") + 1] : 4173);
  startServer({ dir, port }).then(({ url }) => console.log(`p5loom site on ${url} (production headers)`));
}
