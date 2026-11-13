// Seasons and Aloha Friday.
import { $, params, scene } from "../core/dom.js";

/** Season for an HST Date (read with getUTC*); `override` is the ?season= value. */
export function detectSeason(hst, override) {
  const month = hst.getUTCMonth() + 1, date = hst.getUTCDate();
  let season = "none";
  if (month === 10 && date >= 15) season = "halloween";
  else if (month === 12 && date <= 30) season = "winter";
  else if ((month === 12 && date === 31) || (month === 1 && date === 1)) season = "newyear";
  if (["halloween", "winter", "newyear", "none"].includes(override)) season = override;
  return season;
}

export const isFriday = (hst, override) => override != null ? override === "1" : hst.getUTCDay() === 5;

export function initSeasons(clock) {
  const today = clock.hst();
  const p = params();
  const season = detectSeason(today, p.get("season"));
  document.body.classList.add(`season-${season}`);
  const sceneEl = scene();

  if (season === "winter") {
    const lights = $("lights");
    const draw = () => {
      const w = sceneEl.clientWidth, span = 300, sag = 34, colors = ["#F5A623", "#E8662A", "#2DD4C8", "#F7EEDB", "#E8484A"];
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

  const friday = isFriday(today, p.has("friday") ? p.get("friday") : null);
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
  return { season, friday, month: today.getUTCMonth() + 1 };
}
