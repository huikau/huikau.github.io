// Easter eggs: pineapple rain, the "aloha" boat, green flash, whales, shooting stars, the ʻiwa.
import { $, params, scene } from "../core/dom.js";
import { motion } from "../core/motion.js";
import { sunTimes } from "../core/astro.js";
import { weather } from "../data/weather.js";

export function rainPineapples() {
  if (motion.reduced || document.querySelector(".rain")) return;
  const rain = document.createElement("div");
  rain.className = "rain";
  rain.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 40; i++) {
    const p = document.createElement("span");
    p.textContent = "🍍";
    p.style.cssText = `left:${Math.random() * 100}%;font-size:${20 + Math.random() * 26}px;--d:${2.2 + Math.random() * 2}s;--delay:${Math.random() * 1.2}s;--r:${Math.random() * 720 - 360}deg`;
    rain.appendChild(p);
  }
  document.body.appendChild(rain);
  setTimeout(() => rain.remove(), 5000);
}

export function sailBoat() {
  const boat = $("boat");
  if (!boat || motion.reduced || boat.classList.contains("sail")) return;
  boat.classList.add("sail");
  boat.addEventListener("animationend", (e) => { if (e.target === boat) boat.classList.remove("sail"); });
}

// Pineapple tap and typing "aloha"
export function initEggs() {
  if ($("pine")) $("pine").addEventListener("click", rainPineapples);
  let typed = "";
  addEventListener("keydown", (e) => {
    if (e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-5);
    if (typed === "aloha") sailBoat();
  });
}

// Green flash at the moment of sunset
export function initGreenFlash({ clock, weather: w = weather }) {
  const flash = $("greenflash");
  if (!flash || motion.reduced) return;
  setInterval(() => {
    const m = clock.minutesExact();
    const clearSky = !w.rain && w.clouds < 4;
    if (params().get("flash") === "1" || (Math.abs(m - sunTimes(clock.hst()).set) < 1.5 && clearSky)) {
      flash.classList.remove("go");
      void flash.offsetWidth;
      flash.classList.add("go");
    }
  }, 4000);
}

// Humpback whales, December through April
export function initWhales({ month }) {
  const whale = $("whale");
  const whaleTest = params().get("whale") === "1";
  if (whale && !motion.reduced && (whaleTest || [12, 1, 2, 3, 4].includes(month))) {
    const surface = () => {
      whale.style.left = `${22 + Math.random() * 56}%`;
      whale.className = `whale ${Math.random() < .5 ? "spouting" : "fluke-up"}`;
      setTimeout(() => { whale.className = "whale"; }, 5200);
      setTimeout(surface, whaleTest ? 7000 : 30000 + Math.random() * 50000);
    };
    setTimeout(surface, whaleTest ? 1500 : 8000 + Math.random() * 20000);
  }
}

// Shooting stars after dark; click one to make a wish
export function initShootingStars() {
  const shooting = $("shooting"), wish = $("wish");
  if (!shooting || motion.reduced) return;
  const sceneEl = scene();
  const wishes = [
    "Wish made. Ula promises not to tell.",
    "Wish made. May your next cast be a big one.",
    "Wish made. Calm seas and a full cooler.",
    "Wish made. Watch for it on the next tide.",
    "You caught a shooting star. That's rarer than a golden ulua."
  ];
  let wishTimer;
  const test = params().get("shoot") === "1";
  const launch = () => {
    const sky = sceneEl.dataset.sky;
    if (sky === "night" || sky === "dusk" || test) {
      const s = document.createElement("button");
      s.type = "button";
      s.className = "shoot";
      s.tabIndex = -1;
      s.style.left = `${5 + Math.random() * 60}%`;
      s.style.top = `${4 + Math.random() * 40}%`;
      s.addEventListener("click", () => {
        wish.textContent = wishes[Math.floor(Math.random() * wishes.length)];
        wish.classList.add("show");
        clearTimeout(wishTimer);
        wishTimer = setTimeout(() => wish.classList.remove("show"), 4500);
        s.remove();
      });
      s.addEventListener("animationend", () => s.remove());
      shooting.appendChild(s);
    }
    setTimeout(launch, test ? 2500 : 9000 + Math.random() * 14000);
  };
  setTimeout(launch, 4000);
}

// An ʻiwa gliding over in daylight
export function initIwa() {
  const iwa = $("iwa");
  if (!iwa || motion.reduced) return;
  const sceneEl = scene();
  const iwaTest = params().get("iwa") === "1";
  const fly = () => {
    if (sceneEl.dataset.sky !== "night" || iwaTest) {
      iwa.style.top = `${10 + Math.random() * 22}%`;
      iwa.classList.remove("glide");
      void iwa.getBoundingClientRect();
      iwa.classList.add("glide");
    }
    setTimeout(fly, iwaTest ? 28000 : 40000 + Math.random() * 50000);
  };
  iwa.addEventListener("animationend", (e) => { if (e.animationName === "glide") iwa.classList.remove("glide"); });
  setTimeout(fly, iwaTest ? 800 : 12000 + Math.random() * 25000);
}
