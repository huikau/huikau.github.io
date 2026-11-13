import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ulasPick } from "../../js/ui/instruments.js";
import { parseTides } from "../../js/data/tides.js";
import { sunTimesAt } from "../../js/core/astro.js";
import { hstToEpoch } from "../../js/core/clock.js";

// The hi/lo fixture spans 48 hours (Nov 12 and Nov 13), as the live feed does.
const list = parseTides(JSON.parse(await readFile(new URL("../fixtures/tides-hilo.json", import.meta.url), "utf8")));
const sun = sunTimesAt(hstToEpoch(2026, 11, 12, 12));

test("ulasPick only considers today's tides: at noon it is today's 5:21 pm high, not tomorrow's 6:15 pm", () => {
  const text = ulasPick(720, sun, list, "20261112");
  assert.match(text, /5:21 pm high tide/);
  assert.doesNotMatch(text, /6:15 pm/);
});

test("ulasPick: once today's tides are behind, it does not borrow tomorrow's", () => {
  const text = ulasPick(23 * 60, sun, list, "20261112");
  assert.match(text, /done for today/);
});

test("ulasPick: tomorrow's list entries are used when tomorrow is the day asked about", () => {
  assert.match(ulasPick(7 * 60, sunTimesAt(hstToEpoch(2026, 11, 13, 12)), list, "20261113"), /6:40 am high tide|2:32 pm low tide|6:15 pm high tide/);
});
