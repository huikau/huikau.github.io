// Sound toggle e2e (WP11): off by default, no AudioContext until a user gesture, aria-pressed follows the toggle, the context
// is suspended again when sound goes off, and the preference is remembered.
import assert from "node:assert/strict";
import { setup } from "./helpers.mjs";

const env = await setup();
// Count AudioContexts and record their state, so the test can see what the page did without a gesture.
const spy = () => {
  const Orig = window.AudioContext;
  window.__ac = { created: 0, ctxs: [] };
  window.AudioContext = class extends Orig { constructor(...a) { super(...a); window.__ac.created++; window.__ac.ctxs.push(this); } };
};
const pressed = (p) => p.locator("#sound").getAttribute("aria-pressed");

await env.test("off by default: no AudioContext at load, not after scroll, mouse move or typing in other controls", async () => {
  const p = await env.page("/?debug=1&t=12:00", { init: spy });
  await p.waitForTimeout(1500);
  assert.equal(await pressed(p), "false");
  assert.equal(await p.evaluate(() => window.__ac.created), 0);
  await p.mouse.move(300, 300); await p.mouse.wheel(0, 600); await p.waitForTimeout(300);
  await p.mouse.click(700, 300);
  assert.equal(await p.evaluate(() => window.__ac.created), 0, "sound is off, so even a click makes no context");
  assert.match(await p.locator("#sound").getAttribute("title"), /off/);
  assert.equal((await p.locator("#sound").getAttribute("aria-label")) ?? (await p.locator("#sound .sr-only").textContent()), "Ocean sound");
  assert.deepEqual(p.problems, []);
  await p.ctx.close();
});

await env.test("keyboard toggle: on makes one running context; off suspends it; on again resumes the same one", async () => {
  const p = await env.page("/?debug=1&t=12:00", { init: spy });
  await p.locator("#sound").focus();
  await p.keyboard.press("Enter");
  assert.equal(await pressed(p), "true");
  assert.equal(await p.evaluate(() => window.__ac.created), 1);
  await p.waitForFunction(() => window.__ac.ctxs[0].state === "running");
  assert.match(await p.locator("#sound").getAttribute("title"), /on/);
  assert.equal(await p.evaluate(() => localStorage.getItem("huikau-sound")), "1");
  await p.keyboard.press("Space");
  assert.equal(await pressed(p), "false");
  await p.waitForFunction(() => window.__ac.ctxs[0].state === "suspended", null, { timeout: 4000 });
  assert.equal(await p.evaluate(() => localStorage.getItem("huikau-sound")), "0");
  await p.keyboard.press("Enter");
  await p.waitForFunction(() => window.__ac.ctxs[0].state === "running");
  assert.equal(await p.evaluate(() => window.__ac.created), 1, "the same context is reused");
  assert.deepEqual(p.problems, []);
  await p.ctx.close();
});

await env.test("remembered 'on' still waits for a gesture before creating the context", async () => {
  const p = await env.page("/?debug=1&t=12:00", { init: spy });
  await p.evaluate(() => localStorage.setItem("huikau-sound", "1"));
  await p.reload();
  await p.waitForFunction(() => window.__huikau?.modules?.fishing);
  assert.equal(await pressed(p), "true");
  assert.equal(await p.evaluate(() => window.__ac.created), 0, "no context before a gesture");
  await p.mouse.click(700, 120);
  await p.waitForFunction(() => window.__ac.created === 1);
  await p.ctx.close();
});

await env.test("a hidden tab suspends sound", async () => {
  const p = await env.page("/?debug=1&t=12:00", { init: spy });
  await p.locator("#sound").click();
  await p.waitForFunction(() => window.__ac.ctxs[0].state === "running");
  await p.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  await p.waitForFunction(() => window.__ac.ctxs[0].state === "suspended", null, { timeout: 4000 });
  await p.ctx.close();
});

await env.done("sound e2e");
