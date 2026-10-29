(() => {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    }
  };
  const scene = document.querySelector(".scene");
  if (params.get("og") === "1") document.body.classList.add("og");

  // ---------- Honolulu time (HST is UTC-10 all year, no daylight saving) ----------
  // Read the returned Date with getUTC* methods to get Honolulu wall-clock values.
  const hstNow = () => new Date(Date.now() - 10 * 3600e3);
  const minutesOf = (d) => d.getUTCHours() * 60 + d.getUTCMinutes();

  // Sunrise and sunset for Honolulu, in minutes after local midnight (NOAA's simplified solar equations).
  function sunTimes(d) {
    const lat = 21.3069 * Math.PI / 180, lon = -157.8583;
    const dayOfYear = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5);
    const g = 2 * Math.PI / 365 * (dayOfYear - 1);
    const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
      + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const ha = Math.acos(Math.cos(90.833 * Math.PI / 180) / (Math.cos(lat) * Math.cos(decl)) - Math.tan(lat) * Math.tan(decl)) * 180 / Math.PI;
    const toLocal = (utcMinutes) => ((utcMinutes - 600) % 1440 + 1440) % 1440;
    return { rise: toLocal(720 - 4 * (lon + ha) - eqTime), set: toLocal(720 - 4 * (lon - ha) - eqTime) };
  }

  function skyFor(m, sun) {
    if (m < sun.rise - 50 || m > sun.set + 50) return "night";
    if (m < sun.rise + 40) return "dawn";
    if (m < sun.set - 70) return "day";
    if (m < sun.set + 15) return "golden";
    return "dusk";
  }

  const clockTime = (m) => {
    const h = Math.floor(m / 60) % 24, mm = String(Math.floor(m % 60)).padStart(2, "0");
    return `${h % 12 || 12}:${mm} ${h < 12 ? "am" : "pm"}`;
  };
  const duration = (mins) => {
    mins = Math.round(mins);
    const h = Math.floor(mins / 60), m = mins % 60;
    if (!h) return `${m} min`;
    return m ? `${h} hr ${m} min` : `${h} hr`;
  };

  function updateSky() {
    const now = hstNow(), m = minutesOf(now), sun = sunTimes(now);
    const forced = params.get("sky");
    scene.dataset.sky = ["dawn", "day", "golden", "dusk", "night"].includes(forced) ? forced : skyFor(m, sun);

    const clock = $("clock-text");
    if (!clock) return;
    let next;
    if (m < sun.rise) next = `Sunrise in ${duration(sun.rise - m)}.`;
    else if (m < sun.set) next = `Sunset in ${duration(sun.set - m)}.`;
    else next = `Sunrise in ${duration(1440 - m + sun.rise)}.`;
    clock.textContent = `${clockTime(m)} in Honolulu. ${next}`;
  }
  updateSky();
  setInterval(updateSky, 30000);

  // Stars for dusk and night
  const stars = $("stars");
  if (stars) {
    for (let i = 0; i < 90; i++) {
      const s = document.createElement("span");
      const size = Math.random() < .85 ? 1.5 : 2.5;
      s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;width:${size}px;height:${size}px;opacity:${.4 + Math.random() * .6};animation-delay:${Math.random() * 3.5}s`;
      if (Math.random() < .3) s.className = "twinkle";
      stars.appendChild(s);
    }
  }

  // ---------- Seasons and Aloha Friday ----------
  const today = hstNow();
  const month = today.getUTCMonth() + 1, date = today.getUTCDate();
  let season = "none";
  if (month === 10 && date >= 15) season = "halloween";
  else if (month === 12 && date <= 30) season = "winter";
  else if ((month === 12 && date === 31) || (month === 1 && date === 1)) season = "newyear";
  if (["halloween", "winter", "newyear", "none"].includes(params.get("season"))) season = params.get("season");
  document.body.classList.add(`season-${season}`);

  if (season === "winter") {
    const lights = $("lights");
    const draw = () => {
      const w = scene.clientWidth, span = 300, sag = 34, colors = ["#F5A623", "#E8662A", "#2DD4C8", "#F7EEDB", "#E8484A"];
      let svg = `<svg width="${w}" height="90" viewBox="0 0 ${w} 90">`;
      let c = 0;
      for (let x = -40; x < w + 40; x += span) {
        svg += `<path d="M${x} 6 Q${x + span / 2} ${6 + sag * 2} ${x + span} 6" stroke="#0E2B30" stroke-width="2" fill="none"/>`;
        for (let t = 0.1; t < 1; t += 0.16) {
          const px = x + span * t, py = 6 + sag * 4 * t * (1 - t);
          const col = colors[c++ % colors.length];
          svg += `<circle cx="${px.toFixed(1)}" cy="${(py + 6).toFixed(1)}" r="5" fill="${col}" style="filter:drop-shadow(0 0 5px ${col})"/>`;
        }
      }
      lights.innerHTML = svg + "</svg>";
    };
    draw();
    addEventListener("resize", draw);
  }

  if (season === "newyear") {
    const fw = $("fireworks");
    const spots = [[18, 30, "#F5A623", 0], [72, 22, "#2DD4C8", 1.1], [45, 12, "#F7EEDB", 2.1], [86, 40, "#E8662A", .6]];
    for (const [left, top, color, delay] of spots) {
      const b = document.createElement("span");
      b.className = "burst";
      const dots = [];
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2;
        dots.push(`${(Math.cos(a) * 70).toFixed(1)}px ${(Math.sin(a) * 70).toFixed(1)}px 0 1px ${color}`);
      }
      b.style.cssText = `left:${left}%;top:${top}%;box-shadow:${dots.join(",")};animation-delay:${delay}s`;
      fw.appendChild(b);
    }
  }

  const friday = params.has("friday") ? params.get("friday") === "1" : today.getUTCDay() === 5;
  if (friday) {
    const badge = $("friday");
    if (badge) badge.hidden = false;
    const lei = $("lei");
    if (lei) {
      const colors = ["#F7A8C4", "#F5D547", "#F7EEDB", "#E8662A"];
      let svg = "";
      for (let i = 0; i < 22; i++) {
        const a = i / 22 * Math.PI * 2;
        svg += `<circle cx="${(60 + Math.cos(a) * 54).toFixed(1)}" cy="${(60 + Math.sin(a) * 54).toFixed(1)}" r="6.5" fill="${colors[i % colors.length]}" stroke="rgba(0,0,0,.15)"/>`;
      }
      lei.innerHTML = svg;
      lei.hidden = false;
    }
  }

  // ---------- Hawaiian word of the day ----------
  const words = [
    ["huikau", "Mixed up, jumbled, confused. In the best way."],
    ["aloha", "Love and compassion. Also hello, and goodbye."],
    ["mahalo", "Thank you."],
    ["nalu", "A wave; the surf."],
    ["kai", "The sea, or seawater."],
    ["moana", "The open ocean."],
    ["lawaiʻa", "A fisherman. Also, to go fishing."],
    ["hoʻomaha", "To rest or take a break. A vacation."],
    ["mālie", "Calm and quiet, like the sea on a still evening."],
    ["pau", "Finished, all done."],
    ["ʻono", "Delicious."],
    ["makani", "Wind."],
    ["ʻohana", "Family, including the ones you choose."],
    ["kōkua", "Help, given freely."],
    ["pāʻina", "A meal shared with friends; a small party."],
    ["a hui hou", "Until we meet again."]
  ];
  if ($("word-term")) {
    const [term, meaning] = words[Math.floor(Date.now() / 86400000) % words.length];
    $("word-term").textContent = term;
    $("word-meaning").textContent = meaning;
  }
  if ($("year")) $("year").textContent = new Date().getFullYear();

  // ---------- Fishing ----------
  const catches = [
    { id: "mahi", e: "🐟", t: "A mahimahi! Ula said mahalo and let it go.", mood: "yay" },
    { id: "pineapple", e: "🍍", t: "A pineapple. Nobody knows how.", mood: "yay" },
    { id: "slipper", e: "🩴", t: "One slipper. Left foot. Again.", mood: "meh" },
    { id: "hee", e: "🐙", t: "A heʻe. It stole the bait and waved goodbye.", mood: "yay" },
    { id: "coconut", e: "🥥", t: "A coconut with a phone number on it.", mood: "yay" },
    { id: "puffer", e: "🐡", t: "A pufferfish that looked very offended.", mood: "meh" },
    { id: "plumeria", e: "🌺", t: "A plumeria. Ula tucked it behind her ear.", mood: "yay" },
    { id: "boot", e: "🥾", t: "An old boot. A classic.", mood: "meh" },
    { id: "shark", e: "🦈", t: "A tiny shark, more scared than she was.", mood: "yay" },
    { id: "honu", e: "🐢", t: "Just a honu saying hi. Ula waved from a respectful distance.", mood: "yay" },
    { id: "wave", e: "🌊", t: "Nothing but a nice wave. Still counts.", mood: "meh" },
    { id: "cap", e: "🧢", t: "A Fat Boy Fishing Club cap. Ula already has one.", mood: "yay" }
  ];
  const golden = { id: "golden", e: "🐟", t: "A golden ulua! Ula's never seen one this big.", mood: "yay", rare: true };
  const seasonal = {
    halloween: [
      { e: "💀", t: "A skeleton fish. Spooky, but polite.", mood: "meh" },
      { e: "🎃", t: "A jack-o'-lantern, still glowing. Happy Halloween!", mood: "yay" }
    ],
    winter: [{ e: "🎁", t: "A present wrapped in seaweed. Mele Kalikimaka!", mood: "yay" }],
    newyear: [{ e: "🎉", t: "A party popper. Hauʻoli Makahiki Hou!", mood: "yay" }],
    none: []
  };

  const rig = $("rig");
  if (rig) {
    const card = $("catch"), emoji = $("catch-emoji"), text = $("catch-text");
    const hint = $("hint"), ula = $("ula");
    const collection = [...catches, golden];
    let caught = new Set(store.get("huikau-tackle", []));
    let lastText = "", hideTimer, biteTimer;

    const grid = $("tackle-grid"), count = $("tackle-count");
    function renderTackle(fresh) {
      grid.innerHTML = "";
      for (const c of collection) {
        const li = document.createElement("li");
        const have = caught.has(c.id);
        li.className = [c.rare ? "rare" : "", have ? "" : "missing", fresh === c.id ? "fresh" : ""].join(" ").trim();
        const span = document.createElement("span");
        span.setAttribute("aria-hidden", "true");
        span.textContent = c.rare && !have ? "?" : c.e;
        if (c.rare && have) span.className = "golden";
        li.appendChild(span);
        li.title = have ? c.t : c.rare ? "Something rare is out there" : "Not caught yet";
        const sr = document.createElement("span");
        sr.className = "sr-only";
        sr.textContent = have ? c.t : "Not caught yet";
        li.appendChild(sr);
        grid.appendChild(li);
      }
      const n = collection.filter((c) => caught.has(c.id)).length;
      count.textContent = n === collection.length ? `All ${n} caught. Ula's impressed.` : `${n} of ${collection.length} caught`;
      $("tackle-reset").hidden = n === 0;
    }
    renderTackle();

    $("tackle-reset").addEventListener("click", () => {
      caught = new Set();
      store.set("huikau-tackle", []);
      renderTackle();
    });

    function pick() {
      if (params.get("rare") === "1" || Math.random() < 1 / 40) return golden;
      const pool = [...catches, ...seasonal[season], ...seasonal[season]];
      let c;
      do { c = pool[Math.floor(Math.random() * pool.length)]; } while (c.t === lastText);
      return c;
    }

    $("bobber").addEventListener("click", () => {
      const c = pick();
      lastText = c.t;

      clearTimeout(hideTimer);
      clearTimeout(biteTimer);
      card.classList.remove("show");
      rig.classList.remove("bite");
      ula.classList.remove("yay", "meh");
      void rig.offsetWidth;
      rig.classList.add("bite");
      hint.hidden = true;

      biteTimer = setTimeout(() => {
        emoji.textContent = c.e;
        emoji.className = c.rare ? "catch-emoji golden" : "catch-emoji";
        text.textContent = c.t;
        card.classList.toggle("rare", !!c.rare);
        card.classList.add("show");
        rig.classList.remove("bite");
        ula.classList.add(c.mood);
        if (c.id && !caught.has(c.id)) {
          caught.add(c.id);
          store.set("huikau-tackle", [...caught]);
          renderTackle(c.id);
        }
      }, 650);
      hideTimer = setTimeout(() => card.classList.remove("show"), c.rare ? 7000 : 5200);
    });
    ula.addEventListener("animationend", () => ula.classList.remove("yay", "meh"));

    // Three quick taps on Ula also sends the boat out (for phones, which can't type "aloha" easily)
    let taps = [];
    ula.addEventListener("click", () => {
      const t = Date.now();
      taps = taps.filter((x) => t - x < 900).concat(t);
      if (taps.length >= 3) { taps = []; sailBoat(); }
    });
  }

  // ---------- Easter eggs ----------
  function rainPineapples() {
    if (reduceMotion || document.querySelector(".rain")) return;
    const rain = document.createElement("div");
    rain.className = "rain";
    rain.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 40; i++) {
      const p = document.createElement("span");
      p.textContent = "🍍";
      p.style.cssText = `left:${Math.random() * 100}%;font-size:${20 + Math.random() * 26}px;--d:${2.2 + Math.random() * 2}s;--delay:${Math.random() * 1.2}s;--r:${Math.random() * 720 - 360}deg`;
      rain.appendChild(p);
    }
    document.body.appendChild(rain);
    setTimeout(() => rain.remove(), 5000);
  }
  if ($("pine")) $("pine").addEventListener("click", rainPineapples);

  function sailBoat() {
    const boat = $("boat");
    if (!boat || reduceMotion || boat.classList.contains("sail")) return;
    boat.classList.add("sail");
    boat.addEventListener("animationend", (e) => { if (e.target === boat) boat.classList.remove("sail"); });
  }
  let typed = "";
  addEventListener("keydown", (e) => {
    if (e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-5);
    if (typed === "aloha") sailBoat();
  });

  // ---------- Tides at Honolulu Harbor, from NOAA ----------
  async function loadTides() {
    const box = $("tides");
    if (!box) return;
    const d = hstNow();
    const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
    const url = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=huikau.com"
      + `&begin_date=${ymd}&range=24&datum=MLLW&station=1612340&time_zone=lst_ldt&units=english&interval=hilo&format=json`;
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const list = (await res.json()).predictions;
      if (!list || !list.length) return;
      const now = minutesOf(d);
      const ul = $("tides-list");
      let marked = false;
      for (const p of list) {
        const [hh, mm] = p.t.slice(11).split(":").map(Number);
        const m = hh * 60 + mm;
        const li = document.createElement("li");
        const isNext = !marked && m >= now;
        if (isNext) { li.className = "next"; marked = true; }
        else if (m < now) li.className = "past";
        li.innerHTML = `<span>${p.type === "H" ? "High tide" : "Low tide"}${isNext ? '<span class="sr-only"> (next)</span>' : ""}</span>`
          + `<span class="when">${clockTime(m)}</span><span class="height">${Number(p.v).toFixed(1)} ft</span>`;
        ul.appendChild(li);
      }
      box.hidden = false;
    } catch {
      // No tides today; the card stays hidden.
    }
  }
  loadTides();
})();
