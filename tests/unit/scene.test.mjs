import test from "node:test";
import assert from "node:assert/strict";
import { buildLandSvg, litFromAltitude, stickerFromAltitude, nearRidgeY, farRidgeY, VIEW } from "../../js/scene/land.js";
import { LINE_STATES, STATES, BOBBER, canoeMarkup } from "../../js/scene/ula.js";
import "../../js/scene/crew.js";

test("land: the SVG is deterministic and has every layer", () => {
  const a = buildLandSvg(), b = buildLandSvg();
  assert.equal(a, b);
  for (const c of ["land-far", "land-near", "land-sand", "palm-trunk", "palm-leaf-front", "land-near-key"]) assert.ok(a.includes(c), c);
  assert.ok(!/NaN|undefined/.test(a));
  assert.ok(a.length < 40000, "stays small");
});

test("land: Lēʻahi is the tallest thing on the near ridge, and the far ridge sinks to the right", () => {
  const xs = Array.from({ length: 181 }, (_, i) => i * 8);
  const peak = xs.reduce((m, x) => (nearRidgeY(x) < nearRidgeY(m) ? x : m), 0);
  assert.ok(Math.abs(peak - 660) < 80, `peak at ${peak}`);
  assert.ok(farRidgeY(1400) > farRidgeY(300));
  for (const x of xs) assert.ok(nearRidgeY(x) < VIEW.h && farRidgeY(x) < VIEW.h);
});

test("land: lit and sticker follow the sun", () => {
  assert.equal(litFromAltitude(-30), 0);
  assert.equal(litFromAltitude(40), 1);
  assert.ok(litFromAltitude(0) > .4 && litFromAltitude(0) < .6);
  assert.equal(stickerFromAltitude(-20), 1);
  assert.equal(stickerFromAltitude(30), 0);
  assert.ok(stickerFromAltitude(2) > 0 && stickerFromAltitude(2) < 1);
});

test("ula: every state is drawn and every line ends at the bobber", () => {
  assert.deepEqual(STATES.sort(), ["bite", "cast", "gotaway", "idle", "landed", "reel", "waiting"]);
  for (const s of STATES) {
    const end = LINE_STATES[s].cord.match(/(-?[\d.]+)\s+(-?[\d.]+)$/);
    assert.equal(Number(end[1]), BOBBER.x, s);
    assert.equal(Number(end[2]), BOBBER.y, s);
    assert.ok(LINE_STATES[s].rod.startsWith("M84 100"), s);
  }
  assert.ok(canoeMarkup().includes("ula-hull"));
});
