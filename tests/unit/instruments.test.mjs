import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseTides, parseHourly, tideMinutes, tidesHourlyUrl } from "../../js/data/tides.js";
import { parseSurf, windRow } from "../../js/data/surf.js";
import { parseWeather, parseForecast, forecastAt, FORECAST_URL } from "../../js/data/weather.js";
import { clockTime } from "../../js/core/clock.js";
import { words, wordOfDay } from "../../js/data/hawaiian.js";
import {
  tideRows, nextChange, nextText, tideSeries, tideChart, tideSkeleton, compassSvg, dialSvg, weatherCells, surfWindRow, smoothPath
} from "../../js/ui/instruments.js";
import { wordIndex, wordCard } from "../../js/ui/bottle.js";
import { sunTimes } from "../../js/core/astro.js";
import { hstToEpoch } from "../../js/core/clock.js";

const fx = async (n) => JSON.parse(await readFile(new URL(`../fixtures/${n}.json`, import.meta.url), "utf8"));

// The old text card, copied from fefa826:js/ui/instruments.js (renderTides): one entry per list item.
function oldTideItems(list, now) {
  let marked = false;
  return list.map((p) => {
    const isNext = !marked && p.m >= now;
    if (isNext) marked = true;
    return { label: p.high ? "High tide" : "Low tide", when: clockTime(p.m), height: `${p.v.toFixed(1)} ft`, next: isNext };
  });
}

test("tide rows match the old card's strings, and the next change is the old 'next' row", async () => {
  const list = parseTides(await fx("tides-hilo"));
  const now = 12 * 60;
  const old = oldTideItems(list, now), rows = tideRows(list);
  assert.deepEqual(rows.map((r) => [r.label, r.when, r.height]), old.map((o) => [o.label, o.when, o.height]));
  const next = nextChange(list, "20261112", now);
  assert.equal(next.p, list[old.findIndex((o) => o.next)]);
  assert.equal(nextText(next), "Next: low tide at 1:34 pm, 0.4 ft, in 1 hr 34 min.");
});

test("next change rolls over to tomorrow and reports nothing when the list ends", async () => {
  const list = parseTides(await fx("tides-hilo"));
  assert.match(nextText(nextChange(list, "20261112", 23 * 60 + 30)), /^Next: high tide at 6:40 am tomorrow/);
  assert.equal(nextText(nextChange(list, "20261112", 3 * 1440)), "No more tide changes listed for today.");
});

test("hourly tides parse and the series spans the day; the hi/lo fallback also does", async () => {
  const hourly = parseHourly(await fx("tides-hourly"));
  assert.equal(hourly.length, 49);
  assert.equal(tideMinutes("2026-11-13 01:00", "20261112"), 1500);
  const list = parseTides(await fx("tides-hilo"));
  const a = tideSeries(hourly, list, "20261112"), b = tideSeries([], list, "20261112");
  for (const s of [a, b]) { assert.equal(s[0][0], 0); assert.equal(s[s.length - 1][0], 1440); assert.ok(s.every(([m, v]) => Number.isFinite(m) && Number.isFinite(v))); }
  assert.equal(tideSeries([], [], "20261112"), null);
  assert.match(tidesHourlyUrl("20261112"), /interval=h/);
});

test("tide chart draws every high/low with its time and height, a now marker, and no NaN", async () => {
  const list = parseTides(await fx("tides-hilo"));
  const series = tideSeries(parseHourly(await fx("tides-hourly")), list, "20261112");
  const ext = list.map((p) => ({ abs: tideMinutes(p.t, "20261112"), v: p.v, high: p.high, m: p.m })).filter((e) => e.abs <= 1440);
  const svg = tideChart(series, ext, 720, "summary");
  assert.ok(!/NaN|undefined/.test(svg));
  for (const t of ["High 2.1 ft", "5:57 am", "Low 0.4 ft", "1:34 pm", "High 0.6 ft", "Low 0.2 ft", "10:33 pm", ">Now<"]) assert.ok(svg.includes(t), t);
  assert.match(svg, /role="img" aria-label="summary"/);
  assert.match(tideSkeleton("loading"), /Tide chart loading/);
  assert.match(tideSkeleton("none"), /unavailable/);
  assert.equal(smoothPath([[0, 0]]), "");
});

test("surf rows are the old rows; the wind row falls back to the hourly forecast only when NWS has none", async () => {
  const d = parseSurf(await fx("surf"));
  assert.deepEqual(d.rows, [["Waves", "5.2 ft from the ESE"], ["Swell", "2.0 ft at 10 s from the SSE"], ["Water", "79°F"]]);
  assert.equal(d.call, "Fun-size surf.");
  assert.deepEqual(d.swell, { h: 2.034, dir: 158, period: 9.7 });
  const w = parseWeather(await fx("weather-full")), none = parseWeather(await fx("weather"));
  const fc = forecastAt(parseForecast(await fx("forecast")), { year: 2026, month: 11, day: 12, hour: 12 });
  assert.deepEqual(surfWindRow(w.wind, fc), { row: windRow(w.wind), source: "nws" });
  assert.equal(surfWindRow(none.wind, fc).source, "forecast");
  assert.deepEqual(surfWindRow(none.wind, fc).row, ["Wind", "16 mph from the ENE"]);
  assert.equal(surfWindRow(null, null).row, null);
  const svg = compassSvg({ swell: d.swell, waves: d.waves });
  assert.ok(!/NaN/.test(svg));
  assert.match(svg, /arrow--swell/);
  assert.ok(!/arrow/.test(compassSvg({}, "none").replace(/<svg[^>]*>/, "")));
});

test("forecast URL is the allowed host; parseForecast tolerates junk", () => {
  assert.equal(new URL(FORECAST_URL).hostname, "api.open-meteo.com");
  assert.equal(parseForecast(null), null);
  assert.equal(parseForecast({ hourly: { time: [] } }), null);
});

test("weather strip: NWS values win, forecast fills nulls, nothing at all gives no readings", async () => {
  const full = parseWeather(await fx("weather-full")), none = parseWeather(await fx("weather"));
  const fc = { tempF: 79, mph: 16, from: 58 };
  const mk = (p, status = "live") => ({ ...p, status, text: p.text });
  let r = weatherCells(mk(full), fc);
  assert.deepEqual(r.cells.map((c) => c.value), ["Partly cloudy", "79°F", "17 mph from the ENE"]);
  assert.equal(r.usedForecast, false);
  r = weatherCells(mk(none), fc);
  assert.deepEqual(r.cells.map((c) => c.value), ["Mostly cloudy", "79°F", "16 mph from the ENE"]);
  assert.equal(r.usedForecast, true);
  r = weatherCells({ status: "none", text: "", desc: "", tempF: null, wind: null, rain: false, clouds: 0 }, null);
  assert.deepEqual(r.cells.map((c) => c.value), [null, null, null]);
});

test("dial draws sunrise and sunset text and no NaN, day and night", () => {
  const dayMs = hstToEpoch(2026, 11, 12, 0), sun = sunTimes(new Date(dayMs - 10 * 3600e3));
  for (const m of [100, 720, 1300]) {
    const svg = dialSvg({ ms: dayMs + m * 60e3, dayMs, m, sun, phase: 0.1 });
    assert.ok(!/NaN|undefined/.test(svg));
    assert.match(svg, /Sunrise 6:40 am/); assert.match(svg, /Sunset 5:51 pm/);
  }
});

test("the bottle shows the same word of the day as the old card, and wraps around", () => {
  const ms = Date.UTC(2026, 10, 12, 22);
  assert.deepEqual(words[wordIndex(ms)], wordOfDay(ms));
  const t = wordIndex(ms);
  assert.equal(wordCard(t, t).label, "Today's Hawaiian word");
  assert.equal(wordCard(t + 1, t).label, "A Hawaiian word");
  assert.equal(wordCard(-1, t).idx, words.length - 1);
  assert.equal(wordCard(words.length, t).idx, 0);
  assert.equal(wordCard(0, t).count, `1 of ${words.length}`);
});
