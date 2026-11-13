// Reduced-motion flag and the visibility gate every animation loop uses.
export const motion = {
  reduced: !!(globalThis.matchMedia && globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches),

  /**
   * Call start() while `el` is on screen AND the tab is visible, stop() otherwise.
   * Returns a function that removes the observers.
   */
  onVisible(el, start, stop) {
    let inView = true, running = null;
    const update = () => {
      const want = inView && !document.hidden;
      if (want === running) return;
      running = want;
      if (want) start(); else stop();
    };
    const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; update(); });
    io.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", update); };
  }
};
