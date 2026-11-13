// Boots the site. ?debug=1 exposes window.__huikau for tests.
import { $, params } from "./core/dom.js";
import { clock } from "./core/clock.js";
import { bus } from "./core/bus.js";
import { store } from "./core/store.js";
import { motion } from "./core/motion.js";
import { astro } from "./core/astro.js";
import { createPerf } from "./core/perf.js";
import { weather, weatherPresets, loadWeather, applyParsed, loadForecast, forecast } from "./data/weather.js";
import { loadTides, loadTidesHourly, tides, tidesHourly } from "./data/tides.js";
import { loadSurf, surf } from "./data/surf.js";
import { initSky } from "./sky/sky.js";
import { initLand } from "./scene/land.js";
import { initUla } from "./scene/ula.js";
import { initCrew } from "./scene/crew.js";
import { initMoon } from "./sky/bodies.js";
import { initSeasons } from "./ui/seasons.js";
import { initEggs, initGreenFlash, initWhales, initShootingStars, initIwa } from "./ui/eggs.js";
import { initFishing } from "./game/fishing.js";
import { initSound } from "./ui/sound.js";
import { initSummary } from "./ui/summary.js";
import { initInstruments } from "./ui/instruments.js";
import { initSurface } from "./scene/surface.js";
import { initDive } from "./scene/dive.js";
import { initReef } from "./scene/reef.js";

const mod = {};
const p = params();
if (p.get("og") === "1") document.body.classList.add("og");

// The land and the cast listen for the first "sky" event, so they start before the sky does.
mod.land = initLand({ bus });
mod.ula = initUla({ bus, clock });
mod.crew = initCrew();

// The sky first (and its stars), then seasons, cards, fishing and eggs, in the same order as before.
mod.sky = initSky({ clock, bus });
setInterval(() => bus.emit("tick"), 30000);
clock.onChange(() => bus.emit("tick"));

mod.seasons = initSeasons(clock);
mod.instruments = initInstruments({ clock, bus, tides, weather });
mod.fishing = initFishing({ season: mod.seasons.season, bus, ula: mod.ula });
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
// The postcard painter is 30 KB and only needed on a click, so it loads then (and sw.js has it for offline).
let postcardReady;
const postcard = () => (postcardReady ||= import("./ui/postcard.js")
  .then((m) => m.initPostcard({ clock, bus, weather, bind: false }))
  .catch((e) => { postcardReady = null; console.warn("postcard:", e); throw e; })); // a failed fetch (offline) can be retried on the next click
for (const b of document.querySelectorAll("[data-postcard]")) b.addEventListener("click", () => postcard().then((pc) => pc.open(b)));
mod.postcard = { load: postcard };
mod.surface = initSurface({ clock, bus, weather });
mod.dive = initDive({ bus });
mod.reef = initReef({ bus });
mod.summary = initSummary({ clock, bus, weather, surf, tides });
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

// ---------- Offline and install (sw.js). Not on plain http, not under ?nosw=1, and not in automated browsers (the screenshot
// matrix blocks workers and would log a warning) unless the test asks with ?sw=1. ----------
if ("serviceWorker" in navigator) {
  const secure = location.protocol === "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  const automated = navigator.webdriver && p.get("sw") !== "1";
  if (p.get("nosw") === "1") navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
  else if (secure && !automated) addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      // a new version installs and takes over by itself; the page already open keeps running, the next load uses the new files
      addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(() => {});
  });
}

if (p.get("debug") === "1") {
  window.__huikau = { clock, bus, store, astro, motion, weather, tides, surf, modules: mod, perf: createPerf() };
}
