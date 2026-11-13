import test from "node:test";
import assert from "node:assert/strict";
import { createBus } from "../../js/core/bus.js";

test("every pure module imports in Node without touching the DOM", async () => {
  for (const f of ["core/astro", "core/bus", "core/clock", "core/dom", "core/motion", "core/store",
    "data/tides", "data/weather", "data/surf", "data/hawaiian", "data/species",
    "sky/sky", "sky/bodies", "sky/clouds", "sky/stars", "sky/rain",
    "ui/instruments", "ui/seasons", "ui/eggs", "ui/sound", "game/basket", "game/fishing"]) {
    await import(`../../js/${f}.js`);
  }
});

test("motion.reduced is false in Node", async () => {
  assert.equal((await import("../../js/core/motion.js")).motion.reduced, false);
});

test("bus: on, off, emit, unsubscribe handle, and a throwing handler doesn't stop others", () => {
  const bus = createBus();
  const seen = [];
  const a = (x) => seen.push(["a", x]);
  const off = bus.on("tick", a);
  bus.on("tick", () => { throw new Error("boom"); });
  bus.on("tick", (x) => seen.push(["c", x]));
  const realError = console.error;
  console.error = () => {};
  try { bus.emit("tick", 1); } finally { console.error = realError; }
  assert.deepEqual(seen, [["a", 1], ["c", 1]]);
  off();
  bus.off("nothing", a);
  console.error = () => {};
  try { bus.emit("tick", 2); } finally { console.error = realError; }
  assert.deepEqual(seen.at(-1), ["c", 2]);
  assert.equal(seen.filter(([k]) => k === "a").length, 1);
  bus.emit("never", 0); // no listeners: fine
});
