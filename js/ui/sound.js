// Ocean sound, generated in the browser.
import { $ } from "../core/dom.js";
import { weather } from "../data/weather.js";

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

export function initSound() {
  const soundBtn = $("sound");
  if (!soundBtn) return;
  let audio = null;
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
