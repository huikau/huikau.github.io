// Bobber fishing, with Ula reacting.
import { $, params } from "../core/dom.js";
import { catches, golden, seasonal } from "../data/species.js";
import { createBasket } from "./basket.js";
import { sailBoat } from "../ui/eggs.js";

export function initFishing({ season, bus, ula: ulaApi = null }) {
  const rig = $("rig");
  if (!rig) return null;
  const card = $("catch"), emoji = $("catch-emoji"), text = $("catch-text");
  const hint = $("hint"), ula = $("ula");
  const collection = [...catches, golden];
  const basket = createBasket(collection);
  let lastText = "", hideTimer, biteTimer;

  function pick() {
    if (params().get("rare") === "1" || Math.random() < 1 / 40) return golden;
    const pool = [...catches, ...seasonal[season], ...seasonal[season]];
    let c;
    do { c = pool[Math.floor(Math.random() * pool.length)]; } while (c.t === lastText);
    return c;
  }

  $("bobber").addEventListener("click", () => {
    const c = pick();
    lastText = c.t;

    clearTimeout(hideTimer);
    clearTimeout(biteTimer);
    card.classList.remove("show");
    rig.classList.remove("bite");
    ula.classList.remove("yay", "meh");
    void rig.offsetWidth;
    rig.classList.add("bite");
    ulaApi?.setLine("bite");
    hint.hidden = true;

    biteTimer = setTimeout(() => {
      emoji.textContent = c.e;
      emoji.className = c.rare ? "catch-emoji golden" : "catch-emoji";
      text.textContent = c.t;
      card.classList.toggle("rare", !!c.rare);
      card.classList.add("show");
      rig.classList.remove("bite");
      if (ulaApi) { ulaApi.setLine("idle"); ulaApi.react(c.mood); } else ula.classList.add(c.mood);
      const isNew = !!(c.id && !basket.has(c.id));
      if (isNew) {
        basket.add(c.id);
        // the basket isn't redrawn until the glide arrives, so the new catch pops in on screen
        setTimeout(() => basket.reveal(() => basket.render(c.id)), 700);
      }
      bus.emit("catch", { ...c, isNew });
    }, 650);
    hideTimer = setTimeout(() => card.classList.remove("show"), c.rare ? 7000 : 5200);
  });
  ula.addEventListener("animationend", () => ula.classList.remove("yay", "meh"));

  // Three quick taps on Ula also sends the boat out (for phones, which can't type "aloha" easily)
  let taps = [];
  ula.addEventListener("click", () => {
    const t = Date.now();
    taps = taps.filter((x) => t - x < 900).concat(t);
    if (taps.length >= 3) { taps = []; sailBoat(); }
  });
  return { basket, pick };
}
