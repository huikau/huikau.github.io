// Surf report off Honolulu, from Open-Meteo's marine forecast.
import { fetchCached } from "../core/store.js";

export const SURF_URL = "https://marine-api.open-meteo.com/v1/marine?latitude=21.26&longitude=-157.84"
  + "&current=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,sea_surface_temperature"
  + "&length_unit=imperial&timezone=Pacific%2FHonolulu";

const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
export const compass = (deg) => deg == null ? "" : POINTS[Math.round(deg / 22.5) % 16];

export const surfCall = (h) =>
  h < 1 ? "Flat. A good day for fishing." :
  h < 3 ? "Small and friendly." :
  h < 6 ? "Fun-size surf." :
  h < 10 ? "Solid. Experienced surfers only." :
  "Big. Watch from the beach.";

/** Open-Meteo marine JSON -> { height, call, rows: [[label, text]] } or null. */
export function parseSurf(json) {
  const c = json && json.current;
  if (!c || c.wave_height == null) return null;
  const h = c.wave_height;
  const rows = [["Waves", `${h.toFixed(1)} ft from the ${compass(c.wave_direction)}`]];
  if (c.swell_wave_height != null) {
    rows.push(["Swell", `${c.swell_wave_height.toFixed(1)} ft at ${Math.round(c.swell_wave_period)} s from the ${compass(c.swell_wave_direction)}`]);
  }
  if (c.sea_surface_temperature != null) rows.push(["Water", `${Math.round(c.sea_surface_temperature * 9 / 5 + 32)}°F`]);
  return { height: h, call: surfCall(h), rows };
}

/** The wind row, from the shared weather reading; null when there is none. */
export function windRow(wind) {
  if (!(wind && wind.mph != null)) return null;
  return ["Wind", wind.mph < 2 ? "Calm" : `${wind.mph} mph${wind.from != null ? ` from the ${compass(wind.from)}` : ""}`];
}

/** -> { status, data: parseSurf() result or null, t } */
export function loadSurf(opts = {}) {
  return fetchCached("surf", SURF_URL, { parse: parseSurf, maxAge: 6 * 3600e3, ...opts });
}

export const surf = { status: "none", data: null };
