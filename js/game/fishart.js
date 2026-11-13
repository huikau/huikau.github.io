// Island-screenprint art for every species: one parametric fish generator plus a small set of
// hand-drawn items, all built from the same layer list so they share a keyline, flat 3-tone fills
// and one light direction (light from upper left, belly and underside in the light tone).
// fishSVG(speciesOrId, { size, silhouette, title, color, opacity }) -> SVG string (viewBox 120x80).
import { speciesById } from "../data/species.js";

const INK = "#0B2226", SAND = "#F7EEDB", SW = 2.2;
const f1 = (n) => Math.round(n * 10) / 10;
const pt = (p) => `${f1(p[0])} ${f1(p[1])}`;

// ---- path helpers -------------------------------------------------------------------------
function bez(pts, closed) {
  const n = pts.length, at = (i) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  let d = "";
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    d += `C${pt([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${pt([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${pt(p2)}`;
  }
  return d;
}
const blob = (pts) => `M${pt(pts[0])}${bez(pts, true)}Z`;
const curve = (pts) => `M${pt(pts[0])}${bez(pts, false)}`;
const poly = (pts) => `M${pts.map(pt).join("L")}Z`;
const lines = (pts) => `M${pts.map(pt).join("L")}`;
function ell(cx, cy, rx, ry, rot = 0) {
  const a = rot * Math.PI / 180, dx = Math.cos(a) * rx, dy = Math.sin(a) * rx;
  return `M${pt([cx - dx, cy - dy])}A${f1(rx)} ${f1(ry)} ${rot} 1 0 ${pt([cx + dx, cy + dy])}A${f1(rx)} ${f1(ry)} ${rot} 1 0 ${pt([cx - dx, cy - dy])}Z`;
}
const rotAbout = (c, a, p) => {
  const r = a * Math.PI / 180, x = p[0] - c[0], y = p[1] - c[1];
  return [c[0] + x * Math.cos(r) - y * Math.sin(r), c[1] + x * Math.sin(r) + y * Math.cos(r)];
};
const star = (cx, cy, r) => poly([[cx, cy - r], [cx + r * .22, cy - r * .22], [cx + r, cy], [cx + r * .22, cy + r * .22], [cx, cy + r], [cx - r * .22, cy + r * .22], [cx - r, cy], [cx - r * .22, cy - r * .22]]);

// layer: { d, f: role | "none", s: stroke role | "none", w: stroke width, detail, clip, cap }
// roles: body light accent ink white (or any #hex)
const F = (d, f, o) => ({ d, f, ...o });
const S = (d, w, s = "ink", o) => ({ d, f: "none", s, w, ...o });
const bold = (d, w = 8, inner = "body", o) => [S(d, w, "ink"), S(d, w - 3.8, inner, { detail: true, ...o })]; // keylined thick stroke

// deterministic scatter so the same species always draws the same
function rng(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)), ((h >>> 0) % 10000) / 10000);
}

// ---- the fish generator -------------------------------------------------------------------
function fishLayers(a, id) {
  const cy = 40, x0 = a.x0 ?? 16, x1 = a.x1 ?? 92, L = x1 - x0, st = a.body;
  const X = (f) => x0 + f * L;
  const interp = (f, k) => {
    for (let i = 1; i < st.length; i++) if (f <= st[i][0]) {
      const t = (f - st[i - 1][0]) / (st[i][0] - st[i - 1][0] || 1);
      return st[i - 1][k] + (st[i][k] - st[i - 1][k]) * t;
    }
    return st[st.length - 1][k];
  };
  const topY = (f) => cy - interp(f, 1), botY = (f) => cy + interp(f, 2);
  const last = st[st.length - 1], yt = cy - last[1], yb = cy + last[2];
  const top = st.map((s) => [X(s[0]), cy - s[1]]), bot = st.map((s) => [X(s[0]), cy + s[2]]).reverse();
  const bodyD = `M${pt(top[0])}${bez(top, false)}L${pt(bot[0])}${bez(bot, false)}Z`;
  const rnd = rng(id);
  const under = [], over = [];
  const finFill = a.finFill ?? "accent";

  // tail
  const T = a.tail || { type: "forked", len: 20, spread: 14 };
  if (T.type !== "none") {
    const xe = x1 - 1, tl = T.len, ts = T.spread, nx = xe + tl;
    let d;
    if (T.type === "forked" || T.type === "lunate") {
      const sw = T.type === "lunate" ? .15 : .5, nt = T.notch ?? (T.type === "lunate" ? .3 : .55);
      d = `M${pt([xe, yt])}Q${pt([xe + tl * sw, cy - ts * .8])} ${pt([nx, cy - ts])}Q${pt([xe + tl * nt, cy])} ${pt([nx, cy + ts])}Q${pt([xe + tl * sw, cy + ts * .8])} ${pt([xe, yb])}Z`;
    } else if (T.type === "truncate") {
      d = `M${pt([xe, yt])}Q${pt([xe + tl * .6, cy - ts * .9])} ${pt([nx, cy - ts])}Q${pt([nx - T.len * .1, cy])} ${pt([nx, cy + ts])}Q${pt([xe + tl * .6, cy + ts * .9])} ${pt([xe, yb])}Z`;
    } else if (T.type === "rounded") {
      d = `M${pt([xe, yt])}C${pt([xe + tl * .5, cy - ts * 1.3])} ${pt([nx + 2, cy - ts * .8])} ${pt([nx, cy])}C${pt([nx + 2, cy + ts * .8])} ${pt([xe + tl * .5, cy + ts * 1.3])} ${pt([xe, yb])}Z`;
    } else { // shark: long upper lobe, short lower lobe
      d = `M${pt([xe, yt])}Q${pt([xe + tl * .3, cy - ts * 1.1])} ${pt([nx + 2, cy - ts * 1.5])}Q${pt([xe + tl * .55, cy - ts * .3])} ${pt([xe + tl * .7, cy + ts * .1])}Q${pt([xe + tl * .95, cy + ts * .6])} ${pt([nx - 4, cy + ts * .75])}Q${pt([xe + tl * .3, cy + ts * .5])} ${pt([xe, yb])}Z`;
    }
    under.push(F(d, a.tailFill ?? finFill));
  }

  // fins (dorsal and anal ride the body edge; drawn behind the body so only the outer part shows)
  const sail = (A, edge, dir) => {
    const xa = X(A.a), xb = X(A.b), px = xa + (xb - xa) * (A.peak ?? .4);
    const ya = edge(A.a) + dir * 2, yb2 = edge(A.b) + dir * 2, py = edge(A.peak != null ? A.a + (A.b - A.a) * A.peak : (A.a + A.b) / 2) + dir * A.h;
    return `M${pt([xa, ya])}C${pt([xa + (px - xa) * .5, ya + dir * A.h * .6])} ${pt([px - 2, py - dir * 2])} ${pt([px, py])}Q${pt([px + (xb - px) * .35, py - dir * A.h * .65])} ${pt([xb, yb2])}Z`;
  };
  const fins = a.fins || {};
  for (const A of fins.dorsal || []) under.push(F(sail(A, (f) => topY(f), -1), finFill));
  for (const A of fins.anal || []) under.push(F(sail(A, (f) => botY(f), 1), finFill));
  if (fins.pelvic) {
    const p = fins.pelvic, x = X(p.f), y = botY(p.f);
    under.push(F(poly([[x - 2, y - 2], [x + 3, y - 2], [x - p.len * .1 + 2, y + p.len]]), finFill));
  }

  // pattern layers clipped to the body
  const pat = [];
  const R = a.pal;
  for (const P of a.patterns || []) {
    const c = P.c || "accent";
    if (P.type === "bars") {
      for (let i = 0; i < P.n; i++) {
        const xc = X(P.f[0] + (P.f[1] - P.f[0]) * (P.n === 1 ? .5 : i / (P.n - 1))), w = P.w / 2, t = P.tilt || 0;
        pat.push(F(poly([[xc - w + t, 0], [xc + w + t, 0], [xc + w - t, 90], [xc - w - t, 90]]), c, { clip: 1, w: 0 }));
      }
    } else if (P.type === "stripes") {
      for (const dy of P.ys) pat.push(F(`M${pt([X(P.f[0]), cy + dy - P.th / 2])}Q${pt([X((P.f[0] + P.f[1]) / 2), cy + dy - P.th / 2 - 1.2])} ${pt([X(P.f[1]), cy + dy - P.th / 2])}L${pt([X(P.f[1]), cy + dy + P.th / 2])}Q${pt([X((P.f[0] + P.f[1]) / 2), cy + dy + P.th / 2 - 1.2])} ${pt([X(P.f[0]), cy + dy + P.th / 2])}Z`, c, { clip: 1, w: 0 }));
    } else if (P.type === "spots") {
      for (let i = 0; i < P.n; i++) pat.push(F(ell(X(P.f[0] + rnd() * (P.f[1] - P.f[0])), cy + P.y[0] + rnd() * (P.y[1] - P.y[0]), P.r, P.r), c, { clip: 1, w: 0 }));
    } else if (P.type === "saddle") {
      for (let i = 0; i < P.n; i++) {
        const f = P.f[0] + (P.f[1] - P.f[0]) * (P.n === 1 ? .5 : i / (P.n - 1));
        pat.push(F(ell(X(f), topY(f), P.w / 2, P.depth), c, { clip: 1, w: 0 }));
      }
    } else if (P.type === "poly") {
      pat.push(F(poly(P.pts.map((p) => [X(p[0]), cy + p[1]])), c, { clip: 1, w: 0 }));
    }
  }

  // extras
  const ctx = { X, topY, botY, cy, x0, x1, R };
  for (const name of a.extras || []) {
    const e = EXTRAS[name](ctx, a);
    under.push(...(e.under || []));
    over.push(...(e.over || []));
  }
  // pectoral fin and gill (over the body, light from upper left)
  const front = [];
  if (a.gill !== false) {
    const g = (a.eye?.f ?? .1) + .1, gx = X(g);
    front.push(S(`M${pt([gx, topY(g) + 3])}Q${pt([gx + 4, cy])} ${pt([gx, botY(g) - 3])}`, 1.6, "ink", { detail: true }));
  }
  if (fins.pectoral) {
    const p = fins.pectoral, x = X(p.f), y = cy + (p.dy ?? 3), l = p.len;
    front.push(F(`M${pt([x, y])}Q${pt([x + l * .5, y - l * .25])} ${pt([x + l, y + l * .2])}Q${pt([x + l * .45, y + l * .38])} ${pt([x - 1, y + 3])}Z`, finFill, { detail: true }));
  }
  const E = a.eye || { f: .1, dy: -3, r: 3.2 }, ex = X(E.f), ey = cy + E.dy;
  const eye = [F(ell(ex, ey, E.r, E.r), "white", { w: 1.4, detail: true }), F(ell(ex + .4, ey, E.r * .5, E.r * .5), "ink", { w: 0, detail: true })];

  const layers = [...under, F(bodyD, "body", { body: 1 })];
  if (a.belly != null) layers.push(F(`M0 ${cy + a.belly}Q60 ${cy + a.belly - 4} 120 ${cy + a.belly}L120 90L0 90Z`, "light", { clip: 1, w: 0 }));
  layers.push(...pat, S(bodyD, SW, "ink", { silKeep: 0 }), ...over, ...front, ...eye);
  return layers;
}

const EXTRAS = {
  horn: ({ X, topY }) => ({ under: [F(poly([[X(.07), topY(.07) + 4], [X(.16), topY(.16) + 3], [X(-.02), topY(.1) - 19]]), "light")] }),
  beak: ({ X, cy }) => ({ over: [F(`M${pt([X(.01), cy - 1])}Q${pt([X(-.06), cy - 1])} ${pt([X(-.06), cy + 5])}Q${pt([X(-.02), cy + 9])} ${pt([X(.07), cy + 8])}L${pt([X(.07), cy - 1])}Z`, "white"), S(lines([[X(-.05), cy + 3], [X(.04), cy + 3.5]]), 1.2, "ink", { detail: true })] }),
  cheek: ({ X, cy }) => ({ over: [F(ell(X(.2), cy + 4, 6, 4, 20), "accent", { w: 0, detail: true })] }),
  finlets: ({ X, topY, botY }) => {
    const out = [];
    for (let i = 0; i < 5; i++) {
      const f = .76 + i * .045;
      out.push(F(poly([[X(f), topY(f) + 2], [X(f + .05), topY(f + .05) + 2], [X(f + .015), topY(f) - 5]]), "accent"));
      out.push(F(poly([[X(f), botY(f) - 2], [X(f + .05), botY(f + .05) - 2], [X(f + .015), botY(f) + 5]]), "accent"));
    }
    return { under: out };
  },
  barbels: ({ X, botY }) => ({ over: [S(curve([[X(.03), botY(.03) - 1], [X(.0), botY(.03) + 5], [X(.03), botY(.03) + 9]]), 1.6, "ink", { detail: true }), S(curve([[X(.06), botY(.06) - 1], [X(.05), botY(.06) + 6], [X(.09), botY(.06) + 9]]), 1.6, "ink", { detail: true })] }),
  threads: ({ X, cy }) => ({ over: [0, 1, 2, 3, 4].map((i) => S(curve([[X(.3), cy + 4], [X(.3) + 2 + i * 1.5, cy + 12 + i * 2], [X(.3) - 6 + i * 3, cy + 22 + i * 1.5]]), 1.3, "ink", { detail: true })) }),
  spikes: ({ X, topY, botY }) => {
    const out = [];
    for (let i = 0; i < 6; i++) {
      const f = .2 + i * .1;
      out.push(F(poly([[X(f) - 2.5, topY(f) + 2], [X(f) + 2.5, topY(f) + 2], [X(f), topY(f) - 3.5]]), "accent", { w: 1.4 }));
      out.push(F(poly([[X(f) - 2.5, botY(f) - 2], [X(f) + 2.5, botY(f) - 2], [X(f), botY(f) + 3.5]]), "accent", { w: 1.4 }));
    }
    return { under: out };
  },
  brow: ({ X, cy }) => ({ over: [S(lines([[X(.2) - 5, cy - 11], [X(.2) + 4, cy - 7.5]]), 2, "ink", { detail: true })] }),
  slits: ({ X, cy }) => ({ over: [0, 1, 2].map((i) => S(lines([[X(.2) + i * 2.6, cy - 5], [X(.2) + i * 2.6 - 1, cy + 3]]), 1.3, "ink", { detail: true })) }),
  sparkle: () => ({ over: [F(star(106, 14, 7), "white", { w: 1.2, detail: true }), F(star(14, 66, 5), "white", { w: 1.2, detail: true }), F(star(100, 66, 3.5), "white", { w: 1, detail: true })] })
};

// ---- hand-drawn items ----------------------------------------------------------------------
const ITEMS = {
  octopus() {
    const t = [
      [[42, 32], [28, 34], [18, 38], [14, 31]], [[46, 36], [36, 48], [26, 54], [20, 50]],
      [[52, 38], [46, 54], [40, 66], [30, 66]], [[60, 39], [58, 54], [60, 66], [68, 70]],
      [[68, 38], [76, 52], [84, 62], [94, 60]], [[74, 35], [88, 44], [98, 52], [104, 46]], [[78, 30], [92, 32], [104, 34], [108, 27]]
    ].map(curve);
    return [...t.map((d) => S(d, 8.5, "ink", { cap: 1 })), ...t.map((d) => S(d, 4.6, "body", { cap: 1, detail: true })),
      F(blob([[38, 30], [38, 17], [48, 7], [60, 5], [72, 7], [82, 17], [82, 30], [74, 38], [46, 38]]), "body"),
      F(ell(51, 14, 6, 3.5, -35), "light", { w: 0, detail: true }),
      ...[[56, 14], [66, 11], [72, 20], [62, 22]].map((p) => F(ell(p[0], p[1], 1.8, 1.8), "accent", { w: 0, detail: true })),
      F(ell(51, 29, 6.5, 6.5), "white", { w: 1.6, detail: true }), F(ell(69, 29, 6.5, 6.5), "white", { w: 1.6, detail: true }),
      F(ell(52, 30, 3.2, 3.2), "ink", { w: 0, detail: true }), F(ell(70, 30, 3.2, 3.2), "ink", { w: 0, detail: true })];
  },
  lobster() {
    const ant = [curve([[36, 34], [24, 22], [12, 16], [4, 20]]), curve([[34, 41], [20, 38], [10, 40], [3, 35]])];
    const legs = [[46, 50, 42, 62], [52, 52, 50, 64], [58, 52, 58, 64], [64, 50, 66, 62]].map((l) => lines([[l[0], l[1]], [l[2], l[3]]]));
    const seg = [[74, 40, 9, 11], [83, 40, 8, 10], [91, 40, 7, 9]];
    return [...ant.map((d) => S(d, 7, "ink", { cap: 1 })), ...ant.map((d) => S(d, 3.4, "body", { cap: 1, detail: true })),
      ...legs.map((d) => S(d, 6, "ink", { cap: 1 })), ...legs.map((d) => S(d, 2.4, "accent", { cap: 1, detail: true })),
      F(poly([[96, 40], [112, 28], [110, 40], [112, 52]]), "accent"), F(poly([[96, 40], [108, 20], [102, 40]]), "body"), F(poly([[96, 40], [108, 60], [102, 40]]), "body"),
      ...seg.map((s) => F(ell(s[0], s[1], s[2], s[3]), "body")),
      ...seg.map((s) => F(ell(s[0] + 1.5, s[1] - 2, s[2] * .45, s[3] * .55), "light", { w: 0, detail: true })),
      F(blob([[28, 42], [32, 32], [44, 26], [60, 27], [70, 33], [72, 44], [66, 52], [48, 54], [34, 50]]), "body"),
      S(curve([[40, 30], [46, 40], [44, 50]]), 1.6, "ink", { detail: true }),
      F(ell(52, 33, 9, 3.5, -10), "light", { w: 0, detail: true }),
      ...[[34, 36], [38, 31]].map((p) => [S(lines([p, [p[0] - 5, p[1] - 5]]), 2, "ink"), F(ell(p[0] - 5, p[1] - 5, 2.8, 2.8), "white", { w: 1.4 }), F(ell(p[0] - 5.2, p[1] - 5, 1.3, 1.3), "ink", { w: 0 })]).flat()];
  },
  honu() {
    const shell = "M24 48C24 30 42 17 60 17C80 17 94 32 94 48Z";
    return [F(blob([[88, 48], [100, 56], [104, 64], [97, 64], [88, 56]]), "light"),
      F(blob([[22, 46], [16, 50], [10, 52], [18, 55], [26, 52]]), "light"),
      F(blob([[86, 36], [92, 30], [104, 28], [108, 34], [102, 40], [92, 42]]), "light"),
      F(blob([[48, 52], [60, 50], [78, 52], [92, 66], [100, 74], [86, 72], [70, 60], [52, 58]]), "light"),
      F(shell, "body"),
      S("M60 17C60 30 60 40 60 48M43 21C45 32 46 40 46 48M78 22C76 32 75 40 75 48M26 36C44 36 78 36 92 36", 1.7, "accent", { detail: true }),
      F(`M24 48L94 48L94 52C94 55 90 56 86 56L32 56C27 56 24 55 24 52Z`, "light"),
      F(ell(101, 37, 8, 6.5, 10), "light"), F(ell(103, 35, 2.6, 2.6), "white", { w: 1.2, detail: true }), F(ell(103.6, 35, 1.2, 1.2), "ink", { w: 0, detail: true }),
      S(lines([[106, 41], [109, 40]]), 1.4, "ink", { detail: true })];
  },
  pineapple() {
    const body = ell(60, 52, 21, 25);
    return [F(poly([[60, 30], [38, 10], [48, 22], [42, 4], [54, 20], [60, 2], [66, 20], [78, 4], [72, 22], [82, 10]]), "accent"),
      F(body, "body"),
      F(`M40 38C40 50 44 62 50 70L50 74C42 66 38 54 38 46Z`, "light", { w: 0, detail: true }),
      S("M44 38L76 66M52 30L80 56M40 52L66 76M76 36L46 66M68 30L40 58M80 50L58 74", 1.6, "accent", { detail: true, clip: 1 })];
  },
  slipper() {
    const sole = blob([[28, 70], [24, 54], [30, 36], [42, 20], [58, 14], [74, 18], [82, 32], [82, 50], [74, 66], [56, 74], [38, 76]]);
    return [F(sole, "body"), F(ell(40, 44, 4, 10, 25), "light", { w: 0, detail: true }),
      ...bold("M58 56L42 26M58 56L72 28", 8, "accent"), F(ell(58, 56, 4.5, 4.5), "accent", { detail: true })];
  },
  coconut() {
    return [F(ell(60, 42, 30, 32), "body"), F(`M34 30C40 18 52 12 64 13C54 22 44 30 38 44Z`, "light", { w: 0, detail: true }),
      S("M32 56C44 66 70 68 88 52M30 44C40 54 74 56 90 40", 1.5, "accent", { detail: true, clip: 1 }),
      F(ell(52, 30, 3.5, 3.5), "ink", { w: 0, detail: true }), F(ell(66, 28, 3.5, 3.5), "ink", { w: 0, detail: true }), F(ell(60, 40, 3.5, 3.5), "ink", { w: 0, detail: true }),
      F(poly([[64, 48], [92, 44], [96, 62], [68, 66]]), "white", { w: 1.8 }),
      S(lines([[70, 53], [90, 51]]) + lines([[71, 59], [86, 57]]), 1.6, "accent", { detail: true })];
  },
  plumeria() {
    const petals = [];
    for (let i = 0; i < 5; i++) {
      const a = -90 + i * 72, c = [60, 40];
      petals.push(F(blob([[60, 40], [51, 24], [53, 10], [62, 8], [70, 16], [70, 28]].map((p) => rotAbout(c, a + 90, p))), "body"));
    }
    return [...petals, ...[0, 1, 2, 3, 4].map((i) => S(curve([[60, 40], rotAbout([60, 40], i * 72, [57, 26]), rotAbout([60, 40], i * 72, [58, 16])]), 1.8, "accent", { detail: true })),
      F(ell(60, 40, 7, 7), "light")];
  },
  boot() {
    return [F("M40 8L66 8L68 40C70 48 82 50 98 56C108 60 108 72 100 74L36 74Z", "body"),
      F("M36 66L100 66L100 74L36 74Z", "light"), F("M40 8L66 8L66 16L40 16Z", "accent", { detail: true }),
      S("M44 28L64 28M44 36L64 36M44 44L64 44", 2.4, "white", { detail: true }),
      F(poly([[64, 12], [76, 10], [72, 20]]), "light", { w: 0, detail: true }), S("M80 58L84 66", 1.6, "ink", { detail: true })];
  },
  wave() {
    return [F("M10 70C14 44 36 18 66 16C88 14 102 28 100 44C98 36 90 30 80 32C88 38 86 52 74 56C82 56 90 60 94 70Z", "body"),
      F("M30 70C32 54 44 38 62 34C76 32 88 38 90 48C80 42 70 44 66 52C62 60 70 66 76 70Z", "accent", { w: 0, detail: true, clip: 1 }),
      F("M66 16C88 14 102 28 100 44C98 36 90 30 80 32C84 24 76 18 66 16Z", "light", { w: 0, detail: true }),
      S("M10 70L110 70", 2.2, "ink"),
      ...[[24, 44], [30, 54], [46, 28]].map((p) => F(ell(p[0], p[1], 2.4, 2.4), "light", { w: 0, detail: true }))];
  },
  cap() {
    return [F("M26 52C26 24 44 12 62 12C82 12 94 28 94 52Z", "body"),
      F("M30 46C30 36 34 28 40 22C38 32 38 40 40 46Z", "light", { w: 0, detail: true }),
      F("M90 48C100 46 112 52 114 58C100 56 92 58 82 58Z", "accent"),
      S("M62 12L62 50", 1.6, "ink", { detail: true }), F(ell(62, 11, 3.2, 3.2), "accent"),
      F("M60 24C52 24 50 34 54 38L54 42L68 42L68 38C72 34 70 24 62 24Z", "light", { w: 1.5, detail: true }),
      F(ell(57, 32, 2.3, 2.6), "ink", { w: 0, detail: true }), F(ell(65, 32, 2.3, 2.6), "ink", { w: 0, detail: true }),
      S("M50 48L74 38M74 48L50 38", 2.4, "white", { detail: true })];
  },
  skeleton() {
    const ribs = [0, 1, 2, 3, 4].flatMap((i) => bold(curve([[38 + i * 10, 40], [36 + i * 10, 28 - i], [40 + i * 10, 20 - i]]), 6, "white").concat(bold(curve([[38 + i * 10, 40], [36 + i * 10, 52 + i], [40 + i * 10, 60 + i]]), 6, "white")));
    return [F(poly([[92, 40], [112, 22], [108, 40], [112, 58]]), "light"), ...bold("M26 40L96 40", 8, "white"), ...ribs,
      F("M6 40C6 28 16 20 28 20C34 20 40 30 40 40C40 50 34 60 28 60C16 60 6 52 6 40Z", "white"),
      F("M6 40L20 46L20 54L12 54C8 50 6 46 6 40Z", "light", { w: 0, detail: true }), S("M12 52L12 56M16 52L16 56", 1.4, "ink", { detail: true }),
      F(ell(26, 34, 5.5, 5.5), "ink", { w: 0 }), F(ell(27, 33.5, 1.6, 1.6), "white", { w: 0, detail: true })];
  },
  pumpkin() {
    return [F("M58 20C60 12 66 8 72 8L68 20Z", "accent"),
      F(ell(36, 48, 22, 26), "body"), F(ell(84, 48, 22, 26), "body"), F(ell(60, 48, 26, 29), "body"),
      S("M60 19C54 36 54 60 60 77M42 26C32 38 32 58 42 72M78 26C88 38 88 58 78 72", 1.6, "#C24F1C", { detail: true }),
      F(ell(46, 36, 6, 9, 30), "light", { w: 0, detail: true }),
      F(poly([[44, 40], [54, 48], [38, 48]]), "ink", { w: 1.5 }), F(poly([[76, 40], [82, 48], [68, 48]]), "ink", { w: 1.5 }),
      F("M42 58L50 62L55 56L60 64L66 56L71 62L78 58C74 70 64 72 60 72C56 72 46 70 42 58Z", "ink", { w: 1.5 }),
      F("M52 62L56 60L60 66L64 60L68 62C65 67 55 67 52 62Z", "light", { w: 0, detail: true })];
  },
  gift() {
    return [F("M22 36L98 36L98 74L22 74Z", "body"), F("M22 36L98 36L98 46L22 46Z", "accent", { w: 0, detail: true }),
      F("M22 24L98 24L98 36L22 36Z", "body"),       F("M52 24L68 24L68 74L52 74Z", "light"),
      F("M60 24C46 4 28 10 38 22C44 28 56 24 60 24Z", "light"), F("M60 24C74 4 92 10 82 22C76 28 64 24 60 24Z", "light"),
      F(ell(60, 24, 5.5, 5.5), "light"), S("M22 74L18 78M98 74L102 78", 1.6, "accent", { detail: true }),
      S("M26 62C32 56 36 68 42 62M78 62C84 56 88 68 94 62", 2, "accent", { detail: true })];
  },
  popper() {
    const burst = [[-30, "light"], [-8, "accent"], [14, "body"], [36, "light"]].map(([a, c], i) => {
      const o = [58, 28], q = [[0, 0], [14, -12], [12, -26], [26, -34]].map((p) => rotAbout([0, 0], a, p)).map((p) => [o[0] + p[0], o[1] + p[1]]);
      return S(curve(q), 3.2, c);
    });
    return [F("M34 74L44 30L66 40Z", "body"), F("M34 74L44 30L50 33Z", "light", { w: 0, detail: true }),
      S("M40 56L58 62M42 44L62 51", 2.4, "accent", { detail: true }),
      F(poly([[40, 24], [48, 22], [58, 30], [66, 40], [50, 28]]), "accent", { w: 1.8 }),
      ...burst.map((d) => ({ ...d, w: 3.2 })),
      ...[[86, 20, "accent"], [94, 40, "light"], [76, 10, "body"], [100, 26, "body"]].map(([x, y, c]) => F(ell(x, y, 2.6, 2.6), c, { w: 1.4 }))];
  }
};

// ---- rendering -----------------------------------------------------------------------------
let uid = 0;
const FILL_ROLE = (role, pal) => role === "body" ? pal[0] : role === "light" ? pal[1] : role === "accent" ? pal[2] : role === "ink" ? INK : role === "white" ? SAND : role;

function layersFor(art, id) {
  if (art.t === "fish") return fishLayers(art, id);
  return ITEMS[art.draw](art);
}

/** The parameter object for a species (or undefined). */
export function fishArt(id) { return speciesById[id]?.art; }

/**
 * SVG string for one species. opts: size (px width, default 96), silhouette (flat shape for an
 * uncaught slot), title (accessible name; omitted = decorative), color/opacity for the silhouette.
 */
export function fishSVG(speciesOrId, opts = {}) {
  const sp = typeof speciesOrId === "string" ? speciesById[speciesOrId] : speciesOrId;
  if (!sp) throw new Error(`fishSVG: unknown species ${speciesOrId}`);
  const { size = 96, silhouette = false, title, color = INK, opacity = .34 } = opts;
  const art = sp.art, pal = art.pal, cid = `fa${++uid}`;
  const layers = layersFor(art, sp.id).flat().filter(Boolean);
  const body = layers.find((l) => l.body) || layers.find((l) => l.clip && l.clipD);
  let out = "";
  if (!silhouette && body) out += `<defs><clipPath id="${cid}"><path d="${body.d}"/></clipPath></defs>`;
  const keep = silhouette ? layers.filter((l) => !l.detail && !l.clip) : layers;
  const g = keep.map((l) => {
    const stroke = l.s ?? (l.f === "none" ? "ink" : "ink"), w = l.w ?? SW;
    const fill = l.f === "none" ? "none" : silhouette ? color : FILL_ROLE(l.f, pal);
    const st = l.f === "none" || w > 0 ? (silhouette ? color : FILL_ROLE(stroke, pal)) : "none";
    const clip = !silhouette && l.clip && body ? ` clip-path="url(#${cid})"` : "";
    return `<path d="${l.d}" fill="${fill}" stroke="${w > 0 ? st : "none"}" stroke-width="${w}"${l.cap ? ' stroke-linecap="round"' : ""}${clip}/>`;
  }).join("");
  out += silhouette ? `<g opacity="${opacity}" stroke-linejoin="round">${g}</g>` : `<g stroke-linejoin="round" stroke-linecap="round">${g}</g>`;
  const label = title ? ` role="img" aria-label="${title.replace(/"/g, "&quot;")}"` : ` aria-hidden="true"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="${size}" height="${f1(size * 2 / 3)}"${label} focusable="false">${title ? `<title>${title}</title>` : ""}${out}</svg>`;
}
