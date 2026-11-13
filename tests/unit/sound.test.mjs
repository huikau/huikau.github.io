// Sound v2. Node has no Web Audio, so a real Chromium renders each sound into an OfflineAudioContext
// and we inspect the samples here. Also checks the page-level behaviour: no AudioContext before a
// gesture, one after the toggle, suspended when toggled off or hidden.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { serve, launch, routeApis } from "../../tools/shots.mjs";

const SR = 44100;
let server, browser, base, page;

before(async () => {
  server = await serve(0);
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await launch();
  const ctx = await browser.newContext();
  await ctx.route(`${base}/__blank`, (r) => r.fulfill({ contentType: "text/html", body: "<!doctype html><title>x</title>" }));
  page = await ctx.newPage();
  await page.goto(`${base}/__blank`);
  await page.evaluate(async () => { window.S = await import("/js/ui/sound.js"); });
});
after(async () => { await browser?.close(); server?.close(); });

// Render `body(ctx, dest)` offline and return mono samples as a plain array.
const render = (body, seconds, args = {}) => page.evaluate(async ({ body, seconds, sr, args }) => {
  const ctx = new OfflineAudioContext(1, Math.round(seconds * sr), sr);
  const master = ctx.createGain();
  master.connect(ctx.destination);
  new Function("ctx", "dest", "S", "args", body)(ctx, master, window.S, args);
  const buf = await ctx.startRendering();
  return Array.from(buf.getChannelData(0));
}, { body, seconds, sr: SR, args });

const stats = (x) => {
  let peak = 0, maxJump = 0, sum = 0, at = 0;
  for (let i = 0; i < x.length; i++) {
    peak = Math.max(peak, Math.abs(x[i]));
    sum += x[i] * x[i];
    if (i) { const j = Math.abs(x[i] - x[i - 1]); if (j > maxJump) { maxJump = j; at = i; } }
  }
  return { peak, maxJump, at, rms: Math.sqrt(sum / x.length) };
};
const dominantHz = (x, from, to) => { // autocorrelation pitch estimate on a slice
  const s = x.slice(from, to);
  let best = 0, bestLag = 0;
  for (let lag = Math.floor(SR / 1500); lag < SR / 150; lag++) {
    let c = 0;
    for (let i = 0; i + lag < s.length; i++) c += s[i] * s[i + lag];
    if (c > best) { best = c; bestLag = lag; }
  }
  return SR / bestLag;
};
const pitchClass = (hz) => ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][((Math.round(12 * Math.log2(hz / 261.6256)) % 12) + 12) % 12];

// ---- detector sanity: a hard cut must be caught, otherwise "no clicks" proves nothing ----
test("the discontinuity check catches a hard-cut loop", () => {
  const a = Array.from({ length: SR }, () => 0.3), b = Array.from({ length: SR }, () => -0.3);
  assert.ok(stats(a.concat(b)).maxJump > 0.25);
});

// ---- loops: continuous across several seams ----
// Threshold: a filtered noise bed moves by well under 0.05 per sample; a click at a seam is a
// jump of the order of the signal level (0.1 to 0.5). 0.05 separates the two with margin.
const LOOPS = [
  ["surf", "const s = S.buildSurf(ctx, { seconds: 3 }); s.out.connect(dest); s.start(0);"],
  ["rain", "const s = S.buildRain(ctx, { seconds: 2 }); s.out.connect(dest); s.start(0);"],
  ["rumble", "const s = S.buildRumble(ctx, { seconds: 3 }); s.out.connect(dest); s.start(0);"]
];
for (const [name, body] of LOOPS) {
  test(`${name}: no discontinuity across loop seams, peak <= 0.9, not silent`, async () => {
    const seconds = name === "rain" ? 7 : 10; // 3.5 and 3.3 loops: at least three seams
    const x = await render(body, seconds);
    const st = stats(x);
    console.log(`  ${name}: peak ${st.peak.toFixed(3)} rms ${st.rms.toFixed(3)} maxJump ${st.maxJump.toFixed(4)} at ${(st.at / SR).toFixed(3)}s`);
    assert.ok(st.rms > 0.01, "audible");
    assert.ok(st.peak <= 0.9, `peak ${st.peak}`);
    if (name === "rain") {
      // Rain is hiss plus drops, so sample steps are always big. At the seams the steps must not exceed
      // what the rest of the signal does: compare the biggest step within 5 ms of a seam with 6x the
      // typical (RMS) step.
      const L = Math.round(2 * SR);
      let sq = 0; for (let i = 1; i < x.length; i++) sq += (x[i] - x[i - 1]) ** 2;
      const typical = Math.sqrt(sq / x.length);
      for (let seam = L; seam < x.length - 300; seam += L) {
        let m = 0; for (let i = seam - 220; i < seam + 220; i++) m = Math.max(m, Math.abs(x[i] - x[i - 1]));
        assert.ok(m < 6 * typical, `seam at ${seam / SR}s: ${m} vs typical ${typical}`);
      }
    } else {
      assert.ok(st.maxJump < 0.05, `jump ${st.maxJump} at ${st.at / SR}s`);
    }
  });
}

test("surf and rain loop buffers wrap smoothly (last sample to first)", async () => {
  const r = await page.evaluate((sr) => {
    const ctx = new OfflineAudioContext(1, sr, sr), out = {};
    for (const [k, b] of [["surf", window.S.surfBuffer(ctx, 3)], ["rain", window.S.rainBuffer(ctx, 2)]]) {
      const d = b.getChannelData(0);
      let sq = 0, peak = 0; for (let i = 1; i < d.length; i++) { sq += (d[i] - d[i - 1]) ** 2; peak = Math.max(peak, Math.abs(d[i])); }
      out[k] = { wrap: Math.abs(d[0] - d[d.length - 1]), typical: Math.sqrt(sq / d.length), peak };
    }
    return out;
  }, SR);
  // surf is smooth brown noise (steps tiny); rain is hissy, so compare with its own typical step.
  assert.ok(r.surf.wrap <= r.surf.typical * 6, JSON.stringify(r.surf));
  assert.ok(r.rain.wrap <= r.rain.typical * 6, JSON.stringify(r.rain));
  assert.ok(r.surf.peak <= 1 && r.rain.peak <= 1);
});

// ---- one-shots: clean start and end ----
// One-shot jump limits: pluck excitation is noisy, so steps up to ~0.09 occur at the 0.2 gain used; the broken
// start we fixed (a one-frame unity-gain spike) measured 0.37 to 0.65, so 0.15 separates them.
const ONE = [
  ["thump", "S.thump(ctx, dest, 0.1);", 0.8, 0.1],
  ["tick", "S.tick(ctx, dest, 0.1);", 0.4, 0.05],
  ["chime", "S.chime(ctx, dest, 0.1, false);", 3, 0.15],
  ["golden chime", "S.chime(ctx, dest, 0.1, true);", 3, 0.15],
  ["low note", "S.lowNote(ctx, dest, 0.1);", 2, 0.15]
];
for (const [name, body, secs, jump] of ONE) {
  test(`${name}: smooth envelope, peak <= 0.9, silent at both ends`, async () => {
    const x = await render(body, secs);
    const st = stats(x);
    console.log(`  ${name}: peak ${st.peak.toFixed(3)} maxJump ${st.maxJump.toFixed(4)}`);
    assert.ok(st.peak > 0.01 && st.peak <= 0.9, `peak ${st.peak}`);
    assert.ok(st.maxJump < jump, `jump ${st.maxJump} at ${st.at / SR}s`);
    assert.equal(x[0], 0);
    assert.ok(Math.abs(x[x.length - 1]) < 1e-4, "ends silent");
    // nothing sounds before the scheduled time
    assert.ok(Math.max(...x.slice(0, Math.floor(0.09 * SR)).map(Math.abs)) < 1e-6);
  });
}

test("chime notes are pentatonic (C D E G A) and pluck is in tune", async () => {
  const notes = await page.evaluate(() => ({ plain: window.S.chimeNotes(false), golden: window.S.chimeNotes(true), set: window.S.PENTATONIC }));
  const close = (f) => notes.set.some((p) => Math.abs(p / f - 1) < 1e-6);
  assert.ok(notes.plain.every(close) && notes.golden.every(close));
  assert.deepEqual(notes.golden.map(pitchClass), ["C", "D", "E", "G", "A", "C"]);
  assert.ok(notes.golden.every((f, i, a) => !i || f > a[i - 1]), "rises");
  assert.equal(notes.set.length, 15);
  // what actually comes out of the plucker: solo notes, measured by autocorrelation
  for (const f of notes.golden) {
    const x = await render(`S.pluck(ctx, dest, 0, ${f});`, 1.6);
    const hz = dominantHz(x, Math.round(0.03 * SR), Math.round(0.09 * SR));
    console.log(`  pluck ${f.toFixed(1)} Hz -> measured ${hz.toFixed(1)} Hz (${pitchClass(hz)})`);
    assert.ok(Math.abs(hz / f - 1) < 0.02, `${hz} vs ${f}`);
    assert.ok(["C", "D", "E", "G", "A"].includes(pitchClass(hz)));
  }
});

test("underwater: cutoff glides 18 kHz to 600 Hz by depth 0.3, surf dips, rumble rises", async () => {
  const f = await page.evaluate(() => [0, 0.05, 0.15, 0.3, 0.8].map((d) => window.S.underwaterParams(d)));
  assert.equal(Math.round(f[0].cutoff), 18000);
  assert.equal(Math.round(f[3].cutoff), 600);
  assert.equal(Math.round(f[4].cutoff), 600);
  for (let i = 1; i < f.length; i++) assert.ok(f[i].cutoff <= f[i - 1].cutoff && f[i].rumble >= f[i - 1].rumble);
  assert.ok(f[3].surf < f[0].surf && f[3].surf > 0.5);
  assert.equal(f[0].rumble, 0);
});

test("the low-pass really muffles: noise through 600 Hz loses most of its high band", async () => {
  const hi = (x) => { let e = 0; for (let i = 1; i < x.length; i++) e += (x[i] - x[i - 1]) ** 2; return e / x.length; };
  const mk = (hz) => `const s = S.buildRain(ctx, {seconds: 2}); const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = ${hz}; s.out.connect(f).connect(dest); s.start(0);`;
  const [open, closed] = [hi(await render(mk(18000), 2)), hi(await render(mk(600), 2))];
  assert.ok(closed < open * 0.1, `${closed} vs ${open}`);
});

test("rain level: none, light, downpour", async () => {
  const r = await page.evaluate(() => [
    window.S.rainLevel({ rain: false, calm: 1 }),
    window.S.rainLevel({ rain: true, calm: 0.9, text: "Light rain" }),
    window.S.rainLevel({ rain: true, calm: 0.6, text: "Heavy rain" })
  ]);
  assert.deepEqual(r, [0, 0.5, 1]);
});

// ---- the page ----
async function openSite(query = "?debug=1", { storage } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  await routeApis(ctx);
  await ctx.addInitScript((storage) => {
    if (storage) try { localStorage.setItem("huikau-sound", storage); } catch {}
    window.__ac = { count: 0, list: [] };
    const Real = window.AudioContext;
    window.AudioContext = new Proxy(Real, {
      construct(T, a) { const c = new T(...a); window.__ac.count++; window.__ac.list.push(c); return c; }
    });
  }, storage);
  const p = await ctx.newPage();
  await p.goto(`${base}/${query}`);
  return { p, ctx };
}

test("no AudioContext before a gesture; the toggle creates exactly one, running; off suspends", async () => {
  const { p, ctx } = await openSite();
  await p.waitForTimeout(3000);
  assert.equal(await p.evaluate(() => window.__ac.count), 0);
  assert.equal(await p.getAttribute("#sound", "aria-pressed"), "false");
  await p.click("#sound");
  await p.waitForFunction(() => window.__ac.list[0]?.state === "running", null, { timeout: 5000 });
  assert.equal(await p.evaluate(() => window.__ac.count), 1);
  assert.equal(await p.getAttribute("#sound", "aria-pressed"), "true");
  assert.equal(await p.evaluate(() => localStorage.getItem("huikau-sound")), "1");
  await p.click("#sound");
  await p.waitForFunction(() => window.__ac.list[0].state === "suspended", null, { timeout: 5000 });
  assert.equal(await p.getAttribute("#sound", "aria-pressed"), "false");
  assert.equal(await p.evaluate(() => localStorage.getItem("huikau-sound")), "0");
  await p.click("#sound");
  await p.waitForFunction(() => window.__ac.list[0].state === "running", null, { timeout: 5000 });
  assert.equal(await p.evaluate(() => window.__ac.count), 1, "context is reused");
  await ctx.close();
});

test("keyboard: Space toggles the focused button and aria-pressed follows", async () => {
  const { p, ctx } = await openSite();
  await p.focus("#sound");
  await p.keyboard.press("Space");
  await p.waitForFunction(() => document.getElementById("sound").getAttribute("aria-pressed") === "true");
  await p.waitForFunction(() => window.__ac.list[0]?.state === "running");
  await p.keyboard.press("Space");
  await p.waitForFunction(() => document.getElementById("sound").getAttribute("aria-pressed") === "false");
  assert.match(await p.textContent("#sound"), /Ocean sound/);
  await ctx.close();
});

test("a remembered 'on' still makes no AudioContext until the first gesture", async () => {
  const { p, ctx } = await openSite("?debug=1", { storage: "1" });
  await p.waitForTimeout(1500);
  assert.equal(await p.evaluate(() => window.__ac.count), 0);
  assert.equal(await p.getAttribute("#sound", "aria-pressed"), "true");
  await p.mouse.click(600, 400);
  await p.waitForFunction(() => window.__ac.list[0]?.state === "running", null, { timeout: 5000 });
  assert.equal(await p.evaluate(() => window.__ac.count), 1);
  await ctx.close();
});

test("a hidden document suspends the context and visible resumes it", async () => {
  const { p, ctx } = await openSite();
  await p.click("#sound");
  await p.waitForFunction(() => window.__ac.list[0]?.state === "running");
  const set = (hidden) => p.evaluate((hidden) => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
  await set(true);
  await p.waitForFunction(() => window.__ac.list[0].state === "suspended", null, { timeout: 5000 });
  await set(false);
  await p.waitForFunction(() => window.__ac.list[0].state === "running", null, { timeout: 5000 });
  await ctx.close();
});

test("bus events drive the one-shots without throwing; clock ticks are rate limited", async () => {
  const { p, ctx } = await openSite();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.click("#sound");
  await p.waitForFunction(() => window.__ac.list[0]?.state === "running");
  const n = await p.evaluate(async () => {
    const { bus, clock } = window.__huikau;
    const c = window.__ac.list[0];
    let started = 0;
    const orig = c.createOscillator.bind(c);
    c.createOscillator = () => { started++; return orig(); };
    const origBuf = c.createBufferSource.bind(c);
    let buffers = 0;
    c.createBufferSource = () => { buffers++; return origBuf(); };
    bus.emit("game", { state: "bite" });
    const afterBite = started;
    bus.emit("game", { state: "landed", id: "golden" });
    bus.emit("catch", { id: "golden", isNew: true });
    await new Promise((r) => setTimeout(r, 200));
    const chimeNotes = buffers; // golden chime = 6 plucks, and the catch must not double it
    bus.emit("depth", 0.5); bus.emit("weather", window.__huikau.weather);
    started = 0;
    const t0 = performance.now();
    for (let i = 0; i < 60; i++) { clock.setHstMinutes(i * 10); await new Promise((r) => setTimeout(r, 8)); } // a fast scrub
    return { afterBite, chimeNotes, ticks: started, seconds: (performance.now() - t0) / 1000 };
  });
  assert.equal(n.afterBite, 1);
  assert.equal(n.chimeNotes, 6);
  console.log(`  ${n.ticks} ticks in ${n.seconds.toFixed(2)} s of scrubbing`);
  assert.ok(n.ticks >= 1 && n.ticks <= n.seconds * 12 + 1, `ticks ${n.ticks} in ${n.seconds} s`);
  assert.deepEqual(errors, []);
  await ctx.close();
});
