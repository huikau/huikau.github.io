import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const src = await readFile(join(dirname(fileURLToPath(import.meta.url)), "../../sw.js"), "utf8");

/** Run sw.js against an in-memory Cache Storage and a scripted fetch. */
function boot(fetchImpl) {
  const stores = new Map();
  const key = (r) => (typeof r === "string" ? r : r.url);
  const cacheApi = (name) => ({
    async put(k, res) { stores.get(name).set(key(k), res); },
    async match(k) { const r = stores.get(name).get(key(k)); return r ? r.clone() : undefined; }
  });
  const caches = {
    async open(name) { if (!stores.has(name)) stores.set(name, new Map()); return cacheApi(name); },
    async match(k, o = {}) { const n = o.cacheName; return stores.has(n) ? cacheApi(n).match(k) : undefined; },
    async keys() { return [...stores.keys()]; },
    async delete(n) { return stores.delete(n); }
  };
  const handlers = {};
  const self = { location: { origin: "https://huikau.com" }, addEventListener: (t, f) => { handlers[t] = f; }, skipWaiting: async () => {}, clients: { claim: async () => {} } };
  vm.runInNewContext(src, { self, caches, fetch: fetchImpl, Response, Headers, Request, URL, setTimeout, clearTimeout, Promise, Date, console });
  const run = async (url, { method = "GET", mode = "cors" } = {}) => {
    let answer, pending = [];
    const event = { request: { method, url, mode }, respondWith: (p) => { answer = p; }, waitUntil: (p) => pending.push(p) };
    handlers.fetch(event);
    const res = answer ? await answer : null;
    await Promise.all(pending);
    return res;
  };
  return { run, stores, handlers };
}
const json = (body, init = {}) => { const r = new Response(JSON.stringify(body), { status: 200, ...init }); return r; };
const API = "https://api.weather.gov/stations/PHNL/observations/latest";

test("API: a good answer passes through and is kept; when the network then fails, the kept copy comes back marked", async () => {
  let up = true;
  const sw = boot(async () => { if (!up) throw new TypeError("offline"); const r = json({ n: 1 }); Object.defineProperty(r, "type", { value: "cors" }); return r; });
  const live = await sw.run(API);
  assert.equal(live.headers.get("x-huikau-sw"), null);
  assert.deepEqual(await live.json(), { n: 1 });
  up = false;
  const cached = await sw.run(API);
  assert.equal(cached.headers.get("x-huikau-sw"), "cache");
  assert.ok(Number(cached.headers.get("x-huikau-sw-time")) > 1e12);
  assert.deepEqual(await cached.json(), { n: 1 });
});

test("API: errors, opaque answers and partial content are never stored", async () => {
  for (const [status, type] of [[500, "cors"], [404, "cors"], [200, "opaque"], [206, "cors"]]) {
    const sw = boot(async () => { const r = new Response("{}", { status: status === 200 ? 200 : status }); Object.defineProperty(r, "type", { value: type }); return r; });
    await sw.run(API);
    assert.equal(sw.stores.get("huikau-api")?.size ?? 0, 0, `${status} ${type} stays out of the cache`);
  }
});

test("API: a 500 with a good copy kept falls back to the copy; with nothing kept it is passed on", async () => {
  let mode = "ok";
  const sw = boot(async () => { if (mode === "ok") { const r = json({ n: 2 }); Object.defineProperty(r, "type", { value: "cors" }); return r; } return new Response("oops", { status: 500 }); });
  assert.equal((await sw.run(API)).status, 200);
  mode = "500";
  const res = await sw.run(API);
  assert.equal(res.headers.get("x-huikau-sw"), "cache");
  const bare = boot(async () => new Response("oops", { status: 500 }));
  assert.equal((await bare.run(API)).status, 500);
});

test("non-GET requests and other hosts are left alone", async () => {
  const sw = boot(async () => json({}));
  assert.equal(await sw.run(API, { method: "POST" }), null);
  assert.equal(await sw.run("https://example.com/x.js"), null);
  assert.equal(await sw.run("https://huikau.com/sw.js"), null);
});

test("an old static cache is deleted on activate; the API cache is kept", async () => {
  const sw = boot(async () => json({}));
  await sw.stores.set("huikau-static-old", new Map()); await sw.stores.set("huikau-api", new Map());
  let done; sw.handlers.activate({ waitUntil: (p) => { done = p; } });
  await done;
  assert.deepEqual([...sw.stores.keys()], ["huikau-api"]);
});
