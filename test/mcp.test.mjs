import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { handle, handleAny, serveHttp } from "../src/mcp/server.js";
import { callTool, toolList, TOOLS } from "../src/mcp/tools.js";

const BIN = fileURLToPath(new URL("../bin/p5loom-mcp.mjs", import.meta.url));
const good = { version: 1, seed: 1, canvas: { width: 120, height: 80 }, elements: [{ type: "circle", x: 0.5, y: 0.5, r: 0.3, fill: "accent" }] };
const text = (r) => r.result.content[0].text;

test("every tool has a name in snake_case, a description and an input schema, and names are unique", () => {
  const names = TOOLS.map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
  for (const t of TOOLS) {
    assert.match(t.name, /^p5loom_[a-z_]+$/);
    assert.ok(t.description.length > 40, `${t.name} needs a description an agent can route on`);
    assert.equal(t.inputSchema.type, "object");
  }
});

test("initialize answers with the protocol version the client asked for, and the tools capability", () => {
  const r = handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } });
  assert.equal(r.result.protocolVersion, "2024-11-05");
  assert.deepEqual(r.result.capabilities, { tools: {}, resources: {}, prompts: {} });
  assert.equal(r.result.serverInfo.name, "p5loom");
  const unknown = handle({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } });
  assert.equal(unknown.result.protocolVersion, "2025-06-18");
});

test("notifications take no reply; unknown methods are a protocol error", () => {
  assert.equal(handle({ jsonrpc: "2.0", method: "notifications/initialized" }), null);
  const r = handle({ jsonrpc: "2.0", id: 3, method: "nope/nothing" });
  assert.equal(r.error.code, -32601);
});

test("a message that is not JSON-RPC is refused with the invalid request code", () => {
  assert.equal(handle({ id: 1, method: "ping" }).error.code, -32600);
  assert.equal(handle([]).error.code, -32600);
});

test("a batch answers with one reply per request and skips notifications", () => {
  const replies = handleAny([
    { jsonrpc: "2.0", id: 1, method: "ping" },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
  ]);
  assert.equal(replies.length, 2);
  assert.equal(handleAny([{ jsonrpc: "2.0", method: "notifications/x" }]), null);
});

test("validate reports problems; a valid spec is valid", () => {
  const bad = callTool("p5loom_validate", { spec: { ...good, seed: -1 } });
  assert.equal(bad.isError, undefined);
  const parsed = JSON.parse(bad.content[0].text);
  assert.equal(parsed.valid, false);
  assert.match(parsed.problems.join(" "), /seed:/);
  assert.equal(JSON.parse(callTool("p5loom_validate", { spec: good }).content[0].text).valid, true);
});

test("a spec sent as a string is refused as a tool error the model can read", () => {
  const r = callTool("p5loom_render_svg", { spec: JSON.stringify(good) });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /send the spec as a JSON object/);
});

test("an invalid spec to render is a tool error that lists the problems", () => {
  const r = callTool("p5loom_render_svg", { spec: { ...good, canvas: { width: 4, height: 80 } } });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /invalid spec \(1 problem\)/);
  assert.match(r.content[0].text, /canvas\.width/);
});

test("render_svg returns the same picture the browser draws, as SVG text", () => {
  const svg = callTool("p5loom_render_svg", { spec: good }).content[0].text;
  assert.match(svg, /^<svg /);
  assert.match(svg, /width="120" height="80"/);
  assert.match(svg, /<circle /);
});

test("controls are listed with defaults, and values change the description", () => {
  const spec = {
    ...good,
    controls: [{ id: "dots", type: "slider", label: "Dots", min: 1, max: 100, step: 1, value: 10 }],
    elements: [{ type: "random-dots", count: { control: "dots" } }],
  };
  const listed = JSON.parse(callTool("p5loom_list_controls", { spec }).content[0].text);
  assert.deepEqual(listed.defaults, { dots: 10 });
  const d1 = JSON.parse(callTool("p5loom_describe", { spec }).content[0].text);
  const d2 = JSON.parse(callTool("p5loom_describe", { spec, values: { dots: 40 } }).content[0].text);
  assert.match(d1.description, /10 generated dots/);
  assert.match(d2.description, /40 generated dots/);
});

test("resolve shows exactly what would be drawn", () => {
  const spec = { ...good, controls: [{ id: "show", type: "toggle", label: "Show", value: true }], elements: [{ type: "circle", x: 0.5, y: 0.5, r: 0.2, when: "show" }] };
  const hidden = JSON.parse(callTool("p5loom_resolve", { spec, values: { show: false } }).content[0].text);
  assert.deepEqual(hidden.elements, []);
});

test("the examples are listed and each one validates", () => {
  const list = JSON.parse(callTool("p5loom_list_examples", {}).content[0].text);
  assert.ok(list.length >= 7);
  for (const e of list) {
    const spec = JSON.parse(callTool("p5loom_get_example", { id: e.id }).content[0].text);
    assert.equal(JSON.parse(callTool("p5loom_validate", { spec }).content[0].text).valid, true, `example ${e.id} is valid`);
  }
});

test("an example id is checked before it touches the file system", () => {
  const r = callTool("p5loom_get_example", { id: "../package" });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /lowercase letters/);
  assert.equal(callTool("p5loom_get_example", { id: "nope" }).isError, true);
});

test("an unknown tool is a protocol error, not a tool result", () => {
  assert.throws(() => callTool("p5loom_nothing", {}), /unknown tool/);
  assert.equal(handle({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "p5loom_nothing" } }).error.code, -32602);
});

test("the reference names every element type and the binding rule", () => {
  const ref = callTool("p5loom_reference", {}).content[0].text;
  for (const t of ["circle", "rect", "line", "scatter", "random-dots"]) assert.ok(ref.includes(t), t);
  assert.match(ref, /\{ "control": "<id>" \}/);
});

test("stdio: a client can initialise, list tools and draw, over a real child process", async () => {
  const child = spawn(process.execPath, [BIN], { stdio: ["pipe", "pipe", "pipe"] });
  const lines = [];
  let buf = "";
  child.stdout.on("data", (d) => {
    buf += d.toString("utf8");
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      lines.push(JSON.parse(buf.slice(0, i)));
      buf = buf.slice(i + 1);
    }
  });
  const wait = async (n) => {
    for (let t = 0; t < 200 && lines.length < n; t += 1) await new Promise((r) => setTimeout(r, 20));
  };
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "p5loom_render_svg", arguments: { spec: good } } })}\n`);
  child.stdin.write("not json\n");
  await wait(4);
  child.kill();
  assert.equal(lines[0].id, 1);
  assert.equal(lines[0].result.serverInfo.name, "p5loom");
  assert.equal(lines.length, 4, "the notification and the blank line produce no output; the bad line gets a parse error");
  assert.equal(lines[1].result.tools.length, TOOLS.length);
  assert.match(lines[2].result.content[0].text, /<svg /);
  assert.equal(lines[3].error.code, -32700);
});

test("http: POST /mcp answers JSON, a notification gets 202, and a non-local origin is refused", async () => {
  const { server, url } = await serveHttp({ port: 0 });
  try {
    const post = (body, headers = {}) =>
      fetch(`${url}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
    const ok = await post({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).result.tools.length, TOOLS.length);
    const note = await post({ jsonrpc: "2.0", method: "notifications/initialized" });
    assert.equal(note.status, 202);
    const remote = await post({ jsonrpc: "2.0", id: 2, method: "ping" }, { Origin: "https://evil.example" });
    assert.equal(remote.status, 403);
    const local = await post({ jsonrpc: "2.0", id: 3, method: "ping" }, { Origin: "http://localhost:3000" });
    assert.equal(local.status, 200);
    const wrongPath = await fetch(`${url}/other`, { method: "POST", body: "{}" });
    assert.equal(wrongPath.status, 404);
    const getNotAllowed = await fetch(`${url}/mcp`);
    assert.equal(getNotAllowed.status, 405);
    const junk = await fetch(`${url}/mcp`, { method: "POST", body: "{nope" });
    assert.equal(junk.status, 400);
  } finally {
    server.close();
  }
});
