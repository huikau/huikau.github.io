// Honolulu weather from the National Weather Service (station PHNL).
import { fetchCached } from "../core/store.js";

export const WEATHER_URL = "https://api.weather.gov/stations/PHNL/observations/latest";

// Shared, mutable current conditions that the sky, rain, sound and surf card read.
export const weather = { text: "", rain: false, clouds: 0, calm: 1, wind: null, status: "none" };

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
  return {
    rain, clouds,
    wind: wind == null ? null : { mph: Math.round(wind / 1.609), from: windFrom },
    calm: wind == null ? null : Math.min(1.15, Math.max(.45, 1 - (wind - 12) / 50)),
    text: [desc && desc.charAt(0) + desc.slice(1).toLowerCase(), c != null && `${Math.round(c * 9 / 5 + 32)}°F`].filter(Boolean).join(", ")
  };
}

/** Copy parsed conditions onto the shared `weather` object. */
export function applyParsed(w, status = "live") {
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
