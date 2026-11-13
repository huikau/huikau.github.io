import test from "node:test";
import assert from "node:assert/strict";
import * as data from "../../js/data/species.js";
const { species, speciesById } = data;
import { fishSVG, fishArt } from "../../js/game/fishart.js";

// Plan section 4.5, character for character (U+02BB okina, kahako).
const VETTED = ["mahimahi", "ʻahi", "aku", "ono", "ulua", "ʻōpakapaka", "uku", "moi", "ʻamaʻama", "humuhumunukunukuāpuaʻa",
  "uhu", "manini", "kala", "weke", "ʻōʻio", "heʻe", "ula", "manō", "honu", "ʻiwa", "koholā"];
const LEGACY = ["mahi", "pineapple", "slipper", "hee", "coconut", "puffer", "plumeria", "boot", "shark", "honu", "wave", "cap", "golden"];
const EMOJI = /\p{Extended_Pictographic}/u;

test("every hawaiian field is in the vetted list, character for character", () => {
  for (const s of species) if (s.hawaiian !== null) assert.ok(VETTED.includes(s.hawaiian), `${s.id}: ${s.hawaiian}`);
  for (const s of species) if (s.hawaiian) assert.ok(!s.hawaiian.includes("'") && !s.hawaiian.includes("’"), `${s.id} uses a plain apostrophe`);
  for (const n of ["ʻahi", "ʻōpakapaka", "ʻamaʻama", "ʻōʻio", "heʻe", "manō", "humuhumunukunukuāpuaʻa"]) {
    assert.ok(species.some((s) => s.hawaiian === n), `missing ${n}`);
  }
});

test("shape: required fields, unique ids, 24+ entries, legacy ids kept", () => {
  assert.ok(species.length >= 24);
  assert.equal(new Set(species.map((s) => s.id)).size, species.length);
  for (const id of LEGACY) assert.ok(speciesById[id], id);
  for (const id of ["skeleton", "pumpkin", "gift", "popper", "ula"]) assert.ok(speciesById[id], id);
  for (const s of species) {
    for (const k of ["id", "name", "english", "line", "mood", "rarity", "habitat", "art"]) assert.ok(s[k], `${s.id}.${k}`);
    assert.ok("hawaiian" in s);
    assert.ok(["yay", "meh"].includes(s.mood));
    assert.ok(s.line.length < 90, `${s.id} line too long`);
  }
  assert.equal(speciesById.honu.rarity, "visitor");
});

test("no emoji anywhere in species entries", () => {
  for (const s of species) assert.ok(!EMOJI.test(JSON.stringify(s)), s.id);
});

test("the emoji compatibility shim is gone; the game uses fishSVG", () => {
  for (const k of ["catches", "golden", "seasonal"]) assert.ok(!(k in data), k);
  for (const id of LEGACY) assert.ok(speciesById[id], id);
});

test("fishSVG renders every species, deterministically, with no gradients or emoji", () => {
  const sizes = new Set();
  for (const s of species) {
    const svg = fishSVG(s.id, { size: 96, title: s.name });
    assert.match(svg, /^<svg [^>]*viewBox="0 0 120 80"/);
    assert.ok(!/gradient/i.test(svg) && !EMOJI.test(svg) && !svg.includes("NaN"), s.id);
    assert.equal(fishSVG(s.id, { size: 96, title: s.name }).replace(/fa\d+/g, ""), svg.replace(/fa\d+/g, ""));
    const sil = fishSVG(s, { silhouette: true });
    assert.ok(sil.length < svg.length && !sil.includes("clip-path"), s.id);
    assert.ok(fishArt(s.id));
    sizes.add(svg.replace(/fa\d+/g, ""));
  }
  assert.equal(sizes.size, species.length);
  assert.match(fishSVG("mahi", { size: 48 }), /width="48" height="32"/);
  assert.throws(() => fishSVG("nope"));
});
