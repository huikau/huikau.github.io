// Boots the site. ?debug=1 exposes window.__huikau for tests.
import { $, params } from "./core/dom.js";
import { clock } from "./core/clock.js";
import { bus } from "./core/bus.js";
import { store } from "./core/store.js";
import { motion } from "./core/motion.js";
import { astro } from "./core/astro.js";
import { weather, weatherPresets, loadWeather, applyParsed, loadForecast, forecast } from "./data/weather.js";
import { loadTides, loadTidesHourly, tides, tidesHourly } from "./data/tides.js";
import { loadSurf, surf } from "./data/surf.js";
import { initSky } from "./sky/sky.js";
import { initMoon } from "./sky/bodies.js";
import { initSeasons } from "./ui/seasons.js";
import { initEggs, initGreenFlash, initWhales, initShootingStars, initIwa } from "./ui/eggs.js";
import { initFishing } from "./game/fishing.js";
import { initSound } from "./ui/sound.js";
import { initInstruments } from "./ui/instruments.js";
import { initSurface } from "./scene/surface.js";
import { initDive } from "./scene/dive.js";
import { initReef } from "./scene/reef.js";

const mod = {};
const p = params();
if (p.get("og") === "1") document.body.classList.add("og");

// The sky first (and its stars), then seasons, cards, fishing and eggs, in the same order as before.
mod.sky = initSky({ clock, bus });
setInterval(() => bus.emit("tick"), 30000);
clock.onChange(() => bus.emit("tick"));

mod.seasons = initSeasons(clock);
mod.instruments = initInstruments({ clock, bus, tides, weather });
mod.fishing = initFishing({ season: mod.seasons.season, bus });
initEggs();

// ---------- Weather ----------
async function refreshWeather() {
  const forced = weatherPresets[p.get("weather")];
  if (forced) { Object.assign(weather, forced, { status: "live" }); bus.emit("weather", weather); refreshForecast(); return; }
  const r = await loadWeather();
  if (r.status === "none") weather.status = "none"; // no weather; the sky stays clear
  else applyParsed(r.data, r.status, r.t);
  bus.emit("weather", weather);
  // NWS often has no wind or temperature: the instruments fall back to Open-Meteo's hourly forecast.
  if (r.status === "none" || !weather.wind || weather.tempF == null) refreshForecast();
}
async function refreshForecast() {
  const r = await loadForecast();
  forecast.status = r.status;
  forecast.list = r.data || [];
  forecast.t = r.t;
  bus.emit("forecast", forecast);
}
refreshWeather();
setInterval(refreshWeather, 20 * 60000);

initMoon(clock);
initGreenFlash({ clock, weather });
initWhales({ month: mod.seasons.month });
initShootingStars();
initIwa();
initSound();
mod.surface = initSurface({ clock, bus, weather });
mod.dive = initDive({ bus });
mod.reef = initReef({ bus });
mod.sky.updateSky(); // the sky event fired before the surface and dive were listening

// ---------- Surf and tides ----------
async function refreshSurf() {
  if (!$("surf")) return;
  const r = await loadSurf();
  surf.status = r.status;
  surf.data = r.data;
  surf.t = r.t;
  bus.emit("surf", surf); // also when there is no data, so the card can show its no-data state
}
refreshSurf();
setInterval(refreshSurf, 30 * 60000);

async function refreshTides() {
  if (!$("tides")) return;
  const ymd = clock.ymd();
  const [r, h] = await Promise.all([loadTides(ymd), loadTidesHourly(ymd)]);
  tides.status = r.status;
  tides.list = r.data || [];
  tides.t = r.t;
  tidesHourly.status = h.status;
  tidesHourly.list = h.data || [];
  tidesHourly.t = h.t;
  bus.emit("tides", tides); // also when there is no data, so the card can show its no-data state
}
refreshTides();

if (p.get("debug") === "1") {
  window.__huikau = { clock, bus, store, astro, motion, weather, tides, surf, modules: mod };
}
