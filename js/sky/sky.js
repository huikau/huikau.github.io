// The sky engine: sun altitude in, a continuous sky out. Writes the palette to :root as custom properties,
// places the sun and moon, drives the stars, clouds and rain, and keeps the clock line and Time Machine current.
import { $, params, scene } from "../core/dom.js";
import { sunTimes, sunPosition } from "../core/astro.js";
import { clockTime, duration } from "../core/clock.js";
import { weather } from "../data/weather.js";
import { initStars } from "./stars.js";
import { renderClouds } from "./clouds.js";
import { initRain } from "./rain.js";
import { initBodies, bodyPlace, currentMoonPhase, moonPositionForPhase } from "./bodies.js";
import { skyPalette, cloudTints, phaseFor, FORCED_SKY } from "./palette.js";
import { initTimeMachine } from "./timemachine.js";

export const SKIES = ["dawn", "day", "golden", "dusk", "night"];

/** The sentence under the logo. When the Time Machine is scrubbing, the weather is left out (it is for now, not then). */
export function clockLine(m, sun, weatherText, scrubbed = false) {
  let next;
  if (m < sun.rise) next = `Sunrise in ${duration(sun.rise - m)}.`;
  else if (m < sun.set) next = `Sunset in ${duration(sun.set - m)}.`;
  else next = `Sunrise in ${duration(1440 - m + sun.rise)}.`;
  const toSunset = sun.set - m;
  if (toSunset > 0 && toSunset <= 5) next = "Watch the horizon for the green flash.";
  if (scrubbed) return `Time machine: ${clockTime(m)} in Honolulu. ${next}`;
  return `${clockTime(m)} in Honolulu. ${weatherText ? weatherText + ". " : ""}${next}`;
}

/** The sky variables other layers read. */
export function cssVars(p, sunPlace, moonPlace, glowRx) {
  return {
    "--sky-top": p.top, "--sky-mid": p.mid, "--sky-horizon": p.horizon,
    "--sun-glow": p.glow, "--sun-glow-soft": p.glowSoft, "--haze": p.haze, "--text-on-sky": p.textOnSky,
    "--sun-x": `${sunPlace.x.toFixed(2)}%`, "--sun-y": `${sunPlace.y.toFixed(2)}%`, "--glow-rx": `${glowRx.toFixed(1)}%`,
    "--moon-x": `${moonPlace.x.toFixed(2)}%`, "--moon-y": `${moonPlace.y.toFixed(2)}%`
  };
}

export function initSky({ clock, bus }) {
  const sceneEl = scene();
  const root = document.documentElement;
  const stars = initStars();
  const bodies = initBodies();
  const rain = initRain(weather);
  const cloudsEl = $("clouds");

  function updateSky() {
    const ms = clock.now(), m = clock.minutesExact(), sun = sunTimes(clock.hst());
    const forced = params().get("sky");
    const force = SKIES.includes(forced) ? FORCED_SKY[forced] : null;
    const pos = force || sunPosition(ms);
    const rising = m < (sun.rise + sun.set) / 2;
    const phase = SKIES.includes(forced) ? forced : phaseFor(pos.altitude, rising);
    const pal = skyPalette(pos.altitude);

    let moon = moonPositionForPhase(ms, currentMoonPhase(ms));
    if (forced === "night") moon = { altitude: 42, azimuth: 118 };
    else if (forced === "dusk") moon = { altitude: 18, azimuth: 100 };

    const sunPlace = bodyPlace(pos.altitude, pos.azimuth);
    const moonPlace = bodyPlace(moon.altitude, moon.azimuth);
    // the glow follows the sun, and narrows as it climbs
    const glowRx = 62 - 30 * Math.min(1, Math.max(0, pos.altitude / 50));
    const vars = cssVars(pal, sunPlace, moonPlace, glowRx);
    for (const k in vars) root.style.setProperty(k, vars[k]);
    sceneEl.dataset.sky = phase;

    // moon glow at night only: light the sky near the moon when it is up and the sun is well down
    const moonUp = Math.min(1, Math.max(0, (moon.altitude + 2) / 8)) * (1 - pal.day) * (pos.altitude < -2 ? 1 : 0);
    root.style.setProperty("--moon-glow-a", (.3 * moonUp).toFixed(3));

    // clouds: lit from the sun's side (or the moon's at night)
    if (cloudsEl) {
      const lightX = pos.altitude > -6 ? sunPlace.x : moonPlace.x;
      const overcast = weather.rain ? .85 : weather.clouds >= 3 ? .45 : weather.clouds === 2 ? .15 : 0;
      const tint = cloudTints(pos.altitude, pal, overcast);
      cloudsEl.style.setProperty("--cloud-hi", tint.hi);
      cloudsEl.style.setProperty("--cloud-body", tint.body);
      cloudsEl.style.setProperty("--cloud-shade", tint.shade);
      cloudsEl.style.setProperty("--lit", lightX > 50 ? "1" : "-1");
    }

    stars.setAlpha(pal.stars);
    bodies.update({ sun: pos, moon, phase: currentMoonPhase(ms), palette: pal });

    const line = $("clock-text");
    if (line) line.textContent = clockLine(Math.floor(m), sun, weather.text, !clock.isLive);
    bus.emit("sky", { altitude: pos.altitude, azimuth: pos.azimuth, phase, colors: pal });
  }

  function applyWeather() {
    // light rain and drizzle fall softer, heavy rain and thunderstorms harder
    rain.set(!weather.rain ? 0 : /heavy|thunder/i.test(weather.text) ? 1.7 : /light|drizzle/i.test(weather.text) ? .7 : 1);
    renderClouds(weather.clouds);
    sceneEl.style.setProperty("--calm", weather.calm);
    updateSky();
  }

  updateSky();
  initTimeMachine({ clock, bus });
  bus.on("weather", applyWeather);
  bus.on("tick", updateSky);
  return { updateSky, rain };
}
