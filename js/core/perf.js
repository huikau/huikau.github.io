// Frame-time sampler for tests (exposed as window.__huikau.perf under ?debug=1). start() counts requestAnimationFrame
// deltas and long tasks; stop() returns { frames, p50, p95, max, longTasks: [{ start, duration }] } (milliseconds).
export const percentile = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0);

export function createPerf() {
  let raf = 0, last = 0, deltas = [], tasks = [], observer = null, running = false;
  const frame = (t) => {
    if (!running) return;
    if (last) deltas.push(t - last);
    last = t;
    raf = requestAnimationFrame(frame);
  };
  return {
    start() {
      this.stop();
      deltas = []; tasks = []; last = 0; running = true;
      try {
        observer = new PerformanceObserver((list) => { for (const e of list.getEntries()) tasks.push({ start: Math.round(e.startTime), duration: Math.round(e.duration) }); });
        observer.observe({ entryTypes: ["longtask"] });
      } catch { observer = null; }
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      if (observer) { for (const e of observer.takeRecords()) tasks.push({ start: Math.round(e.startTime), duration: Math.round(e.duration) }); observer.disconnect(); observer = null; }
      const s = deltas.slice().sort((a, b) => a - b);
      return { frames: s.length, p50: +percentile(s, .5).toFixed(2), p95: +percentile(s, .95).toFixed(2), max: +(s[s.length - 1] || 0).toFixed(2), longTasks: tasks };
    }
  };
}
