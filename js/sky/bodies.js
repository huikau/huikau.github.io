// Sun and moon: where they sit on the sky, what the moon's lit shape is, and the drawing code.
import { $, params } from "../core/dom.js";
import { moonPhase, HONOLULU } from "../core/astro.js";

const RAD = Math.PI / 180;
export const HORIZON_Y = 72; // % of the scene height where the sea meets the sky

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

/**
 * Moon position for an arbitrary phase (used when ?moon= forces one). The same maths as
 * astro.moonPosition, with the phase as an input: with the real phase the two agree exactly.
 */
export function moonPositionForPhase(ms, phase) {
  const days = (ms - Date.UTC(2000, 0, 1, 12)) / 864e5;
  const meanLon = 280.460 + 0.9856474 * days;
  const anomaly = (357.528 + 0.9856003 * days) * RAD;
  const sunLon = (meanLon + 1.915 * Math.sin(anomaly) + 0.020 * Math.sin(2 * anomaly)) * RAD;
  const lon = sunLon + 2 * Math.PI * phase;
  const obliq = 23.4393 * RAD;
  const ra = Math.atan2(Math.cos(obliq) * Math.sin(lon), Math.cos(lon));
  const dec = Math.asin(Math.sin(obliq) * Math.sin(lon));
  const ha = (280.46061837 + 360.98564736629 * days) * RAD + HONOLULU.lon * RAD - ra;
  const lat = HONOLULU.lat * RAD;
  const altitude = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha)) / RAD;
  const fromSouth = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat));
  return { altitude, azimuth: ((fromSouth / RAD + 180) % 360 + 360) % 360 };
}

/**
 * Where a body sits on the scene, in % of its width and height, from its altitude and azimuth.
 * x follows the east-west direction cosine, which (unlike azimuth) is continuous through the zenith:
 * east is on the left, west on the right. y rises from the horizon and eases off toward the zenith.
 */
export function bodyPlace(altitude, azimuth) {
  const east = Math.sin(azimuth * RAD) * Math.cos(altitude * RAD);
  const x = 50 - 44 * east;
  const y = altitude >= 0
    ? HORIZON_Y - 62 * (1 - Math.exp(-altitude / 28))
    : HORIZON_Y - 62 * altitude / 28;
  return { x, y };
}

/**
 * Keep a body out from behind the clock line and the Time Machine (WP11): a disc that would overlap `box` (the union of their
 * rectangles, in px relative to the scene) is lowered to just under it, easing in over 140 px of horizontal approach so the
 * body glides rather than jumps as it crosses. `x`, `y` are the centre in % of the scene, `half` the radius in px,
 * `scene` is { w, h } in px. Returns the new y in %.
 */
export function keepClear(x, y, half, box, scene, ramp = 140) {
  if (!box || !(scene.w > 0 && scene.h > 0)) return y;
  const cx = x / 100 * scene.w, cy = y / 100 * scene.h;
  const floor = box.bottom + half + 4;
  if (cy >= floor) return y;
  const d = Math.max(0, box.left - half - cx, cx - (box.right + half));
  const w = Math.min(1, Math.max(0, 1 - d / ramp));
  return (cy + (floor - cy) * w) / scene.h * 100;
}

/** Sun disc colour: deep orange at the horizon, buttery yellow overhead (flat, no gradient). */
export function sunColors(alt) {
  const k = Math.min(1, Math.max(0, alt / 30));
  const mix = (a, b) => Math.round(a + (b - a) * k);
  return {
    disc: `rgb(${mix(244, 255)}, ${mix(120, 214)}, ${mix(54, 110)})`,
    ring: `rgb(${mix(236, 255)}, ${mix(100, 190)}, ${mix(50, 96)})`
  };
}

export function initBodies() {
  const sun = $("sun"), moon = $("moon"), moonLit = $("moon-lit");
  let last = null;
  // the clock line and the Time Machine, as one box relative to the scene (null when the page has neither, as on the 404)
  function barBox() {
    const scene = (sun || moon)?.parentElement, parts = document.querySelectorAll(".skybar > *");
    if (!scene || !parts.length) return null;
    const sr = scene.getBoundingClientRect();
    let box = null;
    for (const el of parts) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      box = box ? { left: Math.min(box.left, r.left), right: Math.max(box.right, r.right), bottom: Math.max(box.bottom, r.bottom) } : { left: r.left, right: r.right, bottom: r.bottom };
    }
    return box && { box: { left: box.left - sr.left, right: box.right - sr.left, bottom: box.bottom - sr.top }, scene: { w: sr.width, h: sr.height } };
  }
  const clear = (el, x, y, size = 1) => {
    const b = barBox();
    return b ? keepClear(x, y, parseFloat(getComputedStyle(el).width) * size / 2 || 0, b.box, b.scene) : y;
  };
  const self = {
    /** sky: {sun:{altitude,azimuth}, moon:{altitude,azimuth}, phase, palette} */
    update(arg) {
      last = arg;
      const { sun: s, moon: m, phase, palette } = arg;
      if (sun) {
        const place = bodyPlace(s.altitude, s.azimuth), x = place.x;
        const size = 1 + .22 * (1 - Math.min(1, Math.max(0, s.altitude / 25)));
        const y = clear(sun, x, place.y, size);
        const horizon = Math.min(1, Math.max(0, (s.altitude + 6) / 6)); // fades out as it drops behind the sea
        const c = sunColors(s.altitude);
        sun.style.cssText = `left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;opacity:${horizon.toFixed(3)};transform:translate(-50%,-50%) scale(${size.toFixed(3)});--sun-disc:${c.disc};--sun-ring:${c.ring}`;
      }
      if (moon) {
        const place = bodyPlace(m.altitude, m.azimuth), x = place.x, y = clear(moon, x, place.y);
        const rise = Math.min(1, Math.max(0, (m.altitude + 2) / 6));
        // by day the moon is pale, and a thin crescent all but vanishes into the blue
        const lit = (1 - Math.cos(2 * Math.PI * phase)) / 2;
        const op = rise * (1 - palette.day * (1 - Math.min(1, lit * 1.3) * .55));
        moon.style.cssText = `left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;opacity:${op.toFixed(3)};transform:translate(-50%,-50%)`;
        moon.dataset.up = op > .02 ? "1" : "0";
      }
      if (moonLit) moonLit.setAttribute("d", moonLitPath(phase));
    }
  };
  // a turned phone or a resized window moves the bar: place the bodies again
  let timer = 0;
  addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(() => last && self.update(last), 150); });
  return self;
}

/** Kept for main.js: draws the moon's phase once; the sky engine keeps it up to date afterwards. */
export function initMoon(clock) {
  const moonLit = $("moon-lit");
  if (moonLit) moonLit.setAttribute("d", moonLitPath(currentMoonPhase(clock.now())));
}
