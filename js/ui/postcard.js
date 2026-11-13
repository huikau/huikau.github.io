// Send a postcard (WP10). Redraws the live scene onto a 1200 x 1500 canvas from the same sources the page uses:
// the sky colours (the --sky-* custom properties), the sun and moon where they are right now, the land and the canoe
// (the live SVG, serialised with its computed colours), the water, the logo and Ula's portrait (same-origin images, so the
// canvas is never tainted), a few of the species in the basket, then a cream card with a stamp, a postmark showing the
// Honolulu time and weather, and "Wish you were here — huikau.com" in Caprasimo. Text is drawn on the canvas (not inside
// SVG-as-image, where page fonts are not available).
import { $ } from "../core/dom.js";
import { store } from "../core/store.js";
import { clockTime } from "../core/clock.js";
import { speciesById } from "../data/species.js";
import { fishSVG } from "../game/fishart.js";
import { nearRidgeY, VIEW } from "../scene/land.js";

export const W = 1200, H = 1500;
export const FILE_NAME = "huikau-postcard.png";
export const SHARE_TEXT = "Wish you were here — huikau.com";
export const SHARE_URL = "https://huikau.com/";
const PIC = { x: 64, y: 64, w: 1072, h: 900 };
const HORIZON = 0.72; // where the sea meets the sky, as a share of the picture height (same as the page)

const INK = "#0B2226", SAND = "#F7EEDB", CREAM = "#FBF3DF", SUNSET = "#E8662A", LAUHALA = "#C49C5E", HIBISCUS = "#D8456B", LAGOON = "#1E6E78";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ---------- pure helpers (unit-tested) ----------

/** The words on the card, from the clock fields (Honolulu) and the shared weather object. */
export function postcardInfo(clock, weather = {}) {
  const f = clock.fields(), time = clockTime(f.minutes);
  const wx = weather.status === "none" ? "" : (weather.text || "").trim();
  return {
    dateLine: `${DAYS[f.dow]}, ${MONTHS[f.month - 1]} ${f.day}, ${f.year}`,
    stampDate: `${MONTHS[f.month - 1].slice(0, 3).toUpperCase()} ${f.day} ${f.year}`,
    time, timeUpper: time.toUpperCase(),
    weatherLine: wx,
    postmarkWeather: postmarkWeather(wx)
  };
}

/** Upper-case, trimmed to what fits round the bottom of the postmark. */
export function postmarkWeather(text, max = 20) {
  const t = String(text || "").toUpperCase().replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > 8 ? cut.slice(0, sp) : cut).replace(/[ ,]+$/, "");
}

/** The caught species to show on the card: fish and creatures only (never a visitor), most recent last, at most `limit`. */
export function pickCatches(ids, limit = 6) {
  const seen = new Set(), out = [];
  for (const id of ids || []) {
    const s = speciesById[id];
    if (!s || seen.has(id) || (s.kind !== "fish" && s.kind !== "creature") || s.rarity === "visitor") continue;
    seen.add(id);
    out.push(s);
  }
  return out.slice(-limit);
}

/** Greedy word wrap with a measuring function. */
export function wrapLines(measure, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > maxWidth) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Angles (radians, 0 = straight up, clockwise) for each glyph of `text` set on a circle of `radius`, centred on `center`. */
export function arcAngles(text, measure, radius, center = 0, dir = 1) {
  const widths = [...text].map((c) => measure(c));
  const total = widths.reduce((a, b) => a + b, 0);
  let pos = -total / 2;
  return [...text].map((ch, i) => {
    const mid = pos + widths[i] / 2;
    pos += widths[i];
    return { ch, angle: center + dir * mid / radius };
  });
}

const mulberry = (seed) => () => {
  seed = (seed + 0x6D2B79F5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---------- browser drawing ----------

const loadImage = (src) => new Promise((ok, no) => {
  const i = new Image();
  i.decoding = "async";
  i.onload = () => ok(i);
  i.onerror = () => no(new Error(`could not load ${String(src).slice(0, 60)}`));
  i.src = src;
});
const svgUrl = (xml) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);

const PROPS = ["fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-opacity", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "opacity", "display", "visibility"];

/** Serialise a live SVG with its computed colours inlined (an SVG used as an image cannot see the page's CSS). */
async function svgToImage(svg, width, height, viewBox) {
  const clone = svg.cloneNode(true);
  const from = [svg, ...svg.querySelectorAll("*")], to = [clone, ...clone.querySelectorAll("*")];
  from.forEach((el, i) => {
    const cs = getComputedStyle(el);
    let s = PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";");
    const tf = cs.transform;
    if (el !== svg && tf && tf !== "none") s += `;transform:${tf}`;
    to[i].setAttribute("style", s);
    to[i].removeAttribute("class");
  });
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", width);
  clone.setAttribute("height", height);
  clone.setAttribute("style", "overflow:visible");
  if (viewBox) clone.setAttribute("viewBox", viewBox);
  clone.querySelectorAll("animate, style, script").forEach((n) => n.remove());
  return loadImage(svgUrl(new XMLSerializer().serializeToString(clone)));
}

function colorResolver() {
  const probe = document.createElement("span");
  probe.style.display = "none";
  document.body.append(probe);
  const fn = (v) => { probe.style.color = ""; probe.style.color = v; return getComputedStyle(probe).color || v; };
  fn.done = () => probe.remove();
  return fn;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function cloudPuff(ctx, x, y, s, c) {
  const puffs = [[0, 0, 46], [52, -14, 56], [112, 0, 48], [60, 12, 60]];
  const paint = (dx, dy, fill, alpha = 1) => {
    ctx.fillStyle = fill;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    for (const [px, py, r] of puffs) { ctx.moveTo(x + (px + dx) * s + r * s, y + (py + dy) * s); ctx.arc(x + (px + dx) * s, y + (py + dy) * s, r * s, 0, Math.PI * 2); }
    ctx.fill();
  };
  paint(3, 7, INK, .5);
  paint(0, 4, c.shade);
  paint(0, 0, c.body);
  paint(-7, -9, c.hi);
  ctx.globalAlpha = 1;
}

function drawSky(ctx, P, cs, resolve) {
  const sea = P.h * HORIZON;
  const g = ctx.createLinearGradient(0, 0, 0, sea);
  g.addColorStop(0, resolve(cs.getPropertyValue("--sky-top")));
  g.addColorStop(.58, resolve(cs.getPropertyValue("--sky-mid")));
  g.addColorStop(1, resolve(cs.getPropertyValue("--sky-horizon")));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, P.w, P.h);
  const sunEl = $("sun");
  const place = (el) => ({
    x: (parseFloat(el.style.left) || 50) / 100 * P.w, y: (parseFloat(el.style.top) || 60) / 100 * P.h,
    op: el.style.opacity === "" ? 1 : parseFloat(el.style.opacity)
  });
  // the glow follows the sun (the page's own radial gradient, as ellipse)
  if (sunEl) {
    const s = place(sunEl);
    const glow = resolve(cs.getPropertyValue("--sun-glow-soft") || "rgba(255,162,92,.5)");
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(1.6, .9);
    const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, P.w * .34);
    rg.addColorStop(0, glow);
    rg.addColorStop(1, "rgba(255,162,92,0)");
    ctx.fillStyle = rg;
    ctx.globalAlpha = Math.max(0, Math.min(1, s.op * 1.2));
    ctx.fillRect(-P.w, -P.h, P.w * 2, P.h * 2);
    ctx.restore();
  }
  return { sea, place };
}

function drawStars(ctx, P, sea) {
  const el = $("stars");
  const a = el ? parseFloat(el.style.opacity) : 0;
  if (!(a > .03)) return;
  const r = mulberry(0x57a2);
  ctx.fillStyle = "#EEF2FF";
  for (let i = 0; i < 170; i++) {
    const x = r() * P.w, y = r() * sea * .86, big = r() < .12;
    ctx.globalAlpha = Math.min(1, a) * (.45 + r() * .55);
    ctx.beginPath();
    ctx.arc(x, y, big ? 2.4 : 1.2 + r() * .6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBodies(ctx, P, { place }, resolve) {
  const sunEl = $("sun"), moonEl = $("moon");
  if (moonEl && moonEl.dataset.up === "1") {
    const m = place(moonEl), box = P.w * .06;
    const lit = $("moon-lit")?.getAttribute("d");
    ctx.save();
    ctx.translate(m.x - box / 2, m.y - box / 2);
    ctx.scale(box / 54, box / 54);
    ctx.globalAlpha = Math.max(.25, Math.min(1, m.op));
    ctx.fillStyle = resolve(getComputedStyle(document.documentElement).getPropertyValue("--sky-mid"));
    ctx.beginPath(); ctx.arc(27, 27, 24, 0, Math.PI * 2); ctx.fill();
    if (lit) { ctx.fillStyle = "#FBF7E6"; ctx.fill(new Path2D(lit)); }
    ctx.lineWidth = 2; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.arc(27, 27, 24, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  if (sunEl) {
    const s = place(sunEl);
    if (s.op > .02) {
      const scale = parseFloat((/scale\(([\d.]+)\)/.exec(sunEl.style.transform) || [])[1]) || 1;
      const box = P.w * .095 * scale, k = box / 100;
      const css = getComputedStyle(sunEl);
      const disc = resolve(css.getPropertyValue("--sun-disc") || "#F5A04A"), ring = resolve(css.getPropertyValue("--sun-ring") || "#EC8A3E");
      ctx.save();
      ctx.globalAlpha = s.op;
      const dot = (r, fill, alpha, stroke) => {
        ctx.globalAlpha = s.op * alpha;
        ctx.fillStyle = fill;
        ctx.beginPath(); ctx.arc(s.x, s.y, r * k, 0, Math.PI * 2); ctx.fill();
        if (stroke) { ctx.globalAlpha = s.op; ctx.lineWidth = 2.4 * k; ctx.strokeStyle = INK; ctx.stroke(); }
      };
      dot(49, ring, .2); dot(38, ring, .42); dot(28, disc, 1, true);
      ctx.restore();
    }
  }
}

function drawClouds(ctx, P, sea, weather) {
  const level = Math.max(0, Math.min(4, weather.clouds | 0));
  const n = [0, 1, 3, 4, 6][level];
  if (!n) return;
  const el = $("clouds");
  const cs = el ? el.style : { getPropertyValue: () => "" };
  const colors = {
    hi: cs.getPropertyValue("--cloud-hi") || "#FFE9D0", body: cs.getPropertyValue("--cloud-body") || "#D8C0B8", shade: cs.getPropertyValue("--cloud-shade") || "#6D6A92"
  };
  const r = mulberry(0xc10d);
  const spots = [[.08, .13, 1.15], [.62, .08, 1.0], [.84, .24, .85], [.28, .3, .8], [.5, .22, 1.2], [.9, .09, .75]];
  for (let i = 0; i < n; i++) {
    const [fx, fy, s] = spots[i];
    cloudPuff(ctx, fx * P.w, fy * sea + r() * 10, s * .85, colors);
  }
}

function drawRain(ctx, P, sea) {
  const r = mulberry(0x2a1d);
  ctx.strokeStyle = "rgba(235,245,255,.42)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 260; i++) {
    const x = r() * P.w, y = r() * P.h * .8, l = 22 + r() * 26;
    ctx.moveTo(x, y); ctx.lineTo(x - l * .22, y + l);
  }
  ctx.stroke();
}

async function drawLand(ctx, P, sea) {
  const svg = document.querySelector("#land .land-svg");
  if (!svg) return;
  // wider than the picture (the page's land is 100% wide of a landscape hero), centred so Lēʻahi sits left of the middle
  const w = P.w * 1.3, h = w * VIEW.h / VIEW.w, x = P.w * .4 - w * (660 / VIEW.w);
  const img = await svgToImage(svg, w, h);
  ctx.drawImage(img, x, P.h * .83 - h, w, h);
}

async function drawLogo(ctx, P) {
  const el = document.querySelector(".logo-wrap img.logo:not(.logo-halo)");
  if (!el) return;
  const img = await loadImage(el.currentSrc || el.src);
  const w = P.w * .74, h = w * img.naturalHeight / img.naturalWidth, x = (P.w - w) / 2, y = 96;
  const a = parseFloat(document.querySelector(".logo-wrap")?.style.getPropertyValue("--sticker-a")) || 0;
  if (a > .12) {
    // the night sticker: a cream keyline with a thin ink line outside it, cut from the logo's own alpha
    const ring = (radius, color) => {
      const c = document.createElement("canvas");
      c.width = Math.ceil(w + radius * 4); c.height = Math.ceil(h + radius * 4);
      const x2 = c.getContext("2d");
      for (let k = 0; k < 20; k++) { const t = k / 20 * Math.PI * 2; x2.drawImage(img, radius * 2 + Math.cos(t) * radius, radius * 2 + Math.sin(t) * radius, w, h); }
      x2.globalCompositeOperation = "source-in";
      x2.fillStyle = color; x2.fillRect(0, 0, c.width, c.height);
      return c;
    };
    ctx.save();
    ctx.globalAlpha = a;
    ctx.drawImage(ring(9, INK), x - 18, y - 18);
    ctx.drawImage(ring(6, "#FBF3DF"), x - 12, y - 12);
    ctx.restore();
  }
  ctx.save();
  ctx.shadowColor = "rgba(11,34,38,.25)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

function drawSea(ctx, P, sea, resolve) {
  const seaH = P.h - sea;
  const css = getComputedStyle(document.querySelector(".sea") || document.documentElement);
  const base = resolve(css.getPropertyValue("--sea-back") || LAGOON);
  const bands = [["back", "--sea-back", 1], ["mid", "--sea-mid", .78], ["front", "--sea-front", .52]];
  ctx.fillStyle = base;
  for (const [name, v, share] of bands) {
    const d = document.querySelector(`.wave.${name} .w-fill`)?.getAttribute("d");
    const bandH = seaH * share;
    const m = new DOMMatrix([P.w / 1440, 0, 0, bandH / 200, 0, P.h - bandH]);
    const fill = new Path2D();
    const fallback = `M0 40 ${Array.from({ length: 12 }, (_, i) => `Q${i * 240 + 120} ${i % 2 ? 62 : 18} ${i * 240 + 240} 40`).join(" ")} V200 H0 Z`;
    fill.addPath(new Path2D(d || fallback), m);
    ctx.fillStyle = resolve(css.getPropertyValue(v) || LAGOON);
    ctx.fill(fill);
    // crest: foam on the back wave, ink on the others
    const crest = new Path2D(((d || fallback).replace(/V200.*$/, "")));
    const line = new Path2D(); line.addPath(crest, m);
    ctx.lineJoin = "round";
    ctx.lineWidth = name === "back" ? 2 : 3; ctx.strokeStyle = name === "back" ? "rgba(191,229,238,.55)" : INK;
    ctx.stroke(line);
    if (name !== "back") {
      const foam = new Path2D(); foam.addPath(crest, new DOMMatrix([P.w / 1440, 0, 0, bandH / 200, 0, P.h - bandH + 8]));
      ctx.setLineDash([70, 130, 26, 90, 44, 160]);
      ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.strokeStyle = "rgba(191,229,238,.75)";
      ctx.stroke(foam);
      ctx.setLineDash([]);
    }
  }
}

async function drawCanoe(ctx, P) {
  const svg = $("canoe"), portrait = $("ula");
  if (!svg) return;
  const s = 1.8, ox = 44, oy = 508;
  const img = await svgToImage(svg, 400 * s, 205 * s, "-40 -14 400 205");
  ctx.drawImage(img, ox - 40 * s, oy - 14 * s, 400 * s, 205 * s);
  // the float
  const bx = ox + 285 * s, by = oy + 92 * s;
  ctx.lineWidth = 3; ctx.strokeStyle = INK;
  ctx.beginPath(); ctx.ellipse(bx, by + 8, 14, 18, 0, 0, Math.PI * 2); ctx.fillStyle = SAND; ctx.fill(); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.ellipse(bx, by + 8, 14, 18, 0, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = SUNSET; ctx.fillRect(bx - 16, by - 12, 32, 18); ctx.restore();
  ctx.beginPath(); ctx.ellipse(bx, by + 8, 14, 18, 0, 0, Math.PI * 2); ctx.stroke();
  // Ula in her lauhala-rimmed frame (108 px box in the page; here scaled)
  const fx = ox + 6 * s, fy = oy + 18 * s, c = 54 * s;
  const cx = fx + c, cy = fy + c;
  ctx.fillStyle = LAUHALA; ctx.strokeStyle = INK; ctx.lineWidth = 3 * s;
  ctx.beginPath(); ctx.arc(cx, cy, 52 * s, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 52 * s, 0, Math.PI * 2); ctx.clip();
  ctx.strokeStyle = "rgba(11,34,38,.35)"; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let k = -200; k < 200; k += 9 * s) { ctx.moveTo(cx + k - 60, cy - 60); ctx.lineTo(cx + k + 60, cy + 60); ctx.moveTo(cx + k + 60, cy - 60); ctx.lineTo(cx + k - 60, cy + 60); }
  ctx.stroke(); ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 3 * s;
  ctx.beginPath(); ctx.arc(cx, cy, 52 * s, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 42 * s, 0, Math.PI * 2); ctx.stroke();
  if (portrait) {
    const pi = await loadImage(portrait.currentSrc || portrait.src);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 42 * s, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(pi, cx - 42 * s, cy - 42 * s, 84 * s, 84 * s);
    ctx.restore();
  }
  ctx.font = "600 27px Caprasimo, Georgia, serif";
  ctx.fillStyle = SAND; ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineJoin = "round";
  ctx.strokeText("Captain Ula", ox + 10 * s, oy + 142 * s + 40);
  ctx.fillText("Captain Ula", ox + 10 * s, oy + 142 * s + 40);
}

async function drawCatches(ctx, P, sea, species) {
  if (!species.length) return;
  const size = 112, top = sea + (P.h - sea) * .64, left = 400;
  const slot = (P.w - left - 50) / species.length;
  for (let i = 0; i < species.length; i++) {
    const img = await loadImage(svgUrl(fishSVG(species[i], { size })));
    const x = left + slot * i + (slot - size) / 2, y = top + (i % 2 ? 14 : -6);
    ctx.save();
    if (i % 2) { ctx.translate(x + size, 0); ctx.scale(-1, 1); ctx.drawImage(img, 0, y, size, size * 2 / 3); }
    else ctx.drawImage(img, x, y, size, size * 2 / 3);
    ctx.restore();
  }
}

/** The picture window: sky, bodies, land, logo, sea, canoe, catches. */
async function drawPicture(ctx, { weather }, species, resolve) {
  const P = PIC;
  const cs = getComputedStyle(document.documentElement);
  ctx.save();
  ctx.translate(P.x, P.y);
  ctx.beginPath(); ctx.rect(0, 0, P.w, P.h); ctx.clip();
  const sky = drawSky(ctx, P, cs, resolve);
  drawStars(ctx, P, sky.sea);
  drawBodies(ctx, P, sky, resolve);
  drawClouds(ctx, P, sky.sea, weather);
  await drawLand(ctx, P, sky.sea);
  await drawLogo(ctx, P);
  drawSea(ctx, P, sky.sea, resolve);
  await drawCanoe(ctx, P);
  await drawCatches(ctx, P, sky.sea, species);
  if (weather.rain) drawRain(ctx, P, sky.sea);
  ctx.restore();
  ctx.lineWidth = 6; ctx.strokeStyle = INK;
  roundRect(ctx, P.x, P.y, P.w, P.h, 4); ctx.stroke();
}

/** Airmail stripes round the edge of the card. */
function drawBorder(ctx) {
  const tile = document.createElement("canvas");
  tile.width = tile.height = 56;
  const t = tile.getContext("2d");
  t.fillStyle = CREAM; t.fillRect(0, 0, 56, 56);
  t.save(); t.translate(28, 28); t.rotate(-Math.PI / 4);
  t.fillStyle = HIBISCUS; t.fillRect(-60, -28, 120, 14);
  t.fillStyle = LAGOON; t.fillRect(-60, 0, 120, 14);
  t.restore();
  ctx.save();
  ctx.beginPath(); ctx.rect(14, 14, W - 28, H - 28); ctx.rect(36, 36, W - 72, H - 72);
  ctx.clip("evenodd");
  ctx.fillStyle = ctx.createPattern(tile, "repeat");
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  ctx.lineWidth = 3; ctx.strokeStyle = INK;
  ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.strokeRect(36, 36, W - 72, H - 72);
}

/** A perforated stamp, drawn off screen so the holes show the card behind it. */
function makeStamp(sw, sh, cs, resolve, info) {
  const pad = 14, c = document.createElement("canvas");
  c.width = sw + pad * 2; c.height = sh + pad * 2;
  const x = c.getContext("2d");
  x.translate(pad, pad);
  x.fillStyle = CREAM; x.fillRect(0, 0, sw, sh);
  // the picture on the stamp: today's sky, the Lēʻahi ridge, a strip of sea
  const ax = 16, ay = 16, aw = sw - 32, ah = sh - 32;
  x.save(); x.beginPath(); x.rect(ax, ay, aw, ah); x.clip();
  const g = x.createLinearGradient(0, ay, 0, ay + ah);
  g.addColorStop(0, resolve(cs.getPropertyValue("--sky-top"))); g.addColorStop(.6, resolve(cs.getPropertyValue("--sky-mid"))); g.addColorStop(1, resolve(cs.getPropertyValue("--sky-horizon")));
  x.fillStyle = g; x.fillRect(ax, ay, aw, ah);
  x.fillStyle = "#F5A04A"; x.strokeStyle = INK; x.lineWidth = 2;
  x.beginPath(); x.arc(ax + aw * .78, ay + ah * .38, 14, 0, Math.PI * 2); x.fill(); x.stroke();
  const x0 = 360, x1 = 1000, sx = aw / (x1 - x0), base = ay + ah * .8;
  x.beginPath(); x.moveTo(ax, base);
  for (let v = x0; v <= x1; v += 8) x.lineTo(ax + (v - x0) * sx, base - (326 - nearRidgeY(v)) * sx * 1.7);
  x.lineTo(ax + aw, base); x.closePath();
  x.fillStyle = "#2D6C55"; x.fill(); x.lineWidth = 2.4; x.stroke();
  x.fillStyle = LAGOON; x.fillRect(ax, base, aw, ah);
  x.strokeStyle = "rgba(191,229,238,.8)"; x.lineWidth = 2.5; x.lineCap = "round";
  for (let r = 0; r < 3; r++) { x.beginPath(); for (let v = 0; v <= aw; v += 6) x.lineTo(ax + v, base + 12 + r * 14 + Math.sin(v / 9 + r) * 3); x.stroke(); }
  x.restore();
  x.lineWidth = 3; x.strokeStyle = INK; x.strokeRect(ax, ay, aw, ah);
  x.font = "400 34px Caprasimo, Georgia, serif"; x.textBaseline = "alphabetic"; x.lineJoin = "round";
  x.strokeStyle = INK; x.lineWidth = 6; x.fillStyle = CREAM;
  x.strokeText("Huikau", ax + 10, ay + 40); x.fillText("Huikau", ax + 10, ay + 40);
  x.font = "400 24px Caprasimo, Georgia, serif";
  x.strokeText("Aloha", ax + 10, ay + 70); x.fillText("Aloha", ax + 10, ay + 70);
  // perforations
  x.globalCompositeOperation = "destination-out";
  const hole = 7, step = 20;
  for (let px = step / 2; px < sw; px += step) { x.beginPath(); x.arc(px, 0, hole, 0, 7); x.arc(px, sh, hole, 0, 7); x.fill(); }
  for (let py = step / 2; py < sh; py += step) { x.beginPath(); x.arc(0, py, hole, 0, 7); x.arc(sw, py, hole, 0, 7); x.fill(); }
  return { canvas: c, pad };
}

function arcText(ctx, text, cx, cy, radius, center, dir, font) {
  ctx.font = font;
  const glyphs = arcAngles(text, (ch) => ctx.measureText(ch).width, radius, center, dir);
  for (const { ch, angle } of glyphs) {
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(angle);
    ctx.translate(0, -radius);
    if (dir < 0) ctx.rotate(Math.PI); // the bottom arc reads left to right with its tops toward the centre
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  }
}

function drawPostmark(ctx, cx, cy, r, info) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(-.2); ctx.translate(-cx, -cy);
  ctx.globalCompositeOperation = "multiply";
  ctx.strokeStyle = "rgba(14,43,70,.82)"; ctx.fillStyle = "rgba(14,43,70,.82)";
  ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, r - 12, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r - 62, 0, Math.PI * 2); ctx.stroke();
  arcText(ctx, "HONOLULU", cx, cy, r - 34, 0, 1, "700 27px Figtree, system-ui, sans-serif");
  if (info.postmarkWeather) arcText(ctx, info.postmarkWeather, cx, cy, r - 21, Math.PI, -1, "700 19px Figtree, system-ui, sans-serif");
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.font = "400 29px Caprasimo, Georgia, serif";
  ctx.fillText(info.timeUpper, cx, cy + 3);
  ctx.font = "700 16px Figtree, system-ui, sans-serif";
  ctx.fillText(info.stampDate, cx, cy + 27);
  // the cancellation waves
  ctx.lineWidth = 4; ctx.lineCap = "round";
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    const y0 = cy - 40 + k * 26;
    for (let v = 0; v <= 190; v += 5) { const px = cx + r - 6 + v, py = y0 + Math.sin(v / 13) * 6; v ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke();
  }
  ctx.restore();
}

function drawCaption(ctx, info) {
  const x = 96, maxW = 700;
  ctx.fillStyle = INK; ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  const fit = (text, size, family) => { let s = size; do { ctx.font = `${family.weight || 400} ${s}px ${family.name}`; s -= 2; } while (ctx.measureText(text).width > maxW && s > 20); };
  const cap = { name: "Caprasimo, Georgia, serif" };
  fit("Wish you were here —", 64, cap);
  ctx.fillText("Wish you were here —", x, 1088);
  ctx.fillStyle = SUNSET; ctx.strokeStyle = INK;
  fit("huikau.com", 108, cap);
  ctx.lineWidth = 2; ctx.strokeText("huikau.com", x, 1196); ctx.fillText("huikau.com", x, 1196);
  ctx.fillStyle = INK;
  ctx.font = "700 36px Figtree, system-ui, sans-serif";
  ctx.fillText(info.dateLine, x, 1278);
  ctx.font = "600 31px Figtree, system-ui, sans-serif";
  ctx.fillStyle = "#24464B";
  ctx.fillText(`${info.time} in Honolulu, Oʻahu`, x, 1326);
  let y = 1326;
  if (info.weatherLine) for (const line of wrapLines((s) => ctx.measureText(s).width, info.weatherLine, maxW).slice(0, 2)) { y += 44; ctx.fillText(line, x, y); }
}

/**
 * Paint the postcard. Resolves to a 1200 x 1500 canvas.
 * `deps`: { clock, weather, basketIds } (basketIds defaults to the saved basket).
 */
export async function renderPostcard({ clock, weather, basketIds } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  await Promise.all([
    document.fonts.load("400 64px Caprasimo", "Wish you were here — Oʻahu"),
    document.fonts.load("600 30px Figtree", "Honolulu Oʻahu 0123456789"),
    document.fonts.load("700 30px Figtree", "HONOLULU")
  ].map((p) => p.catch(() => null)));
  const resolve = colorResolver();
  try {
    const cs = getComputedStyle(document.documentElement);
    const info = postcardInfo(clock, weather);
    const species = pickCatches(basketIds ?? store.get("huikau-basket", store.get("huikau-tackle", [])));
    ctx.fillStyle = CREAM; ctx.fillRect(0, 0, W, H);
    drawBorder(ctx);
    ctx.fillStyle = SAND; ctx.fillRect(44, 44, W - 88, H - 88);
    await drawPicture(ctx, { weather }, species, resolve);
    // the back of the card: a divider, the message, the stamp, the postmark
    ctx.strokeStyle = "rgba(11,34,38,.4)"; ctx.lineWidth = 3; ctx.setLineDash([2, 10]); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(848, 1010); ctx.lineTo(848, 1420); ctx.stroke(); ctx.setLineDash([]);
    drawCaption(ctx, info);
    const stamp = makeStamp(216, 268, cs, resolve, info);
    ctx.save(); ctx.shadowColor = "rgba(11,34,38,.28)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
    ctx.translate(900, 1018); ctx.rotate(.025);
    ctx.drawImage(stamp.canvas, -stamp.pad, -stamp.pad);
    ctx.restore();
    drawPostmark(ctx, 930, 1296, 106, info);
    // paper grain over everything
    const r = mulberry(0x9a1);
    ctx.fillStyle = INK;
    for (let i = 0; i < 6000; i++) { ctx.globalAlpha = .02 + r() * .04; ctx.fillRect(r() * W, r() * H, 1.4, 1.4); }
    ctx.globalAlpha = 1;
  } finally { resolve.done(); }
  return canvas;
}

const toBlob = (canvas) => new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error("toBlob failed"))), "image/png"));

// ---------- the dialog ----------

export function initPostcard({ clock, bus, weather, bind = true } = {}) {
  const buttons = bind ? [...document.querySelectorAll("[data-postcard]")] : [];
  let dlg = null, url = "", blob = null, opener = null, token = 0;

  const els = {};
  function build() {
    dlg = document.createElement("dialog");
    dlg.className = "postcard-dialog paper-card";
    dlg.setAttribute("aria-labelledby", "postcard-title");
    dlg.innerHTML = `
      <h2 class="heading postcard-title" id="postcard-title">Your postcard</h2>
      <div class="postcard-stage">
        <img class="postcard-img" width="480" height="600" alt="Postcard preview: today's view from Ula's fishing spot, with a stamp, a Honolulu postmark and the words Wish you were here, huikau.com" hidden>
        <p class="postcard-wait" role="status">Painting the scene…</p>
      </div>
      <p class="postcard-status" role="status" aria-live="polite"></p>
      <div class="postcard-actions">
        <button class="btn" type="button" data-act="save" disabled>Save</button>
        <button class="btn btn--water" type="button" data-act="share" hidden>Share</button>
        <button class="btn btn--secondary" type="button" data-act="close">Close</button>
      </div>`;
    document.body.append(dlg);
    for (const k of ["img", "wait", "status"]) els[k] = dlg.querySelector(`.postcard-${k}`);
    els.save = dlg.querySelector('[data-act="save"]');
    els.share = dlg.querySelector('[data-act="share"]');
    els.save.addEventListener("click", save);
    els.share.addEventListener("click", share);
    dlg.querySelector('[data-act="close"]').addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }); // the backdrop
    dlg.addEventListener("close", () => { token++; release(); opener?.focus?.(); opener = null; });
  }
  function release() { if (url) URL.revokeObjectURL(url); url = ""; blob = null; }
  const say = (t) => { els.status.textContent = t; };

  function save() {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = url; a.download = FILE_NAME;
    document.body.append(a); a.click(); a.remove();
    say(`Saved ${FILE_NAME}.`);
  }
  async function share() {
    if (!blob) return;
    const file = new File([blob], FILE_NAME, { type: "image/png" });
    try {
      await navigator.share({ files: [file], title: "Huikau", text: SHARE_TEXT, url: SHARE_URL });
      say("Shared.");
    } catch (e) { if (e?.name !== "AbortError") say("Sharing did not work here. Try Save instead."); }
  }

  async function open(from) {
    if (!dlg) build();
    opener = from || document.activeElement;
    release();
    const mine = ++token;
    els.img.hidden = true; els.wait.hidden = false; els.wait.textContent = "Painting the scene…";
    els.save.disabled = true; els.share.hidden = true; say("");
    if (!dlg.open) dlg.showModal();
    try {
      const canvas = await renderPostcard({ clock, weather });
      const b = await toBlob(canvas);
      if (mine !== token) return;
      blob = b; url = URL.createObjectURL(b);
      els.img.src = url; els.img.hidden = false; els.wait.hidden = true;
      els.save.disabled = false;
      const probe = new File([b], FILE_NAME, { type: "image/png" });
      els.share.hidden = !(typeof navigator.canShare === "function" && typeof navigator.share === "function" && navigator.canShare({ files: [probe] }));
      els.save.focus();
    } catch (e) {
      if (mine !== token) return;
      els.wait.hidden = false;
      els.wait.textContent = "The postcard could not be painted in this browser.";
      console.warn("postcard:", e);
    }
  }

  for (const b of buttons) b.addEventListener("click", () => open(b));
  return { open, render: () => renderPostcard({ clock, weather }), get dialog() { return dlg; } };
}
