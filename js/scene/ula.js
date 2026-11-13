// Ula in her center-console boat: an illustration (assets/img/ula-boat.webp) floated on the water, with the fishing line
// drawn from the tip of the rod she is holding to the bobber. The game drives the line with ula.setLine(state) and her
// reactions with ula.react(mood). Everything is placed in the rig's own coordinates (320 x 150), so the line's far end
// always lands on the bobber button and its near end on the rod tip, at every width.
import { $ } from "../core/dom.js";

/** Where the line meets the bobber's stub (the bobber button sits at left 270, top 92, and its stub starts at the top of its svg). */
export const BOBBER = { x: 285, y: 92 };

/** The boat illustration's box in rig coordinates (its file is 740 x 493). */
export const BOAT = { x: -14, y: -28, w: 270, h: 180, src: { w: 740, h: 493 } };

/** A point in the illustration's own pixels, in rig coordinates. */
export const boatPoint = (ix, iy) => ({ x: BOAT.x + ix * BOAT.w / BOAT.src.w, y: BOAT.y + iy * BOAT.h / BOAT.src.h });

/** The rod tip: in the illustration it is at (632, 40); rounded to whole rig units so the CSS keyframes can name it. */
export const TIP = { x: 217, y: -13 };

/** The line for each state, from the rod tip to the bobber: slack while she waits, taut on a bite, limp when one gets away. */
export const LINE_STATES = {
  idle:    { cord: "M217 -13Q236 82 285 92" },
  waiting: { cord: "M217 -13Q236 82 285 92" },
  cast:    { cord: "M217 -13Q262 40 285 92" },
  bite:    { cord: "M217 -13L285 92" },
  reel:    { cord: "M217 -13Q254 46 285 92" },
  landed:  { cord: "M217 -13Q224 92 285 92" },
  gotaway: { cord: "M217 -13Q212 122 285 92" }
};
export const STATES = Object.keys(LINE_STATES);

/** The drawing over the boat: the sea lapping at the hull (so she floats in it, not on it), the T-top light's glow (dusk and night) and the line. */
export function boatMarkup() {
  const s = LINE_STATES.idle, light = boatPoint(375, 50);
  return `
  <defs><radialGradient id="ula-light-glow"><stop offset="0" stop-color="#FFE7A8" stop-opacity=".9"/><stop offset=".35" stop-color="#F5A623" stop-opacity=".35"/><stop offset="1" stop-color="#F5A623" stop-opacity="0"/></radialGradient></defs>
  <ellipse class="ula-light" cx="${light.x.toFixed(1)}" cy="${light.y.toFixed(1)}" rx="34" ry="20" fill="url(#ula-light-glow)"/>
  <path class="ula-wash" d="M-10 152L-10 143Q0 138 12 142T36 142T60 142T84 143T108 143T132 142T156 142T180 141Q194 139 206 135L214 152Z"/>
  <path class="ula-wash-crest" d="M-10 143Q0 138 12 142T36 142T60 142T84 143T108 143T132 142T156 142T180 141Q194 139 206 135"/>
  <path class="ula-spray" d="M206 130q6-5 12-2M212 136q7-3 12 1"/>
  <path class="cord-key" d="${s.cord}"/>
  <path class="cord" d="${s.cord}"/>
  <circle class="ula-tip" cx="${TIP.x}" cy="${TIP.y}" r="1.8"/>`;
}

/** Apply a state to the SVG's cord. */
function drawLine(svg, state) {
  const s = LINE_STATES[state];
  svg.querySelectorAll(".cord, .cord-key").forEach((c) => c.setAttribute("d", s.cord));
}

export function initUla({ bus, clock } = {}) {
  const frame = $("ula-frame"), svg = $("canoe"), rig = $("rig");
  if (!frame || !svg) return null;
  svg.innerHTML = boatMarkup();
  // the rod and line used to be a separate drawing inside the rig; the boat's overlay draws the line now
  rig?.querySelectorAll(":scope > svg.line").forEach((n) => n.remove());

  let state = "idle";
  const setLine = (next) => {
    if (!LINE_STATES[next]) return state;
    state = next;
    svg.dataset.line = next;
    drawLine(svg, next);
    return state;
  };
  setLine("idle");

  /** "yay": the boat hops twice. "meh": it sways back. The line's near end moves with it (same class on the overlay). */
  const react = (mood) => {
    if (mood !== "yay" && mood !== "meh") return;
    for (const el of [frame, svg]) { el.classList.remove("yay", "meh"); void el.offsetWidth; el.classList.add(mood); }
  };
  frame.addEventListener("animationend", (e) => {
    if (e.animationName !== "boat-hop" && e.animationName !== "boat-sway") return;
    for (const el of [frame, svg]) el.classList.remove("yay", "meh");
  });

  return { setLine, react, el: frame, get state() { return state; } };
}
