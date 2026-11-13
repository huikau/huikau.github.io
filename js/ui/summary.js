// The plain-text "Right now in Honolulu..." summary for screen readers: one short paragraph that restates what the
// scene and the instruments show (time and sky, weather, wind, surf, the next tide). Not a live region (it would chatter
// every half minute); a reader finds it at the top of the page and reads the current text.
import { $ } from "../core/dom.js";
import { readout } from "../sky/timemachine.js";
import { nextChange, nextText } from "./instruments.js";
import { windRow } from "../data/surf.js";

/** The sentences, from plain data. Pure, so it runs in Node. */
export function summaryText({ clock, weather = {}, surf = {}, tides = {} }) {
  const m = Math.round(clock.minutesExact());
  const parts = [`${clock.isLive ? "Right now in Honolulu" : "In Honolulu, on the island time machine"}, it is ${readout(clock, m).replace(" · ", ", ")}.`];
  if (weather.status && weather.status !== "none" && weather.text) parts.push(`${weather.text.replace(/\.$/, "")}.`);
  const wind = windRow(weather.wind);
  if (wind) parts.push(`Wind: ${wind[1]}.`);
  if (surf.data) parts.push(`Surf: ${surf.data.rows[0][1].replace(/^/, "waves ")}. ${surf.data.call}`);
  if (tides.list && tides.list.length) parts.push(nextText(nextChange(tides.list, clock.ymd(), clock.minutesExact())));
  return parts.join(" ");
}

export function initSummary({ clock, bus, weather, surf, tides }) {
  const el = $("right-now");
  if (!el) return null;
  const update = () => { const t = summaryText({ clock, weather, surf, tides }); if (el.textContent !== t) el.textContent = t; };
  for (const type of ["tick", "weather", "surf", "tides"]) bus.on(type, update);
  update();
  return { update };
}
