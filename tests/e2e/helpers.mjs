// Shared bits for the e2e specs: one static server and browser per spec file, a page factory that freezes the clock at
// 2026-11-12 (Honolulu), answers the APIs from tests/fixtures/ and records every console error, warning and page error.
import { launch, serve, routeApis, API_HOSTS, hostOf } from "../../tools/shots.mjs";

export const DATE = "2026-11-12";
export const hst = (hhmm = "12:00", date = DATE) => new Date(`${date}T${hhmm}:00-10:00`);

export async function setup() {
  const server = await serve(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await launch();
  let failed = 0;
  const env = {
    base, browser,
    /**
     * Open a page. Options: viewport, reduced, apis ("fixtures" | "down"), weather (fixture name), seed ({ key: json value } for
     * localStorage, written once), at ("HH:MM" the frozen Date), sw (allow service workers), wait (a function to wait for, default: the fishing module).
     */
    async page(url = "/?debug=1&t=12:00", { viewport = { width: 1440, height: 900 }, reduced = false, apis = "fixtures", weather = "weather", seed, at = "12:00", sw = false, wait = true, init } = {}) {
      const context = await browser.newContext({ viewport, reducedMotion: reduced ? "reduce" : "no-preference", serviceWorkers: sw ? "allow" : "block" });
      await routeApis(context, apis, weather);
      if (seed) await context.addInitScript((s) => { if (localStorage.getItem("__seeded")) return; for (const [k, v] of Object.entries(s)) localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem("__seeded", "1"); }, seed);
      const p = await context.newPage();
      p.problems = [];
      // with the APIs down the browser logs "Failed to load resource" for each refused call; that is the test's doing
      // (and the 404 page's own "Failed to load resource": it is served with status 404 on purpose)
      p.on("console", (m) => {
        if (!["error", "warning"].includes(m.type())) return;
        if (apis === "down" && API_HOSTS.includes(hostOf(m.location().url))) return;
        if (m.location().url === p.url() && /status of 404/.test(m.text())) return;
        p.problems.push(`${m.type()}: ${m.text()}`);
      });
      p.on("pageerror", (e) => p.problems.push(`pageerror: ${e}`));
      p.on("requestfailed", (r) => { if (!API_HOSTS.includes(hostOf(r.url()))) p.problems.push(`requestfailed: ${r.url()}`); });
      // Freeze Date only. (page.clock would also swap in a fake requestAnimationFrame, which ruins frame timing.)
      await context.addInitScript((ms) => {
        const Real = Date;
        class FixedDate extends Real { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } }
        window.Date = FixedDate;
      }, hst(at).getTime());
      if (init) await context.addInitScript(init);
      p.ctx = context;
      await p.goto(base + url);
      if (wait) await p.waitForFunction(() => window.__huikau?.modules?.fishing && document.getElementById("timemachine") && !document.getElementById("timemachine").hidden);
      return p;
    },
    async test(name, fn) {
      try { await fn(); console.log(`ok   ${name}`); }
      catch (e) { failed++; console.error(`FAIL ${name}\n${e.stack || e}`); }
    },
    async done(label) {
      await browser.close();
      server.close();
      if (failed) { console.error(`${label}: ${failed} failed`); process.exit(1); }
      console.log(`${label}: all passed`);
    }
  };
  return env;
}

/** The rendered pixel size / visibility of an element as a plain object. */
export const css = (p, sel, prop) => p.locator(sel).first().evaluate((e, prop) => getComputedStyle(e).getPropertyValue(prop), prop);
export const rootVar = (p, name) => p.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);
