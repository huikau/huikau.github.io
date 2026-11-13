// Tiny pub/sub. Events used across the site:
//   tick (every 30 s and whenever the clock is moved), sky, weather, tides, surf, catch.
// ("depth" arrives with the dive.)
export function createBus() {
  const handlers = new Map();
  return {
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(fn);
      return () => this.off(type, fn);
    },
    off(type, fn) {
      const set = handlers.get(type);
      if (set) set.delete(fn);
    },
    emit(type, detail) {
      const set = handlers.get(type);
      if (!set) return;
      for (const fn of [...set]) {
        try { fn(detail, type); } catch (err) { console.error(`bus handler for "${type}" failed`, err); }
      }
    }
  };
}

export const bus = createBus();
