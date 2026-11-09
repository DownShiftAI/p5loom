#!/usr/bin/env node
// Browser test for the built site. Serves dist/ with the production headers (so the Content-Security-Policy is
// enforced), opens every page in Chrome, and checks what a visitor sees: the demos draw, the playground works, the
// theme switch works, nothing overflows a phone, and no console error or CSP violation happens.
//
//   npm run docs && npm run e2e:docs
//   CHROME_PATH="C:\\path\\to\\chrome.exe" npm run e2e:docs     (optional; defaults to a Windows Chrome install)
//   E2E_SHOTS=dir node scripts/e2e-docs.mjs                      (also saves screenshots for review)

import { mkdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { startServer } from "./serve-docs.mjs";
import { PAGES, NOT_FOUND } from "../site/content.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dist = join(root, "dist");
const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const shots = process.env.E2E_SHOTS ? resolve(process.env.E2E_SHOTS) : null;

if (!existsSync(join(dist, "index.html"))) {
  console.error("dist/ is missing. Run: npm run docs");
  process.exit(1);
}
if (shots) mkdirSync(shots, { recursive: true });

const failures = [];
const passes = [];
const check = (ok, what) => (ok ? passes.push(what) : failures.push(what));

const { server, url } = await startServer({ dir: dist, port: 0 });
const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

function watch(page, label) {
  const problems = [];
  page.on("pageerror", (e) => problems.push(`${label}: page error ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // p5.js registers motion listeners when it starts; a sandboxed sketch frame has no motion sensors, so Chrome
    // reports the request. Nothing in code mode uses them. Every other console error still fails the page.
    if (/Permissions policy violation: accelerometer/.test(m.text())) return;
    problems.push(`${label}: console ${m.text()}`);
  });
  page.on("requestfailed", (r) => {
    // A cancelled navigation is not a fault of the site.
    if (r.failure()?.errorText !== "net::ERR_ABORTED") problems.push(`${label}: request failed ${r.url()}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().endsWith("/favicon.ico")) problems.push(`${label}: HTTP ${r.status()} ${r.url()}`);
  });
  return problems;
}

async function open(path, width = 1280, height = 900) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  const problems = watch(page, path);
  const res = await page.goto(url + path, { waitUntil: "networkidle0", timeout: 45000 });
  return { page, problems, status: res?.status() };
}

async function canvasCount(page, selector = "canvas") {
  return page.$$eval(selector, (els) => els.length);
}

try {
  // 1. Every page answers, carries a title, and produces no console errors or CSP violations.
  for (const p of PAGES) {
    const { page, problems, status } = await open(p.path);
    check(status === 200, `${p.path} answers 200 (got ${status})`);
    const title = await page.title();
    check(title.length > 0, `${p.path} has a title`);
    await new Promise((r) => setTimeout(r, 250));
    for (const prob of problems) failures.push(prob);
    if (!problems.length) passes.push(`${p.path} loads with no console errors`);
    await page.close();
  }

  // 2. The 404 page answers 404 and says so.
  {
    const page = await browser.newPage();
    const res = await page.goto(url + "/no-such-page.html", { waitUntil: "networkidle0" });
    check(res?.status() === 404, `unknown path answers 404 (got ${res?.status()})`);
    const h1 = await page.$eval("h1", (e) => e.textContent);
    check(h1 === NOT_FOUND.body.match(/<h1>(.*?)<\/h1>/)[1], "404 page shows its heading");
    await page.close();
  }

  // 3. Home: the overview draws its demo, the canvas is labelled for screen readers, and the theme switch works.
  {
    const { page, problems } = await open("/");
    await page.waitForSelector("[data-demo] canvas", { timeout: 20000 });
    check((await canvasCount(page, "[data-demo] canvas")) === 2, "home draws its two demo pictures (sunrise and circle)");
    const label = await page.$eval("[data-demo=\"sunrise\"] canvas", (c) => c.getAttribute("role") + "|" + c.getAttribute("aria-label"));
    check(label.startsWith("img|Visualization 960 by 560 pixels") && /(dark|light) theme/.test(label), "sunrise follows the system or chosen theme and has a text description");
    const caption = await page.$eval("[data-demo=\"sunrise\"] .p5loom-sr-only", (e) => e.textContent);
    check(caption.includes("1 circle element") && caption.includes("220 generated dots"), "sunrise has a visually hidden caption from the spec");
    const dark = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--night").trim());
    check(dark.length > 0, "design tokens are loaded from tokens.css");

    const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.click("#theme-toggle");
    const after = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    check(before !== after, "theme button changes the page colours");
    const attr = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    check(attr === "light" || attr === "dark", `theme button sets an explicit data-theme (got ${attr})`);
    await page.click("#theme-toggle");
    await page.evaluate(() => localStorage.removeItem("p5loom-theme"));
    for (const prob of problems) failures.push(prob);
    if (shots) await page.screenshot({ path: join(shots, "home-desktop.png"), fullPage: true });
    await page.close();
  }

  // 4. Docs pages draw every demo they promise.
  const demoCounts = { "/docs/elements.html": 5, "/docs/examples.html": 10, "/docs/themes.html": 1, "/docs/getting-started.html": 1 };
  for (const [path, expected] of Object.entries(demoCounts)) {
    const { page, problems } = await open(path);
    await page.waitForFunction(
      (n) => document.querySelectorAll("[data-demo] canvas").length >= n,
      { timeout: 25000 },
      expected,
    ).catch(() => {});
    const drawn = await canvasCount(page, "[data-demo] canvas");
    check(drawn === expected, `${path} draws ${expected} demo pictures (drew ${drawn})`);
    for (const prob of problems) failures.push(prob);
    await page.close();
  }

  // 4b. Controls: the library draws the inputs, and moving one redraws the picture it describes.
  {
    const { page, problems } = await open("/docs/controls.html");
    const scope = "[data-demo=\"controls-demo\"]";
    await page.waitForSelector(`${scope} .p5loom-controls`, { timeout: 25000 });
    const inputs = await page.evaluate(
      (s) => document.querySelectorAll(`${s} .p5loom-controls input, ${s} .p5loom-controls select`).length,
      scope,
    );
    check(inputs === 6, `controls page draws six inputs for the controls demo (drew ${inputs})`);
    const labelled = await page.evaluate(
      (s) =>
        Array.from(document.querySelectorAll(`${s} .p5loom-control`)).every((r) => {
          const label = r.querySelector("label");
          return Boolean(label && label.htmlFor && document.getElementById(label.htmlFor));
        }),
      scope,
    );
    check(labelled, "every control is labelled by a label that points at its input");
    const before = await page.$eval(`${scope} .p5loom-sr-only`, (e) => e.textContent);
    check(before.includes("1 line element"), "the horizon is drawn while its toggle is on");
    await page.evaluate((s) => {
      const box = document.querySelector(`${s} input[type=checkbox]`);
      box.checked = false;
      box.dispatchEvent(new Event("change"));
    }, scope);
    await page.waitForFunction(
      (s) => !document.querySelector(`${s} .p5loom-sr-only`).textContent.includes("line element"),
      { timeout: 5000 },
      scope,
    );
    check(true, "switching the horizon off removes the line from the picture");
    await page.evaluate((s) => {
      const r = document.querySelector(`${s} input[type=range][id$="-dots"]`);
      r.value = "50";
      r.dispatchEvent(new Event("input"));
    }, scope);
    await page.waitForFunction(
      (s) => document.querySelector(`${s} .p5loom-sr-only`).textContent.includes("50 generated dots"),
      { timeout: 5000 },
      scope,
    );
    check(true, "moving the stars slider redraws with the new count");
    const label = await page.$eval(`${scope} canvas`, (c) => c.getAttribute("aria-label"));
    check(label.includes("50 generated dots"), "the canvas label follows the controls too");
    for (const prob of problems) failures.push(prob);
    await page.close();
  }

  // 4d. Charts, integrations, code mode, the second nav row, live announcements and shareable state.
  {
    const { page, problems } = await open("/docs/charts.html");
    await page.waitForFunction(() => document.querySelectorAll("[data-demo] canvas").length >= 2, { timeout: 25000 }).catch(() => {});
    check((await canvasCount(page, "[data-demo] canvas")) === 2, "charts page draws its two chart pictures");
    const bars = await page.$eval("[data-demo=\"bar-chart\"] .p5loom-sr-only", (e) => e.textContent);
    check(bars.includes("6 bars") || bars.includes("1 bars") || bars.includes("bars element"), "the bar chart caption names its element");
    const subnav = await page.$$eval("nav.subnav a", (els) => els.length);
    check(subnav >= 13, `docs pages show the full second nav row (${subnav} links)`);
    for (const prob of problems) failures.push(prob);
    await page.close();
  }
  {
    const { page, problems } = await open("/docs/integrations.html");
    await page.waitForFunction(() => document.querySelector("p5-loom canvas") !== null, { timeout: 25000 }).catch(() => {});
    check((await canvasCount(page, "p5-loom canvas")) === 1, "the p5-loom web component draws its picture from src");
    const defined = await page.evaluate(() => customElements.get("p5-loom") !== undefined);
    check(defined, "the p5-loom element is defined on the integrations page");
    for (const prob of problems) failures.push(prob);
    await page.close();
  }
  {
    const { page, problems } = await open("/docs/code-mode.html");
    await page.waitForSelector("[data-sketch] iframe", { timeout: 15000 }).catch(() => {});
    const attrs = await page.$eval("[data-sketch] iframe", (f) => ({ sandbox: f.getAttribute("sandbox"), src: f.getAttribute("src") })).catch(() => ({}));
    check(attrs.sandbox === "allow-scripts", `the sketch frame is sandboxed with only allow-scripts (got ${attrs.sandbox})`);
    check(String(attrs.src).startsWith("/sketches/rings/"), `the sketch frame loads its own file (src ${attrs.src})`);
    // The sketch draws inside the frame, under the frame's own policy.
    await new Promise((r) => setTimeout(r, 2500));
    const inner = page.frames().find((f) => f.url().includes("/sketches/rings/"));
    const drawn = inner ? await inner.evaluate(() => document.querySelectorAll("canvas").length).catch(() => 0) : 0;
    check(drawn === 1, `the sketch draws one canvas inside its frame (found ${drawn})`);
    for (const prob of problems) failures.push(prob);
    await page.close();
  }

  {
    const { page, problems } = await open("/docs/controls.html");
    const scope = "[data-demo=\"controls-demo\"]";
    await page.waitForSelector(`${scope} .p5loom-controls`, { timeout: 25000 });
    check(!(new URL(page.url()).search.includes("p5loom-controls-demo")), "the controls page starts with no share parameter");
    await page.evaluate((s) => {
      const r = document.querySelector(`${s} input[type=range][id$="-dots"]`);
      r.value = "50";
      r.dispatchEvent(new Event("input"));
    }, scope);
    await page.waitForFunction(() => new URL(location.href).searchParams.has("p5loom-controls-demo"), { timeout: 5000 });
    const token = await page.evaluate(() => new URL(location.href).searchParams.get("p5loom-controls-demo"));
    check(typeof token === "string" && token.length > 0, "moving a control writes a share parameter to the address bar");
    await page.waitForFunction(
      (s) => document.querySelector(`${s} [role=status]`)?.textContent.includes("Stars: 50"),
      { timeout: 5000 },
      scope,
    );
    check(true, "the change is announced to the live region once the reader pauses");
    await page.close();
    // A new visit to the link reproduces the picture.
    const again = await browser.newPage();
    await again.setViewport({ width: 1280, height: 900 });
    await again.goto(`${url}/docs/controls.html?p5loom-controls-demo=${token}`, { waitUntil: "networkidle0" });
    await again.waitForFunction(() => document.querySelector("[data-demo=\"controls-demo\"] .p5loom-sr-only")?.textContent.includes("50 generated dots"), { timeout: 25000 });
    check(true, "opening the share link draws the same picture");
    await again.close();
    for (const prob of problems) failures.push(prob);
  }

  // 4c. The MCP page names the tools the server actually has.
  {
    const { page } = await open("/docs/mcp.html");
    const tools = await page.$$eval("td code", (els) => Array.from(els, (e) => e.textContent));
    check(tools.includes("p5loom_render_svg") && tools.includes("p5loom_validate"), "the MCP page lists the server's tools");
    await page.close();
  }

  // 5. Playground: a valid example draws; a broken spec lists its problems; the theme and reset buttons work.
  {
    const { page, problems } = await open("/playground.html");
    await page.waitForFunction(() => document.querySelector("#pg-status")?.textContent.startsWith("Valid"), { timeout: 25000 });
    check((await canvasCount(page, "#pg-stage canvas")) === 1, "playground draws the default example");
    const desc = await page.$eval("#pg-desc", (e) => e.textContent);
    check(desc.startsWith("Visualization 960 by 560 pixels"), "playground shows the text description");

    await page.$eval("#pg-spec", (el) => (el.value = '{"version":1,"seed":-1,"canvas":{"width":8,"height":8},"elements":[{"type":"circle","x":0.5,"y":0.5,"r":0.2,"fill":"#ff00ff"}]}'));
    await page.$eval("#pg-spec", (el) => el.dispatchEvent(new Event("input")));
    await page.waitForFunction(() => document.querySelector("#pg-status")?.textContent.includes("problem"), { timeout: 5000 });
    const items = await page.$$eval("#pg-problems li", (els) => els.map((e) => e.textContent));
    check(items.some((t) => t.startsWith("seed:")), "playground lists the seed problem");
    check(items.some((t) => t.includes('"#ff00ff" is not a theme token')), "playground lists the raw colour problem");
    check((await canvasCount(page, "#pg-stage canvas")) === 0, "playground does not draw an invalid spec");

    await page.$eval("#pg-spec", (el) => (el.value = "{ not json"));
    await page.$eval("#pg-spec", (el) => el.dispatchEvent(new Event("input")));
    await page.waitForFunction(() => document.querySelector("#pg-problems li")?.textContent.startsWith("Not valid JSON"), { timeout: 5000 });
    check(true, "playground reports invalid JSON");

    await page.click("#pg-reset");
    await page.waitForFunction(() => document.querySelector("#pg-status")?.textContent.startsWith("Valid"), { timeout: 10000 });
    const themeBefore = JSON.parse(await page.$eval("#pg-spec", (e) => e.value)).theme;
    await page.click("#pg-theme");
    await page.waitForFunction((was) => JSON.parse(document.querySelector("#pg-spec")?.value || "{}").theme !== was, { timeout: 5000 }, themeBefore);
    await page.waitForFunction(() => document.querySelectorAll("#pg-stage canvas").length === 1, { timeout: 5000 });
    check(true, "theme button switches the spec's theme and redraws");

    await page.select("#pg-example", "random-field");
    await page.waitForFunction(() => document.querySelector("#pg-desc")?.textContent.includes("900 generated dots"), { timeout: 10000 });
    check(true, "example picker loads another example");

    if (shots) await page.screenshot({ path: join(shots, "playground-desktop.png"), fullPage: true });
    for (const prob of problems) failures.push(prob);
    await page.close();
  }

  // 6. Share link: the spec survives a round trip through the URL fragment.
  {
    const { page } = await open("/playground.html#example=bars");
    await page.waitForFunction(() => document.querySelector("#pg-status")?.textContent.startsWith("Valid"), { timeout: 25000 });
    const original = await page.$eval("#pg-spec", (e) => e.value);
    await page.click("#pg-share");
    await new Promise((r) => setTimeout(r, 300));
    const hash = await page.evaluate(() => location.hash);
    check(hash.startsWith("#spec="), "share sets a spec fragment");
    const again = await browser.newPage();
    await again.goto(url + "/playground.html" + hash, { waitUntil: "networkidle0" });
    await again.waitForFunction(() => document.querySelector("#pg-status")?.textContent.startsWith("Valid"), { timeout: 25000 });
    const restored = await again.$eval("#pg-spec", (e) => e.value);
    check(JSON.parse(restored).elements.length === JSON.parse(original).elements.length, "share link restores the same spec");
    await again.close();
    await page.close();
  }

  // 7. Phones: no page scrolls sideways at 390px, and the playground stacks to one column.
  for (const path of ["/", "/docs/spec.html", "/docs/elements.html", "/playground.html"]) {
    const { page, problems } = await open(path, 390, 844);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(overflow <= 0, `${path} has no sideways scroll at 390px (overflow ${overflow}px)`);
    for (const prob of problems) failures.push(prob);
    if (shots && path === "/playground.html") await page.screenshot({ path: join(shots, "playground-phone.png"), fullPage: true });
    if (shots && path === "/") await page.screenshot({ path: join(shots, "home-phone.png"), fullPage: true });
    await page.close();
  }

  // 8. Every page: one h1, a skip link, and a main landmark.
  for (const p of PAGES) {
    const { page } = await open(p.path);
    const h1s = await page.$$eval("h1", (e) => e.length);
    const main = await page.$("main#main");
    check(h1s === 1, `${p.path} has exactly one h1 (has ${h1s})`);
    check(Boolean(main), `${p.path} has a main landmark`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

for (const p of passes) console.log(`  ok   ${p}`);
for (const f of failures) console.log(`  FAIL ${f}`);
console.log(`\n${passes.length} passed, ${failures.length} failed`);
process.exitCode = failures.length ? 1 : 0;
