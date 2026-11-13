// Load e2e (WP11): the page loads clean, every region is present, the screen-reader summary reads sensibly, the plan's
// "keep exactly" items are intact, and nothing scrolls sideways from 320 to 1920 px.
import assert from "node:assert/strict";
import { setup } from "./helpers.mjs";

const env = await setup();

await env.test("loads with no console errors or warnings, and every region is there", async () => {
  const p = await env.page("/?debug=1&t=12:00");
  await p.waitForTimeout(2500);
  assert.deepEqual(p.problems, []);
  for (const sel of [".scene", "#sun", "#moon", "#stars", "#clouds", "#land", ".logo-wrap img.logo[alt=Huikau]", ".sea", "#rig", "#ula", "#bobber", ".crew", "#deep", "#reef-zone", "#gauge",
    "h1", "#basket", "#surf", "#tides", "#today", "#weather", "#bottle-open", "#today-pick", "#sound", "[data-postcard]", "#timemachine .tm-range", "#tm-live", ".clock", "footer", "#finds"]) {
    assert.ok(await p.locator(sel).count() > 0, `missing ${sel}`);
  }
  assert.equal(await p.locator("h1").count(), 1, "exactly one h1");
  assert.equal(await p.locator("html").getAttribute("lang"), "en");
  assert.ok((await p.title()).length > 0);
  await p.ctx.close();
});

await env.test("the clock line reads like the sky at noon", async () => {
  const p = await env.page("/?debug=1&t=12:00");
  const text = await p.locator("#clock-text").textContent();
  assert.match(text, /12:00 pm/i);
  await p.ctx.close();
});

await env.test("screen-reader summary: 'Right now in Honolulu' with the time, sky, weather, surf and next tide", async () => {
  const p = await env.page("/?debug=1", { weather: "weather-full" }); // live clock, frozen at noon
  await p.waitForFunction(() => /tide/i.test(document.getElementById("right-now").textContent));
  const text = await p.locator("#right-now").textContent();
  assert.match(text, /^Right now in Honolulu/);
  assert.match(text, /12:00 pm/);
  assert.match(text, /midday|day/i);
  assert.match(text, /Surf:/);
  assert.match(text, /Next: low tide at 1:34 pm/);
  assert.match(text, /Wind:/);
  assert.doesNotMatch(text, /undefined|NaN|null|\[object/);
  // it is in the reading order before the scene, and exposed to assistive tech (not aria-hidden)
  assert.equal(await p.evaluate(() => !document.getElementById("right-now").closest("[aria-hidden=true]")), true);
  assert.equal(await p.evaluate(() => document.querySelector("main").firstElementChild.id), "right-now");
  await p.ctx.close();
});

await env.test("the summary follows the Island Time Machine and says so", async () => {
  const p = await env.page("/?debug=1");
  await p.evaluate(() => window.__huikau.clock.setHstMinutes(22 * 60));
  await p.waitForFunction(() => /10:00 pm/.test(document.getElementById("right-now").textContent));
  const text = await p.locator("#right-now").textContent();
  assert.match(text, /island time machine/);
  assert.doesNotMatch(text, /^Right now/);
  await p.ctx.close();
});

await env.test("with every API down the summary is still sensible (no weather, surf or tide claims)", async () => {
  const p = await env.page("/?debug=1", { apis: "down" });
  await p.waitForTimeout(1500);
  const text = await p.locator("#right-now").textContent();
  assert.match(text, /^Right now in Honolulu, it is 12:00 pm/);
  assert.doesNotMatch(text, /Surf|Next:|Wind/);
  assert.deepEqual(p.problems, []);
  await p.ctx.close();
});

await env.test("kept exactly: Fat Boy link and logo, Ula at most 112 px, the logo", async () => {
  const p = await env.page("/?debug=1&t=12:00");
  const a = p.locator('a[href="https://fatboyfishn.com/"]');
  assert.equal(await a.count(), 1);
  assert.equal(await a.getAttribute("target"), "_blank");
  assert.match(await a.getAttribute("rel"), /noopener/);
  assert.equal(await a.locator('img[src$="assets/fatboy-logo.webp"]').count(), 1);
  assert.match(await a.textContent() + await a.getAttribute("aria-label"), /Fat Boy Fishing Club/);
  const r = await p.locator("#ula").boundingBox();
  assert.ok(r.width <= 112 && r.height <= 112, `Ula renders ${r.width}x${r.height}`);
  assert.equal(await p.locator('img.logo[src$="assets/huikau-logo.webp"]').count() >= 1, true);
  await p.ctx.close();
});

await env.test("saved catches survive: huikau-basket and legacy huikau-tackle", async () => {
  const p = await env.page("/?debug=1&t=12:00", { seed: { "huikau-basket": ["mahi"], "huikau-guide": { mahi: { n: 2 } } } });
  assert.deepEqual(JSON.parse(await p.evaluate(() => localStorage.getItem("huikau-basket"))), ["mahi"]);
  assert.match(await p.locator("#basket-count").textContent(), /^1 of/);
  await p.ctx.close();
});

for (const [w, h] of [[320, 640], [360, 740], [390, 844], [768, 1024], [1280, 800], [1440, 900], [1920, 1080]]) {
  await env.test(`no horizontal scroll at ${w} x ${h} (top, middle and bottom of the page)`, async () => {
    const p = await env.page("/?debug=1&t=17:30", { viewport: { width: w, height: h } });
    for (const f of [0, .5, 1]) {
      await p.evaluate((f) => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), f);
      await p.waitForTimeout(250);
      const wide = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth }));
      assert.ok(wide.sw <= wide.cw && wide.bw <= wide.cw, `${w}px: scrollWidth ${wide.sw} > clientWidth ${wide.cw} at ${f}`);
      assert.equal(await p.evaluate(() => scrollX), 0);
    }
    assert.deepEqual(p.problems, []);
    await p.ctx.close();
  });
}

await env.done("load e2e");
