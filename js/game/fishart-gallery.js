// Dev-only: fills #species-gallery in styleguide.html with every species at 48, 96 and 240 px plus a silhouette.
import { species } from "../data/species.js";
import { fishSVG } from "./fishart.js";

const host = document.getElementById("species-gallery");
if (host) {
  const style = document.createElement("style");
  style.textContent = `
    #species-gallery .sg-fish{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:16px}
    #species-gallery .sg-card{background:#F7EEDB;color:#0B2226;border:2px solid #0B2226;border-radius:12px;padding:12px}
    #species-gallery .sg-card h3{margin:0;font-size:1rem}
    #species-gallery .sg-card p{margin:2px 0 8px;font-size:.85rem}
    #species-gallery .sg-row{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap}
    #species-gallery .sg-dark{background:#164E56;border-radius:8px;padding:4px}`;
  host.append(style);
  const grid = document.createElement("div");
  grid.className = "sg-fish";
  for (const s of species) {
    const card = document.createElement("article");
    card.className = "sg-card";
    const title = s.hawaiian ? `${s.hawaiian} (${s.english})` : s.english;
    card.innerHTML = `<h3>${title}</h3><p>${s.id} · ${s.rarity} · ${s.habitat}</p>
      <div class="sg-row">${[48, 96, 240].map((n) => fishSVG(s, { size: n, title: n === 96 ? title : undefined })).join("")}
      <span>${fishSVG(s, { size: 96, silhouette: true })}</span>
      <span class="sg-dark">${fishSVG(s, { size: 48, silhouette: true, color: "#BFE5EE", opacity: .6 })}</span></div>`;
    grid.append(card);
  }
  host.append(grid);
}
