// Instruments e2e (WP11): tides, surf, weather and Today each in four states -- loading, live (fixtures), cached ("From
// earlier") and none (API down) -- plus Ula's pick and the word of the day.
import assert from "node:assert/strict";
import { setup } from "./helpers.mjs";
import { API_HOSTS } from "../../tools/shots.mjs";

const env = await setup();
const state = (p, id) => p.locator(`#${id}`).getAttribute("data-state");

await env.test("fixtures: tides, surf, weather and today are live and complete", async () => {
  const p = await env.page("/?debug=1", { weather: "weather-full" });
  await p.waitForFunction(() => ["tides", "surf", "weather"].every((id) => document.getElementById(id).dataset.state === "live"));
  assert.equal(await p.locator("#tides svg").count() > 0, true, "tide curve drawn");
  assert.equal(await p.locator("#tides-table tbody tr").count(), 4, "today's four tides, not tomorrow's");
  assert.doesNotMatch(await p.locator("#tides-table").textContent(), /6:15 pm|6:40 am/);
  assert.match(await p.locator("#tides-next").textContent(), /^Next: low tide at 1:34 pm, 0\.4 ft, in 1 hr 34 min\.$/);
  assert.equal(await p.locator("#tides .nowdot").count() > 0, true, "a 'now' marker on the curve");
  assert.match(await p.locator("#surf-call").textContent(), /\w/);
  assert.equal(await p.locator("#surf svg").count() > 0, true, "swell compass drawn");
  assert.match(await p.locator("#surf-stats").textContent(), /Waves/);
  assert.match(await p.locator("#weather-body").textContent(), /Wind|Air|Sky/);
  assert.equal(await p.locator("#weather-body .wx__none-text").count(), 0, "full fixture has every reading");
  assert.equal(await p.locator("#today svg").count() > 0, true, "sun and moon dial drawn");
  assert.match(await p.locator("#today-stats").textContent(), /Sunrise.*Sunset/);
  for (const id of ["tides", "surf", "weather"]) assert.equal(await p.locator(`#${id}-stale`).isHidden(), true, `${id} is not marked stale`);
  assert.deepEqual(p.problems, []);
  await p.ctx.close();
});

await env.test("Ula's pick uses today's tides: the 5:21 pm high, never tomorrow's 6:15 pm", async () => {
  const p = await env.page("/?debug=1&t=12:00");
  await p.waitForFunction(() => /tide/.test(document.getElementById("today-pick").textContent));
  const t = await p.locator("#today-pick").textContent();
  assert.match(t, /5:21 pm high tide/);
  assert.doesNotMatch(t, /6:15|6:18/);
  await p.ctx.close();
});

await env.test("loading state first: placeholders, not empty boxes", async () => {
  const p = await env.page("/?debug=1&t=12:00", { wait: false, init: () => { const f = window.fetch; window.fetch = (u, o) => (/noaa|open-meteo|weather\.gov/.test(String(u)) ? new Promise(() => {}) : f(u, o)); } });
  await p.waitForSelector("#tides-body");
  await p.waitForTimeout(600);
  for (const id of ["tides", "surf", "weather"]) assert.equal(await state(p, id), "loading");
  assert.match(await p.locator("#tides-body").textContent(), /Checking the tide chart/);
  assert.match(await p.locator("#today-pick").textContent(), /checking the tide chart/i);
  assert.equal(await p.locator("#today svg").count() > 0, true, "Today needs no network");
  await p.ctx.close();
});

await env.test("every API down: designed no-data states, nothing broken, the page is still complete", async () => {
  const p = await env.page("/?debug=1&t=12:00", { apis: "down" });
  await p.waitForFunction(() => ["tides", "surf", "weather"].every((id) => document.getElementById(id).dataset.state === "none"), null, { timeout: 15000 });
  assert.match(await p.locator("#tides-body").textContent(), /out of reach/);
  assert.match(await p.locator("#surf-body").textContent(), /No surf report right now/);
  assert.match(await p.locator("#weather-body").textContent(), /No weather reading right now/);
  assert.equal(await p.locator("#tides svg").count() > 0, true, "an empty chart frame, not a hole");
  assert.equal(await p.locator("#today svg").count() > 0, true);
  assert.doesNotMatch(await p.locator("main").innerText(), /undefined|NaN|\[object|null/);
  assert.match(await p.locator("#today-pick").textContent(), /Ula/);
  assert.equal(await p.locator(".scene").isVisible(), true);
  assert.deepEqual(p.problems, []);
  await p.ctx.close();
});

await env.test("cached: the APIs go down after a visit and every panel says 'From earlier'", async () => {
  const p = await env.page("/?debug=1&t=12:00", { weather: "weather-full" });
  await p.waitForFunction(() => document.getElementById("tides").dataset.state === "live" && document.getElementById("surf").dataset.state === "live" && document.getElementById("weather").dataset.state === "live");
  await p.route((url) => API_HOSTS.includes(url.hostname), (r) => r.abort("failed"));
  await p.reload();
  await p.waitForFunction(() => ["tides", "surf", "weather"].every((id) => document.getElementById(id).dataset.state === "cached"), null, { timeout: 15000 });
  for (const id of ["tides", "surf", "weather"]) {
    assert.equal(await p.locator(`#${id}-stale`).isVisible(), true, `${id} stale tag`);
    assert.match(await p.locator(`#${id}-stale`).textContent(), /^From earlier/);
  }
  assert.equal(await p.locator("#tides svg").count() > 0, true);
  assert.equal(await p.locator("#surf svg").count() > 0, true);
  assert.deepEqual(p.problems.filter((x) => !/Failed to load resource/.test(x)), []);
  await p.ctx.close();
});

await env.test("weather with null wind and temperature falls back to the hourly forecast and says so", async () => {
  const p = await env.page("/?debug=1&t=12:00"); // weather.json fixture has null wind and temperature
  await p.waitForFunction(() => document.getElementById("weather").dataset.state === "live");
  await p.waitForFunction(() => !document.querySelector("#weather-body .wx__none-text"), null, { timeout: 8000 });
  assert.equal(await p.locator("#weather-forecast-source").isVisible(), true);
  await p.ctx.close();
});

await env.test("word of the day: opens as a dialog, Previous/Next work from the keyboard, Escape closes and returns focus", async () => {
  const p = await env.page("/?debug=1&t=12:00");
  await p.locator("#bottle-open").focus();
  await p.keyboard.press("Enter");
  await p.waitForSelector("#bottle-card[open]");
  const first = await p.locator("#word-term").textContent();
  await p.keyboard.press("Enter"); // autofocus is Next
  await p.waitForTimeout(200);
  assert.notEqual(await p.locator("#word-term").textContent(), first);
  assert.equal(await p.locator("#word-term").getAttribute("lang"), "haw");
  await p.keyboard.press("Escape");
  await p.waitForFunction(() => !document.getElementById("bottle-card").open);
  assert.equal(await p.evaluate(() => document.activeElement.id), "bottle-open");
  await p.ctx.close();
});

await env.done("instruments e2e");
