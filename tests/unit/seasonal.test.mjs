import test from "node:test";
import assert from "node:assert/strict";
import { createBus } from "../../js/core/bus.js";
import { detectSeason, lightsSVG, burstSVG, leiSVG, BURSTS } from "../../js/ui/seasons.js";
import { SECRETS, CATCH_SECRETS, markFound, isFound, resetFound, foundLabel, flashWindow, whaleSeason, pineappleSVG, WISHES } from "../../js/ui/eggs.js";

test("seasons by date and override", () => {
  assert.equal(detectSeason(new Date(Date.UTC(2026, 9, 31))), "halloween");
  assert.equal(detectSeason(new Date(Date.UTC(2026, 11, 20))), "winter");
  assert.equal(detectSeason(new Date(Date.UTC(2026, 11, 31))), "newyear");
  assert.equal(detectSeason(new Date(Date.UTC(2026, 5, 1)), "winter"), "winter");
});

test("string lights are flat SVG with an ink keyline and no gradients or emoji", () => {
  const s = lightsSVG(1200, "winter");
  assert.match(s, /^<svg/);
  assert.ok((s.match(/class="bulb"/g) || []).length >= 10);
  assert.ok(!/gradient|filter|drop-shadow/.test(s));
  assert.match(s, /#0B2226/);
});

test("fireworks, lei and pineapple are drawn, not emoji", () => {
  for (const s of [burstSVG("#F5A623", "#F7EEDB"), leiSVG(), pineappleSVG(40)]) {
    assert.match(s, /<(svg|ellipse|path|g)/);
    assert.ok(!/\p{Extended_Pictographic}/u.test(s));
  }
  assert.ok(BURSTS.length >= 4);
});

test("every secret has a short riddle and a unique id; catch ids map to real secrets", () => {
  const ids = new Set(SECRETS.map((s) => s.id));
  assert.equal(ids.size, SECRETS.length);
  for (const s of SECRETS) assert.ok(s.riddle.length < 70 && s.name);
  for (const v of Object.values(CATCH_SECRETS)) assert.ok(ids.has(v));
  assert.ok(!/\p{Extended_Pictographic}/u.test(JSON.stringify(SECRETS)));
  assert.ok(WISHES.length > 3);
});

test("found state: marks once, emits on the bus, counts, ignores unknown ids", () => {
  resetFound([]);
  const bus = createBus(), seen = [];
  bus.on("found", (id) => seen.push(id));
  markFound("greenflash", bus);
  markFound("greenflash", bus);
  markFound("nope", bus);
  assert.deepEqual(seen, ["greenflash"]);
  assert.ok(isFound("greenflash") && !isFound("wish"));
  assert.equal(foundLabel(), `1 of ${SECRETS.length} found`);
  resetFound([]);
});

test("green flash window, whale season", () => {
  assert.equal(flashWindow(1071, 1073, { rain: false, clouds: 1 }), true);
  assert.equal(flashWindow(1071, 1090, { rain: false, clouds: 1 }), false);
  assert.equal(flashWindow(1071, 1073, { rain: false, clouds: 6 }), false);
  assert.equal(whaleSeason(12), true);
  assert.equal(whaleSeason(7), false);
});
