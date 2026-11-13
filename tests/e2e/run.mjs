// Runs every e2e spec, one after another (they share nothing but the machine). Exit code 1 if any file failed.
//   node tests/e2e/run.mjs              all specs
//   node tests/e2e/run.mjs load a11y    only specs whose file name contains one of these words
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const want = process.argv.slice(2);
const specs = readdirSync(dir).filter((f) => f.endsWith(".spec.mjs") && (!want.length || want.some((w) => f.includes(w)))).sort();
const results = [];
for (const f of specs) {
  const t0 = Date.now();
  console.log(`\n== ${f}`);
  const r = spawnSync(process.execPath, [join(dir, f)], { stdio: "inherit" });
  results.push({ f, ok: r.status === 0, s: ((Date.now() - t0) / 1000).toFixed(0) });
}
console.log("\ne2e summary");
for (const r of results) console.log(`  ${r.ok ? "pass" : "FAIL"}  ${r.f}  (${r.s} s)`);
const bad = results.filter((r) => !r.ok);
console.log(bad.length ? `${bad.length} of ${results.length} spec files failed` : `all ${results.length} spec files passed`);
process.exit(bad.length ? 1 : 0);
