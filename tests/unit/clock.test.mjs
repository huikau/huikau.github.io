import test from "node:test";
import assert from "node:assert/strict";
import { createClock, hstFields, ymd, clockTime, duration, parseTimeParam, parseDateParam } from "../../js/core/clock.js";

const REAL = Date.UTC(2026, 10, 12, 22, 0); // 12:00 noon on 2026-11-12 in Honolulu

test("no params: tracks real time", () => {
  const c = createClock({ search: "", realNow: () => REAL });
  assert.equal(c.now(), REAL);
  assert.ok(c.isLive);
  const f = c.fields();
  assert.deepEqual([f.year, f.month, f.day, f.hour, f.minute, f.dow], [2026, 11, 12, 12, 0, 4]);
});

test("HST is UTC-10: 02:00 UTC is 4 pm the day before", () => {
  const f = hstFields(Date.UTC(2026, 0, 2, 2, 0));
  assert.deepEqual([f.year, f.month, f.day, f.hour], [2026, 1, 1, 16]);
  assert.equal(ymd(Date.UTC(2026, 0, 2, 2, 0)), "20260101");
});

test("?t= picks the Honolulu time of day on the current Honolulu date", () => {
  const c = createClock({ search: "?t=06:40", realNow: () => REAL });
  const f = c.fields();
  assert.deepEqual([f.year, f.month, f.day, f.hour, f.minute, f.second], [2026, 11, 12, 6, 40, 0]);
  assert.equal(c.minutes(), 400);
  assert.ok(!c.isLive);
});

test("?t= keeps ticking from the chosen time", () => {
  let real = REAL;
  const c = createClock({ search: "?t=22:00", realNow: () => real });
  assert.equal(c.minutes(), 22 * 60);
  real += 5 * 60e3;
  assert.equal(c.minutes(), 22 * 60 + 5);
});

test("?t= uses the Honolulu date, not the UTC date", () => {
  // 08:00 UTC on the 13th is 10 pm on the 12th in Honolulu
  const c = createClock({ search: "?t=22:30", realNow: () => Date.UTC(2026, 10, 13, 8, 0) });
  assert.equal(c.ymd(), "20261112");
  assert.equal(c.minutes(), 22 * 60 + 30);
});

test("?date= changes the day and keeps the time of day", () => {
  const c = createClock({ search: "?date=2026-10-28", realNow: () => REAL });
  const f = c.fields();
  assert.deepEqual([f.year, f.month, f.day, f.hour, f.minute], [2026, 10, 28, 12, 0]);
});

test("?date= and ?t= together", () => {
  const c = createClock({ search: "?date=2026-12-31&t=23:59", realNow: () => REAL });
  const f = c.fields();
  assert.deepEqual([f.year, f.month, f.day, f.hour, f.minute], [2026, 12, 31, 23, 59]);
  assert.equal(c.hst().getUTCDay(), 4); // a Thursday
});

test("bad ?t= and ?date= are ignored", () => {
  for (const q of ["?t=25:00", "?t=noon", "?t=12:75", "?date=2026-02-30", "?date=tomorrow", "?t=&date="]) {
    const c = createClock({ search: q, realNow: () => REAL });
    assert.equal(c.now(), REAL, q);
  }
  assert.equal(parseTimeParam("9:05"), 545);
  assert.equal(parseTimeParam("24:00"), null);
  assert.deepEqual(parseDateParam("2026-02-28"), { y: 2026, mo: 2, d: 28 });
  assert.equal(parseDateParam("2026-02-30"), null);
});

test("setOffset, setHstMinutes and live()", () => {
  const c = createClock({ search: "?t=06:00", realNow: () => REAL });
  let changes = 0;
  const off = c.onChange(() => changes++);
  c.setOffset(3600e3);
  assert.equal(c.now(), REAL + 3600e3);
  assert.equal(c.minutes(), 13 * 60); // noon + 1 h; setOffset is relative to real time
  c.setHstMinutes(18 * 60 + 15);
  assert.equal(c.minutes(), 18 * 60 + 15);
  assert.equal(c.fields().day, 12);
  c.live();
  assert.equal(c.now(), REAL);
  assert.ok(c.isLive);
  assert.equal(changes, 3);
  off();
  c.setOffset(0);
  assert.equal(changes, 3);
});

test("formatting helpers", () => {
  assert.equal(clockTime(0), "12:00 am");
  assert.equal(clockTime(12 * 60), "12:00 pm");
  assert.equal(clockTime(6 * 60 + 31.7), "6:31 am");
  assert.equal(clockTime(17 * 60 + 58), "5:58 pm");
  assert.equal(duration(45), "45 min");
  assert.equal(duration(120), "2 hr");
  assert.equal(duration(135.4), "2 hr 15 min");
});
