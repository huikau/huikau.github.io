import test from "node:test";
import assert from "node:assert/strict";
import { species, speciesById } from "../../js/data/species.js";
import { schoolPlan, reefRole, spawn, stepFlock, mulberry32, SIZES, BANDS } from "../../js/scene/reef.js";
import { glintSource, waveSeconds } from "../../js/scene/surface.js";
import { diveMetrics, depthFor, lightFor, meters } from "../../js/scene/dive.js";

const FIVE = ["mahi", "uhu", "manini", "kala", "humu"];

test("only caught fish and creatures live on the reef; objects, visitors and strangers do not", () => {
  assert.deepEqual(schoolPlan([]), []);
  assert.deepEqual(schoolPlan(null), []);
  const plan = schoolPlan(["slipper", "boot", "pineapple", "honu", "wave", "pumpkin", "nonsense", 42, "mahi", "mahi"]);
  assert.deepEqual(plan.map((p) => p.id), ["mahi"]);
  assert.equal(reefRole(speciesById.honu), null);
  assert.equal(reefRole(speciesById.slipper), null);
  assert.equal(reefRole(speciesById.hee), "floor");
  assert.equal(reefRole(speciesById.uhu), "school");
});

test("five catches make five schools, sized by rarity, with everyone in a sensible band", () => {
  const plan = schoolPlan(FIVE);
  assert.deepEqual(plan.map((p) => p.id), FIVE);
  const by = Object.fromEntries(plan.map((p) => [p.id, p]));
  assert.equal(by.mahi.count, 7); // common
  assert.equal(by.uhu.count, 4); // uncommon
  assert.equal(by.humu.count, 2); // rare
  for (const p of plan) { assert.ok(p.band[0] < p.band[1]); assert.equal(p.size, SIZES[p.id]); }
  assert.deepEqual(by.mahi.band, BANDS["open ocean"]);
  assert.deepEqual(by.manini.band, BANDS.reef);
});

test("a rare giant swims alone, creatures rest on the sand, and the total is capped", () => {
  assert.equal(schoolPlan(["shark"])[0].count, 1);
  assert.equal(schoolPlan(["hee"])[0].role, "floor");
  const every = species.map((s) => s.id);
  const plan = schoolPlan(every, speciesById, { cap: 30 });
  assert.ok(plan.reduce((n, p) => n + p.count, 0) <= 30);
  assert.ok(plan.every((p) => p.count >= 1));
  assert.ok(!plan.some((p) => ["honu", "slipper", "pumpkin"].includes(p.id)));
  assert.ok(schoolPlan(["mahi"], speciesById, { scale: .5 })[0].size < SIZES.mahi);
});

test("steering: a school stays inside its water, keeps together, keeps apart and holds its speed", () => {
  const bounds = { w: 1200, h: 520 };
  const entry = schoolPlan(["manini"])[0];
  const rng = mulberry32(7);
  const fish = spawn(entry, bounds, mulberry32(3));
  assert.equal(fish.length, entry.count);
  let crowded = 0, frames = 0, maxSpread = 0;
  for (let i = 0; i < 60 * 40; i++) {
    stepFlock(fish, bounds, 1 / 60, rng);
    for (const f of fish) {
      assert.ok(f.x >= -f.size && f.x <= bounds.w + f.size, `x out of bounds ${f.x}`);
      assert.ok(f.y > -20 && f.y < bounds.h, `y out of bounds ${f.y}`);
      const sp = Math.hypot(f.vx, f.vy);
      assert.ok(sp <= f.speed * 1.4 + 1e-6, `too fast ${sp}`);
      assert.ok(Number.isFinite(f.x + f.y + f.vx + f.vy));
    }
    if (i > 600) {
      const cx = fish.reduce((a, f) => a + f.x, 0) / fish.length, cy = fish.reduce((a, f) => a + f.y, 0) / fish.length;
      maxSpread = Math.max(maxSpread, ...fish.map((f) => Math.hypot(f.x - cx, f.y - cy)));
      frames++;
      let tight = false;
      for (let a = 0; a < fish.length; a++) for (let b = a + 1; b < fish.length; b++)
        if (Math.hypot(fish[a].x - fish[b].x, fish[a].y - fish[b].y) < fish[a].size * .12) tight = true;
      if (tight) crowded++;
    }
  }
  assert.ok(maxSpread < 600, `school scattered: ${maxSpread}`);
  assert.ok(crowded / frames < .02, `fish piled up in ${crowded} of ${frames} frames`);
});

test("steering: a fish below its band is pushed back up, and floor creatures never move", () => {
  const bounds = { w: 1000, h: 500 };
  const f = { id: "mahi", role: "school", size: 100, band: [.1, .3], x: 500, y: 480, vx: -20, vy: 0, speed: 30, theta: 0, phase: 0 };
  const rng = mulberry32(1);
  for (let i = 0; i < 600; i++) stepFlock([f], bounds, 1 / 60, rng);
  assert.ok(f.y < 480 - 60, `still low: ${f.y}`);
  const hee = spawn(schoolPlan(["hee"])[0], bounds, mulberry32(2));
  const [x, y] = [hee[0].x, hee[0].y];
  stepFlock(hee, bounds, .5, rng);
  assert.deepEqual([hee[0].x, hee[0].y], [x, y]);
});

test("steering is deterministic for a seed", () => {
  const run = () => {
    const b = { w: 800, h: 400 }, fish = spawn(schoolPlan(["uhu"])[0], b, mulberry32(9)), r = mulberry32(5);
    for (let i = 0; i < 200; i++) stepFlock(fish, b, 1 / 60, r);
    return fish.map((f) => f.x.toFixed(3) + f.y.toFixed(3)).join();
  };
  assert.equal(run(), run());
});

test("dive: depth runs 0 at the waterline to 1 at the bottom and is clamped", () => {
  const m = diveMetrics({ shoreTop: 1000, viewport: 900, docHeight: 3000 });
  assert.equal(depthFor(0, m), 0);
  assert.equal(depthFor(m.surface, m), 0);
  assert.equal(depthFor(m.max, m), 1);
  assert.equal(depthFor(m.max + 500, m), 1);
  const mid = depthFor((m.surface + m.max) / 2, m);
  assert.ok(Math.abs(mid - .5) < 1e-9);
  assert.equal(depthFor(100, diveMetrics({ shoreTop: 1000, viewport: 900, docHeight: 900 })), 0); // a page that doesn't scroll
  assert.equal(meters(0), 0);
  assert.equal(meters(1), 30);
});

test("light: bright by day, dim at night, never zero", () => {
  assert.equal(lightFor(60).day, 1);
  assert.ok(lightFor(-30).day < .2 && lightFor(-30).day > 0);
  assert.ok(lightFor(-30).night > .9 && lightFor(40).night === 0);
  assert.ok(lightFor(0).day > lightFor(-5).day);
});

test("surface: glints follow the sun by day, the moon by night, and wind speeds the waves", () => {
  const sun = glintSource({ sunAlt: 30, sunX: 70, moonAlt: 40, moonX: 20, moonIllum: 80 });
  assert.equal(sun.body, "sun"); assert.equal(sun.x, 70);
  const moon = glintSource({ sunAlt: -20, sunX: 90, moonAlt: 40, moonX: 20, moonIllum: 80 });
  assert.equal(moon.body, "moon"); assert.equal(moon.x, 20);
  assert.ok(moon.strength < sun.strength);
  assert.equal(glintSource({ sunAlt: -20, sunX: 90, moonAlt: -10, moonX: 20, moonIllum: 80 }).strength, 0);
  const low = glintSource({ sunAlt: 12, sunX: 70, moonAlt: 0, moonX: 0, moonIllum: 0 }), high = glintSource({ sunAlt: 70, sunX: 50, moonAlt: 0, moonX: 0, moonIllum: 0 });
  assert.ok(low.strength > high.strength, "a low sun makes a stronger golden road");
  assert.ok(waveSeconds(.45) < waveSeconds(1) && waveSeconds(1) < waveSeconds(1.15));
});
