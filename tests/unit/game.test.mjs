import test from "node:test";
import assert from "node:assert/strict";
import { species, speciesById } from "../../js/data/species.js";
import { judgeReel, phaseOf, pool, weightFor, pickSpecies, GUARD, ZONE_START, RING_END, BITE_MIN, BITE_MAX } from "../../js/game/fishing.js";
import { migrateGuide, nameParts } from "../../js/game/basket.js";

const EMOJI = /\p{Extended_Pictographic}/u;
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };

test("reel timing: guard, early, generous window, late; easy lets any press land", () => {
  assert.equal(judgeReel(GUARD - 1), "ignore");
  assert.equal(judgeReel(ZONE_START - 1), "early");
  assert.equal(judgeReel(ZONE_START), "hit");
  assert.equal(judgeReel(RING_END), "hit");
  assert.equal(judgeReel(RING_END + 1), "late");
  assert.equal(judgeReel(GUARD, { easy: true }), "hit");
  assert.equal(judgeReel(GUARD - 1, { easy: true }), "ignore");
  assert.ok(BITE_MIN === 1500 && BITE_MAX === 6000);
});

test("phases of the day", () => {
  assert.equal(phaseOf(6 * 60), "dawn");
  assert.equal(phaseOf(12 * 60), "day");
  assert.equal(phaseOf(18 * 60 + 10), "dusk");
  assert.equal(phaseOf(22 * 60), "night");
  assert.equal(phaseOf(2 * 60), "night");
});

test("heʻe is likelier at dusk than at noon; honu is a visitor and never in the basket guide", () => {
  const hee = speciesById.hee;
  assert.ok(weightFor(hee, "dusk") > 2 * weightFor(hee, "day"));
  assert.equal(speciesById.honu.rarity, "visitor");
});

test("seasonal finds only in season; golden ulua is excluded from the pool and forced by rare", () => {
  const ids = (season) => pool(season).map((s) => s.id);
  assert.ok(ids("halloween").includes("pumpkin") && ids("halloween").includes("skeleton"));
  assert.ok(!ids("none").includes("pumpkin") && !ids("none").includes("gift"));
  assert.ok(ids("winter").includes("gift") && !ids("winter").includes("popper"));
  assert.ok(ids("newyear").includes("popper"));
  assert.ok(!ids("none").includes("golden"));
  assert.equal(pickSpecies({ rare: true }).id, "golden");
  assert.equal(pickSpecies({ rng: seq(0.01) }).id, "golden");         // under 1/40
  assert.notEqual(pickSpecies({ rng: seq(0.5, 0.5) }).id, "golden");
});

test("the pick follows the weights and never repeats the last one", () => {
  const counts = {};
  let s = 12345;
  const rng = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  let last = null;
  for (let i = 0; i < 6000; i++) {
    const sp = pickSpecies({ rng, phase: "dusk", season: "none", avoid: last });
    if (sp.id !== "golden") assert.notEqual(sp.id, last);
    last = sp.id;
    counts[sp.id] = (counts[sp.id] || 0) + 1;
  }
  assert.ok(counts.golden > 80 && counts.golden < 220, `golden ${counts.golden}`); // ~1/40
  assert.ok(counts.hee > counts.mahi * 0.9, "heʻe is at least as common as mahimahi at dusk");
  assert.ok(counts.mahi > counts.shark);
});

test("every species has a best time, a fact, and no emoji; ula has her own line", () => {
  for (const s of species) {
    assert.ok(["dawn", "day", "dusk", "night", "any"].includes(s.best), s.id);
    assert.ok(s.fact.length > 10, s.id);
    assert.ok(!EMOJI.test(s.fact + s.line), s.id);
  }
  assert.ok(speciesById.ula.ulaLine && speciesById.ula.ulaLine !== speciesById.ula.line);
});

test("migrateGuide: legacy ids appear once, honu and unknown ids are dropped, counts survive", () => {
  const g = migrateGuide(["mahi", "honu", "bogus", "boot"], null);
  assert.deepEqual(Object.keys(g), ["mahi", "boot"]);
  assert.equal(g.mahi.n, 1);
  const g2 = migrateGuide(["mahi"], { mahi: { n: 4, first: 5, last: 9 }, uhu: { n: 2, first: 1, last: 2 } });
  assert.equal(g2.mahi.n, 4);
  assert.equal(g2.uhu.n, 2);
  assert.deepEqual(migrateGuide("nope", []), {});
});

test("nameParts: Hawaiian name large with English under it; plain English items have no sub", () => {
  assert.deepEqual(nameParts(speciesById.ahi), { main: "ʻAhi", mainHaw: true, sub: "Yellowfin tuna" });
  assert.deepEqual(nameParts(speciesById.boot), { main: "Old boot", mainHaw: false, sub: "" });
  assert.equal(nameParts(speciesById.golden).mainHaw, false);
});
