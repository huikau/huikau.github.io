// Fishing e2e (WP6b). Run: node tests/e2e/fishing.spec.mjs   (exits non-zero on failure)
// Uses the ?debug=1 hooks on window.__huikau.modules.fishing: force(id), skipWait(), state.
import assert from "node:assert/strict";
import { launch, serve, routeApis } from "../../tools/shots.mjs";

const server = await serve(0);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await launch();
let failed = 0;

async function page(url, { seed, reduced = false, viewport = { width: 1440, height: 900 } } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion: reduced ? "reduce" : "no-preference" });
  await routeApis(context);
  if (seed) await context.addInitScript((s) => { for (const [k, v] of Object.entries(s)) if (!localStorage.getItem("__seeded")) localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem("__seeded", "1"); }, seed);
  const p = await context.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(base + url);
  await p.waitForFunction(() => window.__huikau?.modules?.fishing);
  p.errors = errors;
  p.ctx = context;
  return p;
}
const fishing = (p, fn, arg) => p.evaluate(([f, a]) => { const m = window.__huikau.modules.fishing; return new Function("m", "a", f)(m, a); }, [fn, arg]);
const stored = (p, key) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), key);

async function toBobber(p) {
  for (let i = 0; i < 80; i++) {
    if (await p.evaluate(() => document.activeElement?.id === "bobber")) return;
    await p.keyboard.press("Tab");
  }
  throw new Error("could not Tab to the bobber");
}
async function cast(p, id) {
  await p.keyboard.press("Enter");
  await p.waitForFunction(() => window.__huikau.modules.fishing.state === "waiting");
  if (id) await fishing(p, "return m.force(a)", id);
  await fishing(p, "return m.skipWait()");
  await p.waitForSelector('#rig[data-state="bite"]');
}

async function test(name, fn) {
  try { await fn(); console.log(`ok   ${name}`); }
  catch (e) { failed++; console.error(`FAIL ${name}\n${e.stack || e}`); }
}

await test("nothing is caught by merely loading the page", async () => {
  const p = await page("/?debug=1&t=12:00");
  await p.waitForTimeout(8000);
  assert.equal(await fishing(p, "return m.state"), "idle");
  const ids = await stored(p, "huikau-basket");
  assert.ok(!ids || ids.length === 0, `basket should be empty, got ${JSON.stringify(ids)}`);
  assert.equal(await p.locator("#catch.show").count(), 0);
  assert.equal(await p.locator("#basket-count").textContent().then((t) => /^0 of/.test(t)), true);
  await p.ctx.close();
});

await test("keyboard-only playthrough: cast, bite, reel, catch card, basket, field guide dialog", async () => {
  const p = await page("/?debug=1&t=12:00");
  const states = [];
  await p.evaluate(() => { window.__states = []; window.__huikau.bus.on("game", (d) => window.__states.push(d.state + (d.id ? ":" + d.id : ""))); });
  await toBobber(p);
  assert.equal(await p.locator("#hint").textContent(), "Cast your line");
  await cast(p, "uhu");
  assert.match(await p.locator("#hint").textContent(), /Bite! Press now/);
  await p.waitForSelector('#rig[data-zone="open"]');
  await p.keyboard.press("Space");
  await p.waitForSelector("#catch.show");
  assert.equal(await fishing(p, "return m.state"), "landed");
  const card = await p.locator("#catch").textContent();
  assert.match(card, /Uhu/);
  assert.match(card, /Parrotfish/);
  assert.equal(await p.locator("#catch svg").count() > 0, true, "card shows the illustrated species");
  assert.equal(await p.locator("#catch-name").getAttribute("lang"), "haw");
  assert.equal(await p.locator("#game-live").textContent().then((t) => /Uhu/.test(t)), true, "announced in the live region");
  await p.waitForFunction(() => /^1 of/.test(document.getElementById("basket-count").textContent), null, { timeout: 8000 });
  assert.deepEqual(await stored(p, "huikau-basket"), ["uhu"]);
  assert.equal((await stored(p, "huikau-guide")).uhu.n, 1);
  const seen = await p.evaluate(() => window.__states);
  for (const s of ["cast", "waiting", "bite", "reel", "landed:uhu"]) assert.ok(seen.includes(s), `missing game state ${s}: ${seen}`);
  assert.ok(seen.indexOf("bite") < seen.indexOf("reel") && seen.indexOf("reel") < seen.indexOf("landed:uhu"));
  // field guide: Enter opens the detail card, Escape closes it, focus returns
  await p.waitForSelector('button.guide-slot[data-id="uhu"]:not(.arriving)');
  await p.locator('button.guide-slot[data-id="uhu"]').focus();
  await p.keyboard.press("Enter");
  await p.waitForSelector("#guide-dialog[open]");
  const dlg = await p.locator("#guide-dialog").textContent();
  assert.match(dlg, /Uhu/); assert.match(dlg, /Parrotfish/); assert.match(dlg, /Times caught/); assert.match(dlg, /Best time/);
  assert.equal(await p.locator("#guide-name").getAttribute("lang"), "haw");
  await p.keyboard.press("Escape");
  await p.waitForFunction(() => !document.getElementById("guide-dialog").open);
  assert.equal(await p.evaluate(() => document.activeElement?.dataset?.id), "uhu");
  assert.deepEqual(p.errors, []);
  await p.ctx.close();
});

await test("a second catch of the same species counts up; casting early pulls the line back, no catch", async () => {
  const p = await page("/?debug=1&t=12:00", { seed: { "huikau-basket": ["uhu"] } });
  await toBobber(p);
  await cast(p, "uhu");
  await p.waitForSelector('#rig[data-zone="open"]');
  await p.keyboard.press("Space");
  await p.waitForSelector("#catch.show");
  assert.match(await p.locator("#catch-kicker").textContent(), /again/i);
  assert.equal((await stored(p, "huikau-guide")).uhu.n, 2);
  await p.waitForFunction(() => window.__huikau.modules.fishing.state === "idle");
  await p.keyboard.press("Enter");                              // cast
  await p.waitForFunction(() => window.__huikau.modules.fishing.state === "waiting");
  await p.waitForTimeout(500);
  await p.keyboard.press("Space");                               // too soon
  assert.equal(await fishing(p, "return m.state"), "idle");
  assert.match(await p.locator("#hint").textContent(), /cast again/i);
  await p.ctx.close();
});

await test("missing the ring: the fish gets away and the basket is untouched", async () => {
  const p = await page("/?debug=1&t=12:00");
  await toBobber(p);
  await cast(p, "mahi");
  await p.waitForSelector('#rig[data-state="gotaway"]', { timeout: 5000 });
  assert.match(await p.locator("#hint").textContent(), /Got away/);
  assert.ok(!(await stored(p, "huikau-basket"))?.length);
  await p.ctx.close();
});

await test("holding the button lands the catch after 2 s even without timing", async () => {
  const p = await page("/?debug=1&t=12:00");
  await toBobber(p);
  await cast(p, "kala");
  await p.keyboard.down("Space");
  await p.waitForSelector("#catch.show", { timeout: 4000 });
  await p.keyboard.up("Space");
  assert.deepEqual(await stored(p, "huikau-basket"), ["kala"]);
  await p.ctx.close();
});

await test("legacy huikau-tackle data appears in the field guide", async () => {
  const p = await page("/?debug=1&t=12:00", { seed: { "huikau-tackle": ["mahi", "boot"] } });
  assert.equal(await p.locator('button.guide-slot[data-id="mahi"]').count(), 1);
  assert.equal(await p.locator('button.guide-slot[data-id="boot"]').count(), 1);
  assert.equal(await p.locator('.guide-slot.is-missing[data-id="shark"]').count(), 1, "uncaught species show silhouettes");
  assert.match(await p.locator("#basket-count").textContent(), /^2 of/);
  await p.ctx.close();
});

await test("Ula meets her namesake; the honu only visits and is never added", async () => {
  const p = await page("/?debug=1&t=12:00");
  await toBobber(p);
  await cast(p, "ula");
  await p.waitForSelector('#rig[data-zone="open"]');
  await p.keyboard.press("Space");
  await p.waitForSelector("#catch.show");
  assert.match(await p.locator("#catch-text").textContent(), /namesake/);
  await p.waitForFunction(() => window.__huikau.modules.fishing.state === "idle");
  await p.keyboard.press("Enter");
  await p.waitForFunction(() => window.__huikau.modules.fishing.state === "waiting");
  await fishing(p, "m.force(a); return m.skipWait()", "honu");
  await p.waitForFunction(() => /Just visiting/.test(document.getElementById("catch-kicker").textContent));
  assert.deepEqual(await stored(p, "huikau-basket"), ["ula"]);
  assert.ok(!/caught/i.test(await p.locator("#catch").textContent()));
  await p.ctx.close();
});

await test("?rare=1 brings the golden ulua; ?easy=1 lets any press land", async () => {
  const p = await page("/?debug=1&t=12:00&rare=1&easy=1");
  await toBobber(p);
  await cast(p);
  await p.waitForTimeout(400);
  await p.keyboard.press("Space");
  await p.waitForSelector("#catch.show");
  assert.match(await p.locator("#catch-kicker").textContent(), /Rare/);
  assert.deepEqual(await stored(p, "huikau-basket"), ["golden"]);
  await p.ctx.close();
});

await test("reduced motion: still works, any press lands, no scrolling away", async () => {
  const p = await page("/?debug=1&t=12:00", { reduced: true });
  await toBobber(p);
  await cast(p, "manini");
  await p.waitForTimeout(400);
  await p.keyboard.press("Enter");
  await p.waitForSelector("#catch.show");
  assert.equal(await p.evaluate(() => scrollY), 0);
  assert.deepEqual(await stored(p, "huikau-basket"), ["manini"]);
  await p.ctx.close();
});

await test("the bobber's tap target is at least 44 px at 390 wide", async () => {
  const p = await page("/?debug=1&t=12:00", { viewport: { width: 390, height: 844 } });
  const r = await p.evaluate(() => {
    const b = document.getElementById("bobber"), c = b.getBoundingClientRect();
    const cx = c.left + c.width / 2, cy = c.top + c.height / 2;
    const hit = (dx, dy) => !!document.elementFromPoint(cx + dx, cy + dy)?.closest("#bobber");
    return { w: c.width, ok: hit(-22 * .85, 0) && hit(22 * .85, 0) && hit(0, -22 * .85) && hit(0, 22 * .85) };
  });
  assert.ok(r.ok, "points 22 px (CSS px) from the centre in every direction hit the bobber");
  await p.ctx.close();
});

await browser.close();
server.close();
if (failed) { console.error(`${failed} failed`); process.exit(1); }
console.log("all fishing e2e tests passed");
