// Accessibility e2e (WP11): reduced motion (a still but complete page, no animation loops) and keyboard-only (Tab reaches
// everything that matters, every focused element shows a focus indicator, nothing focusable is off screen).
import assert from "node:assert/strict";
import { setup } from "./helpers.mjs";

const env = await setup();
const BASKET = { "huikau-basket": ["mahi", "uhu"], "huikau-guide": { mahi: { n: 1 }, uhu: { n: 1 } } };

// ---------- reduced motion ----------
const countRaf = () => {
  window.__raf = 0;
  const orig = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => orig((t) => { window.__raf++; cb(t); });
};

for (const [name, url] of [["clear noon", "/?debug=1&t=12:00"], ["downpour at night", "/?debug=1&t=22:00&weather=downpour"], ["winter, Aloha Friday", "/?debug=1&t=18:10&season=winter&friday=1"]]) {
  await env.test(`reduced motion (${name}): no rAF loops after load, no endless animations, page complete`, async () => {
    const p = await env.page(url, { reduced: true, init: countRaf, seed: BASKET });
    await p.waitForTimeout(1500); // everything has booted
    await p.evaluate(() => { window.__raf = 0; });
    await p.waitForTimeout(2000);
    const raf = await p.evaluate(() => window.__raf);
    assert.ok(raf <= 2, `${raf} rAF callbacks in 2 s with reduced motion`);
    const endless = await p.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && a.effect?.getComputedTiming().iterations === Infinity && !(a.timeline instanceof ScrollTimeline)).map((a) => (a.effect.target?.id || a.effect.target?.className?.baseVal || a.effect.target?.className || a.effect.target?.tagName) + ":" + (a.animationName || a.transitionProperty || "")));
    assert.deepEqual(endless, [], `endless CSS animations: ${endless.join(", ")}`);
    // still complete
    for (const sel of [".scene", "#sun", "#land", "#bobber", ".crew", "#deep", "#basket", "#surf", "#tides", "#today", "#weather", "footer", "#timemachine"]) assert.ok(await p.locator(sel).count() > 0, sel);
    assert.equal(await p.locator("#reef-fish .fish").count() > 0, true, "reef is drawn, just still");
    assert.match(await p.locator("#right-now").textContent(), /^Right now|^In Honolulu/);
    // controls still work
    await p.locator("#tm-range").focus(); await p.keyboard.press("ArrowRight");
    assert.deepEqual(p.problems, []);
    await p.ctx.close();
  });
}

await env.test("animations do run without the preference (the check above is meaningful)", async () => {
  const p = await env.page("/?debug=1&t=12:00", { init: countRaf });
  await p.evaluate(() => { window.__raf = 0; });
  await p.waitForTimeout(1500);
  assert.ok(await p.evaluate(() => window.__raf) > 20);
  await p.ctx.close();
});

await env.test("a hidden tab does no animation work", async () => {
  const p = await env.page("/?debug=1&t=12:00", { init: countRaf });
  await p.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  await p.waitForTimeout(500);
  await p.evaluate(() => { window.__raf = 0; });
  await p.waitForTimeout(1500);
  const raf = await p.evaluate(() => window.__raf);
  assert.ok(raf <= 6, `${raf} rAF callbacks while hidden (the sky's own cheap tick is allowed)`);
  await p.ctx.close();
});

// ---------- keyboard only ----------
// In-page helpers: a signature of everything a focus style could change, and "is it really on screen".
const install = () => {
  window.__sig = (e) => {
    const part = (cs) => `${cs.outlineStyle}|${cs.outlineWidth}|${cs.outlineColor}|${cs.boxShadow}|${cs.borderColor}|${cs.backgroundColor}|${cs.filter}|${cs.textDecorationLine}`;
    return [part(getComputedStyle(e)), ...["::before", "::after", "::-webkit-slider-thumb"].map((ps) => part(getComputedStyle(e, ps)))].join("§");
  };
  window.__describe = (e) => ({
    id: e.id, tag: e.tagName, text: (e.getAttribute("aria-label") || e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
    href: e.getAttribute("href"), i: e.dataset.e2eI, cls: String(e.className?.baseVal ?? e.className)
  });
};
const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

async function tabAll(p, max = 90) {
  await p.evaluate(({ sel }) => {
    window.__base = new Map();
    document.querySelectorAll(sel).forEach((e, i) => { e.dataset.e2eI = i; window.__base.set(String(i), window.__sig(e)); });
  }, { sel: FOCUSABLE });
  await p.evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0); });
  await p.mouse.click(2, 2); // puts the sequential-focus starting point back at the top of the page
  const seen = [];
  for (let i = 0; i < max; i++) {
    await p.keyboard.press("Tab");
    const r = await p.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body || e === document.documentElement) return { end: true };
      const rect = e.getBoundingClientRect();
      const vis = e.checkVisibility ? e.checkVisibility({ visibilityProperty: true, opacityProperty: false }) : true;
      const onscreen = rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < innerWidth && rect.bottom > 0 && rect.top < innerHeight;
      const changed = window.__sig(e) !== window.__base.get(e.dataset.e2eI);
      return { ...window.__describe(e), vis, onscreen, changed, w: Math.round(rect.width), h: Math.round(rect.height) };
    });
    if (r.end) break;
    if (!r.changed) {
      // the style probe cannot see vendor pseudo-elements (a range thumb), so compare what is actually painted
      const box = await p.evaluate(() => { const b = document.activeElement.getBoundingClientRect(); return { x: Math.max(0, b.x - 12), y: Math.max(0, b.y - 12), width: b.width + 24, height: b.height + 24 }; });
      const withFocus = await p.screenshot({ clip: box, animations: "disabled" });
      await p.evaluate(() => { window.__last = document.activeElement; window.__last.blur(); });
      const without = await p.screenshot({ clip: box, animations: "disabled" });
      await p.evaluate(() => window.__last.focus());
      r.changed = !withFocus.equals(without);
    }
    seen.push(r);
  }
  return seen;
}

for (const [label, viewport, postcardId] of [["desktop 1440", { width: 1440, height: 900 }, "hero"], ["phone 390", { width: 390, height: 844 }, "foot"]]) {
  await env.test(`keyboard only (${label}): Tab reaches every control in a sensible order, each with a visible focus indicator, none off screen`, async () => {
    const p = await env.page("/?debug=1&t=12:00", { viewport, seed: BASKET, init: install });
    // scrub once so "Live" is enabled and tabbable
    await p.locator("#tm-range").focus(); await p.keyboard.press("PageDown"); await p.waitForTimeout(200);
    await p.evaluate(() => { document.activeElement.blur(); });
    const seen = await tabAll(p);
    const names = seen.map((s) => s.id || s.text || s.cls);
    const idx = (pred) => seen.findIndex(pred);
    const must = {
      sound: idx((s) => s.id === "sound"),
      postcard: idx((s) => /postcard-btn--(hero|foot)/.test(s.cls) && s.cls.includes(`--${postcardId}`)),
      timeMachine: idx((s) => s.id === "tm-range"),
      live: idx((s) => s.id === "tm-live"),
      fatBoy: idx((s) => s.href === "https://fatboyfishn.com/"),
      bobber: idx((s) => s.id === "bobber"),
      bottle: idx((s) => s.id === "bottle-open"),
      guideSlot: idx((s) => /guide-slot/.test(s.cls)),
      finds: idx((s) => s.tag === "SUMMARY" && /Things to find/.test(s.text))
    };
    for (const [k, v] of Object.entries(must)) assert.ok(v >= 0, `Tab never reached ${k}. Order: ${names.join(" > ")}`);
    // a sensible order: top-of-page controls, then the scene, then the cards, then the footer
    assert.ok(must.timeMachine < must.live && must.live < must.bobber, `order ${names.join(" > ")}`);
    assert.ok(must.bobber < must.bottle && must.bottle < must.finds, `order ${names.join(" > ")}`);
    assert.ok(must.guideSlot < must.finds);
    assert.ok(label.startsWith("phone") ? must.postcard > must.bottle : must.postcard < must.timeMachine, `postcard position in ${names.join(" > ")}`);
    for (const s of seen) {
      assert.ok(s.vis, `${s.id || s.text} is focusable but not rendered`);
      assert.ok(s.onscreen, `${s.id || s.text} took focus but is off screen`);
      assert.ok(s.changed, `${s.id || s.text} (${s.tag}.${s.cls}) shows no focus indicator`);
    }
    assert.equal(new Set(seen.map((s) => s.i)).size, seen.length, "focus visits each control once (no loops, no traps)");
    assert.deepEqual(p.problems, []);
    await p.ctx.close();
  });
}

await env.test("nothing focusable is positioned off screen (all widths)", async () => {
  for (const width of [320, 390, 768, 1440]) {
    const p = await env.page("/?debug=1&t=12:00", { viewport: { width, height: 800 }, seed: BASKET });
    const bad = await p.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => !e.disabled && e.checkVisibility({ visibilityProperty: true })).map((e) => ({ e, r: e.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.right < 0 || r.left > document.documentElement.clientWidth || r.left < -1 && r.right < 4)).map(({ e }) => e.id || e.className || e.tagName), FOCUSABLE);
    assert.deepEqual(bad, [], `${width}px`);
    await p.ctx.close();
  }
});

await env.test("dialogs trap and return focus: field guide card and postcard close with Escape back to their opener", async () => {
  const p = await env.page("/?debug=1&t=12:00", { seed: BASKET });
  const slot = p.locator("button.guide-slot").first();
  await slot.focus(); await p.keyboard.press("Enter");
  await p.waitForSelector("#guide-dialog[open]");
  await p.keyboard.press("Escape");
  await p.waitForFunction(() => !document.getElementById("guide-dialog").open);
  await p.waitForFunction(() => document.activeElement.classList.contains("guide-slot"), null, { timeout: 3000 });
  // the browser returns focus on close() at once and the dialog's own "close" handler does it again a task later: let that land first
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50))));
  await p.locator("[data-postcard]").first().focus(); await p.keyboard.press("Enter");
  await p.waitForSelector(".postcard-dialog[open]", { timeout: 8000 });
  await p.waitForSelector(".postcard-img:not([hidden])", { timeout: 15000 });
  await p.keyboard.press("Escape");
  await p.waitForFunction(() => !document.querySelector(".postcard-dialog").open);
  await p.waitForFunction(() => document.activeElement.hasAttribute("data-postcard"), null, { timeout: 3000 });
  assert.deepEqual(p.problems, []);
  await p.ctx.close();
});

await env.done("accessibility e2e");
