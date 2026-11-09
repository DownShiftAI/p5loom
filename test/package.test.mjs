import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
// On Windows the npm command is npm.cmd, which only runs through a shell.
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";
const packed = () => JSON.parse(execFileSync(NPM, ["pack", "--dry-run", "--json"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], shell: process.platform === "win32" }))[0];

test("the changelog describes the version the package names", () => {
  const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  assert.ok(changelog.includes(`## ${pkg.version}`), `CHANGELOG.md has no section for ${pkg.version}`);
});

test("every export target exists in the repository", () => {
  const targets = [];
  const walk = (v) => {
    if (typeof v === "string") targets.push(v);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(pkg.exports);
  assert.ok(targets.length > 10);
  for (const t of targets) {
    // A pattern target such as ./examples/* is checked by its folder.
    const path = t.includes("*") ? t.slice(0, t.indexOf("*")) : t;
    assert.ok(existsSync(join(root, path)), `missing export target ${t}`);
  }
});

test("the package ships the library, the CLI, the schema, the types and the styles, and nothing from development", () => {
  const files = packed().files.map((f) => f.path);
  for (const must of ["src/index.js", "src/mcp/server.js", "bin/p5loom-mcp.mjs", "schema/p5loom-spec-1.schema.json", "types/index.d.ts", "styles/p5loom.css", "examples/catalog.json", "README.md", "LICENSE"]) {
    assert.ok(files.includes(must), `missing ${must}`);
  }
  const development = /^(test|site|scripts|deploy|\.github|node_modules|dist)\//;
  for (const f of files) assert.doesNotMatch(f, development, `development file in the package: ${f}`);
});

test("the CLI is marked executable for Node", () => {
  assert.ok(readFileSync(join(root, "bin", "p5loom-mcp.mjs"), "utf8").startsWith("#!/usr/bin/env node"));
});

test("the types declare the main entry points", () => {
  const types = readFileSync(join(root, "types", "index.d.ts"), "utf8");
  const declared = [
    /export function mount\(/,
    /export function validateSpec\(/,
    /export function buildPlan\(/,
    /export function renderSvg\(/,
    /export function mountSketch\(/,
    /export interface Spec \{/,
    /export type Element =/,
  ];
  for (const re of declared) assert.match(types, re);
});

test("the package has no runtime dependencies", () => {
  assert.deepEqual(pkg.dependencies ?? {}, {});
});
