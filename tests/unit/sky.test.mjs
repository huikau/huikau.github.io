// Sky engine tests. Contrast: the clock line sits on --sky-top, over the first 0-12% of the scene's height
// (the top of the sky gradient), so --text-on-sky is held to AA against that range, not against --sky-mid.
import test from "node:test";
import assert from "node:assert/strict";
import {
  KEYFRAMES, CLOCK_SAMPLES, TEXT_DARK, TEXT_LIGHT, skyPalette, skyStop, gradientAt, contrast, luminance,
  hexToOklch, oklchToHex, mixOklch, starAlpha, cloudTints, skyLabel, phaseFor, FORCED_SKY
} from "../../js/sky/palette.js";
import { sunPosition, moonPosition, moonPhase, sunTimes } from "../../js/core/astro.js";
import { bodyPlace, moonPositionForPhase, HORIZON_Y } from "../../js/sky/bodies.js";
import { stepForKey } from "../../js/sky/timemachine.js";
import { makeStars } from "../../js/sky/stars.js";
import { cloudShape, cloudSvg, cloudCount } from "../../js/sky/clouds.js";
import { hstToEpoch, createClock } from "../../js/core/clock.js";
import { readout } from "../../js/sky/timemachine.js";

const DATES = [[2026, 3, 20], [2026, 6, 21], [2026, 12, 21], [2026, 11, 12]];

test("OKLCH round trip is stable for sky colours", () => {
  for (const k of KEYFRAMES) for (const name of ["top", "mid", "horizon", "glow"]) {
    const hex = k[name].toUpperCase();
    const back = oklchToHex(hexToOklch(hex)).toUpperCase();
    const d = [1, 3, 5].map((i) => Math.abs(parseInt(hex.slice(i, i + 2), 16) - parseInt(back.slice(i, i + 2), 16)));
    assert.ok(Math.max(...d) <= 1, `${hex} -> ${back}`);
  }
});

test("OKLCH mixing: endpoints, grey hue borrowing, short hue path", () => {
  const a = hexToOklch("#FF0000"), b = hexToOklch("#0000FF");
  assert.equal(oklchToHex(mixOklch(a, b, 0)), "#ff0000");
  assert.equal(oklchToHex(mixOklch(a, b, 1)), "#0000ff");
  const grey = hexToOklch("#808080");
  assert.ok(Math.abs(mixOklch(grey, a, .5)[2] - a[2]) < 1e-9);
  const m = mixOklch([.6, .1, 350], [.6, .1, 10], .5);
  assert.ok(m[2] < 1 || m[2] > 359, `short way round, got ${m[2]}`); // through 0, not through 180
});

test("keyframes are sorted by altitude, as the brief lists them", () => {
  assert.deepEqual(KEYFRAMES.map((k) => k.alt), [-18, -12, -6, -2, 0, 4, 10, 25, 60]);
});

test("sky stops reproduce the keyframes and are continuous in between", () => {
  for (const k of KEYFRAMES) assert.equal(skyStop("mid", k.alt).toUpperCase(), oklchToHex(k.oc.mid).toUpperCase());
  // no jumps: 0.05 degree steps move every stop by a few colour levels at most (no pop, no band)
  let prev = skyPalette(-25);
  for (let a = -24.95; a <= 80; a += .05) {
    const p = skyPalette(a);
    for (const n of ["top", "mid", "horizon"]) {
      const d = [1, 3, 5].map((i) => Math.abs(parseInt(p[n].slice(i, i + 2), 16) - parseInt(prev[n].slice(i, i + 2), 16)));
      assert.ok(Math.max(...d) <= 3, `${n} jumps ${Math.max(...d)} at ${a.toFixed(2)} deg`);
    }
    prev = p;
  }
});

test("lightness of the horizon rises monotonically with the sun (no dips)", () => {
  let last = -1;
  for (let a = -18; a <= 25; a += .5) {
    const L = hexToOklch(skyStop("horizon", a))[0];
    assert.ok(L >= last - .002, `horizon darkens at ${a}`);
    last = L;
  }
});

test("stars fade in below -6 degrees, fully on at night, off in the day", () => {
  assert.equal(starAlpha(0), 0);
  assert.equal(starAlpha(-3), 0);
  assert.ok(starAlpha(-6) > .3 && starAlpha(-6) < .7);
  assert.equal(starAlpha(-12), 1);
  for (let a = -20; a < 5; a += .5) assert.ok(starAlpha(a) >= starAlpha(a + .5) - 1e-9, `monotonic at ${a}`);
});

// What actually sits behind the clock line is the top of the sky gradient (the first CLOCK_SAMPLES of its height),
// on a phone as well as a desktop. The sun's glow is not included: it is faint, and kept away from the top.
test("--text-on-sky is AA (4.5:1) over the sky behind the clock line, every half hour, on four dates", () => {
  let worst = 99, where = "";
  for (const [y, mo, d] of DATES) {
    for (let half = 0; half < 48; half++) {
      const ms = hstToEpoch(y, mo, d, half * 30);
      const p = skyPalette(sunPosition(ms).altitude);
      assert.ok([TEXT_DARK, TEXT_LIGHT].includes(p.textOnSky));
      for (const f of CLOCK_SAMPLES) {
        const c = contrast(p.textOnSky, gradientAt(p, f));
        if (c < worst) { worst = c; where = `${y}-${mo}-${d} ${half / 2}h at ${f}`; }
        assert.ok(c >= 4.5, `${y}-${mo}-${d} ${half / 2}h: ${c.toFixed(2)} at ${f}`);
      }
      // --sky-top is the colour at the very top edge. --sky-mid sits 42% of the way down, far below the clock line
      // (even on a phone, where the line wraps to three rows, it ends near 10%), so it is deliberately not held to AA.
      assert.ok(contrast(p.textOnSky, p.top) >= 4.5, `top ${y}-${mo}-${d} ${half / 2}h`);
    }
  }
  assert.ok(worst >= 4.5, `worst ${worst} at ${where}`);
});

test("--text-on-sky holds at every altitude, not just on the sampled half hours", () => {
  for (let a = -30; a <= 90; a += .25) assert.ok(skyPalette(a).textContrast >= 4.5, `alt ${a}`);
});

test("palette exposes every variable the other layers read", () => {
  const p = skyPalette(10);
  for (const k of ["top", "mid", "horizon", "glow", "glowSoft", "haze", "textOnSky"]) assert.ok(p[k], k);
  assert.match(p.top, /^#[0-9a-f]{6}$/);
});

test("night is dark, noon is bright", () => {
  assert.ok(luminance(skyPalette(-30).mid) < .02);
  assert.ok(luminance(skyPalette(60).horizon) > .6);
});

test("cloud tints: lit side brighter than the shade; rain greys them", () => {
  for (const a of [-20, 0, 30]) {
    const t = cloudTints(a, skyPalette(a));
    assert.ok(luminance(t.hi) >= luminance(t.shade), `alt ${a}`);
  }
  const clear = cloudTints(30, skyPalette(30)), wet = cloudTints(30, skyPalette(30), .85);
  assert.ok(luminance(wet.body) < luminance(clear.body));
});

test("Time Machine readout on 2026-11-12: midday around solar noon, golden hour, twilight", () => {
  const clock = createClock({ search: "", realNow: () => hstToEpoch(2026, 11, 12, 600) });
  const at = (h, m = 0) => readout(clock, h * 60 + m);
  assert.equal(at(9), "9:00 am · morning");
  assert.equal(at(12), "12:00 pm · midday");
  assert.equal(at(15), "3:00 pm · afternoon");
  assert.equal(at(17, 30), "5:30 pm · golden hour");
  assert.match(at(6), /^6:00 am · before dawn$/);
  assert.equal(at(18, 20), "6:20 pm · dusk");
  assert.equal(skyLabel(40, true, -60), "midday");
  assert.equal(skyLabel(40, false, 90), "afternoon");
});

test("labels and legacy phases", () => {
  assert.equal(skyLabel(-30, false), "night");
  assert.equal(skyLabel(3, false), "golden hour");
  assert.equal(skyLabel(40, true), "morning");
  assert.equal(skyLabel(40, false), "afternoon");
  assert.equal(phaseFor(-20, true), "night");
  assert.equal(phaseFor(5, true), "dawn");
  assert.equal(phaseFor(5, false), "golden");
  assert.equal(phaseFor(-3, false), "dusk");
  assert.equal(phaseFor(40, false), "day");
  for (const [name, f] of Object.entries(FORCED_SKY)) {
    assert.equal(phaseFor(f.altitude, f.azimuth < 180), name === "day" ? "day" : name, name);
  }
});

test("sun and moon places: on the horizon at 0 degrees, higher with altitude, east left of west", () => {
  assert.ok(Math.abs(bodyPlace(0, 90).y - HORIZON_Y) < 1e-9);
  assert.ok(bodyPlace(30, 90).y < bodyPlace(10, 90).y);
  assert.ok(bodyPlace(-10, 90).y > HORIZON_Y);
  assert.ok(bodyPlace(20, 90).x < 50 && bodyPlace(20, 270).x > 50);
  // continuous through the zenith, even though azimuth flips there
  const a = bodyPlace(88, 5), b = bodyPlace(88, 175);
  assert.ok(Math.abs(a.x - b.x) < 3, "x stays near the middle at the zenith");
});

test("the sun's place follows the real day: rises east, peaks near the middle, sets west", () => {
  const at = (h) => { const p = sunPosition(hstToEpoch(2026, 11, 12, h * 60)); return { ...p, ...bodyPlace(p.altitude, p.azimuth) }; };
  const dawn = at(6.6), noon = at(12), dusk = at(17.4);
  assert.ok(dawn.x < 20 && dusk.x > 80, `${dawn.x} ${dusk.x}`);
  assert.ok(noon.y < dawn.y - 20 && noon.y < dusk.y - 20);
  assert.ok(Math.abs(noon.x - 50) < 25);
  // sun below the horizon at midnight, so it is behind the sea
  assert.ok(at(0).altitude < -30 && at(0).y > HORIZON_Y);
});

test("sunset in the sky engine matches astro's sun times (altitude about -0.8 at the horizon)", () => {
  for (const [y, mo, d] of DATES) {
    const t = sunTimes(new Date(Date.UTC(y, mo - 1, d)));
    assert.ok(Math.abs(sunPosition(hstToEpoch(y, mo, d, t.rise)).altitude + .83) < .6, `rise ${mo}/${d}`);
    assert.ok(Math.abs(sunPosition(hstToEpoch(y, mo, d, t.set)).altitude + .83) < .6, `set ${mo}/${d}`);
  }
});

test("moonPositionForPhase agrees with astro.moonPosition at the real phase, and moves with the phase", () => {
  const ms = hstToEpoch(2026, 11, 12, 22 * 60);
  const real = moonPosition(ms), same = moonPositionForPhase(ms, moonPhase(ms));
  assert.ok(Math.abs(real.altitude - same.altitude) < 1e-6 && Math.abs(real.azimuth - same.azimuth) < 1e-6);
  const full = moonPositionForPhase(ms, .5), nw = moonPositionForPhase(ms, 0);
  // a full moon is up when the sun is down (around midnight in the tropics); the new moon travels with the sun
  const midnight = hstToEpoch(2026, 11, 12, 24 * 60);
  assert.ok(moonPositionForPhase(midnight, .5).altitude > 30);
  assert.ok(moonPositionForPhase(hstToEpoch(2026, 11, 12, 12 * 60), 0).altitude > 30);
  assert.notEqual(full.altitude, nw.altitude);
});

test("Time Machine keyboard: arrows 15 min, Page keys 1 h, Home/End, clamped", () => {
  assert.equal(stepForKey("ArrowRight", 600), 615);
  assert.equal(stepForKey("ArrowUp", 600), 615);
  assert.equal(stepForKey("ArrowLeft", 600), 585);
  assert.equal(stepForKey("ArrowDown", 600), 585);
  assert.equal(stepForKey("PageUp", 600), 660);
  assert.equal(stepForKey("PageDown", 600), 540);
  assert.equal(stepForKey("Home", 600), 0);
  assert.equal(stepForKey("End", 600), 1439);
  assert.equal(stepForKey("ArrowLeft", 5), 0);
  assert.equal(stepForKey("PageUp", 1430), 1439);
  assert.equal(stepForKey("a", 600), null);
});

test("stars and clouds are generated in range", () => {
  let s = 1; const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const stars = makeStars(rand);
  assert.ok(stars.length > 100 && stars.every((x) => x.x >= 0 && x.x <= 1 && x.y >= 0 && x.y <= 1 && x.a > 0 && x.a <= 1));
  const puffs = cloudShape(rand);
  assert.ok(puffs.length >= 4 && puffs.every(([x, , r]) => x - r > -5 && x + r < 225));
  assert.match(cloudSvg(puffs), /cl-hi/);
  assert.deepEqual([0, 1, 2, 3, 4].map(cloudCount), [0, 1, 3, 4, 6]);
});
