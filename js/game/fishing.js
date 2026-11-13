// Fishing, v2: idle -> cast -> waiting -> bite -> reel -> landed | gotaway.
// One press casts; a bite comes after 1.5-6 s; one press inside the shrinking ring reels it in.
// The state machine, the weights and the timing are plain functions (exported, tested in Node);
// the DOM only wakes up inside initFishing().
import { $, params } from "../core/dom.js";
import { motion } from "../core/motion.js";
import { clock as siteClock } from "../core/clock.js";
import { species, speciesById } from "../data/species.js";
import { createBasket, nameParts } from "./basket.js";
import { fishSVG } from "./fishart.js";
import { sailBoat } from "../ui/eggs.js";

export const STATES = ["idle", "cast", "waiting", "bite", "reel", "landed", "gotaway"];

// ---------- timing (ms) ----------
export const BITE_MIN = 1500, BITE_MAX = 6000;   // how long the line waits before a bite
export const GUARD = 300;                        // a press this soon after the bite is ignored (reaction time)
export const ZONE_START = 700;                   // the ring is close enough to the target: a press lands
export const RING_END = 2250;                    // the ring has shrunk and faded: the fish is gone
export const HOLD_MS = 2000;                     // hold the button this long and the catch lands anyway
export const WAIT_GUARD = 400;                   // presses right after the cast don't pull the line back

/** What a press `elapsed` ms after the bite does: "ignore" | "early" (nothing happens yet) | "hit" | "late". */
export function judgeReel(elapsed, { easy = false } = {}) {
  if (elapsed < GUARD) return "ignore";
  if (elapsed > RING_END) return "late";
  if (easy) return "hit";
  return elapsed >= ZONE_START ? "hit" : "early";
}

// ---------- what bites ----------
/** dawn 5:00-8:00, day to 16:30, dusk to 19:30, night after that. `minutes` is minutes after midnight, Honolulu. */
export function phaseOf(minutes) {
  if (minutes >= 300 && minutes < 480) return "dawn";
  if (minutes >= 480 && minutes < 990) return "day";
  if (minutes >= 990 && minutes < 1170) return "dusk";
  return "night";
}
export const SEASON_IDS = { halloween: ["skeleton", "pumpkin"], winter: ["gift"], newyear: ["popper"], none: [] };
const RARITY_WEIGHT = { common: 10, uncommon: 5, rare: 1.5, junk: 2.5, visitor: 1.2, seasonal: 4 };
// Ula fishes from the shallows: the reef and the flats are busier than the deep.
const HABITAT_FACTOR = { shallows: 1.3, sandflat: 1.3, reef: 1.3, shore: 1.2, "open ocean": .9, deep: .6, anywhere: 1 };
export const GOLDEN_ODDS = 1 / 40;

/** Everything that can turn up on the line this season, golden ulua excluded (it has its own roll). */
export function pool(season = "none") {
  const ok = new Set(SEASON_IDS[season] || []);
  return species.filter((s) => s.id !== "golden" && (s.rarity !== "seasonal" || ok.has(s.id)));
}
/** Relative chance of `sp` at this time of day: rarity x habitat x best-time match. */
export function weightFor(sp, phase) {
  const base = RARITY_WEIGHT[sp.rarity] ?? 1;
  const time = sp.best === "any" || !sp.best ? 1 : sp.best === phase ? 2.5 : .7;
  return base * (HABITAT_FACTOR[sp.habitat] ?? 1) * time;
}
/** Choose what bites. `rng` returns [0,1). `rare` forces the golden ulua. `avoid` is the last id (no immediate repeats). */
export function pickSpecies({ rng = Math.random, phase = "day", season = "none", rare = false, avoid = null } = {}) {
  if (rare || rng() < GOLDEN_ODDS) return speciesById.golden;
  const list = pool(season).filter((s) => s.id !== avoid);
  const w = list.map((s) => weightFor(s, phase));
  let r = rng() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) { r -= w[i]; if (r < 0) return list[i]; }
  return list[list.length - 1];
}

export const CUES = {
  idle: "Cast your line", cast: "Casting…", waiting: "Waiting for a bite…", bite: "Bite! Press now",
  reel: "Reeling in…", landed: "Got one!", gotaway: "Got away — cast again"
};
const LABELS = {
  idle: "Cast your line", cast: "Casting", waiting: "Waiting for a bite", bite: "Bite! Reel in now",
  reel: "Reeling in", landed: "Caught one", gotaway: "Got away. Cast again"
};

export function initFishing({ season = "none", bus, ula: ulaApi = null, clock = siteClock } = {}) {
  const rig = $("rig");
  if (!rig) return null;
  const bobber = $("bobber"), hint = $("hint"), live = $("game-live"), ula = $("ula");
  const card = $("catch"), art = $("catch-art"), kicker = $("catch-kicker"), nameEl = $("catch-name"), enEl = $("catch-en");
  const text = $("catch-text"), close = $("catch-close");
  const q = params();
  const easy = () => q.get("easy") === "1" || motion.reduced;
  const basket = createBasket({
    list: () => pool(season).filter((s) => s.kind !== "visitor"),
    season
  });

  let state = "idle", cueIdle = CUES.idle;
  let forced = null, pending = null, last = null;
  let castT = 0, waitT = 0, zoneT = 0, endT = 0, reelT = 0, backT = 0, holdT = 0, hideT = 0, glideT = 0;
  let waitAt = 0, biteAt = 0, held = false;

  const say = (msg) => { if (live) live.textContent = msg; };
  const clearTimers = () => { [castT, waitT, zoneT, endT, reelT, backT, holdT].forEach(clearTimeout); };

  function go(next, id) {
    state = next;
    rig.dataset.state = next;
    if (next !== "bite") delete rig.dataset.zone;
    ulaApi?.setLine(next);
    const cue = next === "idle" ? cueIdle : CUES[next];
    hint.textContent = cue;
    bobber.setAttribute("aria-label", next === "idle" && cueIdle !== CUES.idle ? "Cast again" : LABELS[next]);
    if (next !== "landed") say(cue);
    bus?.emit("game", { state: next, id });
  }

  function hideCard() {
    clearTimeout(hideT);
    card.classList.remove("show");
  }
  function showCard(sp, { kick, line, tone }) {
    const n = nameParts(sp);
    art.innerHTML = fishSVG(sp, { size: 120 });
    kicker.textContent = kick;
    nameEl.textContent = n.main;
    if (n.mainHaw) nameEl.setAttribute("lang", "haw"); else nameEl.removeAttribute("lang");
    enEl.textContent = n.sub;
    enEl.hidden = !n.sub;
    text.textContent = line;
    card.classList.toggle("rare", tone === "rare");
    card.classList.toggle("visit", tone === "visit");
    card.classList.add("show");
    clearTimeout(hideT);
    hideT = setTimeout(hideCard, tone === "rare" ? 7500 : 5600);
  }

  // ---------- the transitions ----------
  function cast() {
    clearTimers();
    hideCard();
    pending = null;
    go("cast");
    castT = setTimeout(startWaiting, motion.reduced ? 0 : 550);
  }
  function startWaiting() {
    go("waiting");
    waitAt = performance.now();
    waitT = setTimeout(bite, BITE_MIN + Math.random() * (BITE_MAX - BITE_MIN));
  }
  function bite() {
    clearTimeout(waitT);
    let sp;
    if (forced) { sp = forced; forced = null; }
    else sp = pickSpecies({ rng: Math.random, phase: phaseOf(clock.minutes()), season, rare: q.get("rare") === "1", avoid: last });
    if (sp.kind === "visitor") { visit(sp); return; }
    pending = sp;
    biteAt = performance.now();
    go("bite");
    if (!motion.reduced) navigator.vibrate?.(30); // the soft thump, for phones that can
    const open = easy() ? GUARD : ZONE_START;
    zoneT = setTimeout(() => { if (state === "bite") rig.dataset.zone = "open"; }, open);
    endT = setTimeout(endOfRing, RING_END);
  }
  function endOfRing() {
    if (state !== "bite") return;
    if (held) { endT = setTimeout(endOfRing, 250); return; } // still holding: the hold timer will land it
    lose();
  }
  function press() {
    if (state === "idle" || state === "landed" || state === "gotaway") { cast(); return; }
    if (state === "waiting") {
      if (performance.now() - waitAt < WAIT_GUARD) return;
      clearTimers();
      cueIdle = "Too soon — cast again";
      go("idle");
      return;
    }
    if (state === "bite") {
      const verdict = judgeReel(performance.now() - biteAt, { easy: easy() });
      if (verdict !== "hit") return; // too soon (or the very first instant): nothing happens, the ring keeps shrinking
      clearTimeout(zoneT); clearTimeout(endT);
      reelIn();
    }
  }
  function reelIn() {
    clearTimers();
    go("reel");
    reelT = setTimeout(land, motion.reduced ? 150 : 650);
  }
  function lose() {
    clearTimers();
    pending = null;
    cueIdle = "Cast again";
    go("gotaway");
    ulaApi?.react("meh");
    backT = setTimeout(() => go("idle"), motion.reduced ? 900 : 1500);
  }
  function land() {
    const sp = pending;
    pending = null;
    last = sp.id;
    const isNew = !basket.has(sp.id);
    const from = bobber.getBoundingClientRect();
    basket.add(sp.id);
    cueIdle = "Cast again";
    go("landed", sp.id);
    const line = sp.id === "ula" && sp.ulaLine ? sp.ulaLine : sp.line;
    showCard(sp, { kick: sp.id === "golden" ? "Rare find!" : isNew ? "New for the field guide!" : "Caught again", line, tone: sp.rarity === "rare" || sp.id === "golden" ? "rare" : "" });
    const n = nameParts(sp);
    say(`Caught: ${n.main}${n.sub ? `, ${n.sub}` : ""}. ${line}${isNew ? " New for the field guide." : ""}`);
    ulaApi?.react(sp.mood);
    // the basket is redrawn when the art arrives, so a new catch pops in on screen
    clearTimeout(glideT);
    if (isNew) glideT = setTimeout(() => basket.glide(sp, from), motion.reduced ? 0 : 450);
    else basket.render();
    bus?.emit("catch", { ...sp, isNew });
    backT = setTimeout(() => go("idle"), motion.reduced ? 600 : 1000);
  }
  function visit(sp) {
    clearTimers();
    cueIdle = "Cast again";
    ulaApi?.react("yay");
    go("idle");
    showCard(sp, { kick: "Just visiting", line: sp.line, tone: "visit" });
    say(`A ${sp.english.toLowerCase()} swam by. ${sp.line}`);
    bus?.emit("visit", { id: sp.id });
  }

  // ---------- input: click / tap, and Space / Enter with the button focused ----------
  const startHold = () => {
    held = true;
    clearTimeout(holdT);
    holdT = setTimeout(() => { if (held && state === "bite") { clearTimeout(zoneT); clearTimeout(endT); reelIn(); } }, HOLD_MS);
  };
  const endHold = () => { held = false; clearTimeout(holdT); };
  bobber.addEventListener("pointerdown", (e) => { if (e.button === 0) startHold(); });
  ["pointerup", "pointercancel", "pointerleave", "blur"].forEach((t) => bobber.addEventListener(t, endHold));
  bobber.addEventListener("keydown", (e) => {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    if (e.repeat) return;
    startHold();
    press();
  });
  bobber.addEventListener("keyup", (e) => {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); endHold(); }
  });
  bobber.addEventListener("click", () => { endHold(); press(); }); // pointer taps, and assistive tech
  close.addEventListener("click", () => { hideCard(); bobber.focus({ preventScroll: true }); });
  card.addEventListener("focusin", () => clearTimeout(hideT));
  rig.addEventListener("keydown", (e) => { if (e.key === "Escape" && card.classList.contains("show")) hideCard(); });

  // Three quick taps on Ula also sends the boat out (for phones, which can't type "aloha" easily)
  let taps = [];
  ula?.addEventListener("click", () => {
    const t = Date.now();
    taps = taps.filter((x) => t - x < 900).concat(t);
    if (taps.length >= 3) { taps = []; sailBoat(); }
  });

  bobber.setAttribute("aria-label", LABELS.idle);
  hint.textContent = CUES.idle;

  return {
    basket,
    pick: () => pickSpecies({ phase: phaseOf(clock.minutes()), season, rare: q.get("rare") === "1", avoid: last }),
    // ---- test hooks (main.js only exposes the module under ?debug=1) ----
    get state() { return state; },
    force(id) {
      if (!speciesById[id]) throw new Error(`unknown species ${id}`);
      forced = speciesById[id];
      return forced.id;
    },
    skipWait() {
      if (state === "cast") { clearTimeout(castT); startWaiting(); }
      if (state === "waiting") bite();
      return state;
    },
    press
  };
}
