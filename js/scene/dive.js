// The dive: scrolling past the waterline takes you under. Emits `depth` (0 at the surface, 1 at the
// bottom of the page), grades the water, aims the light rays, drifts the particles and runs the gauge.
// Parallax and grading use CSS scroll-driven animations where the browser has them; elsewhere the
// same effects read --depth, which this module writes on #deep.
import { motion } from "../core/motion.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrap = (v) => v - Math.floor(v);

/** Scroll distances that bracket the dive: where the waterline crosses mid-screen, and the end of the page. */
export function diveMetrics({ shoreTop, viewport, docHeight }) {
  return { surface: Math.max(0, shoreTop - viewport * .55), max: Math.max(0, docHeight - viewport) };
}
/** 0 at the surface, 1 at the bottom. A page too short to scroll past the waterline stays at 0. */
export function depthFor(scrollY, m) {
  if (m.max <= m.surface) return 0;
  return clamp((scrollY - m.surface) / (m.max - m.surface), 0, 1);
}
export const MAX_METERS = 30;
export const meters = (depth) => Math.round(clamp(depth, 0, 1) * MAX_METERS);

/** How much light reaches the water (day, 0.08..1) and how night-dark it is (0..1) from the sun's altitude. */
export function lightFor(sunAlt) {
  return { day: Math.max(.08, clamp((sunAlt + 8) / 30, 0, 1)), night: 1 - clamp((sunAlt + 14) / 16, 0, 1) };
}

/** Marine snow and, after dark, bioluminescent specks, on a canvas the size of the viewport. */
function createParticles(canvas, getNight) {
  const ctx = canvas.getContext("2d");
  let w = 0, h = 0, running = false, raf = 0, last = 0, lastScroll = scrollY, time = 0;
  let seed = 0x9e3779b9;
  const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const snow = Array.from({ length: 80 }, () => ({ x: rnd(), y: rnd(), z: .3 + rnd() * .7, ph: rnd() * 6.28, r: .8 + rnd() * 1.8 }));
  const bio = Array.from({ length: 44 }, () => ({ x: rnd(), y: rnd(), z: .3 + rnd() * .7, ph: rnd() * 6.28, rate: .6 + rnd() * 1.8, r: 1.1 + rnd() * 1.6 }));

  function resize() {
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.max(1, w); canvas.height = Math.max(1, h); // 1x: these are soft specks
    draw(0, 0);
  }
  function draw(dScroll, dt) {
    ctx.clearRect(0, 0, w, h);
    const night = getNight();
    ctx.fillStyle = "#BFE5EE";
    for (const p of snow) {
      p.y = wrap(p.y + (.01 + .02 * p.z) * dt - dScroll * p.z * .5 / h);
      const x = (p.x + Math.sin(time * .4 + p.ph) * .012) * w;
      ctx.globalAlpha = (.16 + .3 * p.z) * (1 - night * .55);
      ctx.beginPath(); ctx.arc(x, p.y * h, p.r * p.z + .3, 0, 6.283); ctx.fill();
    }
    if (night > .15) {
      for (const b of bio) {
        b.y = wrap(b.y - (.006 + .01 * b.z) * dt - dScroll * b.z * .5 / h);
        const tw = Math.max(0, Math.sin(time * b.rate + b.ph));
        const a = night * tw * tw, x = (b.x + Math.sin(time * .3 + b.ph) * .02) * w, y = b.y * h;
        if (a < .03) continue;
        ctx.fillStyle = "#7FF3E0";
        ctx.globalAlpha = a * .18; ctx.beginPath(); ctx.arc(x, y, b.r * 4.5, 0, 6.283); ctx.fill();
        ctx.globalAlpha = a * .9; ctx.beginPath(); ctx.arc(x, y, b.r, 0, 6.283); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (now - last < 33) return;
    const dt = Math.min(.1, (now - last) / 1000); last = now; time += dt;
    const sy = scrollY, d = sy - lastScroll; lastScroll = sy;
    draw(d, dt);
  }
  return {
    resize,
    start() { if (running || motion.reduced) return; running = true; last = performance.now(); lastScroll = scrollY; raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    redraw: () => draw(0, 0)
  };
}

export function initDive({ bus }) {
  const deep = document.getElementById("deep");
  const shore = document.querySelector(".shore");
  if (!deep || !shore) return null;
  const gauge = document.getElementById("gauge"), mark = document.getElementById("gauge-mark"), read = document.getElementById("gauge-read");
  const sdt = !!(globalThis.CSS && CSS.supports && CSS.supports("animation-timeline: scroll()"));
  deep.classList.toggle("sdt", sdt);

  let metrics = { surface: 0, max: 1 }, depth = 0, emitted = -1, trackH = 0, queued = false, night = 0, shown = false, lastM = -1;
  const particles = createParticles(document.getElementById("deep-motes"), () => night);

  function measure() {
    const top = shore.getBoundingClientRect().top + scrollY;
    metrics = diveMetrics({ shoreTop: top, viewport: innerHeight, docHeight: document.documentElement.scrollHeight });
    const span = Math.max(1, metrics.max);
    // scroll-driven animations run from here to the end of the page
    deep.style.setProperty("--dive-start", `${(metrics.surface / span * 100).toFixed(2)}%`);
    if (gauge) trackH = Math.max(0, gauge.querySelector(".gauge-track").clientHeight - 2);
    particles.resize();
    update();
  }

  function update() {
    queued = false;
    depth = depthFor(scrollY, metrics);
    if (!sdt) deep.style.setProperty("--depth", depth.toFixed(4));
    if (gauge) {
      const on = depth > .004;
      if (on !== shown) { shown = on; gauge.classList.toggle("on", on); }
      mark.style.transform = `translate3d(0,${(depth * trackH).toFixed(1)}px,0)`;
      const m = meters(depth);
      if (m !== lastM) { lastM = m; read.textContent = `${m} m`; }
    }
    if (Math.abs(depth - emitted) > .0005) { emitted = depth; bus.emit("depth", depth); }
  }
  const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", measure);
  new ResizeObserver(measure).observe(shore);

  bus.on("sky", (s) => {
    const l = lightFor(s.altitude);
    night = l.night;
    deep.style.setProperty("--light", l.day.toFixed(3));
    deep.style.setProperty("--night", l.night.toFixed(3));
    // light comes down away from the sun: rays slant left when the sun is on the right (west)
    const sunX = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sun-x"));
    const x = s.altitude > -3 && Number.isFinite(sunX) ? sunX : 50;
    deep.style.setProperty("--lean", `${((x - 50) / 50 * 16).toFixed(1)}deg`);
    if (motion.reduced) particles.redraw();
  });

  // live (animations running) only while the water is on screen and the tab is visible
  motion.onVisible(deep, () => { deep.classList.add("live"); particles.start(); }, () => { deep.classList.remove("live"); particles.stop(); });
  measure();
  return { get depth() { return depth; }, measure, sdt };
}
