// localStorage wrapper that never throws, plus the last-good cache and the
// timeout-guarded fetch used by every data module.
//
// Keys that must keep working exactly as before: "huikau-basket" and the legacy "huikau-tackle".
const ls = () => { try { return globalThis.localStorage || null; } catch { return null; } };

export const store = {
  get(key, fallback) {
    try { const v = ls().getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { ls().setItem(key, JSON.stringify(value)); } catch {}
  }
};

const CACHE_PREFIX = "huikau-cache:";
export const cache = {
  read(key) {
    const c = store.get(CACHE_PREFIX + key, null);
    return c && typeof c.t === "number" && "v" in c ? c : null;
  },
  write(key, value, t = Date.now()) { store.set(CACHE_PREFIX + key, { t, v: value }); }
};

export const FETCH_TIMEOUT_MS = 8000;

/**
 * Fetch JSON with an 8 s timeout and a last-good cache.
 * Resolves (never rejects) to { status: "live" | "cached" | "none", data, t }:
 *   live    fresh data from the network (also written to the cache)
 *   cached  the network failed, so the last good value (t = when it was fetched)
 *   none    no network and nothing usable cached; data is null
 * `parse` turns the response JSON into the value to keep; return null/undefined/[] to say "unusable".
 */
export async function fetchCached(key, url, opts = {}) {
  const {
    init = {}, parse = (j) => j, timeout = FETCH_TIMEOUT_MS, maxAge = Infinity,
    fetchImpl = globalThis.fetch, now = () => Date.now()
  } = opts;
  let timer, swCached; // swCached: set when the service worker served a cached copy (its fetch time, or null if unknown)
  try {
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const limit = new Promise((_, no) => { timer = setTimeout(() => { ctl && ctl.abort(); no(new Error("timeout")); }, timeout); });
    const work = (async () => {
      const res = await fetchImpl(url, ctl ? { ...init, signal: ctl.signal } : init);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // sw.js answers from its own cache when the network fails, and says so (and when it was fetched) in these headers
      const h = res.headers;
      if (h && typeof h.get === "function" && h.get("x-huikau-sw") === "cache") swCached = Number(h.get("x-huikau-sw-time")) || null;
      return parse(await res.json());
    })();
    work.catch(() => {}); // a late failure after the timeout must not surface
    const data = await Promise.race([work, limit]);
    if (data == null || (Array.isArray(data) && !data.length)) throw new Error("unusable response");
    if (swCached !== undefined) return { status: "cached", data, t: swCached ?? now() };
    const t = now();
    cache.write(key, data, t);
    return { status: "live", data, t };
  } catch {
    const c = cache.read(key);
    if (c && now() - c.t <= maxAge) return { status: "cached", data: c.v, t: c.t };
    return { status: "none", data: null, t: null };
  } finally {
    clearTimeout(timer);
  }
}
