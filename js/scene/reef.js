// The reef: the fish Ula has caught, living in small schools on the sea floor under the page.
// The top half of this file is pure logic (which species school, how many, how they steer) so it
// runs in Node tests; initReef() at the bottom touches the DOM.
import { motion } from "../core/motion.js";
import { store } from "../core/store.js";
import { speciesById } from "../data/species.js";
import { fishSVG } from "../game/fishart.js";

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Small seeded random generator so the still layout is the same on every load. */
export function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash = (str) => { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

// Rendered width in px at a 1440 px wide page: big open-water fish are large, reef fish small.
export const SIZES = {
  shark: 168, ono: 132, ahi: 122, mahi: 116, ulua: 112, uku: 104, aku: 92, opakapaka: 92, moi: 84, amaama: 76,
  uhu: 88, kala: 86, oio: 86, weke: 72, manini: 60, humu: 58, puffer: 58, golden: 84, hee: 76, ula: 84
};
// Where in the water column (0 = just under the light, 1 = the sand) each habitat keeps to.
export const BANDS = { "open ocean": [0.04, 0.34], deep: [0.22, 0.5], reef: [0.42, 0.74], shallows: [0.1, 0.36], sandflat: [0.7, 0.84] };
export const COUNT_BY_RARITY = { common: 7, uncommon: 4, rare: 2 };

/** True for species that swim in schools; creatures (heʻe, ula) rest on the sand; everything else is not on the reef. */
export function reefRole(sp) {
  if (!sp) return null;
  if (sp.rarity === "visitor" || sp.rarity === "junk" || sp.rarity === "seasonal") return null; // honu visit, objects are not fish
  if (sp.kind === "fish") return "school";
  if (sp.kind === "creature") return "floor";
  return null;
}

/**
 * What lives on the reef for a list of caught ids. Uncaught species never appear.
 * Returns [{ id, role, count, size, band: [top, bottom] }], capped at `cap` swimmers in total by thinning the biggest schools first.
 */
export function schoolPlan(caughtIds, byId = speciesById, { cap = 46, scale = 1 } = {}) {
  const seen = new Set();
  const plan = [];
  for (const id of caughtIds || []) {
    if (typeof id !== "string" || seen.has(id)) continue;
    seen.add(id);
    const sp = byId[id], role = reefRole(sp);
    if (!role) continue;
    const size = Math.round((SIZES[id] || 80) * scale);
    let count = role === "floor" ? 1 : (COUNT_BY_RARITY[sp.rarity] || 3);
    if (role === "school" && sp.rarity === "rare" && size >= 130) count = 1; // a lone manō
    plan.push({ id, role, count, size, band: BANDS[sp.habitat] || BANDS.reef });
  }
  let total = plan.reduce((n, p) => n + p.count, 0);
  while (total > cap) {
    const big = plan.filter((p) => p.role === "school" && p.count > 1).sort((a, b) => b.count - a.count)[0];
    if (!big) break;
    big.count--; total--;
  }
  return plan;
}

/** Starting fish for one plan entry: spread loosely inside its band, all heading the same way. */
export function spawn(entry, bounds, rng) {
  const { w, h } = bounds, [b0, b1] = entry.band;
  const dir = rng() < .5 ? -1 : 1;
  const speed = (entry.role === "floor" ? 0 : 22 + rng() * 16 + 18 / Math.sqrt(entry.size / 60));
  const cx = entry.size + rng() * Math.max(1, w - entry.size * 2), cy = h * (b0 + (b1 - b0) * rng());
  const out = [];
  for (let i = 0; i < entry.count; i++) {
    out.push({
      id: entry.id, size: entry.size, band: entry.band, role: entry.role,
      x: clamp(cx + (rng() - .5) * entry.size * 2.4, 0, w), y: clamp(cy + (rng() - .5) * entry.size * .9, h * b0 * .8, h * (b1 + .06)),
      vx: dir * speed * (.85 + rng() * .3), vy: (rng() - .5) * 6, speed, theta: rng() * 6.28, phase: rng() * 6.28
    });
  }
  if (entry.role === "floor") { out[0].x = w * (.18 + rng() * .64); out[0].y = h * .9; }
  return out;
}

const DEFAULTS = { cohesion: .55, align: .9, separate: 2.2, wander: .9, band: 1.6, wall: 1.6, maxTurn: .5 };

/**
 * One steering step for a school (array of fish, mutated in place).
 *   cohesion  drift toward the school's centre when strayed
 *   alignment match the neighbours' heading
 *   separation keep about one body-length apart
 *   wander    a slow random bend, mostly sideways
 *   band      stay in the habitat's depth range; walls turn them before the edge
 * bounds = { w, h }. rng() in [0,1). Speeds stay within 0.55x to 1.4x of the fish's own.
 */
export function stepFlock(fish, bounds, dt, rng, opts = {}) {
  const k = { ...DEFAULTS, ...opts }, n = fish.length;
  if (!n || fish[0].role === "floor") return fish;
  const { w, h } = bounds;
  let cx = 0, cy = 0, avx = 0, avy = 0;
  for (const f of fish) { cx += f.x; cy += f.y; avx += f.vx; avy += f.vy; }
  cx /= n; cy /= n; avx /= n; avy /= n;
  for (const f of fish) {
    let ax = 0, ay = 0;
    if (n > 1) {
      const dx = cx - f.x, dy = cy - f.y, d = Math.hypot(dx, dy) || 1;
      const pull = clamp((d - f.size * .6) / (f.size * 2.5), 0, 1);
      ax += dx / d * pull * k.cohesion * f.speed; ay += dy / d * pull * k.cohesion * f.speed * .5;
      ax += (avx - f.vx) * k.align * .6; ay += (avy - f.vy) * k.align * .6;
      for (const o of fish) {
        if (o === f) continue;
        const sx = f.x - o.x, sy = f.y - o.y, sd = Math.hypot(sx, sy) || .001, r = f.size * .75;
        if (sd < r) { const q = 1 - sd / r, push = q * (.5 + q) * k.separate * f.speed; ax += sx / sd * push; ay += sy / sd * push; }
      }
    }
    f.theta += (rng() - .5) * dt * 3.2;
    ax += Math.cos(f.theta) * k.wander * f.speed * .35; ay += Math.sin(f.theta) * k.wander * f.speed * .12;
    const top = h * f.band[0], bottom = h * f.band[1];
    if (f.y < top) ay += (top - f.y) * k.band; else if (f.y > bottom) ay -= (f.y - bottom) * k.band;
    const m = f.size * 1.4, inward = f.x < m ? 0 : f.x > w - m ? Math.PI : null;
    f.vx += ax * dt; f.vy += ay * dt;
    let sp = Math.hypot(f.vx, f.vy);
    const lo = f.speed * .55, hi = f.speed * 1.4;
    if (sp > hi || sp < lo) { const c = clamp(sp, lo, hi) / (sp || 1); f.vx = sp ? f.vx * c : lo; f.vy = sp ? f.vy * c : 0; sp = clamp(sp, lo, hi); }
    if (inward === null) {
      if (Math.abs(f.vy) > sp * k.maxTurn) f.vy = Math.sign(f.vy) * sp * k.maxTurn;
    } else {
      // near a wall: swing the heading round toward open water at a fixed turn rate (keeps the speed)
      const cur = Math.atan2(f.vy, f.vx);
      let diff = inward - cur;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const depth = clamp(inward === 0 ? (m - f.x) / m : (f.x - (w - m)) / m, 0, 1);
      const turn = clamp(diff, -k.wall * dt, k.wall * dt) * (.35 + .65 * depth);
      f.vx = Math.cos(cur + turn) * sp; f.vy = Math.sin(cur + turn) * sp;
    }
    f.x = clamp(f.x + f.vx * dt, -f.size * .5, w + f.size * .5);
    f.y += f.vy * dt;
  }
  return fish;
}

// ---------------------------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------------------------
const SLIPPER_ID = "slipper";

export function initReef({ bus, ids } = {}) {
  const zone = document.getElementById("reef-zone");
  const layer = document.getElementById("reef-fish");
  if (!zone || !layer) return null;
  const note = document.getElementById("reef-note");
  const summary = document.getElementById("reef-summary");
  const scale = () => (innerWidth < 700 ? .62 : innerWidth < 1100 ? .82 : 1);
  const caughtNow = () => ids || store.get("huikau-basket", store.get("huikau-tackle", []));

  const schools = new Map(); // id -> { entry, fish: [{...state, el}] }
  let bounds = { w: zone.clientWidth || 1000, h: zone.clientHeight || 500 };
  let caught = new Set(), running = false, raf = 0, last = 0, honuTimer = 0;
  const rng = mulberry32(0x5eef);

  function sprite(f) {
    const el = document.createElement("span");
    el.className = "fish" + (f.role === "floor" ? " fish--floor" : "");
    el.style.width = f.size + "px";
    el.style.height = Math.round(f.size * 2 / 3) + "px";
    el.innerHTML = fishSVG(f.id, { size: f.size });
    layer.appendChild(el);
    return el;
  }
  function place(f) {
    const flip = f.vx > 0 ? -1 : 1; // the art faces left
    const r = f.role === "floor" ? 0 : -clamp(Math.atan2(f.vy, Math.abs(f.vx) || 1) * 57.3, -22, 22);
    f.el.style.transform = `translate3d(${(f.x - f.size / 2).toFixed(1)}px,${(f.y - f.size / 3).toFixed(1)}px,0) scaleX(${flip}) rotate(${r.toFixed(1)}deg)`;
  }
  function addSchool(entry, fromEdge) {
    if (schools.has(entry.id)) return;
    const r = mulberry32(hash(entry.id));
    const fish = spawn(entry, bounds, r);
    if (fromEdge) { const dir = r() < .5 ? 1 : -1; fish.forEach((f, i) => { f.x = dir > 0 ? -f.size - i * 40 : bounds.w + f.size + i * 40; f.vx = dir * f.speed; }); }
    for (const f of fish) { f.el = sprite(f); if (fromEdge) f.el.classList.add("fish--new"); place(f); }
    schools.set(entry.id, { entry, fish });
  }
  function describe() {
    const names = [...schools.keys()].map((id) => speciesById[id].english.toLowerCase());
    if (summary) summary.textContent = names.length
      ? `On the reef below: ${names.join(", ")}.` : "The reef below is quiet. Catch something and it will come to live here.";
    if (note) note.hidden = names.length > 0;
    zone.dataset.catches = String(names.length);
  }
  function rebuild() {
    layer.textContent = ""; schools.clear();
    caught = new Set(caughtNow());
    for (const e of schoolPlan([...caught], speciesById, { scale: scale() })) addSchool(e, false);
    describe();
  }

  function frame(t) {
    if (!running) return;
    const dt = Math.min(.05, (t - last) / 1000 || .016); last = t;
    for (const s of schools.values()) {
      if (s.entry.role === "floor") { for (const f of s.fish) place(f); continue; }
      stepFlock(s.fish, bounds, dt, rng);
      for (const f of s.fish) place(f);
    }
    raf = requestAnimationFrame(frame);
  }
  const start = () => { if (running || motion.reduced) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); scheduleHonu(); };
  const stop = () => { running = false; cancelAnimationFrame(raf); clearTimeout(honuTimer); };

  // The honu only ever visits: it glides across now and then, and is never in the basket.
  function scheduleHonu() {
    clearTimeout(honuTimer);
    honuTimer = setTimeout(() => {
      if (!running) return;
      const el = document.getElementById("reef-honu");
      if (el && !el.classList.contains("swim")) {
        el.style.setProperty("--honu-y", `${Math.round(bounds.h * (.16 + Math.random() * .2))}px`);
        el.classList.add("swim");
        el.addEventListener("animationend", () => el.classList.remove("swim"), { once: true });
      }
      scheduleHonu();
    }, 40000 + Math.random() * 40000);
  }

  // the sprites for the lone slipper and the honu
  const slip = document.getElementById("reef-slipper");
  if (slip && !slip.firstChild) slip.innerHTML = fishSVG(SLIPPER_ID, { size: 64 });
  const hon = document.getElementById("reef-honu");
  if (hon && !hon.firstChild) hon.innerHTML = fishSVG("honu", { size: 120 });

  const ro = new ResizeObserver(() => {
    const w = zone.clientWidth, h = zone.clientHeight;
    if (!w || !h || (Math.abs(w - bounds.w) < 2 && Math.abs(h - bounds.h) < 2)) return;
    bounds = { w, h };
    rebuild();
  });
  bounds = { w: zone.clientWidth || bounds.w, h: zone.clientHeight || bounds.h };
  rebuild();
  ro.observe(zone);
  let rt = 0;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(rebuild, 250); });

  if (bus) bus.on("catch", (c) => {
    const id = c && c.id;
    if (!id || caught.has(id)) return;
    caught.add(id);
    const e = schoolPlan([id], speciesById, { scale: scale() })[0];
    if (e) { addSchool(e, !motion.reduced); describe(); }
  });

  motion.onVisible(zone, start, stop);
  return { rebuild, schools, plan: () => schoolPlan([...caught], speciesById, { scale: scale() }), get bounds() { return bounds; } };
}
