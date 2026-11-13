// Contrast sweep e2e (WP11): for 48 half-hours of 2026-11-12 at 1440 x 900, 390 x 844 and 320 x 640, measure the text that sits straight on
// the sky or water (clock line, Island Time Machine, Ula's tag, the cast cue, the postcard button, the footer) against the
// pixels actually rendered behind it. The text is made transparent for a screenshot, every pixel in the text's line boxes is
// compared with the text colour, and the 5th-percentile (95th-percentile-worst) ratio must be at least 4.5:1, or 3:1 for large text.
//   CONTRAST_REPORT=1 node tests/e2e/contrast.spec.mjs    prints the worst case of every target
import assert from "node:assert/strict";
import { setup } from "./helpers.mjs";

const env = await setup();
const REPORT = !!process.env.CONTRAST_REPORT;
const TARGETS = [
  ["clock line", "#clock-text"], ["aloha friday", "#friday"],
  ["time machine label", ".tm-label"], ["time machine readout", "#tm-readout"], ["time machine ticks", ".tm-ticks li"], ["Live button", "#tm-live"],
  ["Captain Ula tag", ".ula-tag"], ["cast cue", "#hint"], ["postcard button", ".postcard-btn--hero span, .postcard-btn--foot span"],
  ["wish", "#wish"], ["Fat Boy sign", ".crew-sign, .crew .sign"],
  ["footer", "footer"], ["things to find", ".finds summary"]
];

const HIDE = `[data-e2e-c]{color:transparent!important;text-shadow:none!important;-webkit-text-stroke:0!important;caret-color:transparent!important}
*,*::before,*::after{transition:none!important;animation:none!important}
/* transient decoration that is not part of the page's fixed layout: the "Secret found" toast, flying and shooting things */
.found-toast,#shooting,#iwa,#fireworks,.whale{display:none!important}`;

// In the page: list the visible text of every target (line boxes, colour, size) at the current scroll position.
function collect(targets) {
  const out = [];
  for (const [name, sel] of targets) {
    for (const el of document.querySelectorAll(sel)) {
      if (!el.checkVisibility({ visibilityProperty: true })) continue;
      // one entry per text node, scored with the colour of the element that owns it (a count in a different colour is its own case)
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent.trim()) continue;
        const owner = n.parentElement, cs = getComputedStyle(owner);
        if (!owner.checkVisibility({ visibilityProperty: true })) continue;
        const rects = [];
        const r = document.createRange(); r.selectNodeContents(n);
        for (const b of r.getClientRects()) if (b.width > 1 && b.height > 1 && b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth) rects.push({ x: Math.max(0, b.x), y: Math.max(0, b.y), w: Math.min(innerWidth, b.right) - Math.max(0, b.x), h: Math.min(innerHeight, b.bottom) - Math.max(0, b.y) });
        if (!rects.length) continue;
        let opacity = 1;
        for (let a = owner; a && a !== document.documentElement; a = a.parentElement) opacity *= parseFloat(getComputedStyle(a).opacity);
        const m = cs.color.match(/[\d.]+/g).map(Number);
        const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10) || 400;
        owner.setAttribute("data-e2e-c", "1");
        out.push({ name, rects, color: [m[0], m[1], m[2]], alpha: (m[3] ?? 1) * opacity, large: size >= 24 || (weight >= 700 && size >= 18.66), size, text: n.textContent.trim().slice(0, 30) });
      }
    }
  }
  return out;
}

// In a blank page: decode the screenshot and score every target.
function score({ png, items }) {
  return new Promise((done) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
      const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0);
      const lin = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
      const L = (r, g, b) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
      done(items.map((it) => {
        const ratios = [];
        for (const r of it.rects) {
          const d = x.getImageData(Math.floor(r.x), Math.floor(r.y), Math.max(1, Math.ceil(r.w)), Math.max(1, Math.ceil(r.h))).data;
          for (let i = 0; i < d.length; i += 4) {
            const a = it.alpha;
            const tr = it.color[0] * a + d[i] * (1 - a), tg = it.color[1] * a + d[i + 1] * (1 - a), tb = it.color[2] * a + d[i + 2] * (1 - a);
            const l1 = L(tr, tg, tb), l2 = L(d[i], d[i + 1], d[i + 2]);
            ratios.push((Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05));
          }
        }
        ratios.sort((p, q) => p - q);
        return { name: it.name, text: it.text, min: ratios[0], p5: ratios[Math.floor(ratios.length * .05)], need: it.large ? 3 : 4.5, size: it.size, n: ratios.length };
      }));
    };
    img.src = "data:image/png;base64," + png;
  });
}

// A seeded Math.random, so the clouds and stars are in the same place every run.
const seed = () => { let s = 0x5eed1234; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

const analyser = await env.browser.newPage();
await analyser.goto("about:blank");

const sweep = async ({ label, url, viewport, targets, bottoms = [false, true], wait }) => {
  const p = await env.page(url, { viewport, init: seed, wait });
  await p.waitForFunction(() => window.__huikau?.clock);
  await p.addStyleTag({ content: HIDE.replace(/\[data-e2e-c\][^}]*}/, "") });
  await p.waitForTimeout(500);
  const failures = [], worst = new Map();
  for (let m = 0; m < 1440; m += 30) {
    await p.evaluate((m) => window.__huikau.clock.setHstMinutes(m), m);
    await p.waitForTimeout(120);
    for (const bottom of bottoms) {
      await p.evaluate((bottom) => scrollTo(0, bottom ? document.documentElement.scrollHeight : 0), bottom);
      await p.waitForTimeout(bottom ? 250 : 120);
      const items = await p.evaluate(collect, targets);
      const hold = await p.addStyleTag({ content: "[data-e2e-c]{color:transparent!important;text-shadow:none!important;-webkit-text-stroke:0!important}" });
      const png = (await p.screenshot({ animations: "disabled" })).toString("base64");
      await hold.evaluate((s) => s.remove());
      await p.evaluate(() => document.querySelectorAll("[data-e2e-c]").forEach((e) => e.removeAttribute("data-e2e-c")));
      for (const r of await analyser.evaluate(score, { png, items })) {
        const hh = `${String(Math.floor(m / 60)).padStart(2, "0")}:${m % 60 ? "30" : "00"}`;
        if (!worst.has(r.name) || r.p5 / r.need < worst.get(r.name).p5 / worst.get(r.name).need) worst.set(r.name, { ...r, at: hh });
        if (r.p5 < r.need) failures.push(`${hh} ${r.name} "${r.text}" ${r.p5.toFixed(2)}:1 (min ${r.min.toFixed(2)}, needs ${r.need})`);
      }
    }
  }
  if (REPORT) { console.log(`  worst cases, ${label}:`); for (const [k, w] of worst) console.log(`    ${k.padEnd(22)} ${w.p5.toFixed(2)}:1 (needs ${w.need}) at ${w.at}, ${w.size}px "${w.text}"`); }
  const show = Number(process.env.CONTRAST_SHOW || 40);
  assert.deepEqual(failures.slice(0, 1), [], `${failures.length} failures:\n${failures.slice(0, show).join("\n")}`);
  assert.ok(worst.size >= targets.length - 4, `only ${worst.size} targets were found on the page`);
  assert.deepEqual(p.problems, []);
  await p.ctx.close();
};

for (const [label, viewport] of [["desktop 1440 x 900", { width: 1440, height: 900 }], ["phone 390 x 844", { width: 390, height: 844 }], ["narrow phone 320 x 640", { width: 320, height: 640 }]]) {
  await env.test(`contrast >= 4.5:1 (3:1 large) over 48 half-hours, ${label}`, () => sweep({ label, url: "/?debug=1&t=12:00", viewport, targets: TARGETS }));
}

// the 404 ("Lost at sea"): the words must hold their contrast whatever the sun and moon are doing behind them
const LOST = [["404 title", ".lost h1"], ["404 words", ".lost p"], ["404 button", ".lost .btn"], ["404 Ula tag", ".ula-tag"]];
for (const [label, viewport] of [["320 x 640", { width: 320, height: 640 }], ["390 x 844", { width: 390, height: 844 }], ["768 x 1024", { width: 768, height: 1024 }], ["1440 x 900", { width: 1440, height: 900 }]]) {
  await env.test(`404 contrast over 48 half-hours, ${label}`, () => sweep({ label: `404 ${label}`, url: "/nope?debug=1&t=12:00", viewport, targets: LOST, bottoms: [false], wait: false }));
}

await env.done("contrast sweep");
