// Budget e2e (WP11): plan section 3 as a test. The same measurement as `node tools/budget.mjs`.
import assert from "node:assert/strict";
import { measure, summarize, BUDGETS } from "../../tools/budget.mjs";

const m = await measure();
const s = summarize(m);
let failed = 0;
const test = (name, fn) => { try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.error(`FAIL ${name}\n${e.message}`); } };

for (const r of s.rows) test(`${r.type} first load is ${r.kb.toFixed(1)} KB, within ${BUDGETS[r.type]} KB`, () => assert.ok(r.ok, `${r.type}: ${r.kb.toFixed(1)} KB > ${BUDGETS[r.type]} KB`));
test("only the allowed hosts are contacted", () => assert.deepEqual(s.badHosts, []));
test("the lazy postcard painter (and the retired fishart-gallery) are not part of the first load", () => {
  const urls = m.files.map((f) => f.url);
  assert.ok(!urls.some((u) => /fishart-gallery|ui\/postcard\.js/.test(u)), urls.filter((u) => /fishart-gallery|postcard\.js/.test(u)).join(", "));
  assert.ok(!urls.some((u) => /\/og\.png$/.test(u)), "og.png is for link previews, never loaded by the page");
});
if (failed) process.exit(1);
console.log("budget e2e: all passed");
