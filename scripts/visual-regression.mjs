#!/usr/bin/env node
// Visual regression for every example picture. Screenshots each demo on the examples page, compares it with the
// committed baseline, and writes a diff image for anything that moved.
//
//   npm run visual            compare against test/visual/baseline (exit 1 when a picture changed)
//   npm run visual:update     write new baselines (review the PNGs, then commit them)
//
// Determinism: a fixed viewport, one device pixel per CSS pixel, dark colour scheme, and a wait for the fonts. A
// picture with no change compares equal to the pixel. A tolerance absorbs anti-aliasing noise and nothing else.

import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { startServer } from "./serve-docs.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dist = join(root, "dist");
const BASE = join(root, "test", "visual", "baseline");
const DIFF = join(root, "test", "visual", "diff");
const update = process.argv.includes("--update");
const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
// Pixels allowed to differ, as a fraction of the picture. Anti-aliasing can move a few; a moved shape moves thousands.
const TOLERANCE = 0.001;

if (!existsSync(join(dist, "index.html"))) {
  console.error("dist/ is missing. Run: npm run docs");
  process.exit(1);
}
mkdirSync(BASE, { recursive: true });
rmSync(DIFF, { recursive: true, force: true });

const ids = JSON.parse(readFileSync(join(root, "examples", "catalog.json"), "utf8")).map((e) => e.id);
const { server, url } = await startServer({ dir: dist, port: 0 });
const browser = await puppeteer.launch({ executablePath: chromePath, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
const results = [];

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 900, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  await page.goto(`${url}/docs/examples.html`, { waitUntil: "networkidle0" });
  await page.waitForFunction(
    (n) => document.querySelectorAll("[data-demo] canvas").length >= n,
    { timeout: 60000 },
    ids.length,
  );
  await page.evaluate(() => document.fonts.ready);
  // The dawn wash follows scroll; hold it at the top so every run starts from the same page.
  await page.evaluate(() => document.documentElement.style.setProperty("--dawn-p", "0"));

  for (const id of ids) {
    const el = await page.$(`[data-demo="${id}"]`);
    if (!el) {
      results.push({ id, status: "missing" });
      continue;
    }
    await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
    await new Promise((r) => setTimeout(r, 150));
    const shot = PNG.sync.read(await el.screenshot({ type: "png" }));
    const file = join(BASE, `${id}.png`);

    if (update || !existsSync(file)) {
      writeFileSync(file, PNG.sync.write(shot));
      results.push({ id, status: update ? "updated" : "created", pixels: shot.width * shot.height });
      continue;
    }

    const base = PNG.sync.read(readFileSync(file));
    if (base.width !== shot.width || base.height !== shot.height) {
      mkdirSync(DIFF, { recursive: true });
      writeFileSync(join(DIFF, `${id}.actual.png`), PNG.sync.write(shot));
      results.push({ id, status: "changed", reason: `size ${base.width}x${base.height} became ${shot.width}x${shot.height}` });
      continue;
    }
    const out = new PNG({ width: shot.width, height: shot.height });
    const diff = pixelmatch(base.data, shot.data, out.data, shot.width, shot.height, { threshold: 0.1 });
    const share = diff / (shot.width * shot.height);
    if (share <= TOLERANCE) {
      results.push({ id, status: "same", diff });
    } else {
      mkdirSync(DIFF, { recursive: true });
      writeFileSync(join(DIFF, `${id}.diff.png`), PNG.sync.write(out));
      writeFileSync(join(DIFF, `${id}.actual.png`), PNG.sync.write(shot));
      results.push({ id, status: "changed", reason: `${diff} pixels differ (${(share * 100).toFixed(2)}%)` });
    }
  }
} finally {
  await browser.close();
  server.close();
}

let failed = 0;
for (const r of results) {
  const detail = r.reason ?? (r.pixels ? `${r.pixels} pixels` : r.diff !== undefined ? `${r.diff} pixels differ` : "");
  console.log(`  ${r.status.padEnd(8)} ${r.id}${detail ? `  ${detail}` : ""}`);
  if (r.status === "changed" || r.status === "missing") failed += 1;
}
console.log(`\n${results.length - failed} ok, ${failed} changed or missing${failed && !update ? `; diffs in ${DIFF}` : ""}`);
process.exitCode = failed && !update ? 1 : 0;
