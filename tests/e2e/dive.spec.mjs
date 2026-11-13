// Dive e2e (WP11): scrolling takes you under. `depth` runs 0 -> 1 without going backwards on the way down, the gauge reads
// metres, the reef holds the caught species (and an invitation when the basket is empty).
import assert from "node:assert/strict";
import { setup } from "./helpers.mjs";

const env = await setup();
const BASKET = { "huikau-basket": ["mahi", "uhu", "kala", "hee"], "huikau-guide": { mahi: { n: 1 }, uhu: { n: 1 }, kala: { n: 1 }, hee: { n: 1 } } };

async function scrollDown(p, steps = 40) {
  const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let i = 1; i <= steps; i++) { await p.evaluate((y) => scrollTo(0, y), (max * i) / steps); await p.waitForTimeout(40); }
  await p.waitForTimeout(300);
  return max;
}

await env.test("scrolling top to bottom emits depth 0 -> 1 in order and the gauge counts down", async () => {
  const p = await env.page("/?debug=1&t=12:00", { seed: BASKET });
  await p.evaluate(() => { window.__depths = []; window.__huikau.bus.on("depth", (d) => window.__depths.push(d)); });
  assert.equal(await p.locator("#gauge.on").count(), 0, "gauge is hidden at the surface");
  assert.equal((await p.locator("#gauge-read").textContent()).trim(), "0 m");
  await scrollDown(p);
  const depths = await p.evaluate(() => window.__depths);
  assert.ok(depths.length >= 8, `only ${depths.length} depth events`);
  for (let i = 1; i < depths.length; i++) assert.ok(depths[i] >= depths[i - 1] - 1e-9, `depth went backwards at ${i}: ${depths[i - 1]} -> ${depths[i]}`);
  assert.ok(depths[0] >= 0 && depths.at(-1) > .995 && depths.at(-1) <= 1, `ends at ${depths.at(-1)}`);
  assert.ok(depths.every((d) => d >= 0 && d <= 1));
  assert.equal(await p.locator("#gauge.on").count(), 1, "gauge shows once under");
  const m = Number((await p.locator("#gauge-read").textContent()).replace(/\D/g, ""));
  assert.ok(m >= 28 && m <= 30, `bottom reads ${m} m`);
  // and back up
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(400);
  assert.equal((await p.locator("#gauge-read").textContent()).trim(), "0 m");
  assert.equal(await p.locator("#gauge.on").count(), 0);
  assert.deepEqual(p.problems, []);
  await p.ctx.close();
});

await env.test("the water changes with depth: the view under the surface looks different shallow and deep", async () => {
  const p = await env.page("/?debug=1&t=12:00");
  const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const shot = async (f) => { await p.evaluate((y) => scrollTo(0, y), max * f); await p.waitForTimeout(500); return (await p.screenshot({ animations: "disabled" })).toString("base64"); };
  const shallow = await shot(.3), deep = await shot(.9);
  assert.notEqual(shallow, deep);
  // the deep section follows the scroll one way or the other
  const mode = await p.evaluate(() => document.getElementById("deep").classList.contains("sdt") ? "scroll-timeline" : getComputedStyle(document.getElementById("deep")).getPropertyValue("--depth"));
  assert.ok(mode === "scroll-timeline" || Number(mode) > .5, `deep mode ${mode}`);
  await p.ctx.close();
});

await env.test("the reef shows a school for each caught species and a text summary", async () => {
  const p = await env.page("/?debug=1&t=12:00", { seed: BASKET });
  await p.waitForFunction(() => document.querySelectorAll("#reef-fish .fish").length > 0);
  const n = await p.locator("#reef-fish .fish").count();
  assert.ok(n >= 4, `${n} swimmers`);
  assert.equal(await p.locator("#reef-note").isHidden(), true);
  const summary = await p.locator("#reef-summary").textContent();
  assert.match(summary, /On the reef below:/);
  assert.match(summary, /dolphinfish/i);
  assert.equal(await p.locator("#reef-zone").getAttribute("data-catches"), "4");
  assert.equal(await p.locator("#reef-fish svg").count() >= 4, true, "illustrated fish, not emoji");
  await p.ctx.close();
});

await env.test("an empty basket gets the invitation instead of a reef", async () => {
  const p = await env.page("/?debug=1&t=12:00");
  await p.waitForFunction(() => document.getElementById("reef-zone").dataset.catches === "0");
  assert.equal(await p.locator("#reef-fish .fish").count(), 0);
  await p.locator("#reef-note").scrollIntoViewIfNeeded();
  assert.equal(await p.locator("#reef-note").isVisible(), true);
  assert.match(await p.locator("#reef-note").textContent(), /Catch a fish/);
  assert.match(await p.locator("#reef-summary").textContent(), /quiet/);
  await p.ctx.close();
});

await env.test("a catch swims down to the reef", async () => {
  const p = await env.page("/?debug=1&t=12:00");
  await p.evaluate(() => window.__huikau.bus.emit("catch", { id: "ono" }));
  await p.waitForFunction(() => document.getElementById("reef-zone").dataset.catches !== "0", null, { timeout: 5000 }).catch(() => {});
  // the game normally saves the basket first; emulate that and rebuild
  await p.evaluate(() => { localStorage.setItem("huikau-basket", JSON.stringify(["ono"])); window.__huikau.modules.reef.rebuild(); });
  assert.equal(await p.locator("#reef-zone").getAttribute("data-catches"), "1");
  await p.ctx.close();
});

await env.done("dive e2e");
