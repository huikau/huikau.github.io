// Seasons and Aloha Friday, drawn in the island-screenprint style: flat fills, an ink keyline, no glows.
import { $, params, scene } from "../core/dom.js";
import { motion } from "../core/motion.js";
import { markFound } from "./eggs.js";

const INK = "#0B2226";

/** Season for an HST Date (read with getUTC*); `override` is the ?season= value. */
export function detectSeason(hst, override) {
  const month = hst.getUTCMonth() + 1, date = hst.getUTCDate();
  let season = "none";
  if (month === 10 && date >= 15) season = "halloween";
  else if (month === 12 && date <= 30) season = "winter";
  else if ((month === 12 && date === 31) || (month === 1 && date === 1)) season = "newyear";
  if (["halloween", "winter", "newyear", "none"].includes(override)) season = override;
  return season;
}

export const isFriday = (hst, override) => override != null ? override === "1" : hst.getUTCDay() === 5;

// ---------- string lights along the shoreline ----------
export const LIGHT_COLORS = {
  winter: ["#F5A623", "#E8662A", "#BFE5EE", "#F7EEDB", "#D8456B"],
  halloween: ["#E8662A", "#F5A623", "#8A5BB0", "#F7EEDB"]
};

/** Strands hung between short posts on the sand. Returns an SVG string `w` wide and 100 tall; the posts stand on its bottom edge. */
export function lightsSVG(w, season = "winter") {
  const colors = LIGHT_COLORS[season] || LIGHT_COLORS.winter;
  const swags = Math.max(2, Math.round(w / 340)), span = w / swags, top = 14, sag = 16, per = 5;
  let posts = "", cords = "", bulbs = "", c = 0;
  for (let i = 0; i <= swags; i++) {
    const x = i * span;
    posts += `<path d="M${x.toFixed(1)} ${top} L${x.toFixed(1)} 100"/>`;
  }
  for (let i = 0; i < swags; i++) {
    const x = i * span;
    cords += `<path d="M${x.toFixed(1)} ${top} Q${(x + span / 2).toFixed(1)} ${top + sag * 2} ${(x + span).toFixed(1)} ${top}"/>`;
    for (let k = 1; k <= per; k++) {
      const t = k / (per + 1), px = x + span * t, py = top + sag * 4 * t * (1 - t);
      const col = colors[c++ % colors.length];
      bulbs += `<g class="bulb" transform="translate(${px.toFixed(1)} ${(py + 2).toFixed(1)})"><rect x="-3" y="-1" width="6" height="5" rx="1.2" fill="${INK}"/><ellipse cy="9.6" rx="6.4" ry="8" fill="${col}" stroke="${INK}" stroke-width="2"/><ellipse cx="-2.1" cy="7.2" rx="1.6" ry="2.6" fill="#FFF9EC" opacity=".85"/></g>`;
    }
  }
  return `<svg width="${w}" height="100" viewBox="0 0 ${w} 100" aria-hidden="true" focusable="false"><g class="l-post" fill="none" stroke-linecap="round"><g stroke="${INK}" stroke-width="7">${posts}</g><g stroke="#C49C5E" stroke-width="3">${posts}</g></g><g class="l-cord" fill="none"><g stroke="${INK}" stroke-width="4">${cords}</g><g stroke="#E9D9B0" stroke-width="1.4">${cords}</g></g>${bulbs}</svg>`;
}

// ---------- fireworks over the ridge, with their reflections on the water ----------
export const BURSTS = [
  { x: 8, y: 32, size: 1, color: "#F5A623", alt: "#F7EEDB", every: 7.4 },
  { x: 92, y: 24, size: 1.1, color: "#BFE5EE", alt: "#F7EEDB", every: 8.6 },
  { x: 44, y: 8, size: .8, color: "#D8456B", alt: "#F5A623", every: 9.8 },
  { x: 76, y: 9, size: .9, color: "#E8662A", alt: "#F7EEDB", every: 6.9 }
];

/** One burst: 14 rays of two lengths, a tip dot on each, and a bright core. Drawn in a -50..50 box. */
export function burstSVG(color, alt) {
  let s = "";
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2, long = i % 2 === 0, r1 = 11, r2 = long ? 40 : 28;
    const c = (r) => `${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`;
    s += `<path d="M${c(r1)}L${c(r2 - 4)}" stroke="${long ? color : alt}" stroke-width="${long ? 4 : 3.2}" stroke-linecap="round"/><circle cx="${(Math.cos(a) * r2).toFixed(1)}" cy="${(Math.sin(a) * r2).toFixed(1)}" r="${long ? 3.1 : 2.4}" fill="${long ? alt : color}"/>`;
  }
  return `<svg viewBox="-50 -50 100 100" aria-hidden="true" focusable="false">${s}<circle r="5" fill="${alt}"/></svg>`;
}

/** The soft reflection: short dashes on the water, shorter as they get further from the horizon. */
export function reflectionSVG(color) {
  const dash = [[44, 6], [32, 14], [22, 22], [13, 30], [6, 38]].map(([w, y]) => `<path d="M${30 - w / 2} ${y}L${30 + w / 2} ${y}"/>`).join("");
  return `<svg viewBox="0 0 60 44" aria-hidden="true" focusable="false"><g stroke="${color}" stroke-width="3.2" stroke-linecap="round" fill="none">${dash}</g></svg>`;
}

function buildFireworks(fw) {
  fw.innerHTML = "";
  const bursts = [];
  for (const b of BURSTS) {
    const el = document.createElement("span");
    el.className = "burst";
    el.innerHTML = burstSVG(b.color, b.alt);
    el.style.cssText = `left:${b.x}%;top:${b.y}%;--s:${b.size}`;
    const ref = document.createElement("span");
    ref.className = "burst-ref";
    ref.innerHTML = reflectionSVG(b.color);
    ref.style.cssText = `left:${b.x}%;top:${(74 + (40 - b.y) * .22).toFixed(1)}%;--s:${b.size}`;
    fw.append(el, ref);
    bursts.push({ el, ref, every: b.every });
  }
  // They sit fully open at rest (stills, reduced motion); with motion each one blooms again now and then.
  if (!motion.reduced && typeof Element !== "undefined" && Element.prototype.animate) {
    bursts.forEach(({ el, ref, every }, i) => {
      const bloom = () => {
        if (document.hidden) return;
        el.animate([{ transform: "translate(-50%, -50%) scale(calc(var(--s) * .12))", opacity: 0 }, { opacity: 1, offset: .25 }, { transform: "translate(-50%, -50%) scale(var(--s))", opacity: 1 }], { duration: 1400, easing: "cubic-bezier(.1,.7,.3,1)" });
        ref.animate([{ opacity: 0 }, { opacity: .38 }], { duration: 1400, easing: "ease-out" });
      };
      setTimeout(() => { bloom(); setInterval(bloom, every * 1000); }, 1500 + i * 1100);
    });
  }
}

// ---------- the Friday lei ----------
const FLOWER = ["#D8456B", "#F7EEDB", "#F5A623", "#D8456B", "#F7EEDB"];

/** A five-petal blossom at (x, y). */
export function blossom(x, y, r, color, rot = 0) {
  const petals = [0, 72, 144, 216, 288].map((a) => `<ellipse cy="${(-r * .55).toFixed(2)}" rx="${(r * .5).toFixed(2)}" ry="${(r * .62).toFixed(2)}" transform="rotate(${a})"/>`).join("");
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot})"><g fill="${color}" stroke="${INK}" stroke-width="1.2">${petals}</g><circle r="${(r * .24).toFixed(2)}" fill="#F5A623" stroke="${INK}" stroke-width=".8"/></g>`;
}
const leaf = (x, y, r, rot) => `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(r * .36).toFixed(2)}" ry="${(r * .78).toFixed(2)}" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})" fill="#3E8F5A" stroke="${INK}" stroke-width="1.1"/>`;

/** A lei around Ula's neck in the boat illustration (rig coordinates: it hangs from her shoulders over the bandana). */
export function leiSVG() {
  // shoulder to shoulder through a low point on her chest: a quadratic drape
  const A = [80.5, 41], C = [95.5, 63], B = [110.5, 41], n = 11;
  let leaves = "", flowers = "";
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), u = 1 - t;
    const x = u * u * A[0] + 2 * u * t * C[0] + t * t * B[0], y = u * u * A[1] + 2 * u * t * C[1] + t * t * B[1];
    const dx = 2 * u * (C[0] - A[0]) + 2 * t * (B[0] - C[0]), dy = 2 * u * (C[1] - A[1]) + 2 * t * (B[1] - C[1]);
    if (i < n - 1) leaves += leaf(x + dx * .05, y + dy * .05 + 1.6, 3.6, Math.atan2(dy, dx) * 180 / Math.PI);
    flowers += blossom(x, y, 3.9, FLOWER[i % FLOWER.length], i * 37);
  }
  return `<g class="ula-lei">${leaves}${flowers}</g>`;
}

export function initSeasons(clock) {
  const today = clock.hst();
  const p = params();
  const season = detectSeason(today, p.get("season"));
  document.body.classList.add(`season-${season}`);
  const sceneEl = scene();

  if (season === "winter" || season === "halloween") {
    const lights = $("lights");
    if (lights) {
      const draw = () => { lights.innerHTML = lightsSVG(Math.round(sceneEl.clientWidth || 1200), season); };
      draw();
      let last = sceneEl.clientWidth;
      addEventListener("resize", () => { if (Math.abs(sceneEl.clientWidth - last) > 40) { last = sceneEl.clientWidth; draw(); } });
    }
  }

  if (season === "newyear") {
    const fw = $("fireworks");
    if (fw) buildFireworks(fw);
    markFound("newyear");
  }

  const friday = isFriday(today, p.has("friday") ? p.get("friday") : null);
  if (friday) {
    const badge = $("friday");
    if (badge) badge.hidden = false;
    const lei = $("lei");
    if (lei) { lei.innerHTML = leiSVG(); lei.removeAttribute("hidden"); } // (an SVG element has no .hidden property)
    markFound("friday");
  }
  return { season, friday, month: today.getUTCMonth() + 1 };
}
