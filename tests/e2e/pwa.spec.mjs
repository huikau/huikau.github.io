// PWA e2e (WP10). Run: node tests/e2e/pwa.spec.mjs   (exits non-zero on failure)
// Covers: the 404 ("Lost at sea."), the manifest and its icons, Chromium's installability check, the service worker
// (offline after one visit with the panels marked "From earlier"; a deploy shows up on the next load), and the
// postcard dialog. Service workers are ALLOWED here (the screenshot matrix blocks them).
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createServer as createHttps } from "node:https";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { serve, routeApis } from "../../tools/shots.mjs";

const origin = await serve(0);
const originBase = `http://127.0.0.1:${origin.address().port}`;

// A thin proxy in front of the repo server, so a test can "deploy": change the service worker's VERSION and the files it ships.
const deploy = { on: false };
const front = createServer(async (req, res) => {
  const r = await fetch(originBase + req.url, { headers: { accept: req.headers.accept || "*/*" } });
  let body = Buffer.from(await r.arrayBuffer());
  const path = new URL(req.url, "http://x").pathname;
  if (deploy.on) {
    const edit = (fn) => { body = Buffer.from(fn(body.toString("utf8"))); };
    if (path === "/sw.js") edit((s) => s.replace(/const VERSION = "[^"]+";/, 'const VERSION = "e2e-deploy-2";'));
    if (path === "/js/main.js") edit((s) => s + "\nwindow.__deploy = 2;\n");
    if (path === "/" || path === "/index.html") edit((s) => s.replace("</head>", '<meta name="e2e-deploy" content="2"></head>'));
  }
  res.writeHead(r.status, { "content-type": r.headers.get("content-type") || "application/octet-stream", "cache-control": "no-store" });
  res.end(body);
});
await new Promise((ok) => front.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${front.address().port}`;

// The worker's own network requests are not seen by Playwright's routes (and a routed request bypasses the worker), so the
// real hosts are mapped to a local HTTPS server that plays the three APIs from tests/fixtures/. `fakeApi.down` fails them.
const API_HOSTS = ["api.tidesandcurrents.noaa.gov", "api.weather.gov", "marine-api.open-meteo.com", "api.open-meteo.com"];
const fakeApi = { down: false, hits: 0 };
let haveOpenssl = true;
try {
  const dir = mkdtempSync(join(tmpdir(), "huikau-e2e-"));
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(dir, "k.pem"), "-out", join(dir, "c.pem"), "-subj", "/CN=api.weather.gov", "-days", "2"], { stdio: "ignore" });
  const api = createHttps({ key: readFileSync(join(dir, "k.pem")), cert: readFileSync(join(dir, "c.pem")) }, async (req, res) => {
    fakeApi.hits++;
    if (fakeApi.down) return req.socket.destroy();
    const host = (req.headers.host || "").split(":")[0], u = new URL(req.url, "https://x");
    const name = host === "api.tidesandcurrents.noaa.gov" ? (u.searchParams.get("interval") === "hilo" ? "tides-hilo" : "tides-hourly")
      : host === "api.weather.gov" ? "weather" : host === "marine-api.open-meteo.com" ? "surf" : "forecast";
    res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
    res.end(await readFile(`tests/fixtures/${name}.json`));
  });
  await new Promise((ok) => api.listen(0, "127.0.0.1", ok));
  fakeApi.port = api.address().port;
  fakeApi.server = api;
} catch { haveOpenssl = false; }

async function launch() {
  const args = haveOpenssl ? [`--host-resolver-rules=${API_HOSTS.map((h) => `MAP ${h} 127.0.0.1:${fakeApi.port}`).join(", ")}`, "--ignore-certificate-errors"] : [];
  try { return await chromium.launch({ args }); } catch {
    const exe = process.env.CHROME_PATH || ["/usr/bin/chromium", "/usr/bin/google-chrome-stable", "/opt/pw-browsers/chromium"].find(existsSync);
    return chromium.launch({ executablePath: exe, args });
  }
}
const browser = await launch();
let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.error(`FAIL ${name}\n${e.stack || e}`); }
}
const controlled = (p) => p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 });
const errorsOf = (p) => { const list = []; p.on("pageerror", (e) => list.push(String(e))); p.on("console", (m) => { if (m.type() === "error") list.push(m.text()); }); return list; };

await test("/nope renders the 404 with every API down", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
  await routeApis(ctx, "down");
  const p = await ctx.newPage();
  const errors = errorsOf(p);
  const res = await p.goto(base + "/nope");
  assert.equal(res.status(), 404);
  assert.equal((await p.textContent("h1")).trim(), "Lost at sea.");
  assert.equal(await p.getAttribute("a.btn", "href"), "/");
  assert.match(await p.textContent("a.btn"), /Paddle back home/);
  await p.waitForSelector("#land .land-svg");
  await p.waitForSelector("#canoe .cord");
  assert.deepEqual(errors.filter((e) => !/Service Worker|Failed to load resource/.test(e)), []);
  const apis = await p.evaluate(() => performance.getEntriesByType("resource").filter((r) => /api\.|noaa|weather\.gov/.test(r.name)).length);
  assert.equal(apis, 0, "the 404 makes no API requests");
  await ctx.close();
});

await test("the manifest parses, its icons load, and Chromium finds nothing blocking installation", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  await routeApis(ctx);
  const p = await ctx.newPage();
  await p.goto(base + "/?debug=1&sw=1");
  const href = await p.getAttribute('link[rel="manifest"]', "href");
  const m = await p.evaluate(async (h) => (await fetch(h)).json(), href);
  assert.equal(m.name, "Huikau");
  assert.equal(m.display, "standalone");
  assert.equal(m.start_url, "/");
  for (const i of m.icons) {
    const size = await p.evaluate((src) => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im.naturalWidth); im.onerror = () => no(new Error(src)); im.src = src; }), i.src);
    assert.equal(`${size}x${size}`, i.sizes, `${i.src} is ${i.sizes}`);
  }
  await controlled(p); // a fetch handler must exist for installability
  const cdp = await ctx.newCDPSession(p);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  assert.deepEqual(installabilityErrors.filter((e) => e.errorId !== "in-incognito"), []); // Playwright's context is incognito; nothing else may block
  await ctx.close();
});

await test("offline after one visit: the page renders and the panels say 'From earlier'", async () => {
  if (!haveOpenssl) return console.log("     (skipped: openssl not found)");
  fakeApi.down = false;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(base + "/?debug=1&t=12:00&sw=1");
  await controlled(p);
  await p.reload(); // this load goes through the worker, so its API answers are cached
  await p.waitForFunction(() => window.__huikau?.tides?.status === "live" && window.__huikau?.surf?.status === "live" && window.__huikau?.weather?.status === "live", null, { timeout: 15000 });
  await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("huikau-cache:")) localStorage.removeItem(k); }); // only the worker's cache may answer now
  await p.waitForTimeout(500);
  await ctx.setOffline(true);
  const errors = errorsOf(p);
  await p.reload();
  await p.waitForSelector("#land .land-svg");
  assert.match(await p.textContent("h2.inst__title >> nth=0"), /\S/);
  await p.waitForFunction(() => ["tides", "surf", "weather"].every((id) => /From earlier/.test(document.getElementById(`${id}-stale`)?.textContent || "")), null, { timeout: 15000 });
  const status = await p.evaluate(() => ({ t: window.__huikau.tides.status, s: window.__huikau.surf.status, w: window.__huikau.weather.status }));
  assert.deepEqual(status, { t: "cached", s: "cached", w: "cached" });
  assert.deepEqual(errors.filter((e) => !/Failed to load resource|net::ERR/.test(e)), []);
  await ctx.setOffline(false);
  await ctx.close();
});

await test("offline, an unknown path shows the cached 404", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  await routeApis(ctx);
  const p = await ctx.newPage();
  await p.goto(base + "/?debug=1&sw=1");
  await controlled(p);
  await ctx.setOffline(true);
  await p.goto(base + "/definitely/not/here");
  assert.equal((await p.textContent("h1")).trim(), "Lost at sea.");
  await ctx.setOffline(false);
  await ctx.close();
});

await test("a deploy shows up on the next load, and the old caches are cleared", async () => {
  deploy.on = false;
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  await routeApis(ctx);
  const p = await ctx.newPage();
  await p.goto(base + "/?debug=1&sw=1");
  await controlled(p);
  const before = await p.evaluate(() => caches.keys());
  assert.ok(before.some((k) => /^huikau-static-2/.test(k)), `static cache present: ${before}`);
  assert.equal(await p.evaluate(() => window.__deploy), undefined);
  deploy.on = true; // the new files are live; only sw.js carries a new VERSION
  await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
  for (let i = 0; ; i++) { // wait for the new worker to install, take over and delete the old cache
    const keys = await p.evaluate(() => caches.keys());
    if (keys.includes("huikau-static-e2e-deploy-2") && !keys.some((k) => /^huikau-static-2/.test(k))) break;
    if (i > 60) throw new Error(`the new version never took over: ${keys}`);
    await p.waitForTimeout(250);
  }
  await p.reload();
  assert.equal(await p.evaluate(() => window.__deploy), 2, "new js is used");
  assert.equal(await p.getAttribute('meta[name="e2e-deploy"]', "content"), "2", "new html is used");
  const keys = await p.evaluate(() => caches.keys());
  assert.deepEqual(keys.sort(), ["huikau-api", "huikau-static-e2e-deploy-2"]);
  deploy.on = false;
  await ctx.close();
});

await test("code changes show up even without a VERSION bump (network first for js, css and html)", async () => {
  deploy.on = false;
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  await routeApis(ctx);
  const p = await ctx.newPage();
  await p.goto(base + "/?debug=1&sw=1");
  await controlled(p);
  deploy.on = true;
  const sw = await p.evaluate(async () => (await (await fetch("/sw.js")).text()).match(/const VERSION = "([^"]+)"/)[1]);
  assert.equal(sw, "e2e-deploy-2"); // (the proxy rewrote it; the worker already running is the old one)
  await p.reload();
  assert.equal(await p.evaluate(() => window.__deploy), 2);
  deploy.on = false;
  await ctx.close();
});

await test("postcard: the button opens a dialog with a 1200 x 1500 preview, Save downloads huikau-postcard.png", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block", acceptDownloads: true });
  await routeApis(ctx);
  await ctx.addInitScript(() => { if (!localStorage.getItem("huikau-basket")) localStorage.setItem("huikau-basket", JSON.stringify(["mahi", "hee", "uhu", "kala"])); });
  const p = await ctx.newPage();
  const errors = errorsOf(p);
  await p.goto(base + "/?debug=1&t=17:30");
  await p.waitForFunction(() => window.__huikau?.modules?.postcard);
  const btn = p.locator(".postcard-btn--hero");
  const box = await btn.boundingBox();
  assert.ok(box.height >= 44 && box.width >= 44, `button is ${box.width} x ${box.height}`);
  await btn.focus();
  await p.keyboard.press("Enter");
  await p.waitForSelector(".postcard-dialog[open] .postcard-img:not([hidden])", { timeout: 20000 });
  const size = await p.evaluate(() => { const i = document.querySelector(".postcard-img"); return [i.naturalWidth, i.naturalHeight]; });
  assert.deepEqual(size, [1200, 1500]);
  await mkdir("shots/wp10", { recursive: true });
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click('[data-act="save"]')]);
  assert.equal(dl.suggestedFilename(), "huikau-postcard.png");
  await dl.saveAs("shots/wp10/postcard-saved.png");
  assert.ok(await p.isHidden('[data-act="share"]'), "Share is hidden where files cannot be shared");
  await p.keyboard.press("Escape");
  assert.equal(await p.evaluate(() => document.activeElement?.classList.contains("postcard-btn")), true, "focus returns to the button");
  assert.deepEqual(errors, []);
  await ctx.close();
});

await test("postcard: Share appears and calls navigator.share with the PNG when files can be shared", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await routeApis(ctx);
  await ctx.addInitScript(() => {
    navigator.canShare = (d) => !!d.files?.length;
    window.__shared = null;
    navigator.share = async (d) => { window.__shared = { name: d.files[0].name, type: d.files[0].type, size: d.files[0].size, text: d.text }; };
  });
  const p = await ctx.newPage();
  await p.goto(base + "/?debug=1&t=12:00");
  await p.waitForFunction(() => window.__huikau?.modules?.postcard);
  assert.ok(await p.isHidden(".postcard-btn--hero"), "the hero button steps aside on a phone");
  await p.locator(".postcard-btn--foot").scrollIntoViewIfNeeded();
  await p.click(".postcard-btn--foot");
  await p.waitForSelector('.postcard-dialog[open] [data-act="share"]:not([hidden])', { timeout: 20000 });
  await p.click('[data-act="share"]');
  const shared = await p.evaluate(() => window.__shared);
  assert.equal(shared.name, "huikau-postcard.png");
  assert.equal(shared.type, "image/png");
  assert.ok(shared.size > 50000);
  assert.match(shared.text, /Wish you were here/);
  await ctx.close();
});

await browser.close();
origin.close();
fakeApi.server?.close();
front.close();
if (failed) { console.error(`${failed} failed`); process.exit(1); }
console.log("pwa e2e: all passed");
