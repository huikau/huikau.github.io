// Drifting clouds; the cover level (0-4) from the weather decides how many.
import { $ } from "../core/dom.js";

export const cloudCount = (level) => [0, 1, 3, 4, 6][level] || 0;

export function renderClouds(level) {
  const clouds = $("clouds");
  if (!clouds) return;
  clouds.innerHTML = "";
  const n = cloudCount(level);
  for (let i = 0; i < n; i++) {
    const c = document.createElement("span");
    const dur = 110 + Math.random() * 90;
    c.style.cssText = `top:${8 + Math.random() * 34}%;--s:${(.55 + Math.random() * .8).toFixed(2)};animation-duration:${dur}s;animation-delay:${-Math.random() * dur}s`;
    clouds.appendChild(c);
  }
}
