import test from "node:test";
import assert from "node:assert/strict";
import { ulasPick, todayRows } from "../../js/ui/instruments.js";
import { detectSeason, isFriday } from "../../js/ui/seasons.js";
import { clockLine } from "../../js/sky/sky.js";
import { moonLitPath } from "../../js/sky/bodies.js";
import { cloudCount } from "../../js/sky/clouds.js";
import { sunTimesAt } from "../../js/core/astro.js";
import { hstToEpoch } from "../../js/core/clock.js";

const sun = { rise: 400, set: 1071 }; // about 6:40 am and 5:51 pm
const tide = (m, high) => ({ m, high, v: 1 });

test("ulasPick prefers the tide change nearest sunrise or sunset", () => {
  const tides = [tide(357, true), tide(814, false), tide(1041, true), tide(1353, false)];
  assert.equal(ulasPick(480, sun, tides), "Ula's heading out for the 5:21 pm high tide, just before sunset.");
});

test("ulasPick: out now when the tide is within ten minutes", () => {
  assert.equal(ulasPick(1035, sun, [tide(1041, true)]), "Ula's out now for the 5:21 pm high tide, just before sunset.");
});

test("ulasPick: right after sunrise / sunset wording", () => {
  assert.equal(ulasPick(300, sun, [tide(420, false)]), "Ula's heading out for the 7:00 am low tide, right after sunrise.");
  assert.equal(ulasPick(900, sun, [tide(1100, true)]), "Ula's heading out for the 6:20 pm high tide, right after sunset.");
});

test("ulasPick: a mid-day tide far from the sun has no suffix; night tides are ignored", () => {
  assert.equal(ulasPick(600, sun, [tide(814, false)]), "Ula's heading out for the 1:34 pm low tide.");
  assert.match(ulasPick(100, sun, [tide(130, true)]), /heading out at sunrise, 6:40 am/);
});

test("ulasPick falls back to sun times with no tide data", () => {
  assert.equal(ulasPick(300, sun, []), "Ula's heading out at sunrise, 6:40 am.");
  assert.equal(ulasPick(600, sun, []), "Ula's heading out for the evening bite, around 4:51 pm.");
  assert.equal(ulasPick(1030, sun, []), "Ula's out now for the sunset bite.");
  assert.equal(ulasPick(1200, sun, []), "Ula's done for today. She'll be back out at sunrise, around 6:40 am.");
});

test("todayRows: sun, moon and what's next", () => {
  const rows = todayRows(sun, .5);
  assert.deepEqual(rows[0], ["Sunrise", "6:40 am"]);
  assert.deepEqual(rows[1], ["Sunset", "5:51 pm"]);
  assert.deepEqual(rows[2], ["Moon", "Full moon, 100% lit"]);
  assert.deepEqual(rows[3][0], "Coming up");
  assert.equal(rows[3][1], "Full moon tonight");
  assert.equal(todayRows(sun, .75)[3][1], "New moon in 7 days");
});

test("detectSeason", () => {
  const d = (m, day) => new Date(Date.UTC(2026, m - 1, day));
  assert.equal(detectSeason(d(10, 14)), "none");
  assert.equal(detectSeason(d(10, 15)), "halloween");
  assert.equal(detectSeason(d(12, 1)), "winter");
  assert.equal(detectSeason(d(12, 30)), "winter");
  assert.equal(detectSeason(d(12, 31)), "newyear");
  assert.equal(detectSeason(d(1, 1)), "newyear");
  assert.equal(detectSeason(d(11, 12)), "none");
  assert.equal(detectSeason(d(11, 12), "winter"), "winter");
  assert.equal(detectSeason(d(12, 1), "bogus"), "winter");
});

test("isFriday: ?friday=1 / 0 override the weekday", () => {
  const thu = new Date(Date.UTC(2026, 10, 12)), fri = new Date(Date.UTC(2026, 10, 13));
  assert.equal(isFriday(thu, null), false);
  assert.equal(isFriday(fri, null), true);
  assert.equal(isFriday(thu, "1"), true);
  assert.equal(isFriday(fri, "0"), false);
});

test("clockLine", () => {
  assert.equal(clockLine(12 * 60, sun, "Clear, 80°F"), "12:00 pm in Honolulu. Clear, 80°F. Sunset in 5 hr 51 min.");
  assert.equal(clockLine(5 * 60, sun, ""), "5:00 am in Honolulu. Sunrise in 1 hr 40 min.");
  assert.equal(clockLine(22 * 60, sun, ""), "10:00 pm in Honolulu. Sunrise in 8 hr 40 min.");
  assert.match(clockLine(1068, sun, ""), /Watch the horizon for the green flash\.$/);
});

test("clockLine on the known-answer day", () => {
  const s = sunTimesAt(hstToEpoch(2026, 10, 28, 720));
  assert.match(clockLine(6 * 60, s, ""), /^6:00 am in Honolulu\. Sunrise in 3[12] min\.$/);
});

test("moonLitPath: waxing lights the right limb, waning the left", () => {
  assert.match(moonLitPath(.1), /^M27 3 A24 24 0 0 1 27 51 /);
  assert.match(moonLitPath(.9), /^M27 3 A24 24 0 0 0 27 51 /);
  assert.equal(moonLitPath(.25), "M27 3 A24 24 0 0 1 27 51 A0.00 24 0 0 1 27 3 Z");
  assert.equal(moonLitPath(0), "M27 3 A24 24 0 0 1 27 51 A24.00 24 0 0 0 27 3 Z");
});

test("cloudCount", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(cloudCount), [0, 1, 3, 4, 6]);
});
