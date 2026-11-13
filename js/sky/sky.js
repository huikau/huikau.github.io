// The sky: which of the five looks applies, the clock line, stars, clouds and rain.
import { $, params, scene } from "../core/dom.js";
import { sunTimes, skyFor, sunPosition } from "../core/astro.js";
import { clockTime, duration } from "../core/clock.js";
import { weather } from "../data/weather.js";
import { initStars } from "./stars.js";
import { renderClouds } from "./clouds.js";
import { initRain } from "./rain.js";

export const SKIES = ["dawn", "day", "golden", "dusk", "night"];

/** The sentence under the logo. */
export function clockLine(m, sun, weatherText) {
  let next;
  if (m < sun.rise) next = `Sunrise in ${duration(sun.rise - m)}.`;
  else if (m < sun.set) next = `Sunset in ${duration(sun.set - m)}.`;
  else next = `Sunrise in ${duration(1440 - m + sun.rise)}.`;
  const toSunset = sun.set - m;
  if (toSunset > 0 && toSunset <= 5) next = "Watch the horizon for the green flash.";
  return `${clockTime(m)} in Honolulu. ${weatherText ? weatherText + ". " : ""}${next}`;
}

export function initSky({ clock, bus }) {
  const sceneEl = scene();

  function updateSky() {
    const now = clock.hst(), m = clock.minutes(), sun = sunTimes(now);
    const forced = params().get("sky");
    const mode = SKIES.includes(forced) ? forced : skyFor(m, sun);
    sceneEl.dataset.sky = mode;
    bus.emit("sky", { ...sunPosition(clock.now()), phase: mode, colors: null });

    const line = $("clock-text");
    if (line) line.textContent = clockLine(m, sun, weather.text);
  }
  updateSky();
  initStars();
  const rain = initRain(weather);

  function applyWeather() {
    // light rain and drizzle fall softer, heavy rain and thunderstorms harder
    rain.set(!weather.rain ? 0 : /heavy|thunder/i.test(weather.text) ? 1.7 : /light|drizzle/i.test(weather.text) ? .7 : 1);
    renderClouds(weather.clouds);
    sceneEl.style.setProperty("--calm", weather.calm);
    updateSky();
  }
  bus.on("weather", applyWeather);
  bus.on("tick", updateSky);
  return { updateSky, rain };
}
