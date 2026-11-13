#!/usr/bin/env node
// Size and request budgets (plan section 3). Loads "/" in Chromium (API fixtures, service worker blocked), records
// every response's uncompressed size by type, and fails when a budget is broken or a host outside the allowed list is hit.
//
//   node tools/budget.mjs            table, exit 1 on any breach
//   node tools/budget.mjs --json     machine-readable
//
// "Critical images" are the images requested during the first load (up to the load event plus a short settle), og.png excluded.
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { serve, launch, routeApis } from "./shots.mjs";

export const BUDGETS = { js: 260, css: 90, fonts: 160, images: 350 }; // KB (1 KB = 1024 bytes)
export const ALLOWED_HOSTS = ["127.0.0.1", "localhost", "api.tidesandcurrents.noaa.gov", "api.weather.gov", "marine-api.open-meteo.com", "api.open-meteo.com"];

const kind = (url, type) => {
  const p = new URL(url).pathname;
  if (/\.m?js$/.test(p)) return "js";
  if (/\.css$/.test(p)) return "css";
  if (/\.(woff2?|ttf|otf)$/.test(p)) return "fonts";
  if (/\.(png|webp|jpe?g|gif|svg|avif|ico)$/.test(p) && !/manifest/.test(p)) return "images";
  if (type === "document") return "html";
  if (/\.json$/.test(p)) return "data";
  return "other";
};

export async function measure({ url = "/", settle = 2500 } = {}) {
  const server = await serve(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
  await routeApis(context);
  const page = await context.newPage();
  const files = [], hosts = new Set(), failures = [];
  const pending = [];
  page.on("response", (res) => {
    const u = res.url();
    hosts.add(new URL(u).hostname);
    pending.push(res.body().then((b) => files.push({ url: u, bytes: b.length, kind: kind(u, res.request().resourceType()), status: res.status() })).catch(() => {}));
  });
  page.on("requestfailed", (r) => failures.push(r.url()));
  await page.goto(base + url, { waitUntil: "load" });
  await page.waitForTimeout(settle);
  await Promise.all(pending);
  await browser.close();
  server.close();
  return { files: files.filter((f) => new URL(f.url).hostname === "127.0.0.1"), hosts: [...hosts], failures };
}

export function summarize({ files, hosts }) {
  const by = {};
  for (const f of files) {
    if (/\/og\.png$/.test(f.url)) continue;
    (by[f.kind] ||= { bytes: 0, files: [] });
    by[f.kind].bytes += f.bytes;
    by[f.kind].files.push(f);
  }
  const rows = Object.entries(BUDGETS).map(([k, limit]) => {
    const kb = (by[k]?.bytes || 0) / 1024;
    return { type: k, kb, limit, ok: kb <= limit, count: by[k]?.files.length || 0 };
  });
  const badHosts = hosts.filter((h) => !ALLOWED_HOSTS.includes(h));
  return { rows, by, badHosts, ok: rows.every((r) => r.ok) && !badHosts.length };
}

async function main() {
  const m = await measure();
  const s = summarize(m);
  if (process.argv.includes("--json")) { console.log(JSON.stringify({ rows: s.rows, badHosts: s.badHosts }, null, 2)); }
  else {
    console.log("type     files   size KB   budget KB   status");
    for (const r of s.rows) console.log(`${r.type.padEnd(8)} ${String(r.count).padStart(5)} ${r.kb.toFixed(1).padStart(9)} ${String(r.limit).padStart(11)}   ${r.ok ? "ok" : "OVER"}`);
    const other = Object.entries(s.by).filter(([k]) => !(k in BUDGETS)).map(([k, v]) => `${k} ${(v.bytes / 1024).toFixed(1)} KB`);
    if (other.length) console.log(`(not budgeted: ${other.join(", ")})`);
    console.log(`hosts contacted: ${m.hosts.join(", ")}${s.badHosts.length ? `   FORBIDDEN: ${s.badHosts.join(", ")}` : ""}`);
    if (process.argv.includes("--list")) for (const [k, v] of Object.entries(s.by)) for (const f of v.files.sort((a, b) => b.bytes - a.bytes)) console.log(`  ${k.padEnd(6)} ${String(f.bytes).padStart(7)}  ${f.url.replace(/^http:\/\/127.0.0.1:\d+/, "")}`);
  }
  process.exitCode = s.ok ? 0 : 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
