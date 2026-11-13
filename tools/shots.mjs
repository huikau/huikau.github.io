#!/usr/bin/env node
// Screenshot matrix for huikau.com. Dev-only; the site never loads this.
//
//   node tools/shots.mjs --label wp3                 full matrix into shots/wp3/
//   node tools/shots.mjs --label x --only t-2200     states whose name contains "t-2200"
//   node tools/shots.mjs --label x --vp 390x844      one viewport
//   node tools/shots.mjs --label x --compare baseline   pixel-diff against shots/baseline/
//   node tools/shots.mjs --label x --basket mahi,shark,hee,uhu,kala   seed caught species
//   node tools/shots.mjs --label x --apis live|fixtures|down   (default fixtures)
//   node tools/shots.mjs --label x --weather weather-full     choose a weather fixture
//   node tools/shots.mjs --label x --extra "dive=?t=12:00#scroll=0.6"  add custom states
//
// Determinism: time is frozen at 2026-11-12 (a Thursday, no season) at the state's
// Honolulu time, Math.random is seeded, API calls are answered from tests/fixtures/,
// and CSS animations are frozen at capture. Every state writes a PNG; report.json
// lists console errors/warnings, page errors and every non-local request.

import { createServer } from "node:http";
import { readFile, mkdir, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const label = opt("label", "check");
const only = opt("only", "");
const apis = opt("apis", "fixtures");
const weatherFixture = opt("weather", "weather");
const basket = opt("basket", "");
const compare = opt("compare", "");
const settle = Number(opt("settle", "1800"));
const DATE = opt("date", "2026-11-12");

// Until WP1 replaces assets/site.js, the old page only understands ?sky=.
const legacy = existsSync(join(root, "assets/site.js"));
const legacySky = { "05:50": "dawn", "06:40": "dawn", "12:00": "day", "17:30": "golden", "18:10": "dusk", "22:00": "night" };

const viewports = (opt("vp", "1440x900,1024x768,390x844")).split(",").map((s) => {
  const [width, height] = s.split("x").map(Number);
  return { width, height, name: s };
});

// name, query, options
const states = [
  ["t-0550", "?t=05:50"],
  ["t-0640", "?t=06:40"],
  ["t-1200", "?t=12:00"],
  ["t-1730", "?t=17:30"],
  ["t-1810", "?t=18:10"],
  ["t-2200", "?t=22:00"],
  ["downpour", "?weather=downpour&t=17:30"],
  ["halloween", "?season=halloween&t=18:10"],
  ["winter", "?season=winter&t=22:00"],
  ["newyear", "?season=newyear&t=22:00"],
  ["friday", "?friday=1&t=12:00"],
  ["reduced", "?t=06:40", { reducedMotion: "reduce" }],
  ["full-1200", "?t=12:00", { fullPage: true }],
  ["full-2200", "?t=22:00", { fullPage: true }],
  ["full-reduced", "?t=17:30", { fullPage: true, reducedMotion: "reduce" }],
];
// --extra "name=?query#scroll=0.5;name2=?q" ; scroll is a fraction of the page height
for (const spec of (opt("extra", "") || "").split(";").filter(Boolean)) {
  const [name, rest] = spec.split(/=(.*)/s);
  const [query, hash] = rest.split("#");
  const o = {};
  for (const kv of (hash || "").split("&").filter(Boolean)) {
    const [k, v] = kv.split("=");
    o[k] = k === "fullPage" ? v !== "0" : Number.isNaN(Number(v)) ? v : Number(v);
  }
  states.push([name, query, o]);
}

// ---------- static server (repo root, unknown paths get 404.html like GitHub Pages) ----------
const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml",
  ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".ico": "image/x-icon",
};
export function serve(port = 0) {
  const server = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = join(root, path);
    try {
      if (!file.startsWith(root)) throw new Error("outside");
      const s = await stat(file);
      if (!s.isFile()) throw new Error("dir");
      res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(await readFile(file));
    } catch {
      try {
        res.writeHead(404, { "content-type": types[".html"] });
        res.end(await readFile(join(root, "404.html")));
      } catch { res.writeHead(404); res.end("not found"); }
    }
  });
  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok(server)));
}

export async function launch() {
  try { return await chromium.launch(); } catch {
    const exe = process.env.CHROME_PATH || ["/usr/bin/chromium", "/usr/bin/google-chrome-stable", "/opt/pw-browsers/chromium"].find(existsSync);
    return chromium.launch({ executablePath: exe });
  }
}

// ---------- API fixtures ----------
const fixture = (name) => readFile(join(root, "tests/fixtures", `${name}.json`), "utf8");
export async function routeApis(context, mode = "fixtures", weatherName = "weather") {
  if (mode === "live") return;
  const hosts = ["api.tidesandcurrents.noaa.gov", "api.weather.gov", "marine-api.open-meteo.com", "api.open-meteo.com"];
  await context.route((url) => hosts.includes(url.hostname), async (route) => {
    if (mode === "down") return route.abort("failed");
    const u = new URL(route.request().url());
    let name;
    if (u.hostname === "api.tidesandcurrents.noaa.gov") name = u.searchParams.get("interval") === "hilo" ? "tides-hilo" : "tides-hourly";
    else if (u.hostname === "api.weather.gov") name = weatherName;
    else if (u.hostname === "marine-api.open-meteo.com") name = "surf";
    else name = "forecast";
    route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: await fixture(name) });
  });
}

// Seeded Math.random so stars, clouds and catches land in the same place every run.
const seedScript = `(() => { let s = 0x5eed1234; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();`;

const hstToUtc = (hhmm) => new Date(`${DATE}T${hhmm}:00-10:00`);

async function capture(browser, base, vp, [name, query, o = {}], outDir, log) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    reducedMotion: o.reducedMotion || "no-preference",
    serviceWorkers: "block",
  });
  await routeApis(context, apis, weatherFixture);
  await context.addInitScript(seedScript);
  if (basket) {
    const ids = JSON.stringify(basket.split(","));
    await context.addInitScript(`try { localStorage.setItem("huikau-basket", ${JSON.stringify(ids)}) } catch {}`);
  }
  const page = await context.newPage();
  const t = (query.match(/[?&]t=(\d\d:\d\d)/) || [])[1] || "12:00";
  await page.clock.setFixedTime(hstToUtc(t));

  let q = query;
  if (legacy && legacySky[t] && !/[?&]sky=/.test(q)) q += `&sky=${legacySky[t]}`;
  const entry = { state: name, viewport: vp.name, url: q, console: [], errors: [], external: [] };
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) entry.console.push(`${m.type()}: ${m.text()}`); });
  page.on("pageerror", (e) => entry.errors.push(String(e)));
  page.on("request", (r) => { const u = new URL(r.url()); if (!["127.0.0.1", "localhost"].includes(u.hostname) && u.protocol.startsWith("http")) entry.external.push(u.hostname + u.pathname); });

  await page.goto(base + "/" + q, { waitUntil: "load" });
  await page.waitForTimeout(settle);
  if (o.scroll != null) {
    await page.evaluate((f) => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), o.scroll);
    await page.waitForTimeout(800);
  }
  const hScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (hScroll) entry.errors.push("horizontal scroll");
  const file = join(outDir, vp.name, `${name}.png`);
  await mkdir(dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage: !!o.fullPage, animations: "disabled", caret: "hide" });
  entry.file = file.slice(root.length + 1);
  log.push(entry);
  await context.close();
}

// Pixel diff in the browser (no extra dependencies). Returns the share of pixels whose
// largest channel difference is over 32/255, and writes a red-on-gray diff image.
async function diff(browser, a, b, out) {
  const page = await browser.newPage();
  const [da, db] = await Promise.all([a, b].map(async (f) => "data:image/png;base64," + (await readFile(f)).toString("base64")));
  const result = await page.evaluate(async ([da, db]) => {
    const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
    const [ia, ib] = await Promise.all([load(da), load(db)]);
    const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
    const read = (img) => { const c = new OffscreenCanvas(w, h), x = c.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
    const pa = read(ia), pb = read(ib);
    const c = new OffscreenCanvas(w, h), x = c.getContext("2d"), out = x.createImageData(w, h);
    let bad = 0;
    for (let i = 0; i < pa.length; i += 4) {
      const d = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]));
      const g = (pa[i] + pa[i + 1] + pa[i + 2]) / 9 + 160;
      if (d > 32) { bad++; out.data.set([255, 0, 0, 255], i); } else out.data.set([g, g, g, 255], i);
    }
    x.putImageData(out, 0, 0);
    const blob = await c.convertToBlob();
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ""; for (const byte of buf) s += String.fromCharCode(byte);
    return { share: bad / (w * h), sizeChanged: ia.width !== ib.width || ia.height !== ib.height, png: btoa(s) };
  }, [da, db]);
  await writeFile(out, Buffer.from(result.png, "base64"));
  await page.close();
  return { share: result.share, sizeChanged: result.sizeChanged };
}

async function main() {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await launch();
  const outDir = join(root, "shots", label);
  const log = [];
  const jobs = [];
  for (const vp of viewports) for (const s of states) if (!only || only.split(",").some((o) => s[0].includes(o))) jobs.push([vp, s]);
  // a few at a time
  const queue = jobs.slice();
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const [vp, s] = queue.shift();
      try { await capture(browser, base, vp, s, outDir, log); }
      catch (e) { log.push({ state: s[0], viewport: vp.name, errors: [`capture failed: ${e.message}`], console: [], external: [] }); }
    }
  }));
  log.sort((a, b) => (a.viewport + a.state).localeCompare(b.viewport + b.state));

  const report = { label, legacy, apis, date: DATE, shots: log };
  if (compare) {
    report.compare = [];
    for (const e of log) {
      if (!e.file) continue;
      const other = join(root, "shots", compare, e.viewport, `${e.state}.png`);
      if (!existsSync(other)) continue;
      const out = join(outDir, e.viewport, `${e.state}.diff.png`);
      const r = await diff(browser, other, join(root, e.file), out);
      report.compare.push({ state: e.state, viewport: e.viewport, changed: +(r.share * 100).toFixed(2), sizeChanged: r.sizeChanged });
    }
  }
  await writeFile(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  server.close();

  const problems = log.filter((e) => e.errors.length || e.console.length);
  const external = [...new Set(log.flatMap((e) => e.external))].sort();
  console.log(`${log.length} shots in shots/${label}/ (${legacy ? "legacy ?sky= mapping" : "?t= native"}, apis: ${apis})`);
  console.log(`external requests: ${external.length ? external.join(", ") : "none"}`);
  for (const e of problems) console.log(`  ${e.viewport} ${e.state}: ${[...e.errors, ...e.console].join(" | ")}`);
  if (!problems.length) console.log("no console errors, warnings or page errors");
  if (report.compare) {
    const worst = report.compare.slice().sort((a, b) => b.changed - a.changed);
    console.log(`diff vs ${compare} (% pixels changed):`);
    for (const c of worst) console.log(`  ${c.changed.toFixed(2).padStart(6)}%  ${c.viewport} ${c.state}${c.sizeChanged ? "  (size changed)" : ""}`);
  }
  process.exitCode = problems.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
