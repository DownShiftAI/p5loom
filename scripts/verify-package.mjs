#!/usr/bin/env node
// Packs the package exactly as npm would publish it, installs the tarball into an empty project, and checks that the
// public surface works from there: the exports, the schema, the picture output, and the MCP command. Nothing here is
// published; it works from a local tarball.
//   node scripts/verify-package.mjs

import { execFileSync, execSync, spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";
const shell = process.platform === "win32";
const work = mkdtempSync(join(tmpdir(), "p5loom-verify-"));
const results = [];
const check = (ok, what) => results.push({ ok: Boolean(ok), what });

try {
  // 1. Pack the tarball the way the release will.
  const packDir = join(work, "pack");
  mkdirSync(packDir, { recursive: true });
  execSync(`${NPM} pack --pack-destination "${packDir}"`, { cwd: root, stdio: "ignore" });
  const tgz = readdirSync(packDir).find((f) => f.endsWith(".tgz"));
  check(tgz, `npm pack produced ${tgz ?? "no tarball"}`);
  const tarball = join(packDir, tgz);

  // 2. Install it into an empty project.
  const project = join(work, "consumer");
  execFileSync("node", ["-e", 'require("fs").mkdirSync(process.argv[1],{recursive:true})', project]);
  writeFileSync(join(project, "package.json"), JSON.stringify({ name: "consumer", version: "1.0.0", type: "module", private: true }, null, 2));
  execSync(`${NPM} install "${tarball}" --no-audit --no-fund --loglevel=error`, { cwd: project, stdio: "ignore" });
  const installed = join(project, "node_modules", "p5loom");
  check(existsSync(join(installed, "src", "index.js")), "the package installs into node_modules/p5loom");
  check(existsSync(join(project, "node_modules", ".bin", process.platform === "win32" ? "p5loom-mcp.cmd" : "p5loom-mcp")), "the p5loom-mcp command is linked");

  // 3. Use the public API from inside the consumer project.
  const probe = join(project, "probe.mjs");
  writeFileSync(
    probe,
    `import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { validateSpec, buildPlan, describePlan, renderSvg, resolveSpec, controlDefaults, SPEC_VERSION } from "p5loom";
import { handle } from "p5loom/mcp";
import { createRequire as cr } from "node:module";

const require = createRequire(import.meta.url);
const spec = JSON.parse(readFileSync(require.resolve("p5loom/examples/bar-chart.json")));
const out = { version: SPEC_VERSION, problems: validateSpec(spec) };
const plan = buildPlan(spec);
out.description = describePlan(plan, spec);
out.svg = renderSvg(plan).startsWith("<svg");
out.defaults = controlDefaults(spec);
out.resolved = resolveSpec(spec).elements.length;
const schema = JSON.parse(readFileSync(require.resolve("p5loom/schema.json")));
out.schemaTitle = schema.title;
out.mcpHandle = typeof handle;
console.log(JSON.stringify(out));
`,
  );
  const raw = execFileSync("node", [probe], { cwd: project, encoding: "utf8" });
  const got = JSON.parse(raw.trim().split("\n").pop());
  check(got.version === 1, "SPEC_VERSION is 1");
  check(got.problems.length === 0, "the bundled bar chart validates");
  check(got.description.startsWith("Visualization 640 by 400 pixels"), `the description is built (${got.description.slice(0, 40)}...)`);
  check(got.svg, "renderSvg returns an SVG document");
  check(got.resolved === 3, "resolveSpec returns the elements to draw");
  check(got.schemaTitle === "p5loom spec, version 1", "the schema export reads back");
  check(got.mcpHandle === "function", "the MCP subpath export loads");

  // 4. Run the MCP command from the installed package over stdio.
  const mcp = spawn("node", [join(installed, "bin", "p5loom-mcp.mjs")], { cwd: project, stdio: ["pipe", "pipe", "ignore"] });
  let stdout = "";
  mcp.stdout.on("data", (d) => (stdout += d.toString("utf8")));
  mcp.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } })}\n`);
  mcp.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "p5loom_list_examples", arguments: {} } })}\n`);
  for (let t = 0; t < 150 && stdout.split("\n").filter(Boolean).length < 2; t += 1) await new Promise((r) => setTimeout(r, 40));
  mcp.kill();
  const lines = stdout.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  check(lines[0]?.result?.serverInfo?.name === "p5loom", "the installed MCP server answers initialize");
  check(Array.isArray(lines[1]?.result?.content?.[0]?.text && JSON.parse(lines[1].result.content[0].text)), "and lists the examples");
} catch (err) {
  check(false, `unexpected error: ${err.message.split("\n")[0]}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}

for (const r of results) console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.what}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} ok, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
