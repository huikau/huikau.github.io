// Every creature and curiosity Ula can meet. Names come only from plan section 4.5; art parameters
// are read by js/game/fishart.js. Entries carry no emoji: the compatibility shim at the bottom
// keeps the current game (fishing.js, basket.js) working until WP6b rewrites them.
//
// rarity: common | uncommon | rare | visitor (never caught) | junk | seasonal
// kind:   fish | creature | visitor | object | seasonal
// art.pal: [body, light, accent]

const SP = (id, name, hawaiian, english, line, mood, rarity, habitat, kind, art) =>
  ({ id, name, hawaiian, english, line, mood, rarity, habitat, kind, art });

// Body profiles are [fraction along body, half-height above centre line, half-height below].
const FUSI = [[0, 0, 0], [.08, 7, 7], [.25, 13, 13], [.5, 15, 14], [.75, 10, 9], [.92, 4.5, 4.5], [1, 3.5, 3.5]];

export const species = [
  // ---------- the thirteen legacy ids ----------
  SP("mahi", "Mahimahi", "mahimahi", "Dolphinfish", "A mahimahi! Ula said mahalo and let it go.", "yay", "common", "open ocean", "fish", {
    t: "fish", pal: ["#4DAA7A", "#F2D16B", "#1E6E78"],
    body: [[0, 3, 3], [.04, 12, 6], [.12, 17, 9], [.3, 16, 12], [.55, 12, 10], [.8, 7, 6], [.92, 4, 4], [1, 3.5, 3.5]],
    tail: { type: "forked", len: 22, spread: 15 },
    fins: { dorsal: [{ a: .1, b: .88, h: 9, peak: .15 }], anal: [{ a: .55, b: .88, h: 6, peak: .3 }], pelvic: { f: .3, len: 9 }, pectoral: { f: .3, len: 12 } },
    patterns: [{ type: "spots", n: 9, r: 1.8, y: [-10, 2], f: [.22, .85], c: "accent" }], eye: { f: .1, dy: -4, r: 3.3 }, belly: 6 }),
  SP("pineapple", "Pineapple", null, "Pineapple", "A pineapple. Nobody knows how.", "yay", "junk", "anywhere", "object", { t: "item", draw: "pineapple", pal: ["#F5A623", "#FFD36B", "#3E8F5A"] }),
  SP("slipper", "Slipper", null, "Slipper", "One slipper. Left foot. Again.", "meh", "junk", "anywhere", "object", { t: "item", draw: "slipper", pal: ["#1E6E78", "#F7EEDB", "#D8456B"] }),
  SP("hee", "Heʻe", "heʻe", "Octopus", "A heʻe. It stole the bait and waved goodbye.", "yay", "uncommon", "reef", "creature", { t: "item", draw: "octopus", pal: ["#C45A7A", "#F2B8C6", "#8F3556"] }),
  SP("coconut", "Coconut", null, "Coconut", "A coconut with a phone number on it.", "yay", "junk", "anywhere", "object", { t: "item", draw: "coconut", pal: ["#8B5E3C", "#C49C5E", "#4A2F1D"] }),
  SP("puffer", "Pufferfish", null, "Pufferfish", "A pufferfish that looked very offended.", "meh", "uncommon", "reef", "fish", {
    t: "fish", pal: ["#E9C86B", "#FBF1D2", "#8C6A2E"],
    body: [[0, 1, 1], [.05, 8, 8], [.2, 17, 16], [.5, 20, 18], [.78, 15, 13], [.93, 6, 6], [1, 3, 3]],
    tail: { type: "rounded", len: 14, spread: 8 },
    fins: { dorsal: [{ a: .62, b: .8, h: 6, peak: .5 }], anal: [{ a: .62, b: .8, h: 6, peak: .5 }], pectoral: { f: .28, len: 10, dy: 2 } },
    patterns: [{ type: "spots", n: 10, r: 2, y: [-14, 0], f: [.3, .85], c: "accent" }],
    eye: { f: .2, dy: -4, r: 4.2 }, belly: 7, extras: ["spikes", "brow"] }),
  SP("plumeria", "Plumeria", null, "Plumeria", "A plumeria. Ula tucked it behind her ear.", "yay", "junk", "anywhere", "object", { t: "item", draw: "plumeria", pal: ["#F7EEDB", "#F5A623", "#D8456B"] }),
  SP("boot", "Old boot", null, "Old boot", "An old boot. A classic.", "meh", "junk", "anywhere", "object", { t: "item", draw: "boot", pal: ["#7A5A3A", "#C49C5E", "#F7EEDB"] }),
  SP("shark", "Manō", "manō", "Shark", "A tiny shark, more scared than she was.", "yay", "rare", "open ocean", "fish", {
    t: "fish", pal: ["#6C8794", "#EEF2EE", "#455F6C"],
    body: [[0, 0, 0], [.05, 5, 5], [.2, 11, 11], [.45, 15, 14], [.72, 10, 8], [.92, 5, 4], [1, 3.5, 3]],
    tail: { type: "shark", len: 24, spread: 16 },
    fins: { dorsal: [{ a: .36, b: .58, h: 17, peak: .1 }, { a: .76, b: .84, h: 5, peak: .3 }], anal: [{ a: .78, b: .86, h: 5, peak: .3 }], pelvic: { f: .62, len: 7 }, pectoral: { f: .33, len: 20, dy: 6 } },
    patterns: [], eye: { f: .1, dy: -3, r: 2.4 }, belly: 7, extras: ["slits"], gill: false }),
  SP("honu", "Honu", "honu", "Green sea turtle", "Just a honu saying hi. Ula waved from a respectful distance.", "yay", "visitor", "reef", "visitor", { t: "item", draw: "honu", pal: ["#5E8F58", "#D8DDA8", "#2F5E45"] }),
  SP("wave", "Nice wave", null, "Wave", "Nothing but a nice wave. Still counts.", "meh", "junk", "shore", "object", { t: "item", draw: "wave", pal: ["#1E6E78", "#BFE5EE", "#164E56"] }),
  SP("cap", "Fat Boy cap", null, "Fishing club cap", "A Fat Boy Fishing Club cap. Ula already has one.", "yay", "junk", "anywhere", "object", { t: "item", draw: "cap", pal: ["#2DD4C8", "#F7EEDB", "#0A171B"] }),
  SP("golden", "Golden ulua", "ulua", "Golden giant trevally", "A golden ulua! Ula's never seen one this big.", "yay", "rare", "reef", "fish", {
    t: "fish", pal: ["#F5A623", "#FBE3A0", "#E8662A"],
    body: [[0, 2, 3], [.05, 10, 6], [.15, 17, 10], [.4, 18, 15], [.65, 13, 12], [.88, 5, 5], [1, 3, 3]],
    tail: { type: "forked", len: 22, spread: 17, notch: .4 },
    fins: { dorsal: [{ a: .16, b: .38, h: 6, peak: .3 }, { a: .46, b: .86, h: 11, peak: .1 }], anal: [{ a: .55, b: .86, h: 9, peak: .1 }], pelvic: { f: .3, len: 8 }, pectoral: { f: .3, len: 13 } },
    patterns: [{ type: "spots", n: 8, r: 1.4, y: [-12, 4], f: [.3, .8], c: "#FFF6D0" }],
    eye: { f: .13, dy: -4, r: 3.4 }, belly: 8, extras: ["sparkle"] }),

  // ---------- new catches ----------
  SP("ahi", "ʻAhi", "ʻahi", "Yellowfin tuna", "An ʻahi, yellow finlets flashing. Ula said mahalo and let it go.", "yay", "uncommon", "open ocean", "fish", {
    t: "fish", pal: ["#2F5D8C", "#E7EEF2", "#F5C12E"],
    body: [[0, 0, 0], [.07, 7, 7], [.25, 14, 14], [.5, 17, 16], [.75, 11, 10], [.9, 4.5, 4.5], [1, 3, 3]],
    tail: { type: "lunate", len: 22, spread: 17 },
    fins: { dorsal: [{ a: .35, b: .52, h: 9, peak: .2 }, { a: .6, b: .72, h: 8, peak: .2 }], anal: [{ a: .62, b: .74, h: 8, peak: .2 }], pelvic: { f: .3, len: 7 }, pectoral: { f: .28, len: 16 } },
    patterns: [{ type: "stripes", ys: [-1], th: 2.6, f: [.14, .9], c: "accent" }],
    eye: { f: .1, dy: -3, r: 3 }, belly: 7, extras: ["finlets"] }),
  SP("aku", "Aku", "aku", "Skipjack tuna", "An aku, zooming past in a hurry. Mahalo, little speedster!", "yay", "common", "open ocean", "fish", {
    t: "fish", pal: ["#2B4F7A", "#DDE6E8", "#6B7F9A"],
    body: [[0, 0, 0], [.07, 6, 6], [.25, 12, 12], [.5, 14, 13], [.75, 9, 8], [.9, 4, 4], [1, 3, 3]],
    tail: { type: "lunate", len: 20, spread: 15 },
    fins: { dorsal: [{ a: .32, b: .5, h: 7, peak: .2 }, { a: .62, b: .7, h: 5, peak: .3 }], anal: [{ a: .64, b: .72, h: 5, peak: .3 }], pelvic: { f: .3, len: 6 }, pectoral: { f: .27, len: 10 } },
    patterns: [{ type: "stripes", ys: [5, 8, 11], th: 1.8, f: [.2, .8], c: "#16304F" }],
    eye: { f: .1, dy: -3, r: 3 }, belly: 3 }),
  SP("ono", "Ono", "ono", "Wahoo", "An ono, long and fast. Ula blinked and it was gone.", "yay", "uncommon", "open ocean", "fish", {
    t: "fish", pal: ["#3D8FA8", "#E3EEF0", "#1B4A5A"], x0: 6, x1: 94,
    body: [[0, 0, 0], [.1, 3, 3], [.22, 6, 6], [.5, 9, 8], [.75, 7, 6], [.92, 3.5, 3.5], [1, 3, 3]],
    tail: { type: "forked", len: 20, spread: 11, notch: .6 },
    fins: { dorsal: [{ a: .25, b: .85, h: 4, peak: .15 }], anal: [{ a: .7, b: .86, h: 4, peak: .3 }], pelvic: { f: .3, len: 4 }, pectoral: { f: .25, len: 6 } },
    patterns: [{ type: "bars", n: 9, f: [.2, .88], w: 3.6, tilt: 1.5, c: "accent" }],
    eye: { f: .09, dy: -1.5, r: 2.4 }, belly: 4 }),
  SP("ulua", "Ulua", "ulua", "Giant trevally", "An ulua, strong as a truck. Ula held on tight, then let go.", "yay", "uncommon", "reef", "fish", {
    t: "fish", pal: ["#7F95A0", "#E4ECEE", "#3E5560"],
    body: [[0, 2, 3], [.05, 10, 6], [.15, 17, 10], [.4, 18, 15], [.65, 13, 12], [.88, 5, 5], [1, 3, 3]],
    tail: { type: "forked", len: 22, spread: 17, notch: .4 },
    fins: { dorsal: [{ a: .16, b: .38, h: 6, peak: .3 }, { a: .46, b: .86, h: 11, peak: .1 }], anal: [{ a: .55, b: .86, h: 9, peak: .1 }], pelvic: { f: .3, len: 8 }, pectoral: { f: .3, len: 13 } },
    patterns: [{ type: "spots", n: 8, r: 1.3, y: [-12, 4], f: [.3, .8], c: "#3E5560" }],
    eye: { f: .13, dy: -4, r: 3.4 }, belly: 8 }),
  SP("opakapaka", "ʻŌpakapaka", "ʻōpakapaka", "Pink snapper", "An ʻōpakapaka, pink as a sunset. What a beauty!", "yay", "uncommon", "deep", "fish", {
    t: "fish", pal: ["#E27A8E", "#F9DDE0", "#D8456B"],
    body: [[0, 1, 2], [.06, 8, 6], [.2, 14, 11], [.45, 16, 14], [.7, 11, 10], [.9, 5, 5], [1, 3.5, 3.5]],
    tail: { type: "forked", len: 21, spread: 15 },
    fins: { dorsal: [{ a: .18, b: .85, h: 8, peak: .6 }], anal: [{ a: .62, b: .85, h: 6, peak: .3 }], pelvic: { f: .32, len: 9 }, pectoral: { f: .3, len: 12 } },
    patterns: [{ type: "saddle", n: 4, f: [.25, .75], w: 12, depth: 5, c: "#E9A0AE" }],
    eye: { f: .12, dy: -3, r: 3.3 }, belly: 6 }),
  SP("uku", "Uku", "uku", "Gray jobfish", "An uku with a very serious face. Ula said hello anyway.", "yay", "uncommon", "deep", "fish", {
    t: "fish", pal: ["#7C9C8E", "#E2E8DC", "#4F6F66"], x0: 12, x1: 94,
    body: [[0, 1, 2], [.06, 7, 6], [.2, 11, 10], [.5, 13, 12], [.75, 10, 9], [.92, 5, 5], [1, 4, 4]],
    tail: { type: "forked", len: 20, spread: 14, notch: .6 },
    fins: { dorsal: [{ a: .2, b: .88, h: 7, peak: .7 }], anal: [{ a: .62, b: .88, h: 5, peak: .3 }], pelvic: { f: .3, len: 8 }, pectoral: { f: .28, len: 12 } },
    patterns: [{ type: "stripes", ys: [-3], th: 1.6, f: [.2, .88], c: "#5F8478" }],
    eye: { f: .1, dy: -3, r: 3.6 }, belly: 6 }),
  SP("moi", "Moi", "moi", "Pacific threadfin", "A moi, with whiskery fins. Ula thinks it looks like a king.", "yay", "uncommon", "shallows", "fish", {
    t: "fish", pal: ["#C9D6D6", "#F2F4EC", "#8AA0A5"],
    body: [[0, 1, 2], [.06, 8, 6], [.22, 13, 11], [.5, 14, 13], [.75, 10, 9], [.92, 4.5, 4.5], [1, 3.5, 3.5]],
    tail: { type: "forked", len: 20, spread: 14, notch: .5 },
    fins: { dorsal: [{ a: .3, b: .5, h: 6, peak: .3 }, { a: .58, b: .75, h: 6, peak: .3 }], anal: [{ a: .62, b: .8, h: 5, peak: .3 }], pelvic: { f: .32, len: 6 } },
    patterns: [{ type: "stripes", ys: [-2, 3], th: 1.2, f: [.2, .85], c: "#8AA0A5" }],
    eye: { f: .11, dy: -3, r: 3.4 }, belly: 6, extras: ["threads"] }),
  SP("amaama", "ʻAmaʻama", "ʻamaʻama", "Striped mullet", "An ʻamaʻama, leaping out of the shallows!", "yay", "common", "shallows", "fish", {
    t: "fish", pal: ["#8FAE9A", "#EEF1E4", "#4F6F66"], x0: 12, x1: 92,
    body: [[0, 2, 2], [.04, 6, 6], [.2, 10, 10], [.5, 12, 11], [.78, 9, 8], [.93, 5, 5], [1, 4, 4]],
    tail: { type: "truncate", len: 17, spread: 12 },
    fins: { dorsal: [{ a: .35, b: .5, h: 7, peak: .3 }, { a: .62, b: .75, h: 5, peak: .3 }], anal: [{ a: .64, b: .78, h: 5, peak: .3 }], pelvic: { f: .35, len: 5 }, pectoral: { f: .28, len: 8 } },
    patterns: [{ type: "stripes", ys: [-6, -2, 2], th: 1.5, f: [.15, .93], c: "accent" }],
    eye: { f: .08, dy: -1, r: 2.6 }, belly: 7 }),
  SP("humu", "Humuhumunukunukuāpuaʻa", "humuhumunukunukuāpuaʻa", "Reef triggerfish", "A humuhumunukunukuāpuaʻa! Ula tried to say it all in one breath.", "yay", "rare", "reef", "fish", {
    t: "fish", pal: ["#E8D08A", "#BFE5EE", "#4A3B2A"],
    body: [[0, 0, 0], [.07, 6, 5], [.22, 17, 14], [.45, 21, 19], [.72, 17, 15], [.92, 6, 6], [1, 4, 4]],
    tail: { type: "truncate", len: 15, spread: 10 },
    fins: { dorsal: [{ a: .22, b: .3, h: 10, peak: .2 }, { a: .5, b: .86, h: 8, peak: .5 }], anal: [{ a: .5, b: .86, h: 7, peak: .5 }], pectoral: { f: .3, len: 9 } },
    tailFill: "light",
    patterns: [
      { type: "poly", c: "accent", pts: [[.42, -30], [1, -30], [1, 30], [.55, 30], [.45, 8]] },
      { type: "poly", c: "light", pts: [[.52, -30], [.6, -30], [.5, 30], [.42, 30]] },
      { type: "poly", c: "light", pts: [[.68, -30], [.76, -30], [.66, 30], [.58, 30]] },
      { type: "poly", c: "accent", pts: [[.08, -3], [.3, -9], [.3, -5], [.08, 1]] }],
    eye: { f: .16, dy: -6, r: 3.2 }, belly: null }),
  SP("uhu", "Uhu", "uhu", "Parrotfish", "An uhu, crunching on coral with a big parrot smile.", "yay", "uncommon", "reef", "fish", {
    t: "fish", pal: ["#2FA8A0", "#8ADBCB", "#D8456B"],
    body: [[0, 2, 3], [.05, 10, 8], [.18, 16, 13], [.45, 17, 15], [.72, 13, 11], [.92, 6, 6], [1, 4, 4]],
    tail: { type: "truncate", len: 16, spread: 12, notch: .85 },
    fins: { dorsal: [{ a: .18, b: .86, h: 8, peak: .5 }], anal: [{ a: .5, b: .86, h: 7, peak: .5 }], pelvic: { f: .32, len: 8 }, pectoral: { f: .3, len: 11 } },
    patterns: [{ type: "stripes", ys: [2], th: 2.2, f: [.3, .92], c: "accent" }],
    eye: { f: .15, dy: -4, r: 3.2 }, belly: 8, extras: ["beak", "cheek"] }),
  SP("manini", "Manini", "manini", "Convict tang", "A manini in its stripy pajamas. Ula waved hello.", "yay", "common", "reef", "fish", {
    t: "fish", pal: ["#D9E4C6", "#F4F8EA", "#F5C12E"], x0: 22, x1: 90,
    body: [[0, 1, 1], [.07, 7, 7], [.22, 15, 14], [.5, 19, 17], [.78, 14, 13], [.94, 5, 5], [1, 3.5, 3.5]],
    tail: { type: "truncate", len: 15, spread: 10 },
    fins: { dorsal: [{ a: .2, b: .85, h: 6, peak: .5 }], anal: [{ a: .3, b: .85, h: 5, peak: .5 }], pectoral: { f: .3, len: 9 } },
    patterns: [{ type: "bars", n: 6, f: [.18, .88], w: 3.4, tilt: 0, c: "#16303A" }],
    eye: { f: .09, dy: -3, r: 2.8 }, belly: null }),
  SP("kala", "Kala", "kala", "Unicornfish", "A kala with its very own horn. Ula thinks it's magic.", "yay", "uncommon", "reef", "fish", {
    t: "fish", pal: ["#9AA38B", "#E6E4C8", "#3E7C8A"], x0: 20, x1: 88,
    body: [[0, 2, 2], [.06, 9, 7], [.2, 15, 13], [.5, 18, 16], [.78, 13, 12], [.94, 5, 5], [1, 4, 4]],
    tail: { type: "forked", len: 20, spread: 14, notch: .85 },
    fins: { dorsal: [{ a: .3, b: .86, h: 9, peak: .6 }], anal: [{ a: .5, b: .86, h: 7, peak: .5 }], pectoral: { f: .3, len: 10 } },
    patterns: [{ type: "stripes", ys: [-5], th: 1.6, f: [.3, .92], c: "accent" }],
    eye: { f: .12, dy: -4, r: 3.1 }, belly: 6, extras: ["horn"] }),
  SP("weke", "Weke", "weke", "Goatfish", "A weke, feeling around the sand with its whiskers.", "yay", "common", "sandflat", "fish", {
    t: "fish", pal: ["#E9867A", "#FBE8D8", "#F5C12E"], x0: 14, x1: 92,
    body: [[0, 1, 2], [.06, 7, 6], [.22, 11, 10], [.5, 13, 12], [.76, 10, 9], [.92, 5, 5], [1, 3.5, 3.5]],
    tail: { type: "forked", len: 20, spread: 13, notch: .55 },
    fins: { dorsal: [{ a: .26, b: .42, h: 8, peak: .4 }, { a: .55, b: .72, h: 6, peak: .3 }], anal: [{ a: .62, b: .8, h: 5, peak: .3 }], pelvic: { f: .3, len: 6 }, pectoral: { f: .26, len: 8 } },
    patterns: [{ type: "stripes", ys: [-1], th: 3.4, f: [.14, .92], c: "accent" }],
    eye: { f: .1, dy: -3, r: 3 }, belly: 5, extras: ["barbels"] }),
  SP("oio", "ʻŌʻio", "ʻōʻio", "Bonefish", "An ʻōʻio, silver and sneaky, gliding over the flats.", "yay", "uncommon", "sandflat", "fish", {
    t: "fish", pal: ["#B9C7CC", "#F2F5F2", "#5E7A86"], x0: 10, x1: 92,
    body: [[0, 1, 2], [.05, 3, 3], [.12, 6, 6], [.3, 10, 9], [.55, 11, 10], [.8, 8, 7], [.93, 4.5, 4.5], [1, 3.5, 3.5]],
    tail: { type: "forked", len: 20, spread: 14, notch: .45 },
    fins: { dorsal: [{ a: .4, b: .58, h: 8, peak: .3 }], anal: [{ a: .7, b: .8, h: 4, peak: .3 }], pelvic: { f: .46, len: 6 }, pectoral: { f: .26, len: 8 } },
    patterns: [{ type: "saddle", n: 6, f: [.2, .85], w: 12, depth: 4, c: "accent" }],
    eye: { f: .12, dy: -2, r: 3.4 }, belly: 5 }),
  SP("ula", "Ula", "ula", "Spiny lobster", "A spiny lobster, waving both feelers. Ula waved back.", "yay", "rare", "reef", "creature", { t: "item", draw: "lobster", pal: ["#D9552B", "#F0C08A", "#7C3A28"] }),

  // ---------- seasonal (WP9) ----------
  SP("skeleton", "Skeleton fish", null, "Skeleton fish", "A skeleton fish. Spooky, but polite.", "meh", "seasonal", "anywhere", "seasonal", { t: "item", draw: "skeleton", pal: ["#F7EEDB", "#BFE5EE", "#0B2226"] }),
  SP("pumpkin", "Jack-o'-lantern", null, "Jack-o'-lantern", "A jack-o'-lantern, still glowing. Happy Halloween!", "yay", "seasonal", "anywhere", "seasonal", { t: "item", draw: "pumpkin", pal: ["#E8662A", "#F5A623", "#3E8F5A"] }),
  SP("gift", "Present", null, "Present", "A present wrapped in seaweed. Mele Kalikimaka!", "yay", "seasonal", "anywhere", "seasonal", { t: "item", draw: "gift", pal: ["#D8456B", "#F5A623", "#3E8F5A"] }),
  SP("popper", "Party popper", null, "Party popper", "A party popper. Hauʻoli Makahiki Hou!", "yay", "seasonal", "anywhere", "seasonal", { t: "item", draw: "popper", pal: ["#F5A623", "#BFE5EE", "#D8456B"] })
];

export const speciesById = Object.fromEntries(species.map((s) => [s.id, s]));

// ---------------------------------------------------------------------------------------------
// Compatibility shim for the current game code (removed when WP6b lands): the old { id, e, t, mood }
// shape, in the old order, derived from `species`. Emoji live only here.
// ---------------------------------------------------------------------------------------------
const LEGACY_EMOJI = {
  mahi: "🐟", pineapple: "🍍", slipper: "🩴", hee: "🐙", coconut: "🥥", puffer: "🐡", plumeria: "🌺",
  boot: "🥾", shark: "🦈", honu: "🐢", wave: "🌊", cap: "🧢", golden: "🐟",
  skeleton: "💀", pumpkin: "🎃", gift: "🎁", popper: "🎉"
};
const legacy = (id, extra) => {
  const s = speciesById[id];
  return { id, e: LEGACY_EMOJI[id], t: s.line, mood: s.mood, ...extra };
};
const noId = ({ id, ...rest }) => rest; // seasonal finds were never saved to the basket

export const catches = ["mahi", "pineapple", "slipper", "hee", "coconut", "puffer", "plumeria", "boot", "shark", "honu", "wave", "cap"].map((id) => legacy(id));
export const golden = legacy("golden", { rare: true });
export const seasonal = {
  halloween: [noId(legacy("skeleton")), noId(legacy("pumpkin"))],
  winter: [noId(legacy("gift"))],
  newyear: [noId(legacy("popper"))],
  none: []
};
