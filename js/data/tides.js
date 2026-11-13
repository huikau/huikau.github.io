// Tides at Honolulu Harbor, from NOAA (station 1612340).
import { fetchCached } from "../core/store.js";

export const tidesUrl = (ymd) => "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=huikau.com"
  + `&begin_date=${ymd}&range=24&datum=MLLW&station=1612340&time_zone=lst_ldt&units=english&interval=hilo&format=json`;

/** NOAA hi/lo JSON -> [{ m: minutes after midnight, high: boolean, v: feet, t: "YYYY-MM-DD HH:MM" }]. */
export function parseTides(json) {
  const list = json && json.predictions;
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const p of list) {
    if (!p || typeof p.t !== "string") continue;
    const [hh, mm] = p.t.slice(11).split(":").map(Number);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue;
    out.push({ m: hh * 60 + mm, high: p.type === "H", v: Number(p.v), t: p.t });
  }
  return out;
}

/** -> { status: "live" | "cached" | "none", data: tide list or null, t } */
export function loadTides(ymd, opts = {}) {
  return fetchCached(`tides-${ymd}`, tidesUrl(ymd), { parse: parseTides, ...opts });
}

/** Hourly predictions (the tide curve): same station, interval=h, today and tomorrow. */
export const tidesHourlyUrl = (ymd) => tidesUrl(ymd).replace("interval=hilo", "interval=h").replace("range=24", "range=48");

/** Minutes from midnight of Honolulu day `ymd` ("YYYYMMDD") to a NOAA "YYYY-MM-DD HH:MM" stamp (can pass 1440). */
export function tideMinutes(t, ymd) {
  const y = +t.slice(0, 4), mo = +t.slice(5, 7), d = +t.slice(8, 10), hh = +t.slice(11, 13), mm = +t.slice(14, 16);
  const base = Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8));
  return Math.round((Date.UTC(y, mo - 1, d, hh, mm) - base) / 60000);
}

/** NOAA hourly JSON -> [{ t, v }] sorted by time (feet); junk rows are dropped. */
export function parseHourly(json) {
  const list = json && json.predictions;
  if (!Array.isArray(list)) return [];
  return list
    .filter((p) => p && typeof p.t === "string" && /^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(p.t) && Number.isFinite(Number(p.v)))
    .map((p) => ({ t: p.t, v: Number(p.v) }));
}

/** -> { status, data: hourly list or null, t } */
export function loadTidesHourly(ymd, opts = {}) {
  return fetchCached(`tides-h-${ymd}`, tidesHourlyUrl(ymd), { parse: parseHourly, ...opts });
}

// Shared state: today's tides as parseTides() returns them. Ula's pick reads this.
// `t` is when the data was fetched (epoch ms), for the "from earlier" marker.
export const tides = { status: "none", list: [], t: null };
// The hourly curve behind the tide chart (optional: the chart falls back to the hi/lo list).
export const tidesHourly = { status: "none", list: [], t: null };
