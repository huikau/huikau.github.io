// Stars for dusk and night.
import { $ } from "../core/dom.js";

export function initStars() {
  const stars = $("stars");
  if (!stars) return;
  for (let i = 0; i < 90; i++) {
    const s = document.createElement("span");
    const size = Math.random() < .85 ? 1.5 : 2.5;
    s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;width:${size}px;height:${size}px;opacity:${.4 + Math.random() * .6};animation-delay:${Math.random() * 3.5}s`;
    if (Math.random() < .3) s.className = "twinkle";
    stars.appendChild(s);
  }
}
