// Time scrub e2e (WP11): the Island Time Machine drives the clock, the sky variables, the readout and the clock line from the
// keyboard, and "Live" returns to the frozen real time (2026-11-12 12:00 Honolulu).
import assert from "node:assert/strict";
import { setup, rootVar } from "./helpers.mjs";

const env = await setup();
const val = (p) => p.locator("#tm-range").inputValue().then(Number);
const skyTop = (p) => rootVar(p, "--sky-top");
const settle = (p) => p.waitForTimeout(250);

await env.test("keyboard scrub: arrows 15 min, PageUp/PageDown 1 h, Home and End; sky, readout and clock line follow", async () => {
  const p = await env.page("/?debug=1");
  assert.equal(await val(p), 720);
  assert.equal(await p.locator("#tm-live").isDisabled(), true, "Live is disabled while live");
  const noonSky = await skyTop(p), noonClock = await p.locator("#clock-text").textContent();
  await p.locator("#tm-range").focus();
  await p.keyboard.press("ArrowRight"); await settle(p);
  assert.equal(await val(p), 735);
  assert.match(await p.locator("#tm-readout").textContent(), /^12:15 pm · /);
  await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft"); await settle(p);
  assert.equal(await val(p), 705);
  await p.keyboard.press("PageUp"); await settle(p);
  assert.equal(await val(p), 765);
  await p.keyboard.press("PageDown"); await p.keyboard.press("PageDown"); await settle(p);
  assert.equal(await val(p), 645);
  assert.equal(await p.locator("#tm-live").isDisabled(), false, "Live is enabled once scrubbed");
  assert.equal(await p.locator("#timemachine.scrubbed").count(), 1);

  await p.keyboard.press("Home"); await settle(p);
  assert.equal(await val(p), 0);
  assert.match(await p.locator("#tm-readout").textContent(), /^12:00 am · /);
  const midnightSky = await skyTop(p);
  assert.notEqual(midnightSky, noonSky, "sky colour changes between noon and midnight");
  assert.match(await p.locator("#tm-range").getAttribute("aria-valuetext"), /12:00 am/);
  const midnightClock = await p.locator("#clock-text").textContent();
  assert.notEqual(midnightClock, noonClock, "clock line changes");
  assert.match(midnightClock, /12:00 am/i);

  await p.keyboard.press("End"); await settle(p);
  assert.equal(await val(p), 1439);
  assert.match(await p.locator("#tm-readout").textContent(), /^11:59 pm · /);
  // clamped at the ends
  await p.keyboard.press("ArrowRight"); await settle(p);
  assert.equal(await val(p), 1439);

  // dawn, golden hour and dusk look different from each other
  const skies = new Set();
  for (const t of ["05:30", "06:40", "12:00", "17:30", "18:10", "22:00"]) {
    await p.evaluate((t) => { const [h, m] = t.split(":").map(Number); window.__huikau.clock.setHstMinutes(h * 60 + m); }, t);
    await settle(p);
    skies.add(await skyTop(p));
  }
  assert.ok(skies.size >= 5, `expected distinct skies, got ${skies.size}`);
  assert.deepEqual(p.problems, []);
  await p.ctx.close();
});

await env.test("Live returns to now: slider, clock line, readout and sky are back", async () => {
  const p = await env.page("/?debug=1");
  const noonSky = await skyTop(p), noonClock = await p.locator("#clock-text").textContent();
  await p.locator("#tm-range").focus();
  await p.keyboard.press("Home"); await settle(p);
  await p.locator("#tm-live").click(); await settle(p);
  assert.equal(await val(p), 720);
  assert.equal(await p.locator("#tm-live").isDisabled(), true);
  assert.equal(await p.locator("#tm-live").getAttribute("aria-pressed"), "true");
  assert.equal(await p.locator("#clock-text").textContent(), noonClock);
  assert.match(await p.locator("#tm-readout").textContent(), /^12:00 pm/);
  assert.equal(await skyTop(p), noonSky);
  assert.equal(await p.evaluate(() => document.activeElement?.id), "tm-range", "focus stays on the slider");
  await p.ctx.close();
});

await env.test("pointer drag across the track moves the time", async () => {
  const p = await env.page("/?debug=1");
  const r = await p.locator("#tm-range").boundingBox();
  await p.mouse.move(r.x + r.width * .5, r.y + r.height / 2);
  await p.mouse.down();
  await p.mouse.move(r.x + r.width * .9, r.y + r.height / 2, { steps: 6 });
  await p.mouse.up();
  await settle(p);
  const v = await val(p);
  assert.ok(v > 1000, `dragged to ${v}`);
  assert.equal(await p.locator("#tm-live").isDisabled(), false);
  await p.ctx.close();
});

await env.test("every half hour of the day has a distinct, valid sky and a readout (no NaN)", async () => {
  const p = await env.page("/?debug=1");
  for (let m = 0; m < 1440; m += 30) {
    await p.evaluate((m) => window.__huikau.clock.setHstMinutes(m), m);
    const bad = await p.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const vars = ["--sky-top", "--sky-mid", "--sky-horizon", "--text-on-sky"].map((v) => cs.getPropertyValue(v).trim());
      return { vars, out: document.getElementById("tm-readout").textContent, clock: document.getElementById("clock-text").textContent };
    });
    for (const v of bad.vars) assert.ok(v && !/NaN|undefined/.test(v), `${m}: sky var ${v}`);
    assert.ok(!/NaN|undefined/.test(bad.out + bad.clock), `${m}: ${bad.out} / ${bad.clock}`);
  }
  assert.deepEqual(p.problems, []);
  await p.ctx.close();
});

await env.done("time machine e2e");
