// The Island Time Machine: a slim slider that scrubs the displayed time through the Honolulu day.
// It drives the clock (setHstMinutes / live); everything else follows the clock's change events.
import { $ } from "../core/dom.js";
import { clockTime } from "../core/clock.js";
import { sunPosition, sunTimes } from "../core/astro.js";
import { skyLabel } from "./palette.js";

/** The new slider value for a key press, or null if the key is not ours. Arrows 15 min, Page keys 1 h. */
export function stepForKey(key, value, max = 1439) {
  const to = (v) => Math.min(max, Math.max(0, v));
  switch (key) {
    case "ArrowRight": case "ArrowUp": return to(value + 15);
    case "ArrowLeft": case "ArrowDown": return to(value - 15);
    case "PageUp": return to(value + 60);
    case "PageDown": return to(value - 60);
    case "Home": return 0;
    case "End": return max;
    default: return null;
  }
}

/** "3:40 pm · golden hour" for minute `m` of the day shown by `clock`. */
export function readout(clock, m) {
  const ms = clock.now() + (m - clock.minutesExact()) * 60e3;
  const sun = sunTimes(new Date(ms - 10 * 3600e3));
  const rising = m < (sun.rise + sun.set) / 2;
  return `${clockTime(m)} · ${skyLabel(sunPosition(ms).altitude, rising, m - (sun.rise + sun.set) / 2)}`;
}

export function initTimeMachine({ clock, bus }) {
  const host = $("timemachine");
  if (!host) return null;
  host.innerHTML = `
    <label class="tm-label" for="tm-range">Island time machine</label>
    <div class="tm-row">
      <div class="tm-track">
        <input class="tm-range" id="tm-range" type="range" min="0" max="1439" step="1" value="0">
        <ol class="tm-ticks" aria-hidden="true">
          <li data-t="midnight">midnight</li><li data-t="dawn">dawn</li><li data-t="noon">noon</li><li data-t="sunset">sunset</li>
        </ol>
      </div>
      <button class="tm-live" id="tm-live" type="button" aria-pressed="true">Live</button>
    </div>
    <output class="tm-readout" id="tm-readout" for="tm-range"></output>`;
  const range = $("tm-range"), live = $("tm-live"), out = $("tm-readout");
  const ticks = Object.fromEntries([...host.querySelectorAll(".tm-ticks li")].map((li) => [li.dataset.t, li]));
  let dragging = false;

  function place(m) {
    const sun = sunTimes(clock.hst());
    const pct = (v) => `${(v / 1439 * 100).toFixed(2)}%`;
    ticks.midnight.style.left = "0%";
    ticks.dawn.style.left = pct(sun.rise);
    ticks.noon.style.left = pct(720);
    ticks.sunset.style.left = pct(sun.set);
  }

  function sync() {
    const m = Math.round(clock.minutesExact());
    if (!dragging || +range.value !== m) range.value = Math.min(1439, m);
    const text = readout(clock, m);
    out.textContent = text;
    range.setAttribute("aria-valuetext", text + (clock.isLive ? " (live)" : ""));
    live.disabled = clock.isLive;
    live.setAttribute("aria-pressed", String(clock.isLive));
    host.classList.toggle("scrubbed", !clock.isLive);
    range.style.setProperty("--tm-fill", `${(m / 1439 * 100).toFixed(2)}%`);
    place(m);
  }

  range.addEventListener("input", () => { dragging = true; clock.setHstMinutes(+range.value); });
  range.addEventListener("change", () => { dragging = false; });
  range.addEventListener("pointerup", () => { dragging = false; });
  range.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const v = stepForKey(e.key, +range.value);
    if (v == null) return;
    e.preventDefault();
    range.value = v;
    clock.setHstMinutes(v);
  });
  live.addEventListener("click", () => { clock.live(); range.focus(); });
  clock.onChange(sync);
  bus?.on("tick", sync); // keeps the thumb moving while live
  sync();
  host.hidden = false;
  return { sync };
}

