// Stars on a canvas: a faint Milky Way band, a field of stars that twinkle gently, and a few bright ones with a cross.
// The whole layer fades with CSS opacity (set by sky.js), so the loop only runs while the stars are visible.
import { $ } from "../core/dom.js";
import { motion } from "../core/motion.js";

export const STAR_COUNT = 170;

/** Star positions and brightness, as fractions of the canvas. Pure apart from the random source. */
export function makeStars(rand = Math.random, n = STAR_COUNT) {
  const stars = [];
  for (let i = 0; i < n; i++) {
    const bright = rand() < .07;
    stars.push({
      x: rand(), y: Math.pow(rand(), 1.15), // a little denser toward the top, away from the haze
      r: bright ? 1.5 + rand() * .8 : .5 + rand() * .9,
      a: bright ? .85 + rand() * .15 : .35 + rand() * .5,
      speed: .4 + rand() * 1.1, phase: rand() * Math.PI * 2,
      twinkle: rand() < .45 ? .35 : .1, // a few twinkle properly, most only shimmer
      bright
    });
  }
  return stars;
}

export function initStars() {
  const host = $("stars");
  if (!host) return { setAlpha() {} };
  const canvas = document.createElement("canvas");
  host.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const band = document.createElement("canvas"); // the Milky Way, painted once
  let w = 0, h = 0, stars = makeStars(), raf = 0, last = 0, visible = true, alpha = 0, t0 = performance.now();

  function paintBand() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    band.width = Math.round(w * dpr);
    band.height = Math.round(h * dpr);
    const b = band.getContext("2d");
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    b.clearRect(0, 0, w, h);
    // a slanted band from lower left to upper right: soft wide glow, then a spray of fine grains
    const x0 = -.05 * w, y0 = .78 * h, x1 = 1.05 * w, y1 = .08 * h;
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
    for (let i = 0; i < 26; i++) {
      const t = i / 25, cx = x0 + dx * t, cy = y0 + dy * t;
      const rad = Math.max(w, h) * (.14 + .05 * Math.sin(t * 6.1 + 1));
      const g = b.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, "rgba(190, 205, 240, .075)");
      g.addColorStop(1, "rgba(190, 205, 240, 0)");
      b.fillStyle = g;
      b.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 700; i++) {
      const t = Math.random(), off = (Math.random() + Math.random() + Math.random() - 1.5) * Math.max(w, h) * .16;
      const px = x0 + dx * t + nx * off, py = y0 + dy * t + ny * off;
      b.fillStyle = `rgba(225, 232, 255, ${(.06 + Math.random() * .22).toFixed(3)})`;
      b.fillRect(px, py, .9, .9);
    }
  }

  function draw(now) {
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(band, 0, 0, w, h);
    const t = (now - t0) / 1000;
    for (const s of stars) {
      const tw = motion.reduced ? 1 : 1 - s.twinkle + s.twinkle * (.5 + .5 * Math.sin(t * s.speed * 1.6 + s.phase));
      const x = s.x * w, y = s.y * h;
      ctx.globalAlpha = s.a * tw;
      ctx.fillStyle = s.bright ? "#FFF6DC" : "#F2F5FF";
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
      if (s.bright) { // a four-point cross, like a registration mark in a print
        ctx.lineWidth = .7;
        ctx.strokeStyle = "#FFF6DC";
        ctx.beginPath();
        ctx.moveTo(x - s.r * 3.2, y); ctx.lineTo(x + s.r * 3.2, y);
        ctx.moveTo(x, y - s.r * 3.2); ctx.lineTo(x, y + s.r * 3.2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    w = host.clientWidth; h = host.clientHeight;
    if (!w || !h) return;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintBand();
    draw(performance.now());
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - last < 40) return; // about 25 frames a second is plenty for a twinkle
    last = now;
    draw(now);
  }
  function run() {
    const want = alpha > .02 && visible && !motion.reduced;
    if (want && !raf) raf = requestAnimationFrame(frame);
    if (!want && raf) { cancelAnimationFrame(raf); raf = 0; }
  }
  resize();
  motion.onVisible(host, () => { visible = true; run(); }, () => { visible = false; run(); });
  addEventListener("resize", resize);

  return {
    /** 0..1: how visible the star field is. The loop stops at 0. */
    setAlpha(a) {
      alpha = a;
      host.style.opacity = a.toFixed(3);
      if (!w) resize();
      run();
    }
  };
}
