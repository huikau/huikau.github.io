import test from "node:test";
import assert from "node:assert/strict";
import {
  sunTimes, sunTimesAt, skyFor, sunPosition, moonPhase, moonIllumination, moonPhaseName,
  nextMoonEvent, inDays, moonPosition
} from "../../js/core/astro.js";
import { hstToEpoch } from "../../js/core/clock.js";

const at = (y, mo, d, h, mi = 0) => hstToEpoch(y, mo, d, h * 60 + mi);

test("sunTimes known answer: Honolulu 2026-10-28", () => {
  const s = sunTimesAt(at(2026, 10, 28, 12));
  assert.ok(Math.abs(s.rise - (6 * 60 + 31)) <= 2, `sunrise ${s.rise}`);
  assert.ok(Math.abs(s.set - (17 * 60 + 58)) <= 2, `sunset ${s.set}`);
});

test("sunTimes: summer solstice has the longest day, winter the shortest", () => {
  const jun = sunTimesAt(at(2026, 6, 21, 12)), dec = sunTimesAt(at(2026, 12, 21, 12));
  // published Honolulu values: about 5:49 am / 7:15 pm and 7:04 am / 5:54 pm
  assert.ok(Math.abs(jun.rise - (5 * 60 + 49)) <= 3 && Math.abs(jun.set - (19 * 60 + 15)) <= 3, JSON.stringify(jun));
  assert.ok(Math.abs(dec.rise - (7 * 60 + 4)) <= 3 && Math.abs(dec.set - (17 * 60 + 54)) <= 3, JSON.stringify(dec));
  assert.ok(jun.set - jun.rise > dec.set - dec.rise + 120);
});

test("sunTimes accepts an HST Date (UTC fields are wall-clock)", () => {
  const d = new Date(Date.UTC(2026, 9, 28, 12, 0));
  assert.deepEqual(sunTimes(d), sunTimesAt(at(2026, 10, 28, 12)));
});

test("sun altitude is about zero at sunrise and sunset", () => {
  for (const [y, mo, d] of [[2026, 10, 28], [2026, 6, 21], [2026, 12, 21], [2026, 3, 20]]) {
    const s = sunTimesAt(at(y, mo, d, 12));
    // sunrise is defined for the sun's upper limb with refraction: centre at about -0.83 degrees
    assert.ok(Math.abs(sunPosition(at(y, mo, d, 0, s.rise)).altitude) < 1, `rise ${y}-${mo}-${d}`);
    assert.ok(Math.abs(sunPosition(at(y, mo, d, 0, s.set)).altitude) < 1, `set ${y}-${mo}-${d}`);
  }
});

test("sun altitude at local noon is plausible for 21.3 N", () => {
  const noon = (y, mo, d) => {
    const s = sunTimesAt(at(y, mo, d, 12));
    return sunPosition(at(y, mo, d, 0, (s.rise + s.set) / 2));
  };
  const nov = noon(2026, 11, 12).altitude;
  assert.ok(nov > 47 && nov < 54, `November noon ${nov}`);
  const may = noon(2026, 5, 27).altitude, jul = noon(2026, 7, 15).altitude;
  assert.ok(may > 85 && may <= 90, `late May noon ${may}`);
  assert.ok(jul > 85 && jul <= 90, `mid July noon ${jul}`);
  const dec = noon(2026, 12, 21).altitude;
  assert.ok(dec > 43 && dec < 47, `December noon ${dec}`);
});

test("sun azimuth: east in the morning, south at noon (winter), west in the afternoon", () => {
  const am = sunPosition(at(2026, 11, 12, 8)).azimuth, pm = sunPosition(at(2026, 11, 12, 16)).azimuth;
  assert.ok(am > 90 && am < 150, `morning ${am}`);
  assert.ok(pm > 210 && pm < 270, `afternoon ${pm}`);
  const noon = sunPosition(at(2026, 11, 12, 12, 10)).azimuth;
  assert.ok(Math.abs(noon - 180) < 5, `noon ${noon}`);
  // sunrise bearing in late October is a little south of due east, sunset a little south of west
  const rise = sunPosition(at(2026, 10, 28, 6, 31)).azimuth, set = sunPosition(at(2026, 10, 28, 17, 58)).azimuth;
  assert.ok(rise > 95 && rise < 112, `sunrise bearing ${rise}`);
  assert.ok(set > 248 && set < 265, `sunset bearing ${set}`);
});

test("sun is well below the horizon at midnight", () => {
  assert.ok(sunPosition(at(2026, 11, 12, 0)).altitude < -60);
});

test("skyFor boundaries", () => {
  const sun = { rise: 400, set: 1070 };
  assert.equal(skyFor(349, sun), "night");
  assert.equal(skyFor(350, sun), "dawn");
  assert.equal(skyFor(439, sun), "dawn");
  assert.equal(skyFor(440, sun), "day");
  assert.equal(skyFor(999, sun), "day");
  assert.equal(skyFor(1000, sun), "golden");
  assert.equal(skyFor(1084, sun), "golden");
  assert.equal(skyFor(1085, sun), "dusk");
  assert.equal(skyFor(1120, sun), "dusk");
  assert.equal(skyFor(1121, sun), "night");
  assert.equal(skyFor(0, sun), "night");
});

test("moon phase: 2026-11-09 is a new moon, and a fortnight later is full", () => {
  const nm = moonPhase(at(2026, 11, 9, 12));
  assert.ok(nm < .03 || nm > .97, `phase ${nm}`);
  assert.equal(moonPhaseName(nm), "New moon");
  const full = moonPhase(at(2026, 11, 24, 12));
  assert.ok(Math.abs(full - .5) < .03, `phase ${full}`);
  assert.equal(moonPhaseName(full), "Full moon");
  assert.ok(moonIllumination(full) > 97);
  assert.ok(moonIllumination(nm) < 3);
});

test("moon phase stays in [0, 1) and illumination in [0, 100]", () => {
  for (let i = 0; i < 400; i++) {
    const p = moonPhase(Date.UTC(1990, 0, 1) + i * 37 * 864e5);
    assert.ok(p >= 0 && p < 1);
    const lit = moonIllumination(p);
    assert.ok(lit >= 0 && lit <= 100);
  }
});

test("moon phase names across the cycle", () => {
  const cases = [[0, "New moon"], [.1, "Waxing crescent"], [.25, "First quarter"], [.4, "Waxing gibbous"], [.5, "Full moon"],
    [.6, "Waning gibbous"], [.75, "Last quarter"], [.9, "Waning crescent"], [.99, "New moon"]];
  for (const [p, name] of cases) assert.equal(moonPhaseName(p), name, String(p));
});

test("next moon event and its wording", () => {
  const n = nextMoonEvent(.4);
  assert.equal(n.name, "Full moon");
  assert.ok(Math.abs(n.days - .1 * 29.530588853) < 1e-9);
  assert.equal(nextMoonEvent(.6).name, "New moon");
  assert.equal(inDays(.5), "tonight");
  assert.equal(inDays(1.5), "tomorrow");
  assert.equal(inDays(5.4), "in 5 days");
});

test("moon altitude (approximate): full moon rises at sunset and is high near midnight; new moon follows the sun", () => {
  // 2026-11-24 is a full moon: up in the evening, up all night, gone by mid-morning
  assert.ok(moonPosition(at(2026, 11, 24, 0)).altitude > 70);
  assert.ok(moonPosition(at(2026, 11, 24, 12)).altitude < -30);
  const evening = moonPosition(at(2026, 11, 24, 18)).altitude;
  assert.ok(evening > -8 && evening < 8, `at sunset ${evening}`);
  // near new moon the moon is in the sky by day, roughly where the sun is
  const t = at(2026, 11, 9, 12);
  const gap = Math.abs(moonPosition(t).altitude - sunPosition(t).altitude);
  assert.ok(gap < 12, `gap ${gap}`);
  assert.ok(moonPosition(at(2026, 11, 9, 0)).altitude < 0);
});
