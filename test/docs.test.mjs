import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildSite, checkSite } from "../scripts/build-docs.mjs";
import { EXAMPLES } from "../site/examples.mjs";
import { PAGES, NOT_FOUND, SECTIONS } from "../site/content.mjs";

function freshSite() {
  const out = mkdtempSync(join(tmpdir(), "p5loom-test-"));
  buildSite({ out });
  return out;
}

test("the built site passes every check", () => {
  const out = freshSite();
  try {
    const result = checkSite(out);
    assert.deepEqual(result.problems, []);
    assert.equal(result.ok, true);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("the home page is the docs overview, with a live demo and the main sections", () => {
  const out = freshSite();
  try {
    const home = readFileSync(join(out, "index.html"), "utf8");
    assert.match(home, /<h1 id="hero-title"><span class="rise"><span>Describe the picture\.<\/span><\/span><span class="rise"><span>p5loom draws it\.<\/span><\/span><\/h1>/);
    assert.match(home, /data-demo="sunrise" data-follow-theme/);
    assert.match(home, /data-demo="hello-circle"/);
    for (const s of SECTIONS) assert.ok(home.includes(`href="${s.href}"`), `nav links ${s.href}`);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("every page declares a title and a description, and the 404 page is defined", () => {
  for (const p of [...PAGES, NOT_FOUND]) {
    assert.ok(p.title && p.description, `${p.path} needs a title and description`);
    assert.ok(p.description.length <= 200, `${p.path} description is long`);
  }
  assert.equal(NOT_FOUND.path, "/404.html");
});

test("every example is listed once, has a file, and validates", () => {
  const ids = EXAMPLES.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate example id");
  const out = freshSite();
  try {
    const index = JSON.parse(readFileSync(join(out, "examples", "index.json"), "utf8"));
    assert.deepEqual(index.map((e) => e.id), ids);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("the playground page loads the playground module and p5 is not inline", () => {
  const out = freshSite();
  try {
    const pg = readFileSync(join(out, "playground.html"), "utf8");
    assert.match(pg, /<script type="module" src="\/assets\/playground\.js"><\/script>/);
    assert.match(pg, /<textarea id="pg-spec"/);
    assert.doesNotMatch(pg, /<script>[^<]/);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("the check catches a broken link, an inline script and an inline style", () => {
  const out = freshSite();
  try {
    appendFileSync(join(out, "docs", "api.html"), '<a href="/missing.html">x</a>');
    const page = join(out, "docs", "roadmap.html");
    writeFileSync(page, readFileSync(page, "utf8").replace("</main>", '<script>alert(1)</script><p style="color:red">x</p></main>'));
    const problems = checkSite(out).problems.join("\n");
    assert.match(problems, /broken link \/missing\.html/);
    assert.match(problems, /inline <script>/);
    assert.match(problems, /inline style attribute/);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("the check catches a demo that names no example", () => {
  const out = freshSite();
  try {
    const page = join(out, "docs", "themes.html");
    writeFileSync(page, readFileSync(page, "utf8") + '<div data-demo="not-real"></div>');
    assert.match(checkSite(out).problems.join("\n"), /demo "not-real" has no example/);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("the nginx config sends the same Content-Security-Policy as the local server", async () => {
  const { CSP } = await import("../site/security-headers.mjs");
  const conf = readFileSync(join(import.meta.dirname, "..", "deploy", "nginx.conf"), "utf8");
  assert.ok(conf.includes(`add_header Content-Security-Policy "${CSP}" always;`), "nginx.conf CSP drifted from site/security-headers.mjs");
});

test("the nginx config sends every other production header too", async () => {
  const { HEADERS } = await import("../site/security-headers.mjs");
  const conf = readFileSync(join(import.meta.dirname, "..", "deploy", "nginx.conf"), "utf8");
  for (const [name, value] of Object.entries(HEADERS)) {
    if (name === "Content-Security-Policy") continue;
    assert.ok(conf.includes(`add_header ${name} "${value}" always;`), `nginx.conf is missing ${name}`);
  }
});
