import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseTides, tidesUrl, loadTides } from "../../js/data/tides.js";
import { parseWeather, applyParsed, weather, loadWeather } from "../../js/data/weather.js";
import { parseSurf, surfCall, compass, windRow, loadSurf } from "../../js/data/surf.js";
import { fetchCached, cache, store } from "../../js/core/store.js";
import { wordOfDay, words } from "../../js/data/hawaiian.js";

const fixture = async (name) => JSON.parse(await readFile(new URL(`../fixtures/${name}.json`, import.meta.url), "utf8"));

// ---- a mocked localStorage and fetch ----
function mockStorage() {
  const m = new Map();
  globalThis.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k)
  };
  return m;
}
const okFetch = (body) => async () => ({ ok: true, status: 200, json: async () => body });
const failFetch = async () => { throw new TypeError("network down"); };
test.afterEach(() => { delete globalThis.localStorage; });

test("parseTides reads the NOAA hi/lo fixture", async () => {
  const list = parseTides(await fixture("tides-hilo"));
  assert.equal(list.length, 8);
  assert.deepEqual(list[0], { m: 5 * 60 + 57, high: true, v: 2.128, t: "2026-11-12 05:57" });
  assert.deepEqual(list[1], { m: 13 * 60 + 34, high: false, v: 0.404, t: "2026-11-12 13:34" });
  assert.equal(list[3].high, false);
  assert.equal(list[3].m, 22 * 60 + 33);
});

test("parseTides tolerates junk", () => {
  assert.deepEqual(parseTides(null), []);
  assert.deepEqual(parseTides({}), []);
  assert.deepEqual(parseTides({ predictions: [{ v: "1" }, { t: "bad", v: "1", type: "H" }] }), []);
});

test("tidesUrl targets Honolulu Harbor", () => {
  const u = new URL(tidesUrl("20261112"));
  assert.equal(u.hostname, "api.tidesandcurrents.noaa.gov");
  assert.equal(u.searchParams.get("station"), "1612340");
  assert.equal(u.searchParams.get("begin_date"), "20261112");
  assert.equal(u.searchParams.get("interval"), "hilo");
});

test("loadTides: live, then cached when the network fails, then none", async () => {
  const store_ = mockStorage();
  const fx = await fixture("tides-hilo");
  const live = await loadTides("20261112", { fetchImpl: okFetch(fx), now: () => 1000 });
  assert.equal(live.status, "live");
  assert.equal(live.data.length, 8);
  assert.equal(live.t, 1000);
  assert.ok([...store_.keys()].some((k) => k.includes("tides-20261112")));

  const cached = await loadTides("20261112", { fetchImpl: failFetch, now: () => 5000 });
  assert.equal(cached.status, "cached");
  assert.equal(cached.t, 1000);
  assert.deepEqual(cached.data, live.data);

  const otherDay = await loadTides("20261113", { fetchImpl: failFetch });
  assert.deepEqual(otherDay, { status: "none", data: null, t: null });
});

test("fetchCached: HTTP errors and unusable bodies fall back; empty body with no cache is none", async () => {
  mockStorage();
  const r500 = await fetchCached("k", "http://x", { fetchImpl: async () => ({ ok: false, status: 500 }) });
  assert.equal(r500.status, "none");
  const empty = await fetchCached("k", "http://x", { fetchImpl: okFetch({ predictions: [] }), parse: parseTides });
  assert.equal(empty.status, "none");
  cache.write("k", { a: 1 }, 10);
  const c = await fetchCached("k", "http://x", { fetchImpl: async () => ({ ok: false, status: 503 }), now: () => 20 });
  assert.deepEqual(c, { status: "cached", data: { a: 1 }, t: 10 });
});

test("fetchCached: maxAge makes an old cache unusable", async () => {
  mockStorage();
  cache.write("old", { a: 1 }, 0);
  const r = await fetchCached("old", "http://x", { fetchImpl: failFetch, maxAge: 1000, now: () => 5000 });
  assert.equal(r.status, "none");
});

test("fetchCached: gives up after the timeout (default 8 s) even if fetch never settles", async () => {
  mockStorage();
  const never = () => new Promise(() => {});
  const t0 = Date.now();
  const r = await fetchCached("slow", "http://x", { fetchImpl: never, timeout: 40 });
  assert.equal(r.status, "none");
  assert.ok(Date.now() - t0 < 1000);
  const { FETCH_TIMEOUT_MS } = await import("../../js/core/store.js");
  assert.equal(FETCH_TIMEOUT_MS, 8000);
});

test("fetchCached: passes an abort signal to fetch and aborts on timeout", async () => {
  mockStorage();
  let signal;
  const hang = (url, init) => new Promise((_, no) => { signal = init.signal; signal.addEventListener("abort", () => no(new Error("aborted"))); });
  const r = await fetchCached("sig", "http://x", { fetchImpl: hang, timeout: 30 });
  assert.equal(r.status, "none");
  assert.equal(signal.aborted, true);
});

test("works with no localStorage at all (private window)", async () => {
  const r = await fetchCached("n", "http://x", { fetchImpl: okFetch({ ok: 1 }) });
  assert.equal(r.status, "live");
  assert.equal(store.get("huikau-basket", "fallback"), "fallback");
  store.set("huikau-basket", [1]); // must not throw
  const r2 = await fetchCached("n", "http://x", { fetchImpl: failFetch });
  assert.equal(r2.status, "none");
});

test("store keeps huikau-basket and legacy huikau-tackle as plain JSON arrays", () => {
  mockStorage();
  store.set("huikau-basket", ["mahi", "shark"]);
  assert.equal(globalThis.localStorage.getItem("huikau-basket"), '["mahi","shark"]');
  globalThis.localStorage.setItem("huikau-tackle", '["boot"]');
  assert.deepEqual(store.get("huikau-tackle", []), ["boot"]);
  assert.deepEqual(store.get("missing", []), []);
});

test("parseWeather on the recorded NWS observation", async () => {
  const w = parseWeather(await fixture("weather"));
  assert.equal(typeof w.text, "string");
  assert.ok(w.clouds >= 0 && w.clouds <= 4);
  assert.equal(typeof w.rain, "boolean");
  assert.ok(w.wind === null || typeof w.wind.mph === "number");
  assert.ok(w.calm === null || (w.calm >= .45 && w.calm <= 1.15));
});

test("parseWeather: rain, cloud cover, wind and temperature", () => {
  const w = parseWeather({ properties: {
    textDescription: "Light Rain", presentWeather: [{ rawString: "-RA" }],
    cloudLayers: [{ amount: "FEW" }], windSpeed: { value: 32.2 }, windDirection: { value: 90 }, temperature: { value: 25 }
  } });
  assert.equal(w.rain, true);
  assert.equal(w.clouds, 3); // rain lifts the cover to at least 3
  assert.deepEqual(w.wind, { mph: 20, from: 90 });
  assert.equal(w.text, "Light rain, 77°F");
  assert.ok(Math.abs(w.calm - (1 - (32.2 - 12) / 50)) < 1e-9);
});

test("parseWeather: null wind and temperature leave calm untouched", () => {
  const w = parseWeather({ properties: { textDescription: "Clear", cloudLayers: [{ amount: "CLR" }], windSpeed: { value: null }, temperature: { value: null } } });
  assert.deepEqual([w.rain, w.clouds, w.wind, w.calm, w.text], [false, 0, null, null, "Clear"]);
  weather.calm = .8;
  applyParsed(w, "live");
  assert.equal(weather.calm, .8);
  assert.equal(weather.text, "Clear");
  assert.equal(parseWeather({}), null);
});

test("loadWeather: live and cached", async () => {
  mockStorage();
  const fx = await fixture("weather");
  const live = await loadWeather({ fetchImpl: okFetch(fx) });
  assert.equal(live.status, "live");
  const cached = await loadWeather({ fetchImpl: failFetch });
  assert.equal(cached.status, "cached");
  assert.deepEqual(cached.data, live.data);
});

test("surf: parse the fixture, wording and compass", async () => {
  const s = parseSurf(await fixture("surf"));
  assert.equal(s.height, 5.184);
  assert.equal(s.call, "Fun-size surf.");
  assert.equal(s.rows[0][0], "Waves");
  assert.equal(s.rows[0][1], "5.2 ft from the ESE");
  assert.ok(s.rows.some(([k]) => k === "Swell"));
  assert.ok(s.rows.some(([k]) => k === "Water"));
  assert.equal(surfCall(.5), "Flat. A good day for fishing.");
  assert.equal(surfCall(2), "Small and friendly.");
  assert.equal(surfCall(8), "Solid. Experienced surfers only.");
  assert.equal(surfCall(12), "Big. Watch from the beach.");
  assert.equal(compass(0), "N");
  assert.equal(compass(350), "N");
  assert.equal(compass(90), "E");
  assert.equal(compass(null), "");
  assert.equal(parseSurf({ current: {} }), null);
});

test("windRow", () => {
  assert.equal(windRow(null), null);
  assert.deepEqual(windRow({ mph: 1, from: 0 }), ["Wind", "Calm"]);
  assert.deepEqual(windRow({ mph: 12, from: 45 }), ["Wind", "12 mph from the NE"]);
  assert.deepEqual(windRow({ mph: 12, from: null }), ["Wind", "12 mph"]);
});

test("loadSurf: live, cached, none", async () => {
  mockStorage();
  const fx = await fixture("surf");
  assert.equal((await loadSurf({ fetchImpl: okFetch(fx) })).status, "live");
  assert.equal((await loadSurf({ fetchImpl: failFetch })).status, "cached");
  delete globalThis.localStorage;
  assert.equal((await loadSurf({ fetchImpl: failFetch })).status, "none");
});

test("word of the day cycles through all sixteen words by UTC day", () => {
  assert.equal(words.length, 16);
  const day = (n) => n * 86400000;
  assert.equal(wordOfDay(day(0))[0], words[0][0]);
  assert.equal(wordOfDay(day(17))[0], words[1][0]);
  assert.equal(wordOfDay(day(16) + 1000)[0], words[0][0]);
});
