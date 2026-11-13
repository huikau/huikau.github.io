// Small DOM helpers. Nothing here touches the document at import time, so it loads in Node.
export const $ = (id) => document.getElementById(id);

let cachedParams;
export const params = () => (cachedParams ??= new URLSearchParams(globalThis.location?.search ?? ""));

export const scene = () => document.querySelector(".scene");

// Fill a <dl> with [term, description] rows.
export function fillDl(dl, rows) {
  dl.innerHTML = "";
  for (const [k, v] of rows) {
    const dt = document.createElement("dt"), dd = document.createElement("dd");
    dt.textContent = k;
    dd.textContent = v;
    dl.append(dt, dd);
  }
}
