// The only source of display time.
//
// Real time comes from Date.now() (so tests that freeze Date work). On top of that:
//   ?t=HH:MM          Honolulu wall-clock time, on the current (or ?date=) Honolulu day
//   ?date=YYYY-MM-DD  Honolulu calendar day (keeps the real time of day unless ?t is also given)
//   setOffset(ms)     shift the clock; live() puts it back to real time (used by the Time Machine)
// Honolulu is UTC-10 all year (no daylight saving).
export const HST_OFFSET_MS = 10 * 3600e3;

const pad = (n) => String(n).padStart(2, "0");

/** Honolulu wall-clock fields for an epoch-ms instant. */
export function hstFields(ms) {
  const d = new Date(ms - HST_OFFSET_MS); // read with getUTC*
  return {
    date: d, year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), dow: d.getUTCDay(),
    hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds(),
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes()
  };
}

/** 'YYYYMMDD' for the Honolulu day of `ms`. */
export const ymd = (ms) => { const f = hstFields(ms); return `${f.year}${pad(f.month)}${pad(f.day)}`; };

/** Epoch ms for a Honolulu wall-clock moment. */
export const hstToEpoch = (year, month, day, minutes = 0) => Date.UTC(year, month - 1, day) + minutes * 60e3 + HST_OFFSET_MS;

export function parseTimeParam(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s || "");
  if (!m) return null;
  const h = +m[1], min = +m[2];
  return h < 24 && min < 60 ? h * 60 + min : null;
}

export function parseDateParam(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const check = new Date(Date.UTC(y, mo - 1, d));
  return check.getUTCFullYear() === y && check.getUTCMonth() === mo - 1 && check.getUTCDate() === d ? { y, mo, d } : null;
}

export const clockTime = (m) => {
  const h = Math.floor(m / 60) % 24, mm = String(Math.floor(m % 60)).padStart(2, "0");
  return `${h % 12 || 12}:${mm} ${h < 12 ? "am" : "pm"}`;
};

export const duration = (mins) => {
  mins = Math.round(mins);
  const h = Math.floor(mins / 60), m = mins % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
};

export function createClock({ search = globalThis.location?.search ?? "", realNow = () => Date.now() } = {}) {
  const q = new URLSearchParams(search);
  const listeners = new Set();
  let offset = 0;

  const tMin = parseTimeParam(q.get("t"));
  const dateP = parseDateParam(q.get("date"));
  if (tMin != null || dateP) {
    const real = realNow(), f = hstFields(real);
    const [y, mo, d] = dateP ? [dateP.y, dateP.mo, dateP.d] : [f.year, f.month, f.day];
    const minutesOfDay = tMin != null ? tMin : f.minutes + f.second / 60;
    offset = hstToEpoch(y, mo, d, minutesOfDay) - real;
  }

  const emit = () => { for (const fn of [...listeners]) fn(); };
  const clock = {
    /** Epoch ms to display. */
    now: () => realNow() + offset,
    /** Honolulu fields for now (or for `ms`). */
    fields: (ms = clock.now()) => hstFields(ms),
    /** A Date to read with getUTC* methods as Honolulu wall-clock. */
    hst: () => new Date(clock.now() - HST_OFFSET_MS),
    /** Minutes after Honolulu midnight (whole minutes). */
    minutes: () => hstFields(clock.now()).minutes,
    /** Minutes after Honolulu midnight including seconds. */
    minutesExact: () => { const f = hstFields(clock.now()); return f.minutes + f.second / 60; },
    ymd: () => ymd(clock.now()),
    get offset() { return offset; },
    get isLive() { return offset === 0; },
    setOffset(ms) { offset = Number(ms) || 0; emit(); },
    /** Jump to a Honolulu time of day (minutes after midnight) on the currently displayed day. */
    setHstMinutes(minutes) {
      const f = hstFields(clock.now());
      offset = hstToEpoch(f.year, f.month, f.day, minutes) - realNow();
      emit();
    },
    live() { offset = 0; emit(); },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
  return clock;
}

export const clock = createClock();
