// Sky colour as a pure function of the sun's altitude. No DOM, no clock: safe to import in Node.
//
// Keyframes sit at fixed altitudes and are blended in OKLCH with a smoothstep per segment, so the
// colour and its rate of change are both continuous: no banding, no popping while a slider is dragged.
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- sRGB <-> OKLab / OKLCH ----------
const toLin = (c) => (c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
const fromLin = (c) => (c <= .0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - .055);

export function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
export const rgbToHex = (rgb) => "#" + rgb.map((c) => Math.round(clamp(c) * 255).toString(16).padStart(2, "0")).join("");

export function rgbToOklab([r, g, b]) {
  const [lr, lg, lb] = [toLin(r), toLin(g), toLin(b)];
  const l = Math.cbrt(.4122214708 * lr + .5363325363 * lg + .0514459929 * lb);
  const m = Math.cbrt(.2119034982 * lr + .6806995451 * lg + .1073969566 * lb);
  const s = Math.cbrt(.0883024619 * lr + .2817188376 * lg + .6299787005 * lb);
  return [
    .2104542553 * l + .7936177850 * m - .0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + .4505937099 * s,
    .0259040371 * l + .7827717662 * m - .8086757660 * s
  ];
}
export function oklabToRgb([L, a, b]) {
  const l = (L + .3963377774 * a + .2158037573 * b) ** 3;
  const m = (L - .1055613458 * a - .0638541728 * b) ** 3;
  const s = (L - .0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + .2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s,
    -.0041960863 * l - .7034186147 * m + 1.7076147010 * s
  ].map((c) => clamp(fromLin(clamp(c))));
}
export function hexToOklch(hex) {
  const [L, a, b] = rgbToOklab(hexToRgb(hex));
  return [L, Math.hypot(a, b), (Math.atan2(b, a) * 180 / Math.PI + 360) % 360];
}
export function oklchToHex([L, C, H]) {
  const h = H * Math.PI / 180;
  return rgbToHex(oklabToRgb([L, C * Math.cos(h), C * Math.sin(h)]));
}

/** Blend two OKLCH colours; hue takes the short way round and is borrowed when a colour is grey. */
export function mixOklch(a, b, t) {
  let [L1, C1, H1] = a, [L2, C2, H2] = b;
  if (C1 < .004) H1 = H2;
  if (C2 < .004) H2 = H1;
  let dh = H2 - H1;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return [lerp(L1, L2, t), lerp(C1, C2, t), (H1 + dh * t + 360) % 360];
}
export const mixHex = (a, b, t) => oklchToHex(mixOklch(hexToOklch(a), hexToOklch(b), t));

// ---------- contrast (WCAG 2.x) ----------
export const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(toLin);
  return .2126 * r + .7152 * g + .0722 * b;
};
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + .05) / (y + .05);
}
/** sRGB mix, which is what a CSS gradient does between two stops. */
export const mixSrgb = (a, b, t) => rgbToHex(hexToRgb(a).map((c, i) => lerp(c, hexToRgb(b)[i], t)));

// ---------- keyframes ----------
// Altitude in degrees; colours are the sky at the top of the scene, around the middle, and at the horizon.
// The upper two are kept dark enough (or on the dark side of the crossover) that the clock line stays readable.
export const KEYFRAMES = [
  { alt: -18, top: "#04091A", mid: "#0A1530", horizon: "#13294A", glow: "#2B3F78", glowA: 0 },
  { alt: -12, top: "#070E26", mid: "#13204A", horizon: "#25396B", glow: "#46508F", glowA: .1 },
  { alt: -6,  top: "#0E1946", mid: "#2D2C68", horizon: "#7A4B84", glow: "#C0679A", glowA: .42 },
  { alt: -2,  top: "#17275E", mid: "#533C7C", horizon: "#D0647C", glow: "#FF8A62", glowA: .62 },
  { alt: 0,   top: "#1D3369", mid: "#74477E", horizon: "#F0875A", glow: "#FFA25C", glowA: .7 },
  { alt: 4,   top: "#1D4C86", mid: "#7A6A96", horizon: "#F5A96C", glow: "#FFB866", glowA: .62 },
  { alt: 10,  top: "#1A599A", mid: "#5A8EBC", horizon: "#F6D2A4", glow: "#FFD79A", glowA: .42 },
  { alt: 25,  top: "#145E9A", mid: "#4D98C8", horizon: "#C9E5EC", glow: "#FFEBC2", glowA: .26 },
  { alt: 60,  top: "#115A96", mid: "#4A96C8", horizon: "#BFE5EE", glow: "#FFF6DA", glowA: .14 }
].map((k) => ({ ...k, oc: { top: hexToOklch(k.top), mid: hexToOklch(k.mid), horizon: hexToOklch(k.horizon), glow: hexToOklch(k.glow) } }));

export const TEXT_DARK = "#0B2226";
export const TEXT_LIGHT = "#FFF9EC";
/** Where the clock line sits, as fractions of the gradient from the top of the scene. */
export const CLOCK_SAMPLES = [0, .03, .06, .09, .12];
/** Where the three gradient stops sit, as a share of the scene's height (the sea starts at 72%). */
export const STOPS = { top: 0, mid: 42, horizon: 74 };

/** The two keyframes around `alt` and the eased blend between them. */
function segment(alt) {
  const k = KEYFRAMES;
  if (alt <= k[0].alt) return [k[0], k[0], 0];
  if (alt >= k[k.length - 1].alt) return [k[k.length - 1], k[k.length - 1], 0];
  let i = 0;
  while (alt > k[i + 1].alt) i++;
  return [k[i], k[i + 1], smooth((alt - k[i].alt) / (k[i + 1].alt - k[i].alt))];
}

/** The colour of the sky stop `name` (top, mid, horizon, glow) at altitude `alt`, as hex. */
export function skyStop(name, alt) {
  const [a, b, t] = segment(alt);
  return oklchToHex(mixOklch(a.oc[name], b.oc[name], t));
}

/** The sky's colour at fraction `f` (0 top, 1 bottom of the gradient), mixed in sRGB like a CSS gradient. */
export function gradientAt(p, f) {
  const y = f * 100;
  if (y <= STOPS.mid) return mixSrgb(p.top, p.mid, y / STOPS.mid);
  return mixSrgb(p.mid, p.horizon, clamp((y - STOPS.mid) / (STOPS.horizon - STOPS.mid)));
}

/** Whichever of the two text colours is more legible over the sky behind the clock line, and how legible. */
export function textOnSky(p) {
  const worst = (text) => Math.min(...CLOCK_SAMPLES.map((f) => contrast(text, gradientAt(p, f))));
  const dark = worst(TEXT_DARK), light = worst(TEXT_LIGHT);
  return light >= dark ? { color: TEXT_LIGHT, ratio: light } : { color: TEXT_DARK, ratio: dark };
}

const rgba = (hex, a) => `rgba(${hexToRgb(hex).map((c) => Math.round(c * 255)).join(", ")}, ${a.toFixed(3)})`;

/** Every sky colour for a sun altitude. */
export function skyPalette(alt) {
  const [a, b, t] = segment(alt);
  const p = {
    top: skyStop("top", alt), mid: skyStop("mid", alt), horizon: skyStop("horizon", alt),
    glow: skyStop("glow", alt), glowAlpha: lerp(a.glowA, b.glowA, t)
  };
  p.glowSoft = rgba(p.glow, p.glowAlpha);
  // haze: the horizon colour pulled toward the mid sky, for far ridges and the sea's edge
  p.haze = mixHex(p.horizon, p.mid, .35);
  const txt = textOnSky(p);
  p.textOnSky = txt.color;
  p.textContrast = txt.ratio;
  p.stars = starAlpha(alt);
  p.day = smooth((alt - 4) / 20); // 0 at night/twilight, 1 in full day: used for moon, cloud and drop tints
  return p;
}

/** Star visibility: none above -3 degrees, full by -10. */
export const starAlpha = (alt) => smooth((-3 - alt) / 7);

/**
 * Cloud colours: lit side, body, and shade, tinted by the sky and the sun. `overcast` (0..1) greys them
 * and darkens them for rain.
 */
export function cloudTints(alt, p, overcast = 0) {
  const day = smooth((alt + 8) / 14); // clouds pick up sun light from about -8 degrees
  const moonlit = "#8CA0C2";
  const white = "#FFFFFF";
  const warm = clamp(1 - alt / 22) * smooth((alt + 8) / 6); // strongest at sunrise and sunset
  let hi = mixHex(moonlit, mixHex(white, p.glow, .25 + .5 * warm), day);
  let body = mixHex(p.mid, hi, lerp(.35, .78, day));
  let shade = mixHex(p.top, body, lerp(.32, .45, day));
  const grey = (hex, toward, k) => mixHex(hex, toward, k);
  if (overcast > 0) {
    hi = grey(hi, "#9AA6B2", overcast * .55);
    body = grey(body, "#6D7A88", overcast * .6);
    shade = grey(shade, "#46525F", overcast * .6);
  }
  return { hi, body, shade };
}

// ---------- the Time Machine's words ----------
/**
 * A short label for the light: "golden hour", "midday", ... `rising` is true before solar noon and
 * `minsFromNoon` is the signed distance from solar noon in minutes ("midday" is within 75 minutes of it, at any altitude).
 */
export function skyLabel(alt, rising, minsFromNoon = null) {
  if (alt < -12) return "night";
  if (alt < -6) return rising ? "before dawn" : "dusk";
  if (alt < -.8) return rising ? "first light" : "twilight";
  if (alt < 6) return "golden hour";
  if (minsFromNoon != null && Math.abs(minsFromNoon) <= 75) return "midday";
  return rising ? "morning" : "afternoon";
}

/** The five legacy looks (dawn, day, golden, dusk, night) from altitude, so old CSS and code keep working. */
export function phaseFor(alt, rising) {
  if (alt < -8) return "night";
  if (alt < 0) return rising ? "dawn" : "dusk";
  if (alt < 10) return rising ? "dawn" : "golden";
  return "day";
}

/** A sun altitude and azimuth that stands for each forced ?sky= look. */
export const FORCED_SKY = {
  dawn:   { altitude: 2,   azimuth: 82 },
  day:    { altitude: 48,  azimuth: 130 },
  golden: { altitude: 6,   azimuth: 258 },
  dusk:   { altitude: -5,  azimuth: 274 },
  night:  { altitude: -30, azimuth: 330 }
};
