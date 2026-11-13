// Clouds as layered screenprint shapes: a dark keyline, a shade tone, a body tone and a highlight
// that sits on whichever side the sun is. The count comes from the weather; the colours from the sky.
import { $ } from "../core/dom.js";
import { motion } from "../core/motion.js";

export const cloudCount = (level) => [0, 1, 3, 4, 6][level] || 0;

/** Puffs for one cloud in a 220 x 90 box with a flat base: [cx, cy, r]. Pure apart from the random source. */
export function cloudShape(rand = Math.random) {
  const puffs = [];
  const n = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? .5 : i / (n - 1);
    const hump = Math.sin(t * Math.PI); // taller in the middle
    const r = 15 + hump * 15 + rand() * 6;
    puffs.push([30 + t * 160 + (rand() - .5) * 10, 90 - r * (.55 + rand() * .25) - 2, r]);
  }
  return puffs;
}

function circles(puffs, grow = 0) {
  return puffs.map(([x, y, r]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${Math.max(2, r + grow).toFixed(1)}"/>`).join("");
}

let uid = 0;

/**
 * The SVG for one cloud. Colours come from --cloud-* variables so the sky can retint every cloud at once.
 * The body and highlight are the same silhouette slid toward the sun and clipped to it, which leaves a crescent of
 * shade on the far side, like a second ink on a screenprint.
 */
export function cloudSvg(puffs) {
  const id = `cc${uid++}`;
  const base = `<rect x="14" y="62" width="192" height="40" rx="14"/>`;
  const shape = circles(puffs) + base;
  return `<svg viewBox="0 0 220 90" aria-hidden="true">`
    + `<defs><clipPath id="${id}">${shape}</clipPath></defs>`
    + `<g class="cl-key">${circles(puffs, 3)}${base.replace('x="14"', 'x="11"').replace('width="192"', 'width="198"')}</g>`
    + `<g class="cl-shade">${shape}</g>`
    + `<g clip-path="url(#${id})"><g class="cl-body">${shape}</g>`
    + `<g class="cl-hi">${circles(puffs, -9)}</g></g>`
    + `</svg>`;
}

export function renderClouds(level) {
  const clouds = $("clouds");
  if (!clouds) return;
  clouds.innerHTML = "";
  const n = cloudCount(level);
  for (let i = 0; i < n; i++) {
    const c = document.createElement("div");
    const s = .5 + Math.random() * .8; // small clouds are far away: slower, fainter
    const dur = 150 - 60 * s + Math.random() * 60;
    c.className = "cloud";
    c.style.cssText = `top:${6 + Math.random() * 38}%;width:${Math.round(220 * s)}px;--xv:${(Math.random() * 80).toFixed(1)};--far:${(1.1 - s * .45).toFixed(2)};animation-duration:${dur.toFixed(0)}s;animation-delay:${-Math.random() * dur}s`;
    if (motion.reduced) c.classList.add("still");
    c.innerHTML = cloudSvg(cloudShape());
    clouds.appendChild(c);
  }
}
