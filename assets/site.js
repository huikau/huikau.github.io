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

  const weather = { text: "", rain: false, clouds: 0, calm: 1, wind: null };
  let redrawSurf = () => {}; // set once the surf report loads, so a later wind reading can update it

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
    const toSunset = sun.set - m;
    if (toSunset > 0 && toSunset <= 5) next = "Watch the horizon for the green flash.";
    clock.textContent = `${clockTime(m)} in Honolulu. ${weather.text ? weather.text + ". " : ""}${next}`;
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
    // catches saved before the basket was renamed lived under "huikau-tackle"
    let caught = new Set(store.get("huikau-basket", store.get("huikau-tackle", [])));
    let lastText = "", hideTimer, biteTimer;

    const grid = $("basket-grid"), count = $("basket-count");
    function renderBasket(fresh) {
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
      $("basket-reset").hidden = n === 0;
    }
    renderBasket();

    // Glide down just far enough to show the basket, then pop the new catch in
    function revealBasket(done) {
      const overflow = $("basket").getBoundingClientRect().bottom + 24 - innerHeight;
      if (overflow <= 0) { done(); return; }
      const start = scrollY;
      if (reduceMotion) { scrollTo(0, start + overflow); done(); return; }
      const t0 = performance.now(), dur = 1600;
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        scrollTo(0, start + overflow);
        done();
      };
      const step = (t) => {
        if (finished) return;
        const k = Math.min(1, (t - t0) / dur);
        const ease = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        scrollTo(0, start + overflow * ease);
        if (k < 1) requestAnimationFrame(step); else finish();
      };
      requestAnimationFrame(step);
      // background tabs can pause animation frames; make sure the glide always lands
      setTimeout(finish, dur + 400);
    }

    $("basket-reset").addEventListener("click", () => {
      caught = new Set();
      store.set("huikau-basket", []);
      renderBasket();
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
          store.set("huikau-basket", [...caught]);
          // the basket isn't redrawn until the glide arrives, so the new catch pops in on screen
          setTimeout(() => revealBasket(() => renderBasket(c.id)), 700);
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

  // ---------- Rain, drawn drop by drop ----------
  const rain = (() => {
    const host = $("showers");
    if (!host) return { set() {} };
    const canvas = document.createElement("canvas");
    host.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, level = 0, drops = [], ripples = [], raf = 0, last = 0, onScreen = true;

    const seaTop = () => h * (1 - .28);
    function makeDrop(anywhere) {
      const z = .35 + Math.random() * .65; // depth: 1 is closest to the viewer
      return {
        x: Math.random() * (w + 300) - 200,
        y: anywhere ? Math.random() * h : -20 - Math.random() * h * .25,
        z,
        len: 10 + 18 * z,
        speed: 560 + 760 * z,
        // far drops meet the water near the horizon, close ones further down
        land: seaTop() + (h - seaTop()) * Math.min(.95, .06 + .8 * (z - .35) / .65 + Math.random() * .08)
      };
    }
    function resize() {
      const dpr = Math.min(2, devicePixelRatio || 1);
      w = host.clientWidth;
      h = host.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.round(w * h / 6500 * level);
      while (drops.length < target) drops.push(makeDrop(true));
      drops.length = target;
    }
    function draw(dt) {
      ctx.clearRect(0, 0, w, h);
      const slant = .07 + (1 - weather.calm) * .45; // windier rain falls at more of an angle
      const rgb = scene.dataset.sky === "day" ? "70, 96, 128" : "228, 238, 255"; // white drops vanish against a daytime sky
      ctx.lineCap = "round";
      for (const d of drops) {
        d.y += d.speed * dt;
        d.x += d.speed * slant * dt;
        if (d.y >= d.land) {
          if (ripples.length < 140) ripples.push({ x: d.x, y: d.land, z: d.z, age: 0 });
          Object.assign(d, makeDrop(false));
          continue;
        }
        const tailX = d.x - d.len * slant, tailY = d.y - d.len;
        const g = ctx.createLinearGradient(d.x, d.y, tailX, tailY);
        g.addColorStop(0, `rgba(${rgb}, ${.18 + .45 * d.z})`);
        g.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.strokeStyle = g;
        ctx.lineWidth = .7 + .9 * d.z;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
      }
      ctx.lineWidth = .8;
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.age += dt;
        const k = r.age / .5;
        if (k >= 1) { ripples.splice(i, 1); continue; }
        const rx = 1.5 + 9 * r.z * k;
        ctx.strokeStyle = `rgba(228, 238, 255, ${(1 - k) * .45 * r.z})`;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, rx, rx * .28, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    function frame(t) {
      const dt = last ? Math.min(.05, (t - last) / 1000) : .016;
      last = t;
      draw(dt);
      raf = requestAnimationFrame(frame);
    }
    function run() {
      const want = level > 0 && onScreen && !document.hidden && !reduceMotion;
      if (want && !raf) { last = 0; raf = requestAnimationFrame(frame); }
      if (!want && raf) { cancelAnimationFrame(raf); raf = 0; }
    }
    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; run(); }).observe(host);
    document.addEventListener("visibilitychange", run);
    addEventListener("resize", () => { if (level) resize(); });

    return {
      set(newLevel) {
        level = newLevel;
        host.hidden = !level;
        if (!level) { run(); return; }
        resize();
        if (reduceMotion) draw(0); // a still frame of rain, no movement
        run();
      }
    };
  })();

  // ---------- Weather in Honolulu, from the National Weather Service ----------
  function applyWeather() {
    const clouds = $("clouds");
    // light rain and drizzle fall softer, heavy rain and thunderstorms harder
    rain.set(!weather.rain ? 0 : /heavy|thunder/i.test(weather.text) ? 1.7 : /light|drizzle/i.test(weather.text) ? .7 : 1);
    if (clouds) {
      clouds.innerHTML = "";
      const n = [0, 1, 3, 4, 6][weather.clouds] || 0;
      for (let i = 0; i < n; i++) {
        const c = document.createElement("span");
        const dur = 110 + Math.random() * 90;
        c.style.cssText = `top:${8 + Math.random() * 34}%;--s:${(.55 + Math.random() * .8).toFixed(2)};animation-duration:${dur}s;animation-delay:${-Math.random() * dur}s`;
        clouds.appendChild(c);
      }
    }
    scene.style.setProperty("--calm", weather.calm);
    updateSky();
  }

  async function loadWeather() {
    const forced = params.get("weather");
    const presets = {
      clear: { text: "Clear", rain: false, clouds: 0, calm: 1 },
      cloudy: { text: "Mostly cloudy", rain: false, clouds: 3, calm: 1 },
      rain: { text: "Light rain", rain: true, clouds: 4, calm: .9 },
      downpour: { text: "Heavy rain", rain: true, clouds: 4, calm: .6 },
      windy: { text: "Breezy", rain: false, clouds: 2, calm: .45 }
    };
    if (presets[forced]) { Object.assign(weather, presets[forced]); applyWeather(); return; }
    try {
      const res = await fetch("https://api.weather.gov/stations/PHNL/observations/latest", { headers: { Accept: "application/geo+json" } });
      if (!res.ok) return;
      const p = (await res.json()).properties;
      const raw = (p.presentWeather || []).map((w) => w.rawString || "").join(" ");
      const desc = p.textDescription || "";
      weather.rain = /RA|DZ|SH|TS/.test(raw) || /rain|shower|drizzle|thunder/i.test(desc);
      const amounts = { CLR: 0, SKC: 0, FEW: 1, SCT: 2, BKN: 3, OVC: 4, VV: 4 };
      weather.clouds = Math.max(0, ...(p.cloudLayers || []).map((c) => amounts[c.amount] ?? 0));
      if (weather.rain) weather.clouds = Math.max(weather.clouds, 3);
      const wind = p.windSpeed && p.windSpeed.value; // km/h
      const windFrom = p.windDirection && p.windDirection.value;
      weather.wind = wind == null ? null : { mph: Math.round(wind / 1.609), from: windFrom };
      redrawSurf();
      if (wind != null) weather.calm = Math.min(1.15, Math.max(.45, 1 - (wind - 12) / 50));
      const c = p.temperature && p.temperature.value;
      weather.text = [desc && desc.charAt(0) + desc.slice(1).toLowerCase(), c != null && `${Math.round(c * 9 / 5 + 32)}°F`].filter(Boolean).join(", ");
      applyWeather();
    } catch {
      // No weather; the sky stays clear.
    }
  }
  loadWeather();
  setInterval(loadWeather, 20 * 60000);

  // ---------- The real moon phase ----------
  const synodic = 29.530588853;
  function moonPhase() { // 0 new, .5 full
    if (params.has("moon")) return Math.min(.999, Math.max(0, Number(params.get("moon")) || 0));
    const knownNew = Date.UTC(2000, 0, 6, 18, 14);
    return (((Date.now() - knownNew) / 864e5 / synodic) % 1 + 1) % 1;
  }
  const moonLit = $("moon-lit");
  if (moonLit) {
    const phase = moonPhase();
    const r = 24, cx = 27, top = 3, bottom = 51;
    const rx = (Math.abs(Math.cos(2 * Math.PI * phase)) * r).toFixed(2);
    // Lit limb on the right while waxing, on the left while waning; the terminator bulges toward the dark side for a gibbous moon.
    const d = phase < .5
      ? `M${cx} ${top} A${r} ${r} 0 0 1 ${cx} ${bottom} A${rx} ${r} 0 0 ${phase < .25 ? 0 : 1} ${cx} ${top} Z`
      : `M${cx} ${top} A${r} ${r} 0 0 0 ${cx} ${bottom} A${rx} ${r} 0 0 ${phase < .75 ? 0 : 1} ${cx} ${top} Z`;
    moonLit.setAttribute("d", d);
  }

  // ---------- Green flash at the moment of sunset ----------
  const flash = $("greenflash");
  if (flash && !reduceMotion) {
    setInterval(() => {
      const d = hstNow();
      const m = minutesOf(d) + d.getUTCSeconds() / 60;
      const clearSky = !weather.rain && weather.clouds < 4;
      if (params.get("flash") === "1" || (Math.abs(m - sunTimes(d).set) < 1.5 && clearSky)) {
        flash.classList.remove("go");
        void flash.offsetWidth;
        flash.classList.add("go");
      }
    }, 4000);
  }

  // ---------- Humpback whales, December through April ----------
  const whale = $("whale");
  const whaleTest = params.get("whale") === "1";
  if (whale && !reduceMotion && (whaleTest || [12, 1, 2, 3, 4].includes(month))) {
    const surface = () => {
      whale.style.left = `${22 + Math.random() * 56}%`;
      whale.className = `whale ${Math.random() < .5 ? "spouting" : "fluke-up"}`;
      setTimeout(() => { whale.className = "whale"; }, 5200);
      setTimeout(surface, whaleTest ? 7000 : 30000 + Math.random() * 50000);
    };
    setTimeout(surface, whaleTest ? 1500 : 8000 + Math.random() * 20000);
  }

  // ---------- Shooting stars after dark; click one to make a wish ----------
  const shooting = $("shooting"), wish = $("wish");
  if (shooting && !reduceMotion) {
    const wishes = [
      "Wish made. Ula promises not to tell.",
      "Wish made. May your next cast be a big one.",
      "Wish made. Calm seas and a full cooler.",
      "Wish made. Watch for it on the next tide.",
      "You caught a shooting star. That's rarer than a golden ulua."
    ];
    let wishTimer;
    const launch = () => {
      const sky = scene.dataset.sky;
      if (sky === "night" || sky === "dusk" || params.get("shoot") === "1") {
        const s = document.createElement("button");
        s.type = "button";
        s.className = "shoot";
        s.tabIndex = -1;
        s.style.left = `${5 + Math.random() * 60}%`;
        s.style.top = `${4 + Math.random() * 40}%`;
        s.addEventListener("click", () => {
          wish.textContent = wishes[Math.floor(Math.random() * wishes.length)];
          wish.classList.add("show");
          clearTimeout(wishTimer);
          wishTimer = setTimeout(() => wish.classList.remove("show"), 4500);
          s.remove();
        });
        s.addEventListener("animationend", () => s.remove());
        shooting.appendChild(s);
      }
      setTimeout(launch, params.get("shoot") === "1" ? 2500 : 9000 + Math.random() * 14000);
    };
    setTimeout(launch, 4000);
  }

  // ---------- An ʻiwa gliding over in daylight ----------
  const iwa = $("iwa");
  if (iwa && !reduceMotion) {
    const iwaTest = params.get("iwa") === "1";
    const fly = () => {
      if (scene.dataset.sky !== "night" || iwaTest) {
        iwa.style.top = `${10 + Math.random() * 22}%`;
        iwa.classList.remove("glide");
        void iwa.getBoundingClientRect();
        iwa.classList.add("glide");
      }
      setTimeout(fly, iwaTest ? 28000 : 40000 + Math.random() * 50000);
    };
    iwa.addEventListener("animationend", (e) => { if (e.animationName === "glide") iwa.classList.remove("glide"); });
    setTimeout(fly, iwaTest ? 800 : 12000 + Math.random() * 25000);
  }

  // ---------- Ocean sound, generated in the browser ----------
  const soundBtn = $("sound");
  if (soundBtn) {
    let audio = null;
    const makeSurf = (ctx) => {
      // 12 seconds of brown noise shaped into two swells, quiet at the loop point so it repeats cleanly
      const seconds = 12, rate = ctx.sampleRate, len = seconds * rate;
      const buf = ctx.createBuffer(2, len, rate);
      for (let ch = 0; ch < 2; ch++) {
        const data = buf.getChannelData(ch);
        let last = 0;
        for (let i = 0; i < len; i++) {
          const t = i / rate;
          last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
          const swell = Math.max(
            Math.exp(-((t - 3.2) ** 2) / 2.2),
            0.75 * Math.exp(-((t - 8.6) ** 2) / 1.8)
          );
          data[i] = last * 3.2 * (0.04 + 0.96 * swell);
        }
      }
      return buf;
    };
    soundBtn.addEventListener("click", async () => {
      const on = soundBtn.getAttribute("aria-pressed") !== "true";
      soundBtn.setAttribute("aria-pressed", String(on));
      if (on) {
        if (!audio) {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const src = ctx.createBufferSource();
          src.buffer = makeSurf(ctx);
          src.loop = true;
          const filter = ctx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.value = 900;
          const gain = ctx.createGain();
          gain.gain.value = 0;
          src.connect(filter).connect(gain).connect(ctx.destination);
          src.start();
          audio = { ctx, gain };
        }
        await audio.ctx.resume();
        const level = weather.calm < .7 ? .75 : .55;
        audio.gain.gain.setTargetAtTime(level, audio.ctx.currentTime, .6);
      } else if (audio) {
        audio.gain.gain.setTargetAtTime(0, audio.ctx.currentTime, .3);
        setTimeout(() => { if (soundBtn.getAttribute("aria-pressed") !== "true") audio.ctx.suspend(); }, 1500);
      }
    });
  }

  // ---------- Surf report off Honolulu, from Open-Meteo's marine forecast ----------
  const compass = (deg) => deg == null ? "" :
    ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][Math.round(deg / 22.5) % 16];
  async function loadSurf() {
    const box = $("surf");
    if (!box) return;
    try {
      const res = await fetch("https://marine-api.open-meteo.com/v1/marine?latitude=21.26&longitude=-157.84"
        + "&current=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,sea_surface_temperature"
        + "&length_unit=imperial&timezone=Pacific%2FHonolulu");
      if (!res.ok) return;
      const c = (await res.json()).current;
      if (!c || c.wave_height == null) return;
      const h = c.wave_height;
      $("surf-call").textContent =
        h < 1 ? "Flat. A good day for fishing." :
        h < 3 ? "Small and friendly." :
        h < 6 ? "Fun-size surf." :
        h < 10 ? "Solid. Experienced surfers only." :
        "Big. Watch from the beach.";
      const rows = [["Waves", `${h.toFixed(1)} ft from the ${compass(c.wave_direction)}`]];
      if (c.swell_wave_height != null) {
        rows.push(["Swell", `${c.swell_wave_height.toFixed(1)} ft at ${Math.round(c.swell_wave_period)} s from the ${compass(c.swell_wave_direction)}`]);
      }
      if (c.sea_surface_temperature != null) rows.push(["Water", `${Math.round(c.sea_surface_temperature * 9 / 5 + 32)}°F`]);
      const stats = $("surf-stats");
      const draw = () => {
        stats.innerHTML = "";
        const all = rows.slice();
        const hasWind = !!(weather.wind && weather.wind.mph != null);
        $("surf-wind-source").hidden = !hasWind;
        if (hasWind) {
          all.push(["Wind", weather.wind.mph < 2 ? "Calm" : `${weather.wind.mph} mph${weather.wind.from != null ? ` from the ${compass(weather.wind.from)}` : ""}`]);
        }
        for (const [k, v] of all) {
          const dt = document.createElement("dt"), dd = document.createElement("dd");
          dt.textContent = k;
          dd.textContent = v;
          stats.append(dt, dd);
        }
      };
      draw();
      redrawSurf = draw;
      box.hidden = false;
    } catch {
      // No surf data; the card stays hidden.
    }
  }
  loadSurf();
  setInterval(loadSurf, 30 * 60000);

  // ---------- Today on the water: sun, moon, and Ula's pick for when to go out ----------
  let todaysTides = []; // filled in by loadTides: [{ m, high }]

  function ulasPick(now, sun) {
    // Anglers like moving water around a tide change, best of all near sunrise or sunset.
    const daylight = (m) => m >= sun.rise - 45 && m <= sun.set + 45;
    const upcoming = todaysTides.filter((t) => t.m >= now - 20 && daylight(t.m));
    if (upcoming.length) {
      const nearSun = (m) => Math.min(Math.abs(m - sun.rise), Math.abs(m - sun.set));
      const best = upcoming.reduce((a, b) => (nearSun(b.m) < nearSun(a.m) ? b : a));
      let when = "";
      if (Math.abs(best.m - sun.set) <= 75) when = best.m <= sun.set ? ", just before sunset" : ", right after sunset";
      else if (Math.abs(best.m - sun.rise) <= 75) when = best.m <= sun.rise ? ", just before sunrise" : ", right after sunrise";
      const lead = best.m <= now + 10 ? "Ula's out now for" : "Ula's heading out for";
      return `${lead} the ${clockTime(best.m)} ${best.high ? "high" : "low"} tide${when}.`;
    }
    if (now < sun.rise) return `Ula's heading out at sunrise, ${clockTime(sun.rise)}.`;
    if (now < sun.set - 60) return `Ula's heading out for the evening bite, around ${clockTime(sun.set - 60)}.`;
    if (now < sun.set) return "Ula's out now for the sunset bite.";
    return `Ula's done for today. She'll be back out at sunrise, around ${clockTime(sun.rise)}.`;
  }

  function renderToday() {
    const box = $("today");
    if (!box) return;
    const d = hstNow(), now = minutesOf(d), sun = sunTimes(d);
    $("today-pick").textContent = ulasPick(now, sun);

    const p = moonPhase();
    const name = p < .034 || p > .966 ? "New moon" : p < .216 ? "Waxing crescent" : p < .284 ? "First quarter"
      : p < .466 ? "Waxing gibbous" : p < .534 ? "Full moon" : p < .716 ? "Waning gibbous" : p < .784 ? "Last quarter" : "Waning crescent";
    const lit = Math.round((1 - Math.cos(2 * Math.PI * p)) / 2 * 100);
    const daysTo = (target) => ((target - p) % 1 + 1) % 1 * synodic;
    const [nextName, days] = daysTo(.5) < daysTo(1) ? ["Full moon", daysTo(.5)] : ["New moon", daysTo(1)];
    const inDays = days < 1 ? "tonight" : days < 2 ? "tomorrow" : `in ${Math.round(days)} days`;

    const stats = $("today-stats");
    stats.innerHTML = "";
    for (const [k, v] of [
      ["Sunrise", clockTime(sun.rise)],
      ["Sunset", clockTime(sun.set)],
      ["Moon", `${name}, ${lit}% lit`],
      ["Coming up", `${nextName} ${inDays}`]
    ]) {
      const dt = document.createElement("dt"), dd = document.createElement("dd");
      dt.textContent = k;
      dd.textContent = v;
      stats.append(dt, dd);
    }
  }
  renderToday();
  setInterval(renderToday, 60000);

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
        todaysTides.push({ m, high: p.type === "H" });
        const li = document.createElement("li");
        const isNext = !marked && m >= now;
        if (isNext) { li.className = "next"; marked = true; }
        else if (m < now) li.className = "past";
        li.innerHTML = `<span>${p.type === "H" ? "High tide" : "Low tide"}${isNext ? '<span class="sr-only"> (next)</span>' : ""}</span>`
          + `<span class="when">${clockTime(m)}</span><span class="height">${Number(p.v).toFixed(1)} ft</span>`;
        ul.appendChild(li);
      }
      box.hidden = false;
      renderToday();
    } catch {
      // No tides today; the card stays hidden.
    }
  }
  loadTides();
})();
