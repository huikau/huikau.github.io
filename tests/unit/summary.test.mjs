import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { summaryText } from "../../js/ui/summary.js";
import { createClock } from "../../js/core/clock.js";
import { parseTides } from "../../js/data/tides.js";
import { parseSurf } from "../../js/data/surf.js";
import { percentile } from "../../js/core/perf.js";

const fixture = async (n) => JSON.parse(await readFile(new URL(`../fixtures/${n}.json`, import.meta.url), "utf8"));
const noon = Date.parse("2026-11-12T12:00:00-10:00");
const live = () => createClock({ search: "", realNow: () => noon });

test("summaryText: live, with weather, wind, surf and the next tide", async () => {
  const text = summaryText({
    clock: live(),
    weather: { status: "live", text: "Mostly cloudy, 78°F", wind: { mph: 8, from: 68 } },
    surf: { data: parseSurf(await fixture("surf")) },
    tides: { list: parseTides(await fixture("tides-hilo")) }
  });
  assert.match(text, /^Right now in Honolulu, it is 12:00 pm, midday\./);
  assert.match(text, /Mostly cloudy, 78°F\./);
  assert.match(text, /Wind: 8 mph from the ENE\./);
  assert.match(text, /Surf: waves 5\.2 ft from the ESE\. Fun-size surf\./);
  assert.match(text, /Next: low tide at 1:34 pm, 0\.4 ft, in 1 hr 34 min\./);
  assert.doesNotMatch(text, /undefined|NaN|null/);
});

test("summaryText: with no data it still says the time and the sky, and nothing else", () => {
  const text = summaryText({ clock: live(), weather: { status: "none" }, surf: {}, tides: { list: [] } });
  assert.equal(text, "Right now in Honolulu, it is 12:00 pm, midday.");
});

test("summaryText: when the time machine is scrubbed it does not claim 'right now'", () => {
  const c = live();
  c.setHstMinutes(22 * 60);
  const text = summaryText({ clock: c });
  assert.match(text, /^In Honolulu, on the island time machine, it is 10:00 pm/);
});

test("percentile: p50, p95 and the empty case", () => {
  const s = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(percentile(s, .5), 51);
  assert.equal(percentile(s, .95), 96);
  assert.equal(percentile([], .95), 0);
});

import { keepClear } from "../../js/sky/bodies.js";
const bar = { left: 24, right: 344, bottom: 118 };
const scene = { w: 360, h: 740 };
test("keepClear: a body behind the bar is lowered to just under it", () => {
  const y = keepClear(50, 10, 30, bar, scene); // centre (180, 74): inside the bar
  assert.equal(Math.round(y / 100 * scene.h), 118 + 30 + 4);
});
test("keepClear: a body already below, or far to the side, stays where it is; in between it eases", () => {
  assert.equal(keepClear(50, 40, 30, bar, scene), 40);
  assert.equal(keepClear(50, 10, 30, null, scene), 10);
  const wide = { w: 1440, h: 900 }, desk = { left: 24, right: 484, bottom: 100 };
  assert.equal(keepClear(60, 10, 40, desk, wide), 10); // x = 864: more than a ramp away from the bar
  const mid = keepClear(40, 10, 40, desk, wide); // x = 576: 12 px from the ramp's start (484 + 40 = 524, ramp 140)
  assert.ok(mid > 10 && mid < (100 + 40 + 4) / 900 * 100, `eased y ${mid}`);
});
