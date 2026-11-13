// Secrets: pineapple rain, the "aloha" boat, green flash, whales, shooting stars, the ʻiwa,
// and the "Things to find" panel in the footer that keeps track of which ones have been found.
import { $, params, scene } from "../core/dom.js";
import { motion } from "../core/motion.js";
import { sunTimes } from "../core/astro.js";
import { bus as siteBus } from "../core/bus.js";
import { store } from "../core/store.js";
import { weather } from "../data/weather.js";
import { fishSVG } from "../game/fishart.js";

// ---------- Things to find ----------
export const FOUND_KEY = "huikau-found";

/** One riddle per secret. Short, kid-friendly, and they don't say where to look. `name` shows once it's found. */
export const SECRETS = [
  { id: "greenflash", riddle: "Wait for the sun to touch the sea on a clear evening.", name: "The green flash" },
  { id: "wish", riddle: "Make a wish when the sky is dark.", name: "A shooting star" },
  { id: "aloha", riddle: "Spell a friendly word.", name: "The aloha boat" },
  { id: "captain", riddle: "Tap the captain three times.", name: "The captain's boat ride" },
  { id: "pineapple", riddle: "The pineapple has a secret.", name: "Pineapple rain" },
  { id: "whale", riddle: "Some visitors only come in winter.", name: "A humpback whale" },
  { id: "iwa", riddle: "Look up for a long-winged bird.", name: "An ʻiwa" },
  { id: "golden", riddle: "A rare gold fish swims here.", name: "The golden ulua" },
  { id: "halloween", riddle: "Something spooky bites in late October.", name: "A Halloween catch" },
  { id: "gift", riddle: "A present waits in the water at Christmastime.", name: "A present from the sea" },
  { id: "newyear", riddle: "Watch the sky on the last night of the year.", name: "New Year fireworks" },
  { id: "friday", riddle: "Flowers come out on the last day of the work week.", name: "Aloha Friday" }
];

/** Which secret (if any) a catch event unlocks. */
export const CATCH_SECRETS = { golden: "golden", skeleton: "halloween", pumpkin: "halloween", gift: "gift", popper: "newyear" };

const known = new Set(SECRETS.map((s) => s.id));
let found = new Set((store.get(FOUND_KEY, []) || []).filter((id) => known.has(id)));

export const isFound = (id) => found.has(id);
export const foundIds = () => [...found];
/** Test hook: reload the found set from storage (or clear it). */
export function resetFound(ids = null) {
  found = new Set((ids ?? store.get(FOUND_KEY, []) ?? []).filter((id) => known.has(id)));
}

function record(id) {
  if (!known.has(id) || found.has(id)) return false;
  found.add(id);
  store.set(FOUND_KEY, [...found]);
  return true;
}

/** Mark a secret as found: saved, and announced on the bus as ("found", id). Safe to call again. */
export function markFound(id, bus = siteBus) {
  if (record(id)) bus.emit("found", id);
}

/** "3 of 12 found" */
export const foundLabel = () => `${found.size} of ${SECRETS.length} found`;

const CHECK = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><rect x="2" y="2" width="16" height="16" rx="3.5" class="fb-box"/><path d="M5.6 10.4L8.8 13.6L14.6 6.6" class="fb-tick"/></svg>';

function renderFinds() {
  const list = $("finds-list");
  if (!list) return;
  list.innerHTML = SECRETS.map((s) => {
    const yes = found.has(s.id);
    return `<li class="${yes ? "is-found" : ""}" data-id="${s.id}">${CHECK}<span class="finds-text"><span class="sr-only">${yes ? "Found: " : "Not found yet: "}</span>${s.riddle}${yes ? `<span class="finds-name">${s.name}</span>` : ""}</span></li>`;
  }).join("");
  const count = $("finds-count");
  if (count) count.textContent = foundLabel();
}

let toastTimer;
function toast(text) {
  let el = document.querySelector(".found-toast");
  if (!el) {
    el = document.createElement("p");
    el.className = "found-toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = text;
  void el.offsetWidth;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3800);
}

export function initFinds({ bus = siteBus } = {}) {
  renderFinds();
  const status = $("finds-status");
  bus.on("found", (id) => {
    record(id); // someone else may have emitted it without saving
    renderFinds();
    const s = SECRETS.find((x) => x.id === id);
    if (!s) return;
    const line = `Secret found: ${s.name}. ${foundLabel()}.`;
    if (status) status.textContent = line;
    toast(line);
  });
  bus.on("catch", (c) => { const id = CATCH_SECRETS[c?.id]; if (id) markFound(id, bus); });
}

// ---------- Pineapple rain ----------
/** One falling pineapple, drawn in the same hand as the catch art (cropped to the fruit). */
export const pineappleSVG = (size) => fishSVG("pineapple", { size }).replace('viewBox="0 0 120 80"', 'viewBox="30 0 60 80"').replace(/height="[\d.]+"/, `height="${(size * 80 / 60).toFixed(1)}"`);

export function rainPineapples() {
  markFound("pineapple");
  if (document.querySelector(".rain")) return;
  const rain = document.createElement("div");
  rain.className = "rain";
  rain.setAttribute("aria-hidden", "true");
  const still = motion.reduced;
  const n = still ? 14 : 36;
  for (let i = 0; i < n; i++) {
    const p = document.createElement("span");
    const size = 30 + Math.random() * 36;
    p.innerHTML = pineappleSVG(size);
    p.style.cssText = `left:${Math.random() * 96}%;--d:${2.2 + Math.random() * 2}s;--delay:${Math.random() * 1.2}s;--r:${Math.random() * 720 - 360}deg`;
    if (still) p.style.top = `${4 + Math.random() * 78}%`;
    rain.appendChild(p);
  }
  document.body.appendChild(rain);
  setTimeout(() => rain.remove(), still ? 3200 : 5000);
}

// ---------- The "aloha" boat ----------
export function sailBoat() {
  const boat = $("boat");
  if (!boat) return;
  markFound("aloha");
  if (boat.classList.contains("sail")) return;
  boat.classList.add("sail");
  if (motion.reduced) { // a still, complete page: the boat just rests mid-sea for a few seconds
    setTimeout(() => boat.classList.remove("sail"), 5000);
    return;
  }
  boat.addEventListener("animationend", (e) => { if (e.target === boat) boat.classList.remove("sail"); });
}

// Pineapple tap, typing "aloha", and three taps on the captain
export function initEggs() {
  if ($("pine")) $("pine").addEventListener("click", rainPineapples);
  let typed = "";
  addEventListener("keydown", (e) => {
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
    typed = (typed + e.key.toLowerCase()).slice(-5);
    if (typed === "aloha") sailBoat();
  });
  // js/game/fishing.js sends the boat on three quick taps; this just notes that the captain was tapped
  const ula = $("ula");
  if (ula) {
    let taps = [];
    ula.addEventListener("click", () => {
      const t = Date.now();
      taps = taps.filter((x) => t - x < 900).concat(t);
      if (taps.length >= 3) { taps = []; markFound("captain"); }
    });
  }
  initFinds();
}

// ---------- Green flash ----------
/** True within five minutes of sunset (m = minutes since HST midnight) on a clear sky. */
export const flashWindow = (m, setMin, w) => Math.abs(m - setMin) < 5 && !w.rain && (w.clouds ?? 0) < 4;

export function initGreenFlash({ clock, weather: w = weather, bus = siteBus }) {
  const flash = $("greenflash");
  if (!flash) return;
  const test = params().get("flash") === "1";
  let inWindow = false;
  const fire = () => {
    markFound("greenflash");
    if (motion.reduced) { // still: hold the line on the horizon for a moment
      flash.classList.add("go");
      setTimeout(() => flash.classList.remove("go"), 4000);
      return;
    }
    flash.classList.remove("go");
    void flash.offsetWidth;
    flash.classList.add("go");
  };
  const check = () => {
    if (test) return;
    const now = flashWindow(clock.minutesExact(), sunTimes(clock.hst()).set, w);
    if (now && !inWindow) fire(); // once each time sunset comes into range (also when the Time Machine is scrubbed to it)
    inWindow = now;
  };
  if (test) { setTimeout(fire, 1200); setInterval(fire, 9000); }
  setInterval(check, 4000);
  bus.on("tick", check);
  setTimeout(check, 1500);
}

// ---------- Humpback whales, December through April ----------
export const whaleSeason = (month) => [12, 1, 2, 3, 4].includes(month);

export function initWhales({ month }) {
  const whale = $("whale");
  const whaleTest = params().get("whale") === "1";
  if (whale && (whaleTest || whaleSeason(month))) {
    const surface = () => {
      whale.style.left = `${24 + Math.random() * 36}%`;
      whale.className = `whale ${Math.random() < .5 ? "spouting" : "fluke-up"}`;
      markFound("whale");
      setTimeout(() => { whale.className = "whale"; }, 5200);
      setTimeout(surface, whaleTest ? 7000 : 30000 + Math.random() * 50000);
    };
    if (motion.reduced) { // a still page: one visit, then gone
      setTimeout(() => { whale.style.left = "62%"; whale.className = "whale spouting"; markFound("whale"); setTimeout(() => { whale.className = "whale"; }, 6000); }, whaleTest ? 1500 : 8000);
      return;
    }
    setTimeout(surface, whaleTest ? 1500 : 8000 + Math.random() * 20000);
  }
}

// ---------- Shooting stars after dark; click one to make a wish ----------
export const WISHES = [
  "Wish made. Ula promises not to tell.",
  "Wish made. May your next cast be a big one.",
  "Wish made. Calm seas and a full cooler.",
  "Wish made. Watch for it on the next tide.",
  "You caught a shooting star. That's rarer than a golden ulua."
];
const STAR = '<svg viewBox="0 0 100 50" aria-hidden="true" focusable="false"><path class="ss-tail" d="M3 10L82 30L84 39Z"/><path class="ss-tail2" d="M30 17L82 31L83 36Z"/><path class="ss-head" d="M86 22L89 31L98 34L89 37L86 46L83 37L74 34L83 31Z"/></svg>';

export function initShootingStars() {
  const shooting = $("shooting"), wish = $("wish");
  if (!shooting) return;
  const sceneEl = scene();
  let wishTimer;
  const test = params().get("shoot") === "1";
  const makeWish = (s) => {
    wish.textContent = WISHES[Math.floor(Math.random() * WISHES.length)];
    wish.classList.add("show");
    clearTimeout(wishTimer);
    wishTimer = setTimeout(() => wish.classList.remove("show"), 4500);
    markFound("wish");
    s.remove();
  };
  const launch = () => {
    const sky = sceneEl.dataset.sky;
    if (sky === "night" || sky === "dusk" || test) {
      const s = document.createElement("button");
      s.type = "button";
      s.className = "shoot";
      s.setAttribute("aria-label", "Shooting star: make a wish");
      s.innerHTML = STAR;
      s.style.left = `${5 + Math.random() * 60}%`;
      s.style.top = `${4 + Math.random() * 40}%`;
      s.addEventListener("click", () => makeWish(s));
      s.addEventListener("animationend", () => s.remove());
      if (motion.reduced) { s.classList.add("still"); setTimeout(() => s.remove(), 6000); }
      shooting.appendChild(s);
    }
    setTimeout(launch, test ? 2500 : 9000 + Math.random() * 14000);
  };
  // the stars are quick, so "w" also makes a wish on whichever one is up
  addEventListener("keydown", (e) => {
    if (e.key !== "w" || e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test(e.target?.tagName || "")) return;
    const s = shooting.querySelector(".shoot");
    if (s) makeWish(s);
  });
  setTimeout(launch, test ? 1000 : 4000);
}

// ---------- An ʻiwa (frigatebird) gliding over in daylight ----------
export function initIwa() {
  const iwa = $("iwa");
  if (!iwa) return;
  const sceneEl = scene();
  const iwaTest = params().get("iwa") === "1";
  const fly = () => {
    if (sceneEl.dataset.sky !== "night" || iwaTest) {
      iwa.style.top = `${10 + Math.random() * 22}%`;
      iwa.classList.remove("glide");
      void iwa.getBoundingClientRect();
      iwa.classList.add("glide");
      markFound("iwa");
      if (motion.reduced) setTimeout(() => iwa.classList.remove("glide"), 6000);
    }
    setTimeout(fly, iwaTest ? 28000 : 40000 + Math.random() * 50000);
  };
  iwa.addEventListener("animationend", (e) => { if (e.animationName === "glide") iwa.classList.remove("glide"); });
  setTimeout(fly, iwaTest ? 800 : 12000 + Math.random() * 25000);
}
