// The water surface at the bottom of the hero: layered SVG waves (CSS-driven, speed from the wind)
// plus a canvas of specular glints that gather on the side of the sun, or of the moon at night.
import { motion } from "../core/motion.js";
import { moonIllumination } from "../core/astro.js";
import { currentMoonPhase, moonPositionForPhase } from "../sky/bodies.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Seconds for the slowest wave layer to travel its own width. `calm` is 0.45 (windy) to 1.15 (calm). */
export const waveSeconds = (calm = 1) => 46 * clamp(calm, .3, 1.5);

/**
 * Where the glints gather and how bright they are. Positions are % of the sea's width.
 * The sun lights the water until it is just below the horizon (strongest when low, a golden road);
 * after that the moon does, dimmer and by its phase; with neither up there is no glint at all.
 */
export function glintSource({ sunAlt, sunX, moonAlt, moonX, moonIllum }) {
  if (sunAlt > -3) {
    const rise = clamp((sunAlt + 3) / 8, 0, 1), low = 1 - clamp(sunAlt / 70, 0, 1);
    return { body: "sun", x: sunX, strength: rise * (.55 + .45 * low) };
  }
  if (moonAlt > 0) {
    return { body: "moon", x: moonX, strength: clamp(moonAlt / 10, 0, 1) * (.18 + .4 * clamp(moonIllum / 100, 0, 1)) };
  }
  return { body: null, x: 50, strength: 0 };
}

function mulberry(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function initSurface({ clock, bus, weather }) {
  const canvas = document.getElementById("glints");
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  const root = document.documentElement;
  const rnd = mulberry(0x6c17);
  // each glint: lateral offset (-1..1), how far down the water (0 horizon .. 1 near), twinkle phase and rate, length
  const glints = Array.from({ length: 120 }, () => ({
    u: (rnd() + rnd() + rnd() - 1.5) / 1.5, v: Math.pow(rnd(), .8), ph: rnd() * 6.283, rate: .5 + rnd() * 1.6, len: .5 + rnd()
  }));
  let src = { body: null, x: 50, strength: 0 }, speed = 1, w = 0, h = 0, dpr = 1, running = false, raf = 0, last = 0, t = 0;

  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    if (src.strength <= 0.01) return;
    const warm = src.body === "sun";
    ctx.fillStyle = warm ? "#FFF1C2" : "#E4ECFF";
    for (const g of glints) {
      // perspective: the road widens and the dashes lengthen toward the viewer
      const spread = (.05 + .16 * g.v) * w, x = src.x / 100 * w + g.u * spread * (warm ? 1 : .6);
      const y = h * (.2 + .6 * g.v);
      const tw = .5 + .5 * Math.sin(t * g.rate + g.ph), a = src.strength * Math.pow(tw, 2.2) * (1 - Math.abs(g.u) * .55);
      if (a < .04) continue;
      ctx.globalAlpha = Math.min(1, a);
      const L = (8 + 30 * g.v) * g.len;
      ctx.fillRect(x - L / 2, y, L, 1.6 + 1.6 * g.v);
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (now - last < 33) return; // 30 fps is plenty for a shimmer
    t += Math.min(.1, (now - last) / 1000) * speed; last = now;
    draw();
  }
  const start = () => { if (running || motion.reduced) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };

  function update() {
    const ms = clock.now();
    const cs = getComputedStyle(root);
    const pct = (name, d) => { const v = parseFloat(cs.getPropertyValue(name)); return Number.isFinite(v) ? v : d; };
    const sunAlt = lastSky ? lastSky.altitude : 30;
    let moonAlt = -90, moonIllum = 0;
    try { const ph = currentMoonPhase(ms); moonAlt = moonPositionForPhase(ms, ph).altitude; moonIllum = moonIllumination(ph); } catch {}
    src = glintSource({ sunAlt, sunX: pct("--sun-x", 50), moonAlt, moonX: pct("--moon-x", 50), moonIllum });
    speed = 1 / clamp(weather && weather.calm || 1, .3, 1.5);
    canvas.parentElement.style.setProperty("--wave-speed", String(speed.toFixed(3)));
    if (!running) draw();
  }
  let lastSky = null;
  bus.on("sky", (s) => { lastSky = s; update(); });
  bus.on("weather", update);
  new ResizeObserver(resize).observe(canvas);
  resize();
  update();
  motion.onVisible(canvas, start, stop);
  return { update, get source() { return src; } };
}
