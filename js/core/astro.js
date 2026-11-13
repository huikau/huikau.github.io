// Sun and moon for Honolulu. Pure functions, no DOM, no clock: pass in the time.
//
// "HST Date" below means a Date whose getUTC* fields are Honolulu wall-clock values
// (see clock.hst()). Positions take plain epoch milliseconds.
const RAD = Math.PI / 180;
export const HONOLULU = { lat: 21.3069, lon: -157.8583 };
export const SYNODIC = 29.530588853;

const dayOfYear = (d) => Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5);

// NOAA's simplified solar equations: equation of time (minutes) and declination (radians).
function solarTerms(g) {
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  return { eqTime, decl };
}

/** Sunrise and sunset for Honolulu, in minutes after local midnight. `d` is an HST Date. */
export function sunTimes(d) {
  const lat = HONOLULU.lat * RAD, lon = HONOLULU.lon;
  const g = 2 * Math.PI / 365 * (dayOfYear(d) - 1);
  const { eqTime, decl } = solarTerms(g);
  const ha = Math.acos(Math.cos(90.833 * RAD) / (Math.cos(lat) * Math.cos(decl)) - Math.tan(lat) * Math.tan(decl)) * 180 / Math.PI;
  const toLocal = (utcMinutes) => ((utcMinutes - 600) % 1440 + 1440) % 1440;
  return { rise: toLocal(720 - 4 * (lon + ha) - eqTime), set: toLocal(720 - 4 * (lon - ha) - eqTime) };
}

/** Sunrise and sunset for the Honolulu day containing epoch-ms `ms`. */
export const sunTimesAt = (ms) => sunTimes(new Date(ms - 10 * 3600e3));

/** Which of the five sky looks applies at minute `m` of the day. `sun` is { rise, set }. */
export function skyFor(m, sun) {
  if (m < sun.rise - 50 || m > sun.set + 50) return "night";
  if (m < sun.rise + 40) return "dawn";
  if (m < sun.set - 70) return "day";
  if (m < sun.set + 15) return "golden";
  return "dusk";
}

/**
 * Where the sun is over Honolulu at epoch-ms `ms`.
 * altitude: degrees above the horizon (geometric, no refraction; the sun's centre is at about -0.83 at sunrise).
 * azimuth: degrees clockwise from north (90 = east, 180 = south, 270 = west).
 */
export function sunPosition(ms) {
  const d = new Date(ms);
  const hour = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600 + d.getUTCMilliseconds() / 3600e3;
  const g = 2 * Math.PI / 365 * (dayOfYear(d) - 1 + (hour - 12) / 24);
  const { eqTime, decl } = solarTerms(g);
  const lat = HONOLULU.lat * RAD;
  const tst = (((hour * 60 + eqTime + 4 * HONOLULU.lon) % 1440) + 1440) % 1440; // true solar time, minutes
  const ha = (tst / 4 - 180) * RAD;
  const altitude = Math.asin(Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha)) / RAD;
  const fromSouth = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat));
  const azimuth = ((fromSouth / RAD + 180) % 360 + 360) % 360;
  return { altitude, azimuth };
}

// ---------- Moon ----------
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

/** Moon phase as a fraction of the cycle: 0 new, .25 first quarter, .5 full, .75 last quarter. */
export function moonPhase(ms) {
  return (((ms - KNOWN_NEW_MOON) / 864e5 / SYNODIC) % 1 + 1) % 1;
}

/** Percent of the disc that is lit, 0-100. */
export const moonIllumination = (p) => (1 - Math.cos(2 * Math.PI * p)) / 2 * 100;

export function moonPhaseName(p) {
  return p < .034 || p > .966 ? "New moon" : p < .216 ? "Waxing crescent" : p < .284 ? "First quarter"
    : p < .466 ? "Waxing gibbous" : p < .534 ? "Full moon" : p < .716 ? "Waning gibbous" : p < .784 ? "Last quarter" : "Waning crescent";
}

/** The next full or new moon: { name, days } counted from phase `p`. */
export function nextMoonEvent(p) {
  const daysTo = (target) => ((target - p) % 1 + 1) % 1 * SYNODIC;
  return daysTo(.5) < daysTo(1) ? { name: "Full moon", days: daysTo(.5) } : { name: "New moon", days: daysTo(1) };
}

/** "tonight", "tomorrow" or "in N days". */
export const inDays = (days) => days < 1 ? "tonight" : days < 2 ? "tomorrow" : `in ${Math.round(days)} days`;

/**
 * Approximate moon position over Honolulu (good to a few degrees): the moon sits
 * 360 x phase degrees of ecliptic longitude ahead of the sun, and its latitude is ignored.
 */
export function moonPosition(ms) {
  const days = (ms - Date.UTC(2000, 0, 1, 12)) / 864e5; // since J2000
  const meanLon = 280.460 + 0.9856474 * days;
  const anomaly = (357.528 + 0.9856003 * days) * RAD;
  const sunLon = (meanLon + 1.915 * Math.sin(anomaly) + 0.020 * Math.sin(2 * anomaly)) * RAD;
  const lon = sunLon + 2 * Math.PI * moonPhase(ms);
  const obliq = 23.4393 * RAD;
  const ra = Math.atan2(Math.cos(obliq) * Math.sin(lon), Math.cos(lon));
  const dec = Math.asin(Math.sin(obliq) * Math.sin(lon));
  const gmst = (280.46061837 + 360.98564736629 * days) * RAD;
  const ha = gmst + HONOLULU.lon * RAD - ra;
  const lat = HONOLULU.lat * RAD;
  const altitude = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha)) / RAD;
  const fromSouth = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat));
  return { altitude, azimuth: ((fromSouth / RAD + 180) % 360 + 360) % 360 };
}

export const astro = {
  HONOLULU, SYNODIC, sunTimes, sunTimesAt, skyFor, sunPosition,
  moonPhase, moonIllumination, moonPhaseName, nextMoonEvent, inDays, moonPosition
};
