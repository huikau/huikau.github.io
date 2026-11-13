// The instruments under the waterline: tide curve, swell compass, sun and moon dial,
// weather strip and Ula's note. Facts and wording are unchanged from the old text cards;
// this file only changes how they are drawn. Every drawing has a text equivalent.
//
// The builders (tideRows, nextChange, tideChart, compassSvg, dialSvg, weatherCells ...) are pure
// functions that return strings or plain data, so they run in Node for the unit tests.
import { $ } from "../core/dom.js";
import { clock as defaultClock, clockTime, duration, hstToEpoch } from "../core/clock.js";
import { sunTimes, sunPosition, moonPosition, moonIllumination, moonPhaseName, nextMoonEvent, inDays } from "../core/astro.js";
import { windRow, surf as surfState } from "../data/surf.js";
import { tidesHourly, tideMinutes } from "../data/tides.js";
import { forecast as forecastState, forecastAt } from "../data/weather.js";
import { currentMoonPhase, moonLitPath } from "../sky/bodies.js";
import { initBottle } from "./bottle.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const n1 = (v) => +v.toFixed(1);

/**
 * Ula's pick for when to go out. `now` is minutes after midnight, `sun` is { rise, set },
 * `tides` is a parseTides() list. Anglers like moving water around a tide change, best of all near sunrise or sunset.
 */
export function ulasPick(now, sun, tides, ymd) {
  const daylight = (m) => m >= sun.rise - 45 && m <= sun.set + 45;
  // The NOAA list can run past midnight (tomorrow's tides have small minutes too), so only today's rows count.
  const day = ymd ? `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}` : null;
  const today = day ? tides.filter((t) => !t.t || t.t.slice(0, 10) === day) : tides;
  const upcoming = today.filter((t) => t.m >= now - 20 && daylight(t.m));
  if (upcoming.length) {
    const nearSun = (m) => Math.min(Math.abs(m - sun.rise), Math.abs(m - sun.set));
    const best = upcoming.reduce((a, b) => (nearSun(b.m) < nearSun(a.m) ? b : a));
    let when = "";
    if (Math.abs(best.m - sun.set) <= 75) when = best.m <= sun.set ? ", just before sunset" : ", right after sunset";
    else if (Math.abs(best.m - sun.rise) <= 75) when = best.m <= sun.rise ? ", just before sunrise" : ", right after sunrise";
    const lead = best.m <= now + 10 ? "Ula's out now for" : "Ula's heading out for";
    return `${lead} the ${clockTime(best.m)} ${best.high ? "high" : "low"} tide${when}.`;
  }
  if (now < sun.rise) return `Ula's heading out at sunrise, ${clockTime(sun.rise)}.`;
  if (now < sun.set - 60) return `Ula's heading out for the evening bite, around ${clockTime(sun.set - 60)}.`;
  if (now < sun.set) return "Ula's out now for the sunset bite.";
  return `Ula's done for today. She'll be back out at sunrise, around ${clockTime(sun.rise)}.`;
}

/** The rows of the "Today on the water" panel. */
export function todayRows(sun, phase) {
  const next = nextMoonEvent(phase);
  return [
    ["Sunrise", clockTime(sun.rise)],
    ["Sunset", clockTime(sun.set)],
    ["Moon", `${moonPhaseName(phase)}, ${Math.round(moonIllumination(phase))}% lit`],
    ["Coming up", `${next.name} ${inDays(next.days)}`]
  ];
}

// ---------------------------------------------------------------- shared bits

const dlHtml = (rows, id) =>
  `<dl class="stats"${id ? ` id="${id}"` : ""}>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;

/** "From earlier, 2:10 pm" for data fetched at epoch-ms `t`. */
export const fromEarlier = (t, clk = defaultClock) =>
  t ? `From earlier, ${clockTime(clk.fields(t).minutes)}` : "From earlier";

// ---------------------------------------------------------------- tide curve

/** The old tide list, row by row: label, time, height. Same strings the text card showed. */
export function tideRows(list) {
  return list.map((p) => ({ label: p.high ? "High tide" : "Low tide", when: clockTime(p.m), height: `${p.v.toFixed(1)} ft`, high: p.high, t: p.t }));
}

/** The next tide change at or after `nowMin` (minutes after midnight of day `ymd`), or null. */
export function nextChange(list, ymd, nowMin) {
  let best = null;
  for (const p of list) {
    const abs = tideMinutes(p.t, ymd);
    if (abs >= nowMin && (!best || abs < best.abs)) best = { p, abs, inMin: abs - nowMin };
  }
  return best;
}

/** One sentence for the next change: "Next: low tide at 1:34 pm, 0.4 ft, in 3 hr 12 min." */
export function nextText(next) {
  if (!next) return "No more tide changes listed for today.";
  const { p, abs, inMin } = next;
  const day = abs >= 1440 ? " tomorrow" : "";
  const eta = inMin < 1 ? "right now" : `in ${duration(inMin)}`;
  return `Next: ${p.high ? "high" : "low"} tide at ${clockTime(p.m)}${day}, ${p.v.toFixed(1)} ft, ${eta}.`;
}

/** Hourly (or, failing that, interpolated hi/lo) height series covering today: [[minutes, feet]]. */
export function tideSeries(hourly, list, ymd) {
  const hs = (hourly || []).map((h) => [tideMinutes(h.t, ymd), h.v]).filter(([m]) => m >= 0 && m <= 1440);
  if (hs.length >= 20) return hs;
  const ex = (list || []).map((p) => ({ abs: tideMinutes(p.t, ymd), v: p.v })).sort((a, b) => a.abs - b.abs);
  if (ex.length < 2) return null;
  // Pad each end with a mirrored extreme so the curve runs edge to edge.
  ex.unshift({ abs: ex[0].abs - (ex[1].abs - ex[0].abs), v: ex[1].v });
  ex.push({ abs: ex[ex.length - 1].abs + (ex[ex.length - 1].abs - ex[ex.length - 2].abs), v: ex[ex.length - 3].v });
  const out = [];
  for (let m = 0; m <= 1440; m += 30) {
    let i = ex.findIndex((e, k) => k < ex.length - 1 && m >= e.abs && m <= ex[k + 1].abs);
    if (i < 0) i = m < ex[0].abs ? 0 : ex.length - 2;
    const a = ex[i], b = ex[i + 1];
    const f = Math.min(1, Math.max(0, (m - a.abs) / (b.abs - a.abs)));
    out.push([m, a.v + (b.v - a.v) * (1 - Math.cos(Math.PI * f)) / 2]);
  }
  return out;
}

/** A smooth cubic path (Catmull-Rom) through [[x, y]] points. */
export function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = `M${n1(pts[0][0])} ${n1(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += `C${n1(p1[0] + (p2[0] - p0[0]) / 6)} ${n1(p1[1] + (p2[1] - p0[1]) / 6)} ${n1(p2[0] - (p3[0] - p1[0]) / 6)} ${n1(p2[1] - (p3[1] - p1[1]) / 6)} ${n1(p2[0])} ${n1(p2[1])}`;
  }
  return d;
}

const TIDE = { w: 340, h: 206, x0: 16, x1: 324, yTop: 68, yBase: 142, yAxis: 162 };
const tx = (m) => TIDE.x0 + (m / 1440) * (TIDE.x1 - TIDE.x0);
const AXIS = [[0, "12 am", "start"], [360, "6 am", "middle"], [720, "noon", "middle"], [1080, "6 pm", "middle"], [1440, "12 am", "end"]];

const tideFrame = (inner, label) =>
  `<svg class="chart chart--tide" viewBox="0 0 ${TIDE.w} ${TIDE.h}" role="img" aria-label="${esc(label)}" focusable="false">${inner}</svg>`;

const tideAxis = () =>
  `<line class="ax" x1="${TIDE.x0}" y1="${TIDE.yBase}" x2="${TIDE.x1}" y2="${TIDE.yBase}"/>`
  + AXIS.map(([m, t, a]) => `<line class="ax" x1="${n1(tx(m))}" y1="${TIDE.yBase}" x2="${n1(tx(m))}" y2="${TIDE.yBase + 5}"/><text class="tick" x="${n1(tx(m))}" y="${TIDE.yAxis + 4}" text-anchor="${a}">${t}</text>`).join("");

/** Skeleton for the loading state (dashed tide line) and the no-data state (flat dashed line). */
export function tideSkeleton(kind) {
  const wave = [];
  for (let m = 0; m <= 1440; m += 120) wave.push([tx(m), 105 - Math.sin((m / 1440) * Math.PI * 4 - 0.9) * 26]);
  const d = kind === "none" ? `M${TIDE.x0} 105L${TIDE.x1} 105` : smoothPath(wave);
  return tideFrame(`${tideAxis()}<path class="sk-line" d="${d}"/>`, kind === "none" ? "Tide chart unavailable" : "Tide chart loading");
}

/**
 * The tide curve. `series` [[min, ft]], `ext` today's high/low points [{ abs, v, high, m }], `nowMin` minutes after midnight.
 * `summary` is the aria-label (the next-change sentence).
 */
export function tideChart(series, ext, nowMin, summary) {
  const vs = series.map((s) => s[1]).concat(ext.map((e) => e.v));
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if (hi - lo < 0.2) { lo -= 0.1; hi += 0.1; }
  const ty = (v) => TIDE.yBase - 6 - ((v - lo) / (hi - lo)) * (TIDE.yBase - 6 - TIDE.yTop);
  const pts = series.map(([m, v]) => [tx(m), ty(v)]);
  const line = smoothPath(pts);
  const area = `${line}L${n1(pts[pts.length - 1][0])} ${TIDE.yBase}L${n1(pts[0][0])} ${TIDE.yBase}Z`;
  const now = Math.min(1440, Math.max(0, nowMin)), nx = tx(now);
  let nowV = series[0][1];
  for (let i = 0; i < series.length - 1; i++) {
    const [m0, v0] = series[i], [m1, v1] = series[i + 1];
    if (now >= m0 && now <= m1) { nowV = v0 + (v1 - v0) * (m1 === m0 ? 0 : (now - m0) / (m1 - m0)); break; }
    if (i === series.length - 2) nowV = v1;
  }
  const anchorFor = (x) => (x < 62 ? "start" : x > 278 ? "end" : "middle");
  const lx = (x, a) => (a === "start" ? Math.max(6, x - 6) : a === "end" ? Math.min(TIDE.w - 6, x + 6) : x);
  const marks = ext.map((e) => {
    const x = tx(e.abs), y = ty(e.v), a = anchorFor(x), X = n1(lx(x, a));
    const lead = `<line class="lead" x1="${n1(x)}" y1="${n1(y)}" x2="${n1(x)}" y2="${e.high ? 50 : 168}"/>`;
    const dot = `<circle class="dot ${e.high ? "dot--high" : "dot--low"}" cx="${n1(x)}" cy="${n1(y)}" r="5.5"/>`;
    const l1 = `<text class="lbl" x="${X}" y="${e.high ? 30 : 184}" text-anchor="${a}">${e.high ? "High" : "Low"} ${e.v.toFixed(1)} ft</text>`;
    const l2 = `<text class="lbl lbl--sub" x="${X}" y="${e.high ? 45 : 199}" text-anchor="${a}">${clockTime(e.m)}</text>`;
    return lead + dot + l1 + l2;
  }).join("");
  const na = anchorFor(nx);
  const nowMark = `<line class="nowline" x1="${n1(nx)}" y1="20" x2="${n1(nx)}" y2="${TIDE.yBase}"/>`
    + `<circle class="nowdot" cx="${n1(nx)}" cy="${n1(ty(nowV))}" r="6.5"/>`
    + `<text class="lbl lbl--now" x="${n1(lx(nx, na))}" y="14" text-anchor="${na}">Now</text>`;
  return tideFrame(
    `<defs><pattern id="tide-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" class="hatch"/></pattern>`
    + `<clipPath id="tide-past"><rect x="${TIDE.x0}" y="0" width="${n1(nx - TIDE.x0)}" height="${TIDE.h}"/></clipPath></defs>`
    + `<path class="area" d="${area}"/><path class="past" d="${area}" clip-path="url(#tide-past)"/>${tideAxis()}`
    + `<path class="curve" d="${line}"/>${marks}${nowMark}`, summary);
}

// ---------------------------------------------------------------- swell compass

const POINT_NAMES = ["N", "E", "S", "W"];
const polar = (deg, r, c = 100) => [c + r * Math.sin(deg * Math.PI / 180), c - r * Math.cos(deg * Math.PI / 180)];

/** An arrow from the rim toward the middle, pointing the way the swell travels (it comes FROM `dir`). */
const compassArrow = (dir, cls, len) => {
  const tail = 100 - 66, tip = 100 + 10, base = tip - 26;
  const t = tail + (66 - len);
  const half = cls === "arrow--swell" ? 4.5 : 3, head = cls === "arrow--swell" ? 13 : 9;
  return `<polygon class="arrow ${cls}" transform="rotate(${Math.round(dir)} 100 100)" points="${100 - half},${t} ${100 + half},${t} ${100 + half},${base} ${100 + head},${base} 100,${tip} ${100 - head},${base} ${100 - half},${base}"/>`;
};

export function compassSvg({ swell, waves } = {}, kind = "live") {
  let ticks = "";
  for (let i = 0; i < 16; i++) {
    const major = i % 4 === 0, a = polar(i * 22.5, 68), b = polar(i * 22.5, major ? 80 : 75);
    ticks += `<line class="ax${major ? " ax--major" : ""}" x1="${n1(a[0])}" y1="${n1(a[1])}" x2="${n1(b[0])}" y2="${n1(b[1])}"/>`;
  }
  const names = POINT_NAMES.map((t, i) => { const p = polar(i * 90, 91); return `<text class="tick tick--dir" x="${n1(p[0])}" y="${n1(p[1])}" dy="0.35em" text-anchor="middle">${t}</text>`; }).join("");
  let arrows = "";
  if (kind === "live") {
    if (waves && waves.dir != null) arrows += compassArrow(waves.dir, "arrow--waves", 46);
    if (swell && swell.dir != null) arrows += compassArrow(swell.dir, "arrow--swell", 66);
    else if (!swell && waves && waves.dir != null) arrows = compassArrow(waves.dir, "arrow--swell", 66);
  }
  const ring = `<circle class="ring${kind === "live" ? "" : " ring--sk"}" cx="100" cy="100" r="68"/><circle class="ring ring--in${kind === "live" ? "" : " ring--sk"}" cx="100" cy="100" r="36"/>`;
  return `<svg class="chart chart--compass" viewBox="0 0 200 200" aria-hidden="true" focusable="false">${ring}${ticks}${names}${arrows}<circle class="hub" cx="100" cy="100" r="5"/></svg>`;
}

const legendGlyph = (cls) => `<svg viewBox="0 0 26 14" class="legend__glyph" aria-hidden="true" focusable="false"><polygon class="arrow ${cls}" points="2,5 14,5 14,2 24,7 14,12 14,9 2,9"/></svg>`;

/** The wind row for the surf panel: NWS first, the Open-Meteo hourly forecast only when NWS has none. */
export function surfWindRow(wind, fc) {
  const nws = windRow(wind);
  if (nws) return { row: nws, source: "nws" };
  const f = fc && fc.mph != null ? windRow({ mph: fc.mph, from: fc.from }) : null;
  return f ? { row: f, source: "forecast" } : { row: null, source: null };
}

// ---------------------------------------------------------------- sun and moon dial

const DIAL = { w: 340, h: 196, cx: 170, rx: 140, ry: 116, horizon: 146 };
/** Where a body at (azimuth, altitude) in degrees sits on the dial: looking south, east on the left. */
export function dialPoint(az, alt) {
  const a = Math.max(0, alt) * Math.PI / 180;
  return [DIAL.cx + DIAL.rx * Math.cos(a) * Math.sin((az - 180) * Math.PI / 180), DIAL.horizon - DIAL.ry * Math.sin(a)];
}

const sunArcCache = new Map();
/** Sample today's sun from sunrise to sunset: [{ m, x, y }]. */
export function sunArc(dayMs, sun) {
  const key = `${dayMs}:${Math.round(sun.rise)}:${Math.round(sun.set)}`;
  if (sunArcCache.has(key)) return sunArcCache.get(key);
  const pts = [];
  const rise = Math.ceil(sun.rise), set = Math.floor(sun.set);
  for (let m = rise; m <= set; m += 10) { const p = sunPosition(dayMs + m * 60e3); const [x, y] = dialPoint(p.azimuth, p.altitude); pts.push({ m, x, y }); }
  const last = pts[pts.length - 1];
  if (!last || last.m < set) { const p = sunPosition(dayMs + set * 60e3); const [x, y] = dialPoint(p.azimuth, p.altitude); pts.push({ m: set, x, y }); }
  if (sunArcCache.size > 8) sunArcCache.clear();
  sunArcCache.set(key, pts);
  return pts;
}

const moonGlyph = (x, y, phase, r = 11) => {
  const k = r / 24; // the 54x54 glyph is centred on (27, 27)
  return `<g transform="translate(${n1(x - 27 * k)} ${n1(y - 27 * k)}) scale(${k.toFixed(3)})"><circle class="moon__dark" cx="27" cy="27" r="24"/><path class="moon__lit" d="${moonLitPath(phase)}"/><circle class="moon__rim" cx="27" cy="27" r="24"/></g>`;
};

const sunGlyph = (x, y) => {
  let rays = "";
  for (let i = 0; i < 8; i++) { const a = polar(i * 45, 12, 0), b = polar(i * 45, 17, 0); rays += `<line class="sun__ray" x1="${n1(x + a[0])}" y1="${n1(y + a[1])}" x2="${n1(x + b[0])}" y2="${n1(y + b[1])}"/>`; }
  return `${rays}<circle class="sun__disc" cx="${n1(x)}" cy="${n1(y)}" r="9"/>`;
};

/** The dial's sky follows the real one: day, golden (sun low), twilight (just down) and night. */
export const dialSky = (alt) => (alt > 8 ? "day" : alt > -0.83 ? "golden" : alt > -12 ? "twilight" : "night");
const DIAL_STARS = [[34, 26, 1.4], [78, 54, 1], [112, 18, 1.2], [150, 40, .9], [196, 22, 1.4], [238, 50, 1], [276, 16, 1.2], [312, 38, 1], [58, 92, .9], [292, 88, 1.1], [176, 76, .8]];
/**
 * Where the "Sun" and "Moon" labels go (their baselines): under the glyph when there is sky to spare above the horizon,
 * otherwise over it; and if the two would overlap, the moon's label moves to the other side of its glyph.
 */
export function dialLabels(sun, moon) {
  const place = (b, gap) => (b.y + b.r + gap + 2 < DIAL.horizon - 4 ? b.y + b.r + gap : b.y - b.r - 6);
  const out = { sun: sun ? place(sun, 11) : null, moon: moon ? moon.y - moon.r - 6 : null };
  if (sun && moon && Math.abs(sun.x - moon.x) < 46 && Math.abs(out.sun - out.moon) < 16) {
    out.moon = out.moon === moon.y - moon.r - 6 && moon.y + moon.r + 17 < DIAL.horizon - 4 ? moon.y + moon.r + 15 : moon.y - moon.r - 6;
    if (Math.abs(out.sun - out.moon) < 16) out.sun = out.sun > sun.y ? sun.y - sun.r - 6 : (sun.y + sun.r + 13 < DIAL.horizon - 4 ? sun.y + sun.r + 11 : out.sun);
  }
  return out;
}

/** The dial. `m` is the current minute of the day, `ms` the displayed instant, `dayMs` midnight of the displayed day. */
export function dialSvg({ ms, dayMs, m, sun, phase }) {
  const arc = sunArc(dayMs, sun);
  const done = arc.filter((p) => p.m <= m), todo = arc.filter((p) => p.m >= m);
  const path = (pts) => (pts.length > 1 ? smoothPath(pts.map((p) => [p.x, p.y])) : "");
  const sp = sunPosition(ms), mp = moonPosition(ms);
  const sunUp = sp.altitude > -0.83, moonUp = mp.altitude > 0;
  const sx = arc[0] ? arc[0].x : 38, ex = arc.length ? arc[arc.length - 1].x : 302;
  const cardinal = [["E", 90], ["S", 180], ["W", 270]].map(([t, az]) => `<text class="tick tick--dir tick--sea" x="${n1(dialPoint(az, 0)[0])}" y="${DIAL.horizon + 17}" text-anchor="middle">${t}</text>`).join("");
  const [sunX, sunY] = dialPoint(sp.azimuth, sp.altitude), [moonX, moonY] = dialPoint(mp.azimuth, mp.altitude);
  const labels = dialLabels(sunUp && { x: sunX, y: sunY, r: 17 }, moonUp && { x: moonX, y: moonY, r: 11 });
  const sunMark = sunUp ? `${sunGlyph(sunX, sunY)}<text class="lbl lbl--halo" x="${n1(sunX)}" y="${n1(labels.sun)}" text-anchor="middle">Sun</text>` : "";
  const moonMark = moonUp ? `${moonGlyph(moonX, moonY, phase)}<text class="lbl lbl--halo" x="${n1(moonX)}" y="${n1(labels.moon)}" text-anchor="middle">Moon</text>` : "";
  const sky = dialSky(sp.altitude);
  let stars = "";
  if (sky === "night" || sky === "twilight") for (const [x, y, r] of DIAL_STARS) stars += `<circle class="dial-star" cx="${x}" cy="${y}" r="${r}"/>`;
  return `<svg class="chart chart--dial chart--dial-${sky}" viewBox="0 0 ${DIAL.w} ${DIAL.h}" aria-hidden="true" focusable="false">`
    + `<rect class="sky" x="0" y="0" width="${DIAL.w}" height="${DIAL.horizon}"/>${stars}`
    + `<rect class="sea" x="0" y="${DIAL.horizon}" width="${DIAL.w}" height="${DIAL.h - DIAL.horizon}"/>`
    + `<line class="horizon" x1="0" y1="${DIAL.horizon}" x2="${DIAL.w}" y2="${DIAL.horizon}"/>`
    + `<path class="arc arc--todo" d="${path(todo)}"/><path class="arc arc--done" d="${path(done)}"/>`
    + `<line class="ax ax--major" x1="${n1(sx)}" y1="${DIAL.horizon - 5}" x2="${n1(sx)}" y2="${DIAL.horizon + 5}"/><line class="ax ax--major" x1="${n1(ex)}" y1="${DIAL.horizon - 5}" x2="${n1(ex)}" y2="${DIAL.horizon + 5}"/>`
    + `${cardinal}${moonMark}${sunMark}`
    + `<text class="tick tick--sea" x="10" y="${DIAL.h - 7}" text-anchor="start">Sunrise ${clockTime(sun.rise)}</text>`
    + `<text class="tick tick--sea" x="${DIAL.w - 10}" y="${DIAL.h - 7}" text-anchor="end">Sunset ${clockTime(sun.set)}</text></svg>`;
}

const moonPhaseSvg = (phase) =>
  `<svg class="moonphase" viewBox="0 0 54 54" aria-hidden="true" focusable="false"><circle class="moon__dark" cx="27" cy="27" r="24"/><path class="moon__lit" d="${moonLitPath(phase)}"/><circle class="moon__rim" cx="27" cy="27" r="24"/></svg>`;

// ---------------------------------------------------------------- weather strip

/** Small drawn icon for the sky condition. kind: sun | partly | cloud | rain | none */
export function skyIcon(kind) {
  const sun = '<circle class="wx__sun" cx="15" cy="15" r="7"/>';
  const cloud = '<path class="wx__cloud" d="M13 36h22a7 7 0 0 0 .6-14 10 10 0 0 0-19-2A8 8 0 0 0 13 36z"/>';
  const drops = '<path class="wx__drop" d="M17 40l-2 5M25 40l-2 5M33 40l-2 5"/>';
  const inner = {
    sun: '<circle class="wx__sun" cx="24" cy="24" r="9"/>' + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = polar(i * 45, 14, 24), b = polar(i * 45, 19, 24); return `<line class="wx__ray" x1="${n1(a[0])}" y1="${n1(a[1])}" x2="${n1(b[0])}" y2="${n1(b[1])}"/>`; }).join(""),
    partly: sun + cloud,
    cloud: cloud,
    rain: cloud + drops,
    none: '<circle class="wx__none" cx="24" cy="24" r="14"/>'
  }[kind] || "";
  return `<svg class="wx__icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">${inner}</svg>`;
}

const skyKind = (w) => (w.rain ? "rain" : w.clouds >= 3 ? "cloud" : w.clouds >= 1 ? "partly" : "sun");

/**
 * The three cells of the weather strip: [{ key, label, value, icon? }] (value null = no reading).
 * `w` is the shared weather object, `fc` the forecast entry for now (or null).
 */
export function weatherCells(w, fc) {
  const haveSky = w.status !== "none" && (w.desc || w.text);
  const sky = haveSky ? (w.desc || String(w.text).split(", ")[0]) : null;
  const temp = w.tempF != null && w.status !== "none" ? { v: `${w.tempF}°F`, from: "nws" } : fc && fc.tempF != null ? { v: `${fc.tempF}°F`, from: "forecast" } : null;
  const wind = w.status !== "none" ? surfWindRow(w.wind, fc) : surfWindRow(null, fc);
  return {
    cells: [
      { key: "sky", label: "Sky", value: sky, icon: haveSky ? skyKind(w) : "none" },
      { key: "air", label: "Air", value: temp && temp.v, icon: null },
      { key: "wind", label: "Wind", value: wind.row && wind.row[1], icon: null }
    ],
    usedForecast: !!(temp && temp.from === "forecast") || wind.source === "forecast"
  };
}

// ---------------------------------------------------------------- the module

export function initInstruments({ clock = defaultClock, bus, tides, weather, surf = surfState, tidesHourly: hourly = tidesHourly, forecast = forecastState }) {
  if ($("year")) $("year").textContent = clock.fields().year;
  initBottle({ clock });

  const seen = { tides: false, surf: false, weather: false, forecast: false };
  const setState = (id, state, stale) => {
    const box = $(id);
    if (!box) return null;
    box.dataset.state = state;
    const tag = $(`${id}-stale`);
    if (tag) { tag.hidden = !stale; tag.textContent = stale || ""; }
    return box;
  };
  const staleFor = (status, t) => (status === "cached" ? fromEarlier(t, clock) : "");
  const msg = (text) => `<p class="inst__msg">${esc(text)}</p>`;

  // ---- tides ----
  function renderTides() {
    const body = $("tides-body");
    if (!body) return;
    if (!seen.tides) { setState("tides", "loading"); body.innerHTML = tideSkeleton("loading") + msg("Checking the tide chart…"); return; }
    const list = tides.list || [];
    if (!list.length) { setState("tides", "none"); body.innerHTML = tideSkeleton("none") + msg("The tide chart is out of reach right now. Check back in a bit."); return; }
    setState("tides", tides.status, staleFor(tides.status, tides.t));
    const ymd = clock.ymd(), now = clock.minutesExact();
    const next = nextChange(list, ymd, now), summary = `Tide curve for today in Honolulu. ${nextText(next)} The full list of tides follows.`;
    const series = tideSeries(hourly.list, list, ymd);
    const ext = list.map((p) => ({ abs: tideMinutes(p.t, ymd), v: p.v, high: p.high, m: p.m })).filter((e) => e.abs >= 0 && e.abs <= 1440);
    const rows = tideRows(list.filter((p) => { const a = tideMinutes(p.t, ymd); return a >= 0 && a < 1440; })); // today only: the feed can run into tomorrow
    const nextKey = next && next.p.t;
    body.innerHTML = (series ? tideChart(series, ext, now, summary) : tideSkeleton("none"))
      + `<p class="tide__next" id="tides-next">${esc(nextText(next))}</p>`
      + `<table class="visually-hidden" id="tides-table"><caption>Tide predictions for Honolulu Harbor</caption><thead><tr><th scope="col">Tide</th><th scope="col">Time</th><th scope="col">Height</th></tr></thead><tbody>`
      + rows.map((r) => `<tr><th scope="row">${r.label}${r.t === nextKey ? " (next)" : ""}</th><td>${r.when}</td><td>${r.height}</td></tr>`).join("")
      + `</tbody></table>`;
  }

  // ---- surf ----
  const forecastNow = () => forecastAt(forecast.list, clock.fields());
  function renderSurf() {
    const body = $("surf-body");
    if (!body) return;
    const src = $("surf-wind-source");
    if (!seen.surf) { setState("surf", "loading"); body.innerHTML = `<div class="surf__grid">${compassSvg({}, "loading")}<div class="surf__text">${msg("Reading the swell…")}</div></div>`; if (src) src.hidden = true; return; }
    const d = surf.data;
    if (!d) { setState("surf", "none"); body.innerHTML = `<div class="surf__grid">${compassSvg({}, "none")}<div class="surf__text">${msg("No surf report right now. Take a look at the water.")}</div></div>`; if (src) src.hidden = true; return; }
    setState("surf", surf.status, staleFor(surf.status, surf.t));
    const wind = surfWindRow(weather.wind, forecastNow());
    const rows = d.rows.slice();
    if (wind.row) rows.push(wind.row);
    if (src) {
      src.hidden = wind.source !== "nws";
      const fsrc = $("surf-forecast-source");
      if (fsrc) fsrc.hidden = wind.source !== "forecast";
    }
    const key = [legendGlyph("arrow--swell"), (d.swell ? "Swell" : "Waves")];
    const keyHtml = `<li>${key[0]}${key[1]}</li>` + (d.swell ? `<li>${legendGlyph("arrow--waves")}Waves</li>` : "");
    body.innerHTML = `<p class="surf__call" id="surf-call">${esc(d.call)}</p><div class="surf__grid">`
      + `<figure class="surf__fig">${compassSvg({ swell: d.swell, waves: d.waves })}<figcaption><ul class="legend">${keyHtml}</ul><span class="visually-hidden"> Arrows point the way the water is travelling; each starts on the side it comes from.</span></figcaption></figure>`
      + `<div class="surf__text">${dlHtml(rows, "surf-stats")}</div></div>`;
  }

  // ---- today: sun and moon dial ----
  function renderToday() {
    const body = $("today-body");
    if (!body) return;
    const d = clock.hst(), f = clock.fields(), sun = sunTimes(d), ms = clock.now(), phase = currentMoonPhase(ms);
    const dayMs = hstToEpoch(f.year, f.month, f.day, 0);
    body.innerHTML = dialSvg({ ms, dayMs, m: clock.minutesExact(), sun, phase })
      + `<div class="dial__rows">${moonPhaseSvg(phase)}${dlHtml(todayRows(sun, phase), "today-stats")}</div>`;
    renderPick(sun);
  }

  // ---- Ula's note ----
  function renderPick(sun = sunTimes(clock.hst())) {
    const el = $("today-pick");
    if (!el) return;
    el.textContent = seen.tides || (tides.list && tides.list.length) ? ulasPick(clock.minutes(), sun, tides.list || [], clock.ymd()) : "Ula's checking the tide chart…";
  }

  // ---- weather strip ----
  function renderWeather() {
    const body = $("weather-body");
    if (!body) return;
    const needFc = weather.status === "none" || !weather.wind || weather.tempF == null;
    if (!seen.weather || (needFc && !seen.forecast)) { setState("weather", "loading"); body.innerHTML = weatherHtml(null, "loading"); return; }
    const fc = forecastNow();
    const { cells, usedForecast } = weatherCells(weather, fc);
    const any = cells.some((c) => c.value != null);
    const status = !any ? "none" : weather.status === "cached" ? "cached" : "live";
    setState("weather", status, status === "cached" ? fromEarlier(weather.t, clock) : "");
    body.innerHTML = weatherHtml(cells, any ? "live" : "none");
    const fsrc = $("weather-forecast-source");
    if (fsrc) fsrc.hidden = !usedForecast;
  }
  function weatherHtml(cells, kind) {
    const list = cells || [{ key: "sky", label: "Sky", icon: "none" }, { key: "air", label: "Air" }, { key: "wind", label: "Wind" }];
    const note = kind === "loading" ? msg("Checking the weather…") : kind === "none" ? msg("No weather reading right now. Step outside and look up.") : "";
    return `<dl class="wx">${list.map((c) => `<div class="wx__cell wx__cell--${c.key}">${c.icon ? skyIcon(c.icon) : ""}<dt>${c.label}</dt><dd${c.value == null ? ' class="wx__none-text"' : ""}>${c.value == null ? (kind === "loading" ? "…" : "No reading") : esc(c.value)}</dd></div>`).join("")}</dl>${note}`;
  }

  bus.on("tides", () => { seen.tides = true; renderTides(); renderPick(); });
  bus.on("surf", () => { seen.surf = true; renderSurf(); });
  bus.on("weather", () => { seen.weather = true; renderWeather(); renderSurf(); });
  bus.on("forecast", () => { seen.forecast = true; renderWeather(); renderSurf(); });
  bus.on("tick", () => { renderToday(); if (seen.tides) renderTides(); renderWeather(); });

  renderTides(); renderSurf(); renderWeather(); renderToday();
  return { renderToday, renderTides, renderSurf, renderWeather, ulasPick };
}
