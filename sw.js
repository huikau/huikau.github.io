// huikau.com service worker (WP10): works offline after one visit, and never serves a stale deploy.
//
// DEPLOY PROCEDURE: bump VERSION below in the same commit as any change to files in the PRECACHE list.
// Changing this file's bytes is what makes browsers install the new worker; the new worker precaches the new
// files into a fresh cache, takes over at once (skipWaiting + clients.claim) and deletes the old caches.
// tests/unit/pwa.test.mjs fails if a js, css, font or icon file is missing from PRECACHE.
//
// Strategies
//   navigations         network first (4 s), then the cached page; unknown paths get the cached 404.html
//   js, css, html       network first (3 s), then the cache, so a deploy shows up on the next load even
//                       if VERSION was forgotten; a hard refresh bypasses the worker entirely
//   fonts, images       cache first (immutable by VERSION)
//   the four APIs       network first (7 s, just under the page's 8 s), then the last good response, marked with
//                       x-huikau-sw: cache and x-huikau-sw-time: <ms when it was fetched>; js/core/store.js turns those
//                       into status "cached"
//   never stored        opaque responses, anything not 200 OK, partial content, non-GET requests
const VERSION = "2026-11-13.1";
const STATIC_CACHE = `huikau-static-${VERSION}`;
const API_CACHE = "huikau-api"; // not versioned: the last good tide, surf and weather survive a deploy

const API_HOSTS = ["api.tidesandcurrents.noaa.gov", "api.weather.gov", "marine-api.open-meteo.com", "api.open-meteo.com"];
const API_BUDGET_MS = 7000;
const NAV_BUDGET_MS = 4000;
const CODE_BUDGET_MS = 3000;

const PRECACHE = [
  "/", "/404.html", "/manifest.webmanifest",
  "/css/tokens.css", "/css/base.css", "/assets/site.css", "/css/scene.css", "/css/game.css", "/css/instruments.css",
  "/css/deep.css", "/css/sound.css", "/css/seasonal.css", "/css/postcard.css",
  "/js/main.js",
  "/js/core/astro.js", "/js/core/bus.js", "/js/core/clock.js", "/js/core/dom.js", "/js/core/motion.js", "/js/core/store.js",
  "/js/data/hawaiian.js", "/js/data/species.js", "/js/data/surf.js", "/js/data/tides.js", "/js/data/weather.js",
  "/js/game/basket.js", "/js/game/fishart-gallery.js", "/js/game/fishart.js", "/js/game/fishing.js",
  "/js/scene/crew.js", "/js/scene/dive.js", "/js/scene/land.js", "/js/scene/reef.js", "/js/scene/surface.js", "/js/scene/ula.js",
  "/js/sky/bodies.js", "/js/sky/clouds.js", "/js/sky/palette.js", "/js/sky/rain.js", "/js/sky/sky.js", "/js/sky/stars.js", "/js/sky/timemachine.js",
  "/js/ui/bottle.js", "/js/ui/eggs.js", "/js/ui/instruments.js", "/js/ui/postcard.js", "/js/ui/seasons.js", "/js/ui/sound.js",
  "/assets/fonts/anton-latin-ext.woff2", "/assets/fonts/anton-latin.woff2",
  "/assets/fonts/caprasimo-latin-ext.woff2", "/assets/fonts/caprasimo-latin.woff2",
  "/assets/fonts/figtree-var-latin-ext.woff2", "/assets/fonts/figtree-var-latin.woff2",
  "/assets/huikau-logo.webp", "/assets/ula.webp", "/assets/fatboy-logo.webp",
  "/assets/favicon-32.png", "/assets/apple-touch-icon.png",
  "/assets/img/icons/icon-192.png", "/assets/img/icons/icon-512.png", "/assets/img/icons/icon-maskable-512.png"
];

const isCode = (path) => /\.(?:js|css|html|webmanifest)$/.test(path) || path === "/";

/** Only good, complete, readable answers go in a cache. */
const storable = (res) => !!res && res.status === 200 && (res.type === "basic" || res.type === "cors");

/** Race a promise against a timer; the loser's rejection is swallowed. */
const within = (promise, ms) => new Promise((ok, no) => {
  const t = setTimeout(() => no(new Error("timeout")), ms);
  promise.then((v) => { clearTimeout(t); ok(v); }, (e) => { clearTimeout(t); no(e); });
});

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    // "reload" skips the HTTP cache, so the precache never captures a stale copy of a file
    await Promise.all(PRECACHE.map(async (path) => {
      const res = await fetch(new Request(path, { cache: "reload" }));
      if (!storable(res)) throw new Error(`precache failed for ${path}: ${res.status}`);
      await cache.put(path, res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith("huikau-static-") && name !== STATIC_CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});

/** A copy of an API response with the time it was fetched, for the cache. */
async function stamped(res) {
  const headers = new Headers(res.headers);
  headers.set("x-huikau-sw-time", String(Date.now()));
  return new Response(await res.clone().blob(), { status: res.status, statusText: res.statusText, headers });
}

async function fromApiCache(request) {
  const hit = await caches.match(request.url, { cacheName: API_CACHE }); // match() reads without creating a cache
  if (!hit) return null;
  const headers = new Headers(hit.headers);
  headers.set("x-huikau-sw", "cache");
  return new Response(await hit.blob(), { status: 200, statusText: "OK", headers });
}

const putStatic = async (key, res) => { try { await (await caches.open(STATIC_CACHE)).put(key, res); } catch {} };
const fromStatic = (key, opts = {}) => caches.match(key, { cacheName: STATIC_CACHE, ...opts });

async function api(event) {
  const { request } = event;
  const network = fetch(request);
  // keep the fetch alive past the budget so a slow answer still refreshes the cache for next time
  // (stamped() must clone the response before the page starts reading it, so it is called first and awaited later)
  event.waitUntil(network.then(async (res) => {
    if (!storable(res)) return;
    const copy = stamped(res);
    await (await caches.open(API_CACHE)).put(request.url, await copy);
  }).catch(() => {}));
  try {
    const res = await within(network, API_BUDGET_MS);
    if (res.ok) return res;
    return (await fromApiCache(request)) || res; // a 500 with nothing cached is passed on as it is
  } catch {
    return (await fromApiCache(request)) || Response.error();
  }
}

async function navigate(event) {
  const { request } = event;
  const url = new URL(request.url);
  const home = url.pathname === "/" || url.pathname === "/index.html";
  try {
    const res = await within(fetch(request), NAV_BUDGET_MS);
    if (home && storable(res)) event.waitUntil(putStatic("/", res.clone()));
    return res;
  } catch {
    const page = (await fromStatic(url.pathname, { ignoreSearch: true })) || (home ? await fromStatic("/") : null);
    if (page) return page;
    const lost = await fromStatic("/404.html");
    return lost ? new Response(lost.body, { status: 404, statusText: "Not Found", headers: lost.headers }) : Response.error();
  }
}

async function code(event) {
  const { request } = event;
  try {
    const res = await within(fetch(request), CODE_BUDGET_MS);
    if (storable(res)) event.waitUntil(putStatic(request, res.clone()));
    return res;
  } catch {
    return (await fromStatic(request, { ignoreSearch: true })) || Response.error();
  }
}

async function immutable(event) {
  const { request } = event;
  const hit = await fromStatic(request, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(request);
  if (storable(res)) event.waitUntil(putStatic(request, res.clone()));
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (API_HOSTS.includes(url.hostname)) return event.respondWith(api(event));
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js") return; // always straight from the network, so updates are seen
  if (request.mode === "navigate") return event.respondWith(navigate(event));
  if (isCode(url.pathname)) return event.respondWith(code(event));
  event.respondWith(immutable(event));
});
