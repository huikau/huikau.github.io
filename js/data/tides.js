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

// Shared state: today's tides as parseTides() returns them. Ula's pick reads this.
export const tides = { status: "none", list: [] };
