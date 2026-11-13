// Fat Boy Fishing Club: a weathered dock sign planted in the shallows. The link itself is plain HTML; this module only
// keeps its ripples from running while the sign is off screen or the tab is hidden, and says it opens a new tab.
import { motion } from "../core/motion.js";

export function initCrew() {
  const el = document.querySelector(".crew");
  if (!el) return null;
  if (!el.hasAttribute("aria-label")) el.setAttribute("aria-label", "Fat Boy Fishing Club: shop the gear (opens in a new tab)");
  if (!motion.reduced) {
    motion.onVisible(el, () => el.classList.remove("paused"), () => el.classList.add("paused"));
  }
  return { el };
}
