// Sun and moon drawing. For now only the moon's lit shape.
import { $, params } from "../core/dom.js";
import { moonPhase } from "../core/astro.js";

/** The ?moon=0..1 test switch overrides the real phase. */
export function currentMoonPhase(ms) {
  const p = params();
  if (p.has("moon")) return Math.min(.999, Math.max(0, Number(p.get("moon")) || 0));
  return moonPhase(ms);
}

/** SVG path for the lit part of the moon in the 54x54 viewBox. */
export function moonLitPath(phase) {
  const r = 24, cx = 27, top = 3, bottom = 51;
  const rx = (Math.abs(Math.cos(2 * Math.PI * phase)) * r).toFixed(2);
  // Lit limb on the right while waxing, on the left while waning; the terminator bulges toward the dark side for a gibbous moon.
  return phase < .5
    ? `M${cx} ${top} A${r} ${r} 0 0 1 ${cx} ${bottom} A${rx} ${r} 0 0 ${phase < .25 ? 0 : 1} ${cx} ${top} Z`
    : `M${cx} ${top} A${r} ${r} 0 0 0 ${cx} ${bottom} A${rx} ${r} 0 0 ${phase < .75 ? 0 : 1} ${cx} ${top} Z`;
}

export function initMoon(clock) {
  const moonLit = $("moon-lit");
  if (moonLit) moonLit.setAttribute("d", moonLitPath(currentMoonPhase(clock.now())));
}
