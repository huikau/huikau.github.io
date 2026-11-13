// The land: far ridge, near ridge with a Lēʻahi-like profile, palms and a strip of shoreline, drawn as one
// flat-fill SVG. The geometry is deterministic (seeded), so the island looks the same on every visit.
// Colours are not in the SVG: css/scene.css tints each layer from the live sky tokens (--haze, --sky-horizon)
// and from --lit, which this module keeps current from the sun's altitude (0 at night, 1 in full day).
import { $ } from "../core/dom.js";

export const VIEW = { w: 1440, h: 420 };

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };

/** 0 at night, 1 in full daylight, about .5 as the sun touches the horizon. Drives how dark the land reads. */
export const litFromAltitude = (alt) => smooth((alt + 10) / 20);

/** How strongly the logo's cream sticker keyline shows: full from dusk through night, gone by midmorning. */
export const stickerFromAltitude = (alt) => clamp((5 - alt) / 9);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(seed) {
  const r = mulberry32(seed);
  const t = Array.from({ length: 512 }, r);
  return (x) => {
    const i = Math.floor(x), u = smooth(x - i);
    const a = t[((i % 512) + 512) % 512], b = t[(((i + 1) % 512) + 512) % 512];
    return a + (b - a) * u;
  };
}

const gauss = (x, c, s) => Math.exp(-(((x - c) / s) ** 2));
const f1 = (n) => n.toFixed(1);

/** y of the far ridge (the long Koʻolau pali) at x. It sinks toward the right so the sun can set behind open water. */
export function farRidgeY(x, noise = makeNoise(11)) {
  const ridged = 1 - Math.abs(2 * noise(x / 120) - 1);
  const taper = 1 - .72 * smooth((x - 1000) / 440);
  const mass = .55 + .45 * gauss(x, 250, 360) + .3 * gauss(x, 880, 260);
  const rough = noise(x / 31 + 40) - .5;
  return 278 - taper * (30 * mass * ridged + 36 * mass * noise(x / 260 + 7)) + rough * 7;
}

/** y of the near ridge: rolling hills, a Lēʻahi-like cone at x=660 (long gentle west flank, steep seaward face), low shore hills. */
export function nearRidgeY(x, noise = makeNoise(23)) {
  const d = x - 660;
  const cone = d < 0 ? gauss(x, 660, 215) : gauss(x, 660, 92);
  const crater = 15 * gauss(x, 694, 17) - 9 * gauss(x, 646, 12); // the rim: a dip, then a lower shoulder
  const hills = 30 * gauss(x, 130, 230) + 22 * gauss(x, 1010, 170) + 12 * gauss(x, 1320, 90);
  const rough = (noise(x / 26) - .5) * 5 + (noise(x / 80 + 9) - .5) * 14;
  return 326 - 154 * Math.pow(cone, 1.18) - hills + crater + rough;
}

/** Sample a height function every `step` px across the view. */
export function sampleRidge(fn, step = 8) {
  const pts = [];
  for (let x = -step; x <= VIEW.w + step; x += step) pts.push([x, fn(x)]);
  return pts;
}

/** A closed filled path under the polyline, running down to the bottom of the view. */
export function pathUnder(pts, bottom = VIEW.h) {
  const [x0] = pts[0], [x1] = pts.at(-1);
  return `M${f1(x0)} ${bottom}L${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join("L")}L${f1(x1)} ${bottom}Z`;
}

/** The ridge line alone (for the keyline stroke). */
export const lineOf = (pts) => `M${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join("L")}`;

/** A band that follows a ridge: its top is the ridge, its bottom is the ridge pushed down by `drop(x)`. Used for the second tone. */
export function bandBelow(pts, x0, x1, drop) {
  const top = pts.filter(([x]) => x >= x0 && x <= x1);
  const bot = top.map(([x, y]) => [x, y + drop(x)]).reverse();
  return `M${top.map(([x, y]) => `${f1(x)} ${f1(y)}`).join("L")}L${bot.map(([x, y]) => `${f1(x)} ${f1(y)}`).join("L")}Z`;
}

/** Short dry-brush streaks scattered inside a ridge, as a single path of tiny horizontal dashes. */
export function streaks(fn, rng, { count, xMin = 0, xMax = VIEW.w, depth = [10, 70], len = [14, 56] }) {
  let d = "";
  for (let i = 0; i < count; i++) {
    const x = xMin + rng() * (xMax - xMin);
    const y = fn(x) + depth[0] + rng() * (depth[1] - depth[0]);
    const l = len[0] + rng() * (len[1] - len[0]);
    d += `M${f1(x)} ${f1(y)}h${f1(l)}`;
  }
  return d;
}

/** One palm: a tapered, leaning trunk and a crown of crescent fronds (alternating darker back and lighter front sets). */
export function palm(x, y, h, lean, rng) {
  const cx = x + lean, cy = y - h;
  const bx = x + lean * .35, by = y - h * .55; // the trunk bows toward its lean
  const trunk = `M${f1(x - 3.2)} ${f1(y)}Q${f1(bx - 3)} ${f1(by)} ${f1(cx - 1.4)} ${f1(cy)}L${f1(cx + 1.4)} ${f1(cy)}Q${f1(bx + 3)} ${f1(by)} ${f1(x + 3.2)} ${f1(y)}Z`;
  let back = "", front = "";
  const n = 9;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    // fan from just above the left horizon, over the top, to just above the right
    const a = Math.PI + .1 + t * (Math.PI - .2) + (rng() - .5) * .22;
    const len = h * (.3 + rng() * .14) * (1 - .22 * Math.abs(t - .5) * 2);
    const k = a < Math.PI * 1.5 ? -1 : 1; // which way is "down" in this frond's own frame
    const c = Math.cos(a), s = Math.sin(a);
    const p = (u, v) => `${f1(cx + u * c - v * s)} ${f1(cy + u * s + v * c)}`;
    const d = `M${p(0, 0)}Q${p(len * .5, -k * len * .2)} ${p(len, k * len * .2)}Q${p(len * .55, -k * len * .02)} ${p(0, 0)}Z`;
    if (i % 2 === 0) back += d; else front += d;
  }
  return { trunk, back, front };
}

/** The hand-placed palms: [x, base y, height, lean, scale group]. Some stand in clusters, as they do on a beach. */
const PALMS = [
  [58, 352, 92, 14], [96, 354, 118, -10], [138, 351, 80, 12],
  [452, 349, 76, 10], [488, 351, 98, -12], [562, 353, 84, -8], [598, 354, 102, 10],
  [800, 350, 84, -8], [838, 352, 106, 10], [872, 350, 70, -6],
  [1392, 353, 104, -10], [1424, 351, 78, 8]
];

/** Build the land SVG markup. */
export function buildLandSvg() {
  const farN = makeNoise(11), nearN = makeNoise(23);
  const far = sampleRidge((x) => farRidgeY(x, farN));
  const near = sampleRidge((x) => nearRidgeY(x, nearN));
  const rng = mulberry32(5);

  const farStreaks = streaks((x) => farRidgeY(x, farN), rng, { count: 70, depth: [8, 44], len: [18, 70] });
  // shade: the east (right-hand) flank of each hill gets the second tone, as a band that follows the ridge
  const nearShade = bandBelow(near, 668, 840, (x) => 18 + 70 * smooth((x - 668) / 70) * (1 - smooth((x - 760) / 80)))
    + bandBelow(near, 40, 300, (x) => 14 + 22 * gauss(x, 160, 70))
    + bandBelow(near, 940, 1130, (x) => 12 + 24 * gauss(x, 1040, 60))
    + bandBelow(near, 566, 660, (x) => 6 + 30 * smooth((x - 566) / 94));
  const nearStreaks = streaks((x) => nearRidgeY(x, nearN), rng, { count: 120, depth: [10, 58], len: [12, 48] });

  const sandPts = sampleRidge((x) => 349 + 5 * Math.sin(x / 90) + 4 * (nearN(x / 40 + 3) - .5), 12);
  const sandStreaks = streaks((x) => 349 + 5 * Math.sin(x / 90), rng, { count: 40, depth: [8, 36], len: [10, 40] });

  let palmBack = "", palmFront = "", trunks = "";
  const prng = mulberry32(9);
  for (const [x, y, h, lean] of PALMS) {
    const p = palm(x, y, h, lean, prng);
    trunks += p.trunk;
    palmBack += p.back;
    palmFront += p.front;
  }

  return `<svg class="land-svg" viewBox="0 0 ${VIEW.w} ${VIEW.h}" preserveAspectRatio="xMidYMax meet" focusable="false">
  <path class="land-far" d="${pathUnder(far)}"/>
  <path class="land-far-hi" d="${farStreaks}"/>
  <path class="land-far-key" d="${lineOf(far)}"/>
  <path class="land-near" d="${pathUnder(near)}"/>
  <path class="land-near-shade" d="${nearShade}"/>
  <path class="land-near-hi" d="${nearStreaks}"/>
  <path class="land-near-key" d="${lineOf(near)}"/>
  <path class="land-sand" d="${pathUnder(sandPts)}"/>
  <path class="land-sand-hi" d="${sandStreaks}"/>
  <path class="land-sand-key" d="${lineOf(sandPts)}"/>
  <path class="palm-trunk" d="${trunks}"/>
  <path class="palm-leaf palm-leaf-back" d="${palmBack}"/>
  <path class="palm-leaf palm-leaf-front" d="${palmFront}"/>
</svg>`;
}

/** Mounts the land into #land and keeps --lit (on the land) and --sticker-a (on the logo) in step with the sun. */
export function initLand({ bus }) {
  const el = $("land");
  if (!el) return null;
  el.innerHTML = buildLandSvg();
  const logoWrap = document.querySelector(".logo-wrap");
  const apply = (alt) => {
    el.style.setProperty("--lit", litFromAltitude(alt).toFixed(3));
    if (logoWrap) logoWrap.style.setProperty("--sticker-a", stickerFromAltitude(alt).toFixed(3));
  };
  bus.on("sky", ({ altitude }) => apply(altitude));
  return { el, apply };
}
