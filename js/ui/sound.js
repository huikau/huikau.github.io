// Sound v2: everything is synthesised with Web Audio (no files, no network).
//
//   surf      brown-noise swells in a seamless loop (always on while sound is on)
//   rain      patter bed + drops, level follows the weather, fades over ~2 s
//   rumble    a faint low bed that rises as you dive
//   underwater a low-pass on everything but the rumble, driven by `depth`
//   one-shots bite thump, catch chime (pentatonic ukulele-ish pluck), UI tick
//
// Off by default. The preference is remembered, but no AudioContext exists until the first
// user gesture, and the context is suspended whenever sound is off or the page is hidden.
// The DSP builders are pure functions of a context (real or Offline) so tests can render them.
import { $ } from "../core/dom.js";
import { bus as siteBus } from "../core/bus.js";
import { clock as siteClock } from "../core/clock.js";
import { weather } from "../data/weather.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const KEY = "huikau-sound";

/* ---------------- pure helpers ---------------- */

// C D E G A, in hertz, octaves 4 to 6.
export const PENTATONIC = [];
for (const oct of [4, 5, 6]) for (const semi of [0, 2, 4, 7, 9]) PENTATONIC.push(440 * 2 ** ((semi - 9) / 12 + (oct - 4)));

/** Where the mix sits for a given depth (0 at the surface, 1 at the bottom). */
export function underwaterParams(depth) {
  const u = clamp((Number(depth) || 0) / 0.3, 0, 1);
  const s = u * u * (3 - 2 * u); // smoothstep, so the muffling eases in
  return { cutoff: 18000 * (600 / 18000) ** s, surf: 1 - 0.3 * s, rumble: 0.9 * s };
}

/** How loud the rain is, 0 to 1: none, light rain, downpour. */
export function rainLevel(w) {
  if (!w || !w.rain) return 0;
  return (w.calm != null && w.calm < 0.75) || /heavy|downpour|thunder/i.test(w.text || "") ? 1 : 0.5;
}

/** Make a buffer loop without a seam: the last `fade` samples are an equal-power blend into the first ones. */
function seamless(raw, len, fade) {
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = raw[i];
  // raw has len + fade samples; out[len-1] is followed in `raw` by raw[len], which we place at out[0].
  for (let i = 0; i < fade; i++) {
    const a = (i / fade) * Math.PI / 2;
    out[i] = raw[len + i] * Math.cos(a) + raw[i] * Math.sin(a);
  }
  return out;
}

function normalise(arrs, peak = 1) {
  let m = 0;
  for (const a of arrs) for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]));
  if (m > 0) for (const a of arrs) for (let i = 0; i < a.length; i++) a[i] *= peak / m;
}

/** A looping stereo brown-noise buffer, shaped by `shape(t, seconds)` (periodic in `seconds`) and seamless. */
export function surfBuffer(ctx, seconds = 12) {
  const rate = ctx.sampleRate, len = Math.round(seconds * rate), fade = Math.round(Math.min(2, seconds / 3) * rate);
  const buf = ctx.createBuffer(2, len, rate);
  const chans = [];
  for (let ch = 0; ch < 2; ch++) {
    const raw = new Float32Array(len + fade);
    let last = 0;
    for (let i = 0; i < raw.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; raw[i] = last; }
    const d = seamless(raw, len, fade);
    // two swells per loop, periodic so the envelope also meets itself at the seam
    for (let i = 0; i < len; i++) {
      const x = i / len, wrap = (c) => { const q = Math.abs(x - c); return Math.min(q, 1 - q) * seconds; };
      const swell = Math.max(Math.exp(-(wrap(0.27) ** 2) / 2.2), 0.75 * Math.exp(-(wrap(0.72) ** 2) / 1.8));
      d[i] *= 0.1 + 0.9 * swell;
    }
    chans.push(d);
  }
  normalise(chans);
  chans.forEach((d, ch) => buf.getChannelData(ch).set(d));
  return buf;
}

/** Rain: a hissing bed plus random drops, wrapped around the loop so it is seamless. */
export function rainBuffer(ctx, seconds = 6) {
  const rate = ctx.sampleRate, len = Math.round(seconds * rate), fade = Math.round(rate * 0.5);
  const buf = ctx.createBuffer(2, len, rate);
  const chans = [];
  for (let ch = 0; ch < 2; ch++) {
    const raw = new Float32Array(len + fade);
    let a = 0, b = 0; // gently high-passed white noise (difference of two smoothed copies)
    for (let i = 0; i < raw.length; i++) {
      const w = Math.random() * 2 - 1;
      a += 0.5 * (w - a); b += 0.02 * (w - b);
      raw[i] = a - b;
    }
    const d = seamless(raw, len, fade);
    // slow random amplitude modulation: sum of a few periodic sines
    const ph = [0, 1, 2].map(() => Math.random() * 6.283);
    for (let i = 0; i < len; i++) {
      const x = i / len * 6.283;
      d[i] *= 0.55 + 0.15 * Math.sin(x * 3 + ph[0]) + 0.1 * Math.sin(x * 7 + ph[1]) + 0.08 * Math.sin(x * 13 + ph[2]);
    }
    // drops: short decaying noise bursts at random times, written modulo the loop length
    const drops = Math.round(seconds * 70), dl = Math.round(rate * 0.006);
    for (let k = 0; k < drops; k++) {
      const s = Math.floor(Math.random() * len), amp = 0.3 + 1.1 * Math.random() ** 2;
      let prev = 0;
      for (let j = 0; j < dl; j++) {
        const attack = Math.min(1, j / (rate * 0.0004)), n = Math.random() * 2 - 1;
        prev += 0.6 * (n - prev);
        d[(s + j) % len] += prev * amp * attack * Math.exp(-j / (dl * 0.3));
      }
    }
    chans.push(d);
  }
  normalise(chans);
  chans.forEach((d, ch) => buf.getChannelData(ch).set(d));
  return buf;
}

function loopSource(ctx, buffer) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

/** Surf bed. Returns { out, start(t), stop(t) }; connect `out` somewhere. */
export function buildSurf(ctx, { seconds = 12 } = {}) {
  const src = loopSource(ctx, surfBuffer(ctx, seconds));
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 900;
  const out = ctx.createGain();
  out.gain.value = 1;
  src.connect(lp).connect(out);
  return { out, start: (t = 0) => src.start(t), stop: (t = 0) => src.stop(t) };
}

/** Rain bed, band-limited. */
export function buildRain(ctx, { seconds = 6 } = {}) {
  const src = loopSource(ctx, rainBuffer(ctx, seconds));
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 700;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 7500;
  const out = ctx.createGain();
  out.gain.value = 1;
  src.connect(hp).connect(lp).connect(out);
  return { out, start: (t = 0) => src.start(t), stop: (t = 0) => src.stop(t) };
}

/** A faint low bed for the deep: very low-passed brown noise. */
export function buildRumble(ctx, { seconds = 8 } = {}) {
  const src = loopSource(ctx, surfBuffer(ctx, seconds));
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 140;
  const out = ctx.createGain();
  out.gain.value = 1;
  src.connect(lp).connect(out);
  return { out, start: (t = 0) => src.start(t), stop: (t = 0) => src.stop(t) };
}

// Attack/decay envelope that starts and ends at exactly zero.
function envelope(ctx, dest, t, attack, peak, decay) {
  const g = ctx.createGain();
  g.gain.value = 0; // a source can start a frame before the first event: never let that frame through at unity
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setTargetAtTime(0, t + attack, decay / 4);
  g.gain.setValueAtTime(0, t + attack + decay * 1.6);
  g.connect(dest);
  return g;
}

/** A plucked-string note (Karplus-Strong with a soft pick), tuned exactly. Starts at t, rings about 1.5 s. */
export function pluck(ctx, dest, t, freq, { gain = 0.22, seconds = 1.5 } = {}) {
  const rate = ctx.sampleRate, len = Math.round(seconds * rate);
  // The averaging filter removes half a sample of delay, so the loop is n - 0.5 samples long (it averages a sample with its successor);
  // playbackRate nudges the result onto the exact pitch.
  const n = Math.max(2, Math.round(rate / freq + 0.5)), actual = rate / (n - 0.5);
  const buf = ctx.createBuffer(1, len, rate), d = buf.getChannelData(0);
  const line = new Float32Array(n);
  for (let i = 0; i < n; i++) line[i] = Math.random() * 2 - 1;
  for (let pass = 0; pass < 2; pass++) { // a soft pick: noise smoothed twice, around the ring so its ends meet
    let sm = line[n - 1];
    for (let i = 0; i < 2 * n; i++) { sm += 0.3 * (line[i % n] - sm); if (i >= n) line[i - n] = sm; }
  }
  let mean = 0; for (let i = 0; i < n; i++) mean += line[i] / n;
  let m = 0; for (let i = 0; i < n; i++) { line[i] -= mean; m = Math.max(m, Math.abs(line[i])); }
  for (let i = 0; i < n; i++) line[i] /= m || 1;
  let k = 0;
  for (let i = 0; i < len; i++) {
    const v = 0.5 * (line[k] + line[(k + 1) % n]) * 0.998;
    d[i] = line[k];
    line[k] = v;
    k = (k + 1) % n;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = freq / actual;
  const stretch = actual / freq, life = seconds * stretch;
  const g = ctx.createGain();
  g.gain.value = 0; // see envelope(): the default value of 1 would let one frame through at the start
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.005);
  g.gain.setValueAtTime(gain, t + life - 0.25);
  g.gain.linearRampToValueAtTime(0, t + life - 0.01);
  src.connect(g).connect(dest);
  src.start(t);
  src.stop(t + life);
}

/** Frequencies of the catch chime: a rising pentatonic strum (C D E G A C). */
export function chimeNotes(golden = false) {
  const C5 = 440 * 2 ** (3 / 12);
  return (golden ? [0, 2, 4, 7, 9, 12] : [0, 4, 7]).map((semi) => C5 * 2 ** (semi / 12));
}

/** The catch chime. Golden gets a brighter, longer flourish. */
export function chime(ctx, dest, t, golden = false) {
  chimeNotes(golden).forEach((f, i) => pluck(ctx, dest, t + i * (golden ? 0.085 : 0.1), f, { gain: golden ? 0.18 : 0.2 }));
}

/** A soft low note for a fish that got away (A3). */
export function lowNote(ctx, dest, t) { pluck(ctx, dest, t, 220, { gain: 0.2, seconds: 1.2 }); }

/** A soft bite: a low sine that drops in pitch, with a little noise at the front. */
export function thump(ctx, dest, t) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(130, t);
  osc.frequency.exponentialRampToValueAtTime(48, t + 0.16);
  const g = envelope(ctx, dest, t, 0.008, 0.5, 0.2);
  osc.connect(g);
  osc.start(t);
  osc.stop(t + 0.5);
}

/** A very quiet UI tick (a tiny sine blip). */
export function tick(ctx, dest, t, gain = 0.05) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1800, t);
  const g = envelope(ctx, dest, t, 0.002, gain, 0.03);
  osc.connect(g);
  osc.start(t);
  osc.stop(t + 0.12);
}

/* ---------------- the controller ---------------- */

export function initSound({ bus = siteBus, clock = siteClock } = {}) {
  const btn = $("sound");
  if (!btn) return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  const read = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
  const write = (on) => { try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* private mode */ } };

  let on = AC ? read() : false;
  let eng = null;           // created lazily, on a user gesture
  let suspendTimer = 0;
  let lastLanded = -1e9, lastTick = -1e9;

  const show = () => {
    btn.setAttribute("aria-pressed", String(on));
    btn.title = on ? "Ocean sound: on" : "Ocean sound: off";
  };
  if (!AC) { btn.disabled = true; btn.title = "Ocean sound is not supported in this browser"; }
  show();

  const running = () => !!eng && eng.ctx.state === "running";
  const audible = () => on && !document.hidden;

  function build() {
    const ctx = new AC();
    const master = ctx.createGain(); master.gain.value = 0;
    const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 18000; filter.Q.value = 0.5;
    const mix = ctx.createGain(); mix.gain.value = 1; // everything that gets muffled underwater
    mix.connect(filter).connect(master).connect(ctx.destination);
    const surf = buildSurf(ctx), rain = buildRain(ctx), rumble = buildRumble(ctx);
    const surfG = ctx.createGain(), rainG = ctx.createGain(), rumbleG = ctx.createGain();
    surfG.gain.value = 0; rainG.gain.value = 0; rumbleG.gain.value = 0;
    surf.out.connect(surfG).connect(mix);
    rain.out.connect(rainG).connect(mix);
    rumble.out.connect(rumbleG).connect(master); // the rumble is not muffled
    surf.start(); rain.start(); rumble.start();
    return { ctx, master, filter, mix, surfG, rainG, rumbleG, depth: 0 };
  }

  function levels() {
    const u = underwaterParams(eng.depth);
    const surfBase = weather.calm < 0.7 ? 0.42 : 0.3;
    const t = eng.ctx.currentTime;
    eng.filter.frequency.setTargetAtTime(u.cutoff, t, 0.3);
    eng.surfG.gain.setTargetAtTime(surfBase * u.surf, t, 0.4);
    eng.rumbleG.gain.setTargetAtTime(0.35 * u.rumble, t, 0.6);
    // rain: ~2 s to settle (time constant 0.6 s)
    eng.rainG.gain.setTargetAtTime(0.4 * rainLevel(weather), t, 0.6);
  }

  function apply() {
    if (!eng) return;
    clearTimeout(suspendTimer);
    const t = eng.ctx.currentTime;
    if (audible()) {
      eng.ctx.resume().then(() => { if (audible()) { eng.master.gain.setTargetAtTime(0.8, eng.ctx.currentTime, 0.4); levels(); } }).catch(() => {});
    } else {
      eng.master.gain.setTargetAtTime(0, t, 0.15);
      suspendTimer = setTimeout(() => { if (!audible() && eng) eng.ctx.suspend().catch(() => {}); }, 700);
    }
  }

  // ---- gestures: the context is only created here ----
  const GESTURES = ["pointerdown", "keydown", "touchend", "click"];
  function onGesture(e) {
    if (e.type === "keydown" && (e.key === "Tab" || e.key === "Shift")) return;
    if (btn.contains(e.target)) return; // the toggle handles itself
    wake();
  }
  function wake() {
    if (!on || eng || !AC) return;
    eng = build();
    GESTURES.forEach((g) => removeEventListener(g, onGesture, true));
    apply();
  }
  if (on) GESTURES.forEach((g) => addEventListener(g, onGesture, true));

  btn.addEventListener("click", () => {
    on = !on;
    write(on);
    show();
    if (on) {
      GESTURES.forEach((g) => removeEventListener(g, onGesture, true));
      if (!eng) eng = build();
      apply();
      eng.ctx.resume().then(() => oneShot(tick));
    } else {
      apply();
    }
  });

  document.addEventListener("visibilitychange", apply);

  // ---- one-shots ----
  function oneShot(fn, ...rest) {
    if (!audible() || !running()) return;
    fn(eng.ctx, eng.mix, eng.ctx.currentTime + 0.01, ...rest);
  }

  bus.on("weather", () => { if (eng && audible()) levels(); });
  bus.on("depth", (d) => { if (!eng) return; eng.depth = Number(d) || 0; if (audible()) levels(); });
  bus.on("game", (g) => {
    if (!g) return;
    if (g.state === "bite") oneShot(thump);
    else if (g.state === "landed") { lastLanded = performance.now(); oneShot(chime, g.id === "golden"); }
    else if (g.state === "gotaway") oneShot(lowNote);
  });
  bus.on("catch", (c) => {
    // Until the game emits `game` events, `catch` is the only signal; wait a beat so a `landed` can win.
    setTimeout(() => { if (performance.now() - lastLanded > 200) oneShot(chime, c && c.id === "golden"); }, 60);
  });
  clock.onChange(() => {
    if (clock.isLive) return;
    const now = performance.now();
    if (now - lastTick < 90) return; // at most about 11 a second
    lastTick = now;
    oneShot(tick);
  });

  return {
    get on() { return on; },
    get context() { return eng && eng.ctx; },
    toggle: () => btn.click()
  };
}
