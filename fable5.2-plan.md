# Huikau.com redesign: "Mauka to Makai" — orchestration plan

> Written by Fable 5.2 on 2026-11-12 and approved by Mike. This file sits untracked on `master`; nothing else has been changed. Opus 5.5 runs it, starting with the kickoff prompt in section 2.1.

## 1. Context

**What exists.** huikau.com is a static GitHub Pages site (repo `huikau/huikau.github.io`, served from `master` root, `CNAME` = `huikau.com`). It is one page plus a 404: `index.html` (~170 lines), `404.html`, `assets/site.css` (~770 lines), `assets/site.js` (one ~800-line IIFE), and five images. It already does a lot: a sky that follows Honolulu time, live NWS weather with canvas rain, real moon phase, NOAA tides, Open-Meteo surf, a bobber that reels in catches into "Ula's lauhala basket", seasonal modes, easter eggs, generated surf sound, and a Fat Boy Fishing Club card.

**Why redesign.** The features are good; the presentation undersells them.
- The scene is flat: CSS gradients and three sine waves. Nothing has depth, texture or a horizon worth looking at.
- The art has no single style. A raster logo with a knocked-out background (needing a gray halo at night), a circular photo-sticker of Ula, emoji as fish, and a product card floating in the sky.
- Below the fold is a generic dark card grid. The live data is shown as text rows, not as anything you'd want to look at.
- Fishing is one click for a random result. The best features (sky modes, wishes, boat, pineapple rain) are hidden behind URL switches and secrets.
- The code is one file with no tests, which makes a redesign by several agents risky.

**Outcome wanted.** A visually stunning, cohesive, island-themed site that is still 100% static and hostable on GitHub Pages exactly as today, with better features. Work happens on branch **`upgrade-fable`**; it ends as a PR for Mike's review. `master` is never touched.

## 2. How to run this plan

### 2.1 Kickoff prompt (paste into a new Claude Code session on Opus 5.5, in the repo)

```
Read fable5.2-plan.md in this repo and execute it as the orchestrator, exactly as written.
Start with section 5 (Wave 0). Delegate work packages to subagents with the Agent tool using
the models the plan names, review each one against its acceptance criteria yourself, and take
over any package that fails review twice. Commit only to the upgrade-fable branch. Never push
to or merge into master. Stop after opening the PR and report.
```

### 2.2 Roles

| Role | Model | Does |
|---|---|---|
| Orchestrator and reviewer | **Opus 5.5** (the session) | Wave 0, briefs subagents, reviews every package, commits, fixes what fails twice, final design pass, opens the PR |
| Builder | **Sonnet 5.5** — `Agent({ model: "sonnet", subagent_type: "general-purpose" })` | Every design or code work package (WP1–WP11) |
| Runner | **Haiku 5.5** — `Agent({ model: "haiku", subagent_type: "general-purpose" })` | Mechanical jobs only: screenshot matrix runs, font and image optimisation, link and size checks |

Sonnet is the builder because every package here involves visual judgment or non-trivial code; Haiku only runs scripts and reports numbers.

### 2.3 Orchestration loop (per work package)

1. **Brief.** Spawn one subagent per package with the template in 2.4 plus the package's section from this file, copied in full. Packages in the same wave go out in one message so they run in parallel.
2. **Builders do not run git write commands.** They edit only the files their package owns (section 6 table) and report.
3. **Review.** Opus runs the gate in section 8 for that package: unit tests, the screenshot matrix, and reads the screenshots itself against the package's acceptance criteria and the art direction in section 4.
4. **Pass →** Opus commits to `upgrade-fable`: `WPn: <summary>` with the attribution trailer the session specifies.
5. **Fail →** send the builder a numbered defect list (`SendMessage`), one revision round. **Second fail →** Opus discards or repairs the work and implements the package itself, then commits.
6. Push the branch after each wave. Do not start the next wave until every package in the current one is committed.

### 2.4 Subagent brief template

```
You are building one work package of the huikau.com redesign. Repo: /home/mckinnms/git/huikau.github.io,
branch upgrade-fable (already checked out). Read fable5.2-plan.md sections 3, 4 and 6 first; they are binding.

YOUR PACKAGE: <paste the full WP section>

Rules:
- Edit only the files listed as yours. In index.html, edit only between your <!-- wp:NAME --> markers.
- Do not run git add/commit/push/checkout. Do not touch master, CNAME, or other packages' files.
- No build step, no frameworks, no CDN scripts, no new network hosts beyond section 3.
- Preview with: python3 -m http.server 8765  (then http://localhost:8765/?debug=1)
- Verify your own work with tools/shots.mjs and node --test before reporting.
Report: files changed, how you verified each acceptance criterion, anything you could not do, and
any Hawaiian text you added that is not in the vetted list (section 4.5).
```

## 3. Hard constraints (binding on everyone)

- **Hosting:** pure static files served from the repo root by GitHub Pages. No build step, no bundler, no server code. Native ES modules, plain CSS. `CNAME` stays. `404.html` stays at the root and uses absolute `/…` paths. Add `.nojekyll`.
- **No new runtime dependencies or third-party scripts.** No analytics, no trackers, no CDN JS. Fonts are self-hosted `woff2`.
- **Network hosts allowed at runtime (all verified CORS-open from a browser):**
  - `api.tidesandcurrents.noaa.gov` — tides, station `1612340` (Honolulu Harbor)
  - `api.weather.gov` — `stations/PHNL/observations/latest` (wind and temperature are often `null`; always handle it)
  - `marine-api.open-meteo.com` — waves, swell, sea temperature at `21.26,-157.84`
  - `api.open-meteo.com` — allowed for hourly wind/temperature fallback; **verify CORS before relying on it**
  - Every fetch has a timeout, a cached last-good value, and a designed "no data" state. The page must be complete and beautiful with every API down.
- **Keep every existing feature** (regression list in section 7). Restyle, don't remove.
- **Keep these exact things:** Ula's portrait stays small (≤ 112 px rendered); the Fat Boy Fishing Club feature keeps the real logo `assets/fatboy-logo.webp`, the name, and the link `https://fatboyfishn.com/` opening in a new tab; saved catches under `localStorage["huikau-basket"]` (and legacy `huikau-tackle`) must survive.
- **Accessibility floor:** WCAG AA contrast for all text at every sky state; everything operable by keyboard; visible focus; `prefers-reduced-motion` gives a still but complete page; no information by color alone; a plain-text "Right now in Honolulu…" summary for screen readers.
- **Performance budget (uncompressed, first load):** JS ≤ 260 KB, CSS ≤ 90 KB, fonts ≤ 160 KB, critical images ≤ 350 KB. No animation work when the tab is hidden or the element is off screen. p95 frame time ≤ 20 ms on desktop at 1440×900 with rain on.
- **Hawaiian language:** use the ʻokina (U+02BB `ʻ`) and kahakō correctly. Use only strings from section 4.5. Never invent Hawaiian phrases. Anything new goes in `js/data/hawaiian.js` with `needsReview: true` and is listed in the PR description.
- **Honu are never "caught"** (protected species); the turtle only visits.

## 4. Design direction: "Mauka to Makai"

*Mauka* means toward the mountains, *makai* toward the sea. The page is one continuous vertical journey: **sky → ridgeline → shoreline → surface → reef → deep**. Scrolling is diving.

### 4.1 Art style: island screenprint

Take the style of the Huikau logo itself (bold dark outlines, flat fills, dry-brush texture, a limited sunset palette) and draw the whole world in it.
- **Shapes:** flat fills, confident curves, 2–3 tones per object, a dark keyline (`--ink`) where objects overlap the sky. No gradients inside objects except the sky and water bodies.
- **Texture:** one shared paper-grain overlay (SVG `feTurbulence`, blended at 6–10%) over the entire scene, plus dry-brush edge masks on large shapes. This is what makes it read as print, not vector clip-art.
- **Depth:** at least five parallax layers above water (far ridge, near ridge with Lēʻahi/Diamond Head silhouette, palms, shoreline, foreground wave) and four below (light rays, far reef, near reef, foreground kelp/coral), each tinted by the live sky colour for atmospheric perspective.
- **No emoji as art.** Every fish, object and icon is SVG in this style. Emoji may appear only in share text.
- **The logo:** the existing `assets/huikau-logo.webp` is the hero mark. Fix its night legibility properly (a cream "sticker" keyline or a light logo variant produced from the brand kit), not a gray halo.

### 4.2 Palette (CSS custom properties, defined once in `css/tokens.css`)

| Token | Value | Use |
|---|---|---|
| `--ink` | `#0B2226` | keylines, deepest water |
| `--abyss` | `#0E2B30` | deep sections background |
| `--deep` | `#164E56` | mid water |
| `--lagoon` | `#1E6E78` | near-surface water |
| `--foam` | `#BFE5EE` | foam, highlights |
| `--sunset` | `#E8662A` | primary accent |
| `--mango` | `#F5A623` | secondary accent, focus ring |
| `--hibiscus` | `#D8456B` | rare accent (leis, rare catches) |
| `--sand` | `#F7EEDB` | paper, light text |
| `--lauhala` | `#C49C5E` | woven surfaces |
| `--fb-ink` `#0A171B`, `--fb-teal` `#2DD4C8` | | Fat Boy Fishing Club only |

Live sky colours are computed in JS and written to `--sky-top`, `--sky-mid`, `--sky-horizon`, `--sun-glow`, `--haze`, `--text-on-sky` on `:root`; every layer reads those.

### 4.3 Type

Self-hosted `woff2`, `font-display: swap`: **Caprasimo** (display, already the brand voice), **Figtree** variable (text), **Anton** (Fat Boy sign only). Scale: 1.25 ratio from 1.0625 rem. Sentence case. No all-caps labels, no eyebrow labels, no "→" on links.

### 4.4 Signature moments (the things people will remember)

1. **A sky that is actually the sky.** Colour is interpolated continuously from the sun's altitude over Honolulu, with the sun and moon drawn on their arcs, not five preset gradients.
2. **The Island Time Machine.** A visible scrubber lets anyone drag through 24 hours and watch dawn, day, golden hour, dusk and night roll past, then tap "Live" to return. It makes the best feature discoverable.
3. **The dive.** Scrolling past the waterline takes you under: the surface ripples overhead, light rays fan down, sound goes muffled, a depth gauge counts down, and **the fish you've caught swim in the reef**.
4. **Fishing with a little skill.** Cast, wait, bite, reel on the beat. Catches are illustrated Hawaiian species with their names and a line about each, collected in the lauhala basket as a field guide.
5. **Instruments, not tables.** A drawn tide curve with a "now" marker, a swell compass, a sun-and-moon arc.
6. **Send a postcard.** One button renders the current scene into a "Wish you were here" image to save or share.

### 4.5 Vetted Hawaiian vocabulary (use exactly as spelled)

- **Words of the day (existing 16, keep):** huikau, aloha, mahalo, nalu, kai, moana, lawaiʻa, hoʻomaha, mālie, pau, ʻono, makani, ʻohana, kōkua, pāʻina, a hui hou. May add: mauka (toward the mountains), makai (toward the sea), lā (sun; day), mahina (moon), ua (rain), ānuenue (rainbow), honu (green sea turtle), iʻa (fish), waʻa (canoe), pōhaku (stone).
- **Species:** mahimahi (dolphinfish), ʻahi (yellowfin tuna), aku (skipjack tuna), ono (wahoo), ulua (giant trevally), ʻōpakapaka (pink snapper), uku (gray jobfish), moi (Pacific threadfin), ʻamaʻama (striped mullet), humuhumunukunukuāpuaʻa (reef triggerfish), uhu (parrotfish), manini (convict tang), kala (unicornfish), weke (goatfish), ʻōʻio (bonefish), heʻe (octopus), ula (spiny lobster), manō (shark), honu (green sea turtle), ʻiwa (frigatebird), koholā (humpback whale).
- **Greetings in use:** Mele Kalikimaka, Hauʻoli Makahiki Hou, Aloha Friday.
- **Places:** Oʻahu, Hawaiʻi, Honolulu, Lēʻahi (Diamond Head).
- All of the above are flagged in the PR for a fluent speaker's once-over. Section headings stay in English.

## 5. Wave 0 — Opus sets up (no subagents)

1. `git switch master && git pull --ff-only && git switch -c upgrade-fable && git push -u origin upgrade-fable`.
2. Commit `fable5.2-plan.md` to the branch as the first commit.
3. Add `.nojekyll`, `.gitignore` (`node_modules/`, `shots/`, `art-src/`), and a dev-only `package.json` (`"private": true`, devDependency `playwright`, scripts `test`, `shots`, `serve`). Run `npm i`.
4. Write `tools/shots.mjs`: serves the repo, then captures the **screenshot matrix** into `shots/<label>/`: viewports 1440×900, 1024×768, 390×844; states `?t=05:50`, `06:40`, `12:00`, `17:30`, `18:10`, `22:00`; plus `?weather=downpour`, `?season=halloween|winter|newyear`, `?friday=1`, `prefers-reduced-motion`, and full-page captures. Until WP1 lands, map `?t=` to the old `?sky=` values.
5. Run it once as `shots/baseline/` — the "before" set for regression and for the PR description.
6. Copy the brand kit from `/home/mckinnms/Pictures/Huikau_Brand_Kit` to `art-src/` (gitignored) so builders can read it. Note: every PNG there has a baked-in background. To cut one out, flood-fill from the corners with ~9% fuzz, then clear enclosed pockets by connected-component analysis (this is how the current logo was made; the palm-trunk gaps and the hole in the "A" were the pockets).
7. Create the empty mount-point skeleton in `index.html` (the `<!-- wp:NAME -->` markers from section 6) without changing how the page looks yet.

## 6. Target architecture and file ownership

```
index.html            semantic skeleton; each region delimited by <!-- wp:NAME --> … <!-- /wp:NAME -->
404.html              "Lost at sea", reuses the same modules
manifest.webmanifest, sw.js
css/  tokens.css  base.css  scene.css  game.css  instruments.css  deep.css
js/
  main.js             boots modules in order; ?debug=1 exposes window.__huikau
  core/  clock.js  astro.js  store.js  bus.js  motion.js  dom.js
  data/  tides.js  weather.js  surf.js  hawaiian.js  species.js
  sky/   sky.js  bodies.js  stars.js  clouds.js  rain.js  timemachine.js
  scene/ land.js  surface.js  dive.js  reef.js  ula.js  crew.js
  game/  fishing.js  fishart.js  basket.js
  ui/    instruments.js  bottle.js  postcard.js  sound.js  seasons.js  eggs.js
assets/ fonts/  img/  (existing images stay at their current paths)
tests/  unit/*.test.mjs   e2e/*.spec.mjs
tools/  shots.mjs  budget.mjs
```

**Contracts every module follows**
- `clock.now()` is the only source of time. It honours `?t=HH:MM`, `?date=YYYY-MM-DD` and the Time Machine offset. Nothing else calls `Date.now()` for display.
- `bus` events: `tick` (every 30 s and on scrub), `sky` (`{altitude, azimuth, phase, colors}`), `weather`, `tides`, `surf`, `depth` (0 at the surface → 1 at the bottom), `catch`.
- `motion.reduced` and `motion.onVisible(el, start, stop)` gate every animation loop.
- Existing URL test switches keep working: `sky`, `season`, `weather` (clear/cloudy/rain/downpour/windy), `moon`, `friday`, `rare`, `whale`, `flash`, `shoot`, `iwa`, `og`.

| Package | Owns |
|---|---|
| WP1 | `js/main.js`, `js/core/*`, `js/data/tides.js weather.js surf.js`, `tests/unit/*`, removal of `assets/site.js` |
| WP2 | `css/tokens.css`, `css/base.css`, `assets/fonts/*`, `styleguide.html` |
| WP3 | `js/sky/*`, sky parts of `css/scene.css`, `wp:sky` |
| WP4 | `js/scene/land.js ula.js crew.js`, land parts of `css/scene.css`, `assets/img/*`, `wp:land`, `wp:crew` |
| WP5 | `js/scene/surface.js dive.js reef.js`, `css/deep.css`, `wp:water`, `wp:reef` |
| WP6 | `js/game/*`, `js/data/species.js hawaiian.js`, `css/game.css`, `wp:game`, `wp:basket` |
| WP7 | `js/ui/instruments.js bottle.js`, `css/instruments.css`, `wp:instruments` |
| WP8 | `js/ui/sound.js`, `wp:sound` |
| WP9 | `js/ui/seasons.js eggs.js`, `wp:seasonal` |
| WP10 | `js/ui/postcard.js`, `manifest.webmanifest`, `sw.js`, `404.html`, `assets/og.png`, icons, `<head>` |
| WP11 | `tests/e2e/*`, `tools/budget.mjs`, fixes anywhere (runs alone) |

## 7. Work packages

Each lists **Build**, then **Accept** (what Opus checks). The regression list applies to all: Honolulu clock line; live weather text; clouds, rain and wind; real moon phase; tides; surf report; "Today on the water" with Ula's pick; Hawaiian word of the day; bobber fishing with Ula reacting; basket with 13 legacy slots and reset; golden ulua; Halloween, December, New Year, Aloha Friday; pineapple rain; "aloha" boat (and triple-tap Ula); whales Dec–Apr; green flash; shooting-star wishes; ʻiwa; ocean sound; Fat Boy card; 404 page; link-preview image.

### Wave 1

**WP1 — Foundation (Sonnet, alone).**
Build: split `assets/site.js` into the module tree above with **no visual or behavioural change**. Add `core/astro.js`: sun altitude and azimuth for Honolulu (extend the NOAA equations already in `sunTimes()`), sunrise/sunset, moon phase and illumination (existing `moonPhase()` math), and an approximate moon altitude. Data modules get an 8 s timeout, `localStorage` last-good cache with timestamp, and a typed `{status: "live"|"cached"|"none"}` result. Move the pure logic (`sunTimes`, `skyFor`, `ulasPick`, phase naming, tide parsing) into testable functions with `node --test` unit tests, including known-answer checks (Honolulu, 2026-10-28: sunrise ≈ 6:31 am, sunset ≈ 5:58 pm, ±2 min).
Accept: screenshot matrix matches `shots/baseline/` (pixel-diff ≤ 1% outside animated regions); `npm test` green; no console errors; old `site.js` deleted; page still works from `file`-less static server and on a subpath-free root.

### Wave 2 (parallel)

**WP2 — Design system (Sonnet).**
Build: `tokens.css` (section 4.2 exactly, spacing scale, radii, shadows, z-index map, motion durations and easings), `base.css` (reset, type scale, focus ring, buttons, the "paper card" and "instrument" surfaces, grain overlay utility, dry-brush mask utility), self-hosted fonts (Haiku runner may fetch and subset). `styleguide.html` showing every token and component on light, dark and mid-sky backgrounds.
Accept: no Google Fonts requests; fonts ≤ 160 KB; styleguide renders every component; contrast table in the styleguide shows AA for each text/background pair.

**WP3 — Sky engine v2 (Sonnet).**
Build: continuous sky from sun altitude using keyframes at −18°, −12°, −6°, −2°, 0°, +4°, +10°, +25°, +60°, interpolated in OKLCH, with a warm glow that follows the sun's azimuth side. Sun disc and moon (correct phase, existing path math) placed on arcs by altitude. Canvas star field with gentle twinkle and a faint Milky Way band, fading in below −6°. Clouds redrawn as layered screenprint shapes, count and tint from weather, lit from the sun side. Port the canvas rain unchanged in behaviour, restyled if needed. **Time Machine:** a slim, labelled, keyboard-operable slider (dawn/noon/sunset/midnight ticks, live readout "3:40 pm · golden hour"), a "Live" button, and it drives `clock`.
Accept: dragging the slider through 24 h is smooth with no banding or popping; `--text-on-sky` keeps the clock line AA at every hour (automated check across 48 half-hours); sun and moon positions plausible against the unit-tested altitudes; reduced motion shows the correct still sky.

**WP6a — Species data and fish art (Sonnet).**
Build: `data/species.js` with ~24 entries (the 13 legacy ids kept: `mahi, pineapple, slipper, hee, coconut, puffer, plumeria, boot, shark, honu→visitor, wave, cap, golden`; plus new species from 4.5) each with `id, name, hawaiian, english, line, mood, rarity, habitat, art`. `game/fishart.js`: a **parametric SVG generator** (body profile, fin set, tail type, pattern, 3-tone palette, keyline) so all species share one hand and silhouettes work as "uncaught" slots. Objects (slipper, boot, coconut, cap with a small skull-and-crossbones, etc.) drawn in the same style.
Accept: a gallery page section in `styleguide.html` showing every species at 48, 96 and 240 px, plus silhouettes; each is recognisable and distinct; zero emoji; Hawaiian names match 4.5 character for character.

### Wave 3 (parallel)

**WP4 — The land and the cast (Sonnet).**
Build: the above-water composition. Far and near ridgelines (near one includes a Lēʻahi-like profile), palms, a strip of shoreline, all tinted from sky tokens with atmospheric fade. Hero logo placement with the night-legible treatment from 4.1. **Ula:** an illustrated outrigger canoe (waʻa) on the water with her portrait set small in a round lauhala-rimmed frame, rod and line rendered as SVG that the game can drive (`ula.setLine(state)`), reactions (hop, head-tilt) kept. **Fat Boy Fishing Club:** redesigned as a weathered dock sign or channel-marker buoy anchored in the scene (their navy and teal, real logo, Anton wordmark, "Ula's cap came from here", "Shop the gear"), fully clickable, never floating in the sky. Compositions specified for 1440, 1024 and 390 wide.
Accept: at all three widths nothing overlaps the logo, the clock, the Time Machine, or the bobber; Ula's portrait ≤ 112 px; the scene reads well at all six matrix times; the Fat Boy link works and has a visible focus state.

**WP5 — Surface and dive (Sonnet).**
Build: a new water surface (layered canvas or SVG with foam lines and specular glints toward the sun/moon side, wave speed from wind). **The dive:** as the user scrolls past the waterline, emit `depth`; the view crosses the surface (surface seen from below, shimmering), then light rays, drifting particles, a parallax reef (far, near, foreground), colour grading from `--lagoon` to `--ink`, and a slim depth gauge. Caught species (from `store`) swim in the reef as small schools with simple steering; uncaught ones don't appear. Night dive is darker with bioluminescent specks. CSS scroll-driven animations where supported, a rAF fallback elsewhere, and a static layered illustration under reduced motion.
Accept: scroll from top to bottom holds the frame budget; no layout shift; the reef is populated in a test with `localStorage` seeded with five catches and empty-but-inviting with none; content below is readable (AA) at every depth.

**WP7 — Instruments (Sonnet).**
Build: replace the text cards with drawn instruments on "paper" panels placed in the underwater section: **tide curve** (fetch hourly predictions, smooth curve, high/low labels, "now" marker, next change called out), **swell compass** (direction rose, height and period, the one-line surf call), **sun and moon dial** (today's arc with sunrise/sunset, moon phase, next full/new), **weather strip** (conditions, temperature, wind when present), **Ula's pick** as a handwritten note. **Word of the day** becomes a message in a bottle that bobs at the surface and opens into a card (keyboard and screen-reader friendly), with previous/next.
Accept: each instrument has a designed loading state and a designed no-data state; values match the old cards for the same data (test with recorded fixtures); all are legible at 390 px; every chart has a text equivalent.

### Wave 4 (parallel)

**WP6b — Fishing game v2 and the basket (Sonnet).**
Build: state machine `idle → cast → waiting → bite → reel → landed | got away`. Cast with click/tap/Space/Enter; a bite comes after 1.5–6 s (bobber dips, ripple, soft thump); reeling is one well-timed press inside a shrinking ring (generous for kids; holding the button auto-succeeds after 2 s so it is never a blocker; under reduced motion or `?easy=1` any press lands). Rarity tiers; time-of-day and habitat affect what bites (e.g. heʻe more at dusk). Catch card redesigned with the illustrated species, Hawaiian and English names, and its line. **Basket → field guide:** woven lauhala panel, silhouettes for uncaught, tap a caught species for a detail card (art large, names, fact, times caught, best time). Keep the glide-to-basket on a new catch, legacy storage migration, reset, golden ulua at ~1/40 and `?rare=1`. Ula catching an *ula* (spiny lobster) gets its own line.
Accept: a full keyboard-only playthrough works; an e2e test lands a catch deterministically with `?debug=1` hooks; legacy `huikau-tackle` data appears; nothing is caught by merely loading the page.

**WP8 — Sound v2 (Sonnet).**
Build: keep the generated surf. Add rain patter when raining, a low-pass "underwater" crossfade driven by `depth`, a soft bite thump, a small catch chime (pentatonic, ukulele-like pluck synthesised), and a UI tick. Off by default; one clear toggle; preference remembered; audio context only created on user gesture; fully suspended when off or hidden.
Accept: no audio before a gesture; no clicks at loop points (inspect rendered buffers with `OfflineAudioContext` in a unit test for discontinuities); toggle is labelled and stateful for screen readers.

**WP9 — Seasons and secrets, restyled (Sonnet).**
Build: port Halloween (jack-o'-lantern bobber, skeleton-fish and pumpkin catches), December (string lights along the shoreline or canoe, gift catch), New Year (fireworks over the ridge with reflections on water), Aloha Friday (lei on Ula's frame and canoe), whales with spout and fluke in the new style, green flash, shooting-star wishes, ʻiwa, pineapple rain from the logo's pineapple, the "aloha" boat. Add a discreet **"Things to find"** panel in the footer listing secrets as unchecked riddles that tick off when found, so they are discoverable without being spoiled.
Accept: every item in the regression list triggers via its switch and appears in the new art style; found-state persists.

### Wave 5 (parallel, then WP11 alone)

**WP10 — Postcard, PWA, 404, meta (Sonnet).**
Build: **postcard** — render the current scene to a 1200×1500 canvas with a stamp, postmark showing Honolulu time and weather, and "Wish you were here — huikau.com"; save, or share via Web Share where available. `manifest.webmanifest`, icons, `sw.js` (versioned cache-first for static files, network-first with fallback for the three APIs, clean update flow, never caches opaque errors). Redesign `404.html` as "Lost at sea" inside the new world. Regenerate `assets/og.png` (1200×630) from the new scene via `?og=1`. Complete `<head>` meta.
Accept: installable; works offline after one visit showing cached data marked as such; a hard refresh after a deploy picks up new files; `/nope` shows the 404 locally via a tiny test server rule; og image looks right at 600 px wide.

**WP11 — Hardening (Sonnet, alone, with a Haiku runner for the matrix).**
Build: Playwright e2e covering load, time scrub, cast-and-catch, dive, each instrument state with fixture data, sound toggle, offline, reduced motion, and keyboard-only. `tools/budget.mjs` enforcing section 3 budgets. Automated contrast sweep across 48 half-hours. Frame-time sampler via `window.__huikau.perf`. Fix everything found.
Accept: all tests green three runs in a row; budgets met; zero console errors or warnings in the matrix; no horizontal scroll at 320–1920 px.

## 8. Review gates

**Per package (Opus):** `npm test`; `node tools/shots.mjs --label wpN`; open the screenshots and judge them against that package's Accept list and section 4; check the diff touches only owned files; check no forbidden hosts (`grep -R "https://" js css *.html`).

**Final design review (Opus, after WP11) — score each 1–5, all must be ≥ 4 or Opus fixes it:**
1. One art style everywhere; nothing looks pasted in.
2. The hero is striking at dawn, noon, golden hour, dusk and night, on desktop and phone.
3. The dive feels continuous and makes you want to keep scrolling.
4. Fishing is fun for a five-year-old and satisfying for an adult.
5. The data instruments are beautiful and readable at a glance.
6. Type, spacing and alignment are disciplined; no orphaned or cramped elements.
7. Motion is purposeful; reduced-motion version still looks finished.
8. Fat Boy Fishing Club is featured prominently and feels part of the world.
9. Phone layout is designed, not just shrunk.
10. A first-time visitor discovers at least three "moments" within a minute without instructions.

Opus then does one **polish pass** itself on the two lowest-scoring items regardless of score.

## 9. Finish

1. Final commit removes `fable5.2-plan.md`, `styleguide.html` and anything dev-only that should not be served from the site root (they stay in branch history); `tests/`, `tools/`, `package.json` may stay.
2. Run the full matrix as `shots/final/`; build a before/after contact sheet from `baseline` and `final`.
3. Push `upgrade-fable`; open a PR to `master` with `gh pr create` — **do not merge, do not enable auto-merge**. PR body: summary, before/after images, feature list, the rubric scores, the Hawaiian-text review list, known limitations, and how to preview (`npm run serve`).
4. Report to Mike and stop.

## 10. Verification (how anyone can check the result)

```bash
git switch upgrade-fable && npm i
npm test                         # unit + e2e
node tools/budget.mjs            # size and request budgets
node tools/shots.mjs --label check   # screenshot matrix into shots/check/
npm run serve                    # http://localhost:8765
```

Manual spot checks: drag the Time Machine through a full day; fish with mouse, touch and keyboard; scroll to the bottom and back; toggle sound and dive; turn on OS "reduce motion"; go offline and reload; open `/?weather=downpour&t=22:00`, `/?season=winter&friday=1`, and `/nope`.

## 11. Risks and how the plan handles them

- **Illustration quality from code-written SVG** is the biggest risk to "stunning". Mitigations: one strict style (4.1), procedural generation for ridges, waves and fish so everything shares a hand, the brand kit as source art, the shared grain overlay, and Opus reviewing real screenshots at every gate with a takeover rule.
- **Parallel edits to `index.html`:** marker-delimited regions, one owner each; Opus resolves any collision at commit time.
- **Scope:** if a wave overruns, the order of sacrifice is WP10 postcard → WP8 extra sounds → WP9 "Things to find". Signature moments 1–5 are not negotiable.
- **API fragility:** designed no-data states and cached values are acceptance criteria, not extras.
- **Cultural accuracy:** vetted vocabulary only, flagged for review in the PR.
