// Boots the site. ?debug=1 exposes window.__huikau for tests.
import { $, params } from "./core/dom.js";
import { clock } from "./core/clock.js";
import { bus } from "./core/bus.js";
import { store } from "./core/store.js";
import { motion } from "./core/motion.js";
import { astro } from "./core/astro.js";
import { weather, weatherPresets, loadWeather, applyParsed } from "./data/weather.js";
import { loadTides, tides } from "./data/tides.js";
import { loadSurf, surf } from "./data/surf.js";
import { initSky } from "./sky/sky.js";
import { initMoon } from "./sky/bodies.js";
import { initSeasons } from "./ui/seasons.js";
import { initEggs, initGreenFlash, initWhales, initShootingStars, initIwa } from "./ui/eggs.js";
import { initFishing } from "./game/fishing.js";
import { initSound } from "./ui/sound.js";
import { initInstruments } from "./ui/instruments.js";

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
  if (forced) { Object.assign(weather, forced, { status: "live" }); bus.emit("weather", weather); return; }
  const r = await loadWeather();
  if (r.status === "none") { weather.status = "none"; return; } // no weather; the sky stays clear
  applyParsed(r.data, r.status);
  bus.emit("weather", weather);
}
refreshWeather();
setInterval(refreshWeather, 20 * 60000);

initMoon(clock);
initGreenFlash({ clock, weather });
initWhales({ month: mod.seasons.month });
initShootingStars();
initIwa();
initSound();

// ---------- Surf and tides ----------
async function refreshSurf() {
  if (!$("surf")) return;
  const r = await loadSurf();
  surf.status = r.status;
  surf.data = r.data;
  if (r.status !== "none") bus.emit("surf", surf);
}
refreshSurf();
setInterval(refreshSurf, 30 * 60000);

async function refreshTides() {
  if (!$("tides")) return;
  const r = await loadTides(clock.ymd());
  if (r.status === "none") return;
  tides.status = r.status;
  tides.list = r.data;
  bus.emit("tides", tides);
}
refreshTides();

if (p.get("debug") === "1") {
  window.__huikau = { clock, bus, store, astro, motion, weather, tides, surf, modules: mod };
}
