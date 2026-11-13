// The cards under the scene: word of the day, tides, surf report, and "Today on the water".
import { $, fillDl } from "../core/dom.js";
import { clockTime } from "../core/clock.js";
import { sunTimes, moonIllumination, moonPhaseName, nextMoonEvent, inDays } from "../core/astro.js";
import { wordOfDay } from "../data/hawaiian.js";
import { windRow } from "../data/surf.js";
import { currentMoonPhase } from "../sky/bodies.js";

/**
 * Ula's pick for when to go out. `now` is minutes after midnight, `sun` is { rise, set },
 * `tides` is a parseTides() list. Anglers like moving water around a tide change, best of all near sunrise or sunset.
 */
export function ulasPick(now, sun, tides) {
  const daylight = (m) => m >= sun.rise - 45 && m <= sun.set + 45;
  const upcoming = tides.filter((t) => t.m >= now - 20 && daylight(t.m));
  if (upcoming.length) {
    const nearSun = (m) => Math.min(Math.abs(m - sun.rise), Math.abs(m - sun.set));
    const best = upcoming.reduce((a, b) => (nearSun(b.m) < nearSun(a.m) ? b : a));
    let when = "";
    if (Math.abs(best.m - sun.set) <= 75) when = best.m <= sun.set ? ", just before sunset" : ", right after sunset";
    else if (Math.abs(best.m - sun.rise) <= 75) when = best.m <= sun.rise ? ", just before sunrise" : ", right after sunrise";
    const lead = best.m <= now + 10 ? "Ula's out now for" : "Ula's heading out for";
    return `${lead} the ${clockTime(best.m)} ${best.high ? "high" : "low"} tide${when}.`;
  }
  if (now < sun.rise) return `Ula's heading out at sunrise, ${clockTime(sun.rise)}.`;
  if (now < sun.set - 60) return `Ula's heading out for the evening bite, around ${clockTime(sun.set - 60)}.`;
  if (now < sun.set) return "Ula's out now for the sunset bite.";
  return `Ula's done for today. She'll be back out at sunrise, around ${clockTime(sun.rise)}.`;
}

/** The rows of the "Today on the water" card. */
export function todayRows(sun, phase) {
  const next = nextMoonEvent(phase);
  return [
    ["Sunrise", clockTime(sun.rise)],
    ["Sunset", clockTime(sun.set)],
    ["Moon", `${moonPhaseName(phase)}, ${Math.round(moonIllumination(phase))}% lit`],
    ["Coming up", `${next.name} ${inDays(next.days)}`]
  ];
}

export function initInstruments({ clock, bus, tides, weather }) {
  // ---- word of the day ----
  if ($("word-term")) {
    const [term, meaning] = wordOfDay(clock.now());
    $("word-term").textContent = term;
    $("word-meaning").textContent = meaning;
  }
  if ($("year")) $("year").textContent = clock.fields().year;

  // ---- Today on the water ----
  function renderToday() {
    const box = $("today");
    if (!box) return;
    const d = clock.hst(), now = clock.minutes(), sun = sunTimes(d);
    $("today-pick").textContent = ulasPick(now, sun, tides.list);
    fillDl($("today-stats"), todayRows(sun, currentMoonPhase(clock.now())));
  }

  // ---- tides ----
  function renderTides() {
    const box = $("tides");
    if (!box || !tides.list.length) return;
    const now = clock.minutes();
    const ul = $("tides-list");
    ul.innerHTML = "";
    let marked = false;
    for (const p of tides.list) {
      const li = document.createElement("li");
      const isNext = !marked && p.m >= now;
      if (isNext) { li.className = "next"; marked = true; }
      else if (p.m < now) li.className = "past";
      li.innerHTML = `<span>${p.high ? "High tide" : "Low tide"}${isNext ? '<span class="sr-only"> (next)</span>' : ""}</span>`
        + `<span class="when">${clockTime(p.m)}</span><span class="height">${p.v.toFixed(1)} ft</span>`;
      ul.appendChild(li);
    }
    box.hidden = false;
  }

  // ---- surf report (wind is added from the weather reading, whenever either arrives) ----
  let surfData = null;
  function renderSurf() {
    const box = $("surf");
    if (!box || !surfData) return;
    $("surf-call").textContent = surfData.call;
    const all = surfData.rows.slice();
    const wind = windRow(weather.wind);
    $("surf-wind-source").hidden = !wind;
    if (wind) all.push(wind);
    fillDl($("surf-stats"), all);
    box.hidden = false;
  }

  bus.on("tides", renderTides);
  bus.on("tides", renderToday);
  bus.on("surf", (s) => { surfData = s && s.data; renderSurf(); });
  bus.on("weather", () => { if (surfData) renderSurf(); });
  bus.on("tick", renderToday);
  renderToday();
  return { renderToday, renderTides, renderSurf, ulasPick };
}
