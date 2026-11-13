// Honolulu weather from the National Weather Service (station PHNL).
import { fetchCached } from "../core/store.js";

export const WEATHER_URL = "https://api.weather.gov/stations/PHNL/observations/latest";

// Shared, mutable current conditions that the sky, rain, sound and surf card read.
export const weather = { text: "", desc: "", tempF: null, rain: false, clouds: 0, calm: 1, wind: null, status: "none", t: null };

export const weatherPresets = {
  clear: { text: "Clear", rain: false, clouds: 0, calm: 1 },
  cloudy: { text: "Mostly cloudy", rain: false, clouds: 3, calm: 1 },
  rain: { text: "Light rain", rain: true, clouds: 4, calm: .9 },
  downpour: { text: "Heavy rain", rain: true, clouds: 4, calm: .6 },
  windy: { text: "Breezy", rain: false, clouds: 2, calm: .45 }
};

const CLOUD_AMOUNTS = { CLR: 0, SKC: 0, FEW: 1, SCT: 2, BKN: 3, OVC: 4, VV: 4 };

/**
 * NWS observation JSON -> { text, rain, clouds (0-4), wind: {mph, from} | null, calm: number | null }.
 * Wind and temperature are often null in the feed; calm is null when there is no wind reading.
 */
export function parseWeather(json) {
  const p = json && json.properties;
  if (!p) return null;
  const raw = (p.presentWeather || []).map((w) => w.rawString || "").join(" ");
  const desc = p.textDescription || "";
  const rain = /RA|DZ|SH|TS/.test(raw) || /rain|shower|drizzle|thunder/i.test(desc);
  let clouds = Math.max(0, ...(p.cloudLayers || []).map((c) => CLOUD_AMOUNTS[c.amount] ?? 0));
  if (rain) clouds = Math.max(clouds, 3);
  const wind = p.windSpeed && p.windSpeed.value; // km/h
  const windFrom = p.windDirection && p.windDirection.value;
  const c = p.temperature && p.temperature.value;
  const tempF = c != null ? Math.round(c * 9 / 5 + 32) : null;
  return {
    rain, clouds, tempF,
    desc: desc && desc.charAt(0) + desc.slice(1).toLowerCase(),
    wind: wind == null ? null : { mph: Math.round(wind / 1.609), from: windFrom },
    calm: wind == null ? null : Math.min(1.15, Math.max(.45, 1 - (wind - 12) / 50)),
    text: [desc && desc.charAt(0) + desc.slice(1).toLowerCase(), c != null && `${Math.round(c * 9 / 5 + 32)}°F`].filter(Boolean).join(", ")
  };
}

/** Copy parsed conditions onto the shared `weather` object. */
export function applyParsed(w, status = "live", t = null) {
  weather.t = t;
  weather.desc = w.desc || "";
  weather.tempF = w.tempF ?? null;
  weather.rain = w.rain;
  weather.clouds = w.clouds;
  weather.wind = w.wind;
  weather.text = w.text;
  if (w.calm != null) weather.calm = w.calm;
  weather.status = status;
}

/** -> { status, data: parsed conditions or null, t } */
export function loadWeather(opts = {}) {
  return fetchCached("weather", WEATHER_URL, {
    init: { headers: { Accept: "application/geo+json" } }, parse: parseWeather, maxAge: 3 * 3600e3, ...opts
  });
}

// ---------- Hourly wind and temperature fallback (Open-Meteo), used only when the NWS reading has none ----------
export const FORECAST_URL = "https://api.open-meteo.com/v1/forecast?latitude=21.31&longitude=-157.86"
  + "&hourly=temperature_2m,wind_speed_10m,wind_direction_10m&temperature_unit=fahrenheit&wind_speed_unit=mph"
  + "&timezone=Pacific%2FHonolulu&forecast_days=2";

/** Open-Meteo hourly JSON -> [{ t: "YYYY-MM-DDTHH:MM", tempF, mph, from }] or null. */
export function parseForecast(json) {
  const h = json && json.hourly;
  if (!h || !Array.isArray(h.time)) return null;
  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const out = h.time.map((t, i) => ({
    t, tempF: num(h.temperature_2m && h.temperature_2m[i]) == null ? null : Math.round(h.temperature_2m[i]),
    mph: num(h.wind_speed_10m && h.wind_speed_10m[i]) == null ? null : Math.round(h.wind_speed_10m[i]),
    from: num(h.wind_direction_10m && h.wind_direction_10m[i])
  }));
  return out.length ? out : null;
}

/** The hourly entry for Honolulu wall-clock fields { year, month, day, hour } (the hour just passed), or null. */
export function forecastAt(list, f) {
  if (!Array.isArray(list)) return null;
  const p = (n) => String(n).padStart(2, "0");
  const key = `${f.year}-${p(f.month)}-${p(f.day)}T${p(f.hour)}:00`;
  return list.find((e) => e.t === key) || null;
}

export function loadForecast(opts = {}) {
  return fetchCached("forecast", FORECAST_URL, { parse: parseForecast, maxAge: 6 * 3600e3, ...opts });
}

export const forecast = { status: "none", list: [], t: null };
