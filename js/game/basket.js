// Ula's lauhala basket, now a field guide: every catchable species gets a slot, a silhouette until
// it is caught, and a detail card (art, names, fact, times caught, best time) when it is.
// Storage: "huikau-basket" stays a plain array of ids (the reef reads it); "huikau-guide" holds
// { id: { n, first, last } }. Legacy "huikau-tackle" is read when the others don't exist.
import { $ } from "../core/dom.js";
import { motion } from "../core/motion.js";
import { store } from "../core/store.js";
import { speciesById } from "../data/species.js";
import { fishSVG } from "./fishart.js";

const BEST_TEXT = { dawn: "early morning", day: "daytime", dusk: "around sunset", night: "after dark", any: "anytime" };
const RARITY_TEXT = { common: "Common", uncommon: "Uncommon", rare: "Rare", junk: "Odd find", seasonal: "Seasonal", visitor: "Visitor" };

/** { main, mainHaw, sub }: the name to show large (Hawaiian when there is one), and the English under it. */
export function nameParts(s) {
  const haw = !!s.hawaiian && s.name.toLowerCase() === s.hawaiian.toLowerCase();
  if (s.hawaiian && s.english.toLowerCase() !== s.name.toLowerCase()) return { main: s.name, mainHaw: haw, sub: s.english };
  return { main: s.name, mainHaw: haw, sub: "" };
}

/**
 * Bring any saved shape up to date. `ids` is the "huikau-basket" array (or legacy "huikau-tackle"),
 * `guide` the "huikau-guide" object. Unknown ids and the honu (a visitor, never caught) are dropped;
 * ids without a guide entry get one catch and no dates.
 */
export function migrateGuide(ids, guide) {
  const g = {};
  const src = guide && typeof guide === "object" && !Array.isArray(guide) ? guide : {};
  const okId = (id) => speciesById[id] && speciesById[id].kind !== "visitor";
  for (const id of Array.isArray(ids) ? ids : []) if (okId(id)) g[id] = { n: 1, first: null, last: null };
  for (const [id, v] of Object.entries(src)) {
    if (!okId(id) || !v || typeof v !== "object") continue;
    g[id] = { n: Math.max(1, Number(v.n) || 1), first: Number(v.first) || null, last: Number(v.last) || null };
  }
  return g;
}

const ease = (k) => (k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

export function createBasket({ list, season = "none" }) {
  const grid = $("basket-grid"), count = $("basket-count"), reset = $("basket-reset");
  const dlg = $("guide-dialog");
  const guide = migrateGuide(store.get("huikau-basket", store.get("huikau-tackle", [])), store.get("huikau-guide", {}));
  let opener = null, armT = 0, arriving = null;

  const save = () => {
    store.set("huikau-basket", Object.keys(guide));
    store.set("huikau-guide", guide);
  };
  const GROUPS = [
    ["Fish and sea creatures", (s) => s.kind === "fish" || s.kind === "creature"],
    ["Odd finds", (s) => s.kind === "object" || s.kind === "seasonal"]
  ];

  function render(fresh) {
    if (!grid) return;
    const items = list();
    grid.replaceChildren();
    for (const [title, test] of GROUPS) {
      const group = items.filter(test);
      if (!group.length) continue;
      const h = document.createElement("h3");
      h.textContent = title;
      const ul = document.createElement("ul");
      ul.className = "guide-list";
      ul.setAttribute("aria-label", title);
      for (const s of group) {
        const li = document.createElement("li");
        const g = guide[s.id], have = !!g;
        const cls = ["guide-slot", have ? "" : "is-missing", s.id === "golden" ? "is-golden" : "", fresh === s.id ? "fresh" : "", arriving === s.id ? "arriving" : ""];
        let slot;
        if (have) {
          slot = document.createElement("button");
          slot.type = "button";
          slot.setAttribute("aria-haspopup", "dialog");
          slot.setAttribute("aria-label", `${s.name}, caught ${g.n} ${g.n === 1 ? "time" : "times"}. Open details`);
          slot.title = s.name;
          slot.innerHTML = fishSVG(s, { size: 68 });
          slot.addEventListener("click", () => open(s.id, slot));
        } else {
          slot = document.createElement("div");
          slot.setAttribute("role", "img");
          slot.setAttribute("aria-label", s.id === "golden" ? "Something rare is out there" : "Not caught yet");
          slot.title = s.id === "golden" ? "Something rare is out there" : "Not caught yet";
          slot.innerHTML = fishSVG(s, { size: 68, silhouette: true, color: "#3A2410", opacity: .38 });
        }
        slot.className = cls.filter(Boolean).join(" ");
        slot.dataset.id = s.id;
        li.append(slot);
        ul.append(li);
      }
      grid.append(h, ul);
    }
    const n = items.filter((s) => guide[s.id]).length;
    count.textContent = n && n === items.length ? `All ${n} caught. Ula's impressed.` : `${n} of ${items.length} caught`;
    reset.hidden = Object.keys(guide).length === 0;
  }

  // ---------- the detail card ----------
  function open(id, from) {
    const s = speciesById[id], g = guide[id];
    if (!s || !g || !dlg) return;
    opener = from || document.activeElement;
    $("guide-art").innerHTML = fishSVG(s, { size: 220 });
    const n = nameParts(s);
    const nameEl = $("guide-name");
    nameEl.textContent = n.main;
    if (n.mainHaw) nameEl.setAttribute("lang", "haw"); else nameEl.removeAttribute("lang");
    $("guide-en").textContent = n.sub;
    $("guide-en").hidden = !n.sub;
    $("guide-rarity").textContent = RARITY_TEXT[s.rarity] || "";
    $("guide-fact").textContent = s.fact;
    const when = (t) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    const rows = [["Times caught", String(g.n)], ["First caught", g.first ? when(g.first) : "Before the field guide began"]];
    if (g.last && g.n > 1) rows.push(["Last caught", when(g.last)]);
    rows.push(["Best time", BEST_TEXT[s.best || "any"]]);
    const dl = $("guide-facts");
    dl.replaceChildren();
    for (const [k, v] of rows) {
      const dt = document.createElement("dt"), dd = document.createElement("dd");
      dt.textContent = k; dd.textContent = v;
      dl.append(dt, dd);
    }
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    $("guide-close").focus({ preventScroll: true });
  }
  function closeDialog() {
    if (dlg.open) dlg.close();
  }
  dlg?.addEventListener("close", () => { opener?.isConnected ? opener.focus({ preventScroll: true }) : null; });
  dlg?.addEventListener("click", (e) => { if (e.target === dlg) closeDialog(); }); // the backdrop
  $("guide-close")?.addEventListener("click", closeDialog);

  // ---------- the glide: the caught art flies from the bobber to its slot ----------
  // Scrolls just far enough to show the basket (as the old basket did), all in one frame loop,
  // moving a fixed clone by transform only. Under reduced motion nothing moves; the slot just appears.
  function glide(sp, from) {
    arriving = motion.reduced ? null : sp.id;
    render(sp.id);
    const slot = grid.querySelector(`[data-id="${sp.id}"]`);
    if (motion.reduced || !slot || !from) { arriving = null; render(sp.id); return; }
    const fly = document.createElement("div");
    fly.className = "guide-fly";
    fly.innerHTML = fishSVG(sp, { size: 72 });
    document.body.append(fly);
    const x0 = from.left + from.width / 2 - 36, y0 = from.top + from.height / 2 - 24;
    const overflow = Math.max(0, $("basket").getBoundingClientRect().bottom + 24 - innerHeight);
    const start = scrollY, t0 = performance.now(), dur = 1500;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      fly.remove();
      scrollTo(0, start + overflow);
      arriving = null;
      slot.classList.remove("arriving");
      slot.classList.add("fresh");
    };
    const step = (t) => {
      if (done) return;
      const k = Math.min(1, (t - t0) / dur), e = ease(k);
      scrollTo(0, start + overflow * e);
      const r = slot.getBoundingClientRect();
      const x = x0 + (r.left + r.width / 2 - 36 - x0) * e;
      const y = y0 + (r.top + r.height / 2 - 24 - y0) * e - Math.sin(k * Math.PI) * 60;
      fly.style.transform = `translate(${x}px, ${y}px) scale(${1 - .3 * e}) rotate(${(1 - e) * -10}deg)`;
      if (k < 1) requestAnimationFrame(step); else finish();
    };
    requestAnimationFrame(step);
    setTimeout(finish, dur + 400); // background tabs can pause animation frames; always land
  }

  // ---------- reset (two presses, so a stray tap can't empty it) ----------
  reset?.addEventListener("click", () => {
    if (!reset.dataset.armed) {
      reset.dataset.armed = "1";
      reset.textContent = "Really empty it? Press again";
      armT = setTimeout(disarm, 4000);
      return;
    }
    disarm();
    for (const k of Object.keys(guide)) delete guide[k];
    save();
    render();
  });
  function disarm() {
    clearTimeout(armT);
    delete reset.dataset.armed;
    reset.textContent = "Empty the basket";
  }

  render();

  return {
    has: (id) => !!guide[id],
    count: (id) => guide[id]?.n || 0,
    info: (id) => guide[id] || null,
    ids: () => Object.keys(guide),
    /** Record a catch. Returns true when it is new. */
    add(id, now = Date.now()) {
      const isNew = !guide[id];
      const g = guide[id] || (guide[id] = { n: 0, first: now, last: now });
      g.n += 1;
      g.last = now;
      save();
      return isNew;
    },
    render, glide, open, closeDialog
  };
}
