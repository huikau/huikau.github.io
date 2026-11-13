// Ula's lauhala basket: what has been caught, and how it is drawn.
import { $ } from "../core/dom.js";
import { motion } from "../core/motion.js";
import { store } from "../core/store.js";

export function createBasket(collection) {
  const grid = $("basket-grid"), count = $("basket-count");
  // catches saved before the basket was renamed lived under "huikau-tackle"
  let caught = new Set(store.get("huikau-basket", store.get("huikau-tackle", [])));

  function render(fresh) {
    grid.innerHTML = "";
    for (const c of collection) {
      const li = document.createElement("li");
      const have = caught.has(c.id);
      li.className = [c.rare ? "rare" : "", have ? "" : "missing", fresh === c.id ? "fresh" : ""].join(" ").trim();
      const span = document.createElement("span");
      span.setAttribute("aria-hidden", "true");
      span.textContent = c.rare && !have ? "?" : c.e;
      if (c.rare && have) span.className = "golden";
      li.appendChild(span);
      li.title = have ? c.t : c.rare ? "Something rare is out there" : "Not caught yet";
      const sr = document.createElement("span");
      sr.className = "sr-only";
      sr.textContent = have ? c.t : "Not caught yet";
      li.appendChild(sr);
      grid.appendChild(li);
    }
    const n = collection.filter((c) => caught.has(c.id)).length;
    count.textContent = n === collection.length ? `All ${n} caught. Ula's impressed.` : `${n} of ${collection.length} caught`;
    $("basket-reset").hidden = n === 0;
  }

  // Glide down just far enough to show the basket, then pop the new catch in
  function reveal(done) {
    const overflow = $("basket").getBoundingClientRect().bottom + 24 - innerHeight;
    if (overflow <= 0) { done(); return; }
    const start = scrollY;
    if (motion.reduced) { scrollTo(0, start + overflow); done(); return; }
    const t0 = performance.now(), dur = 1600;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      scrollTo(0, start + overflow);
      done();
    };
    const step = (t) => {
      if (finished) return;
      const k = Math.min(1, (t - t0) / dur);
      const ease = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      scrollTo(0, start + overflow * ease);
      if (k < 1) requestAnimationFrame(step); else finish();
    };
    requestAnimationFrame(step);
    // background tabs can pause animation frames; make sure the glide always lands
    setTimeout(finish, dur + 400);
  }

  $("basket-reset").addEventListener("click", () => {
    caught = new Set();
    store.set("huikau-basket", []);
    render();
  });
  render();

  return {
    has: (id) => caught.has(id),
    add(id) { caught.add(id); store.set("huikau-basket", [...caught]); },
    ids: () => [...caught],
    render, reveal
  };
}
