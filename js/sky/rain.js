// Rain, drawn drop by drop on a canvas.
import { $, scene } from "../core/dom.js";
import { motion } from "../core/motion.js";

export function initRain(weather) {
  const host = $("showers");
  if (!host) return { set() {} };
  const canvas = document.createElement("canvas");
  host.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const sceneEl = scene();
  let w = 0, h = 0, level = 0, drops = [], ripples = [], raf = 0, last = 0, visible = true;

  const seaTop = () => h * (1 - .28);
  function makeDrop(anywhere) {
    const z = .35 + Math.random() * .65; // depth: 1 is closest to the viewer
    return {
      x: Math.random() * (w + 300) - 200,
      y: anywhere ? Math.random() * h : -20 - Math.random() * h * .25,
      z,
      len: 10 + 18 * z,
      speed: 560 + 760 * z,
      // far drops meet the water near the horizon, close ones further down
      land: seaTop() + (h - seaTop()) * Math.min(.95, .06 + .8 * (z - .35) / .65 + Math.random() * .08)
    };
  }
  function resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    w = host.clientWidth;
    h = host.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const target = Math.round(w * h / 6500 * level);
    while (drops.length < target) drops.push(makeDrop(true));
    drops.length = target;
  }
  function draw(dt) {
    ctx.clearRect(0, 0, w, h);
    const slant = .07 + (1 - weather.calm) * .45; // windier rain falls at more of an angle
    const rgb = sceneEl.dataset.sky === "day" ? "70, 96, 128" : "228, 238, 255"; // white drops vanish against a daytime sky
    ctx.lineCap = "round";
    for (const d of drops) {
      d.y += d.speed * dt;
      d.x += d.speed * slant * dt;
      if (d.y >= d.land) {
        if (ripples.length < 140) ripples.push({ x: d.x, y: d.land, z: d.z, age: 0 });
        Object.assign(d, makeDrop(false));
        continue;
      }
      const tailX = d.x - d.len * slant, tailY = d.y - d.len;
      const g = ctx.createLinearGradient(d.x, d.y, tailX, tailY);
      g.addColorStop(0, `rgba(${rgb}, ${.18 + .45 * d.z})`);
      g.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx.strokeStyle = g;
      ctx.lineWidth = .7 + .9 * d.z;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
    }
    ctx.lineWidth = .8;
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.age += dt;
      const k = r.age / .5;
      if (k >= 1) { ripples.splice(i, 1); continue; }
      const rx = 1.5 + 9 * r.z * k;
      ctx.strokeStyle = `rgba(228, 238, 255, ${(1 - k) * .45 * r.z})`;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, rx, rx * .28, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  function frame(t) {
    const dt = last ? Math.min(.05, (t - last) / 1000) : .016;
    last = t;
    draw(dt);
    raf = requestAnimationFrame(frame);
  }
  function run() {
    const want = level > 0 && visible && !motion.reduced;
    if (want && !raf) { last = 0; raf = requestAnimationFrame(frame); }
    if (!want && raf) { cancelAnimationFrame(raf); raf = 0; }
  }
  // no animation work while the canvas is off screen or the tab is hidden
  motion.onVisible(host, () => { visible = true; run(); }, () => { visible = false; run(); });
  addEventListener("resize", () => { if (level) resize(); });

  return {
    set(newLevel) {
      level = newLevel;
      host.hidden = !level;
      if (!level) { run(); return; }
      resize();
      if (motion.reduced) draw(0); // a still frame of rain, no movement
      run();
    }
  };
}
