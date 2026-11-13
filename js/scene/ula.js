// Ula and her waʻa (outrigger canoe): an illustrated hull on the water, her portrait in a lauhala-rimmed round frame,
// and a rod and line the game can drive with ula.setLine(state). Everything is drawn in the rig's own coordinates
// (320 x 150), so the line's far end always lands on the bobber button, at every width.
import { $ } from "../core/dom.js";

/** Where the line meets the bobber's stub (the bobber button sits at left 270, top 92, and its stub starts at the top of its svg). */
export const BOBBER = { x: 285, y: 92 };

/** The rod and the line for each state: rod path and cord path, in rig coordinates. */
export const LINE_STATES = {
  idle:    { rod: "M84 100Q150 50 190 2",  cord: "M190 2Q232 92 285 92" },
  waiting: { rod: "M84 100Q150 50 190 2",  cord: "M190 2Q232 92 285 92" },
  cast:    { rod: "M84 100Q132 62 204 16", cord: "M204 16Q250 52 285 92" },
  bite:    { rod: "M84 100Q140 66 184 24", cord: "M184 24L285 92" },
  reel:    { rod: "M84 100Q136 72 172 30", cord: "M172 30Q232 58 285 92" },
  landed:  { rod: "M84 100Q124 44 148 -8", cord: "M148 -8Q196 62 285 92" },
  gotaway: { rod: "M84 100Q148 46 182 -4", cord: "M182 -4Q210 108 285 92" }
};
export const STATES = Object.keys(LINE_STATES);

/** The canoe, drawn behind the portrait. Flat fills, two or three tones, an ink keyline. */
export function canoeMarkup() {
  const s = LINE_STATES.idle;
  return `
  <g class="ula-ama">
    <path class="ula-iako" d="M52 124L44 146M156 124L148 146"/>
    <path class="ula-float" d="M18 146Q30 139 70 139L150 139Q184 139 204 148Q176 155 140 155L60 155Q30 155 18 146Z"/>
  </g>
  <path class="ula-hull" d="M-34 88C-28 108-8 118 22 118L176 118C204 116 224 102 238 80C226 112 200 134 150 138L50 138C0 136-26 116-34 88Z"/>
  <path class="ula-hull-shade" d="M-24 108C-10 124 20 134 50 137L150 137C176 134 200 124 214 110C196 122 176 128 150 129L50 129C16 129-10 122-24 108Z"/>
  <path class="ula-gunwale" d="M-34 88C-28 108-8 118 22 118L176 118C204 116 224 102 238 80"/>
  <path class="ula-rod-key" d="${s.rod}"/>
  <path class="ula-rod" d="${s.rod}"/>
  <path class="ula-foam" d="M-30 144Q-18 136 -4 143T26 143T56 143T86 143T116 143T146 143T176 143T206 143L206 150L-30 150Z"/>
  <path class="cord-key" d="${s.cord}"/>
  <path class="cord" d="${s.cord}"/>
  <circle class="ula-tip" cx="190" cy="2" r="2.2"/>`;
}

/** Apply a state to the SVG's rod, tip and cord. */
function drawLine(svg, state) {
  const s = LINE_STATES[state];
  const rod = svg.querySelectorAll(".ula-rod, .ula-rod-key"), cord = svg.querySelectorAll(".cord, .cord-key"), tip = svg.querySelector(".ula-tip");
  rod.forEach((r) => r.setAttribute("d", s.rod));
  cord.forEach((c) => c.setAttribute("d", s.cord));
  const m = s.cord.match(/^M(-?[\d.]+)\s*(-?[\d.]+)/);
  if (tip && m) { tip.setAttribute("cx", m[1]); tip.setAttribute("cy", m[2]); }
}

export function initUla({ bus, clock } = {}) {
  const frame = $("ula-frame"), svg = $("canoe"), rig = $("rig");
  if (!frame || !svg) return null;
  svg.innerHTML = canoeMarkup();
  // the rod and line used to be a separate drawing inside the rig; the canoe draws them now
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

  /** "yay": a double hop. "meh": a head-tilt. The class is cleared when the animation ends. */
  const react = (mood) => {
    if (mood !== "yay" && mood !== "meh") return;
    frame.classList.remove("yay", "meh");
    void frame.offsetWidth;
    frame.classList.add(mood);
  };
  frame.addEventListener("animationend", () => frame.classList.remove("yay", "meh"));

  return { setLine, react, el: frame, get state() { return state; } };
}
