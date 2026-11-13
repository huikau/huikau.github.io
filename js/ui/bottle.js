// The message in a bottle: Today's Hawaiian word bobs just under the waterline and opens into a card
// with previous / next. A native <dialog>, so Tab is trapped, Escape closes it and focus returns to the bottle.
import { $ } from "../core/dom.js";
import { motion } from "../core/motion.js";
import { words } from "../data/hawaiian.js";

/** Index in `words` of the word for epoch-ms `ms` (the same pick wordOfDay makes). */
export const wordIndex = (ms) => Math.floor(ms / 86400000) % words.length;

/** The card's text for word `i`: the label, the counter and the word itself. */
export function wordCard(i, todayIdx) {
  const idx = ((i % words.length) + words.length) % words.length;
  const [term, meaning] = words[idx];
  return { idx, term, meaning, label: idx === todayIdx ? "Today's Hawaiian word" : "A Hawaiian word", count: `${idx + 1} of ${words.length}`, isToday: idx === todayIdx };
}

export function initBottle({ clock }) {
  const open = $("bottle-open"), dlg = $("bottle-card");
  if (!open || !dlg) return null;
  const today = () => wordIndex(clock.now());
  let idx = today();

  const show = (i) => {
    const c = wordCard(i, today());
    idx = c.idx;
    $("word-label").textContent = c.label;
    $("word-term").textContent = c.term;
    $("word-meaning").textContent = c.meaning;
    $("bottle-count").textContent = c.count;
    $("bottle-today").hidden = c.isToday;
  };

  const openCard = () => {
    show(today());
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    open.setAttribute("aria-expanded", "true");
  };
  const closeCard = () => {
    if (typeof dlg.close === "function") dlg.close(); else dlg.removeAttribute("open");
    onClosed();
  };
  const onClosed = () => { open.setAttribute("aria-expanded", "false"); open.focus(); };

  open.addEventListener("click", openCard);
  dlg.addEventListener("close", onClosed);
  $("bottle-close").addEventListener("click", closeCard);
  $("bottle-prev").addEventListener("click", () => show(idx - 1));
  $("bottle-next").addEventListener("click", () => show(idx + 1));
  $("bottle-today").addEventListener("click", () => { show(today()); $("bottle-next").focus(); });
  // A click on the dimmed backdrop (the dialog element itself, outside the card) closes it.
  dlg.addEventListener("click", (e) => { if (e.target === dlg) closeCard(); });
  dlg.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") show(idx - 1);
    else if (e.key === "ArrowRight") show(idx + 1);
    else if (e.key === "Escape" && typeof dlg.showModal !== "function") closeCard();
  });

  show(today());
  // Bob only while the bottle is on screen and the tab is visible; the resting pose is the plain style.
  const float = open.querySelector(".bottle__float");
  if (float && !motion.reduced && typeof IntersectionObserver === "function") {
    motion.onVisible(open, () => float.classList.add("is-bobbing"), () => float.classList.remove("is-bobbing"));
  }
  return { open: openCard, close: closeCard, show, get index() { return idx; } };
}
