import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClock, hstToEpoch } from "../../js/core/clock.js";
import { postcardInfo, postmarkWeather, pickCatches, wrapLines, arcAngles, W, H, FILE_NAME } from "../../js/ui/postcard.js";
import { fetchCached } from "../../js/core/store.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("postcard is 1200 x 1500 and saves as huikau-postcard.png", () => {
  assert.deepEqual([W, H, FILE_NAME], [1200, 1500, "huikau-postcard.png"]);
});

test("postcardInfo: Honolulu date, time and weather from the clock, not the machine", () => {
  const ms = hstToEpoch(2026, 11, 12, 17 * 60 + 30);
  const clock = createClock({ search: "", realNow: () => ms });
  const i = postcardInfo(clock, { status: "live", text: "Mostly cloudy, 78°F" });
  assert.equal(i.dateLine, "Thursday, November 12, 2026");
  assert.equal(i.time, "5:30 pm");
  assert.equal(i.timeUpper, "5:30 PM");
  assert.equal(i.stampDate, "NOV 12 2026");
  assert.equal(i.weatherLine, "Mostly cloudy, 78°F");
  assert.equal(postcardInfo(clock, { status: "none", text: "stale" }).weatherLine, "");
});

test("postmarkWeather: upper case, trimmed at a word", () => {
  assert.equal(postmarkWeather("Clear"), "CLEAR");
  assert.equal(postmarkWeather("Mostly cloudy, 78°F"), "MOSTLY CLOUDY, 78°F");
  assert.ok(postmarkWeather("Thunderstorm in the vicinity with heavy rain").length <= 20);
  assert.equal(postmarkWeather(null), "");
});

test("pickCatches: fish and creatures only, unique, most recent last, at most six", () => {
  const picked = pickCatches(["mahi", "pineapple", "honu", "mahi", "hee", "nope", "puffer"]);
  assert.deepEqual(picked.map((s) => s.id), ["mahi", "hee", "puffer"]);
  const all = pickCatches(["mahi", "hee", "puffer", "uhu", "kala", "weke", "manini", "ulua"], 6);
  assert.ok(all.length <= 6);
  assert.deepEqual(pickCatches([]), []);
});

test("wrapLines wraps on width", () => {
  const m = (s) => s.length * 10;
  assert.deepEqual(wrapLines(m, "aaa bbb ccc ddd", 70), ["aaa bbb", "ccc ddd"]);
  assert.deepEqual(wrapLines(m, "", 70), []);
});

test("arcAngles: symmetric about the centre, one glyph per character", () => {
  const a = arcAngles("ABC", () => 20, 100, 0, 1);
  assert.equal(a.length, 3);
  assert.ok(Math.abs(a[0].angle + a[2].angle) < 1e-9);
  assert.ok(Math.abs(a[1].angle) < 1e-9);
});

test("fetchCached reports a service-worker cached answer as cached, with its time", async () => {
  const body = { v: 1 };
  const res = (headers) => ({ ok: true, status: 200, headers: new Headers(headers), json: async () => body });
  const cached = await fetchCached("pc-test", "http://x/", { fetchImpl: async () => res({ "x-huikau-sw": "cache", "x-huikau-sw-time": "1700000000000" }) });
  assert.deepEqual([cached.status, cached.t], ["cached", 1700000000000]);
  const live = await fetchCached("pc-test", "http://x/", { fetchImpl: async () => res({}) });
  assert.equal(live.status, "live");
});

test("sw.js precaches every js, css, font and icon file, and every entry exists", async () => {
  const sw = await readFile(join(root, "sw.js"), "utf8");
  const list = JSON.parse("[" + /const PRECACHE = \[([\s\S]*?)\];/.exec(sw)[1].replace(/,\s*$/, "") + "]");
  for (const p of list) await access(join(root, p === "/" ? "index.html" : p.slice(1)));
  const walk = async (dir) => (await readdir(join(root, dir), { withFileTypes: true })).flatMap((e) => (e.isDirectory() ? [] : [`/${dir}/${e.name}`]));
  const dirs = ["css", "assets/fonts", "assets/img/icons"];
  const jsDirs = ["js", "js/core", "js/data", "js/game", "js/scene", "js/sky", "js/ui"];
  const want = [...(await Promise.all([...dirs, ...jsDirs].map(walk))).flat()].filter((p) => !/LICENSE/.test(p));
  const missing = want.filter((p) => !list.includes(p));
  assert.deepEqual(missing, [], "add these to PRECACHE in sw.js and bump VERSION");
  assert.match(sw, /const VERSION = "[^"]+";/);
});

test("manifest: name, start_url, standalone, 192 and 512 icons that exist, and a maskable one", async () => {
  const m = JSON.parse(await readFile(join(root, "manifest.webmanifest"), "utf8"));
  assert.equal(m.name, "Huikau");
  assert.equal(m.short_name, "Huikau");
  assert.equal(m.start_url, "/");
  assert.equal(m.display, "standalone");
  assert.match(m.theme_color, /^#0E2B30$/i);
  const sizes = m.icons.map((i) => i.sizes);
  assert.ok(sizes.includes("192x192") && sizes.includes("512x512"));
  assert.ok(m.icons.some((i) => i.purpose === "maskable"));
  for (const i of m.icons) await access(join(root, i.src.slice(1)));
});
