// Frame-time e2e (WP11): window.__huikau.perf samples requestAnimationFrame deltas while the page is scrolled top to bottom
// at 1440 x 900 with the downpour on. Headless Chromium is capped near 16.7 ms a frame, so a p95 over 20 ms is real jank.
import assert from "node:assert/strict";
import { setup } from "./helpers.mjs";

const env = await setup();

async function run(url, label, { seed } = {}) {
  const p = await env.page(url, { seed });
  await p.waitForTimeout(1500);
  assert.ok(await p.evaluate(() => typeof window.__huikau.perf?.start === "function"), "window.__huikau.perf exists under ?debug=1");
  await p.evaluate(() => window.__huikau.perf.start());
  // a smooth 7 s scroll down the whole page, then 2 s of standing still at the bottom, then back up in 3 s
  await p.evaluate(() => new Promise((done) => {
    const max = document.documentElement.scrollHeight - innerHeight, t0 = performance.now();
    const leg = (from, to, ms, next) => { const s = performance.now(); (function step(now) { const k = Math.min(1, (now - s) / ms); scrollTo(0, from + (to - from) * k); if (k < 1) requestAnimationFrame(step); else next(); })(s); };
    leg(0, max, 7000, () => setTimeout(() => leg(max, 0, 3000, done), 2000));
  }));
  const r = await p.evaluate(() => window.__huikau.perf.stop());
  console.log(`     ${label}: ${r.frames} frames, p50 ${r.p50} ms, p95 ${r.p95} ms, max ${r.max} ms, long tasks ${r.longTasks.length}${r.longTasks.length ? " (" + r.longTasks.map((t) => t.duration + "ms").join(", ") + ")" : ""}`);
  assert.deepEqual(p.problems, []);
  await p.ctx.close();
  return r;
}

await env.test("sampler API: start/stop returns frames, p50, p95, max", async () => {
  const p = await env.page("/?debug=1&t=12:00");
  const r = await p.evaluate(async () => { const s = window.__huikau.perf; s.start(); await new Promise((ok) => setTimeout(ok, 500)); return s.stop(); });
  assert.ok(r.frames > 10, `${r.frames} frames`);
  assert.ok(r.p50 > 0 && r.p95 >= r.p50 && r.max >= r.p95);
  assert.ok(Array.isArray(r.longTasks));
  await p.ctx.close();
});

await env.test("p95 frame time <= 20 ms scrolling top to bottom in a downpour at 1440 x 900", async () => {
  const r = await run("/?debug=1&weather=downpour&t=17:30", "downpour 17:30");
  assert.ok(r.frames > 300, `${r.frames} frames sampled`);
  assert.ok(r.p95 <= 20, `p95 ${r.p95} ms`);
  assert.ok(r.longTasks.filter((t) => t.duration > 200).length === 0, `long tasks over 200 ms: ${JSON.stringify(r.longTasks)}`);
});

await env.test("p95 frame time <= 20 ms at night with a full reef (stars, bioluminescence, 4 schools)", async () => {
  const seed = { "huikau-basket": ["mahi", "uhu", "kala", "hee", "shark", "weke"], "huikau-guide": { mahi: { n: 1 }, uhu: { n: 1 }, kala: { n: 1 }, hee: { n: 1 }, shark: { n: 1 }, weke: { n: 1 } } };
  const r = await run("/?debug=1&t=22:00&weather=rain", "night rain, full reef", { seed });
  assert.ok(r.p95 <= 20, `p95 ${r.p95} ms`);
});

await env.done("perf e2e");
