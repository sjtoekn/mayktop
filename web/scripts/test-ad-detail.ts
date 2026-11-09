// Tests for the ad details numbers (patch-ads-details). Run:  npm run test:ad-detail
// Needs no database. Prints "OK" lines and stops with an error message at the first failure.
import assert from "node:assert/strict";
import { barPercents, DAY_MS, dayStart, fillDays, periodInfo, rangeEnd, rangeStart, spread, summarize, weekTrend } from "../src/lib/ad-detail-rules";

function ok(name: string) { console.log("OK  " + name); }
const d = (s: string) => new Date(s + "T00:00:00Z");

// fillDays: every day, zeros included, oldest first
const rows = [{ date: d("2026-11-03"), impressions: 10, clicks: 1 }, { date: d("2026-11-05"), impressions: 4, clicks: 0 }];
const filled = fillDays(rows, d("2026-11-02"), d("2026-11-06"));
assert.equal(filled.length, 5);
assert.deepEqual(filled.map((r) => r.impressions), [0, 10, 0, 4, 0]);
assert.equal(filled[0].date.toISOString(), "2026-11-02T00:00:00.000Z");
ok("fillDays gives one row per day with zeros");

assert.equal(fillDays(rows, d("2026-11-09"), d("2026-11-06")).length, 0);
const long = fillDays([], d("2026-01-01"), d("2026-11-06"), 60);
assert.equal(long.length, 60);
assert.equal(long[59].date.toISOString(), "2026-11-06T00:00:00.000Z");
ok("fillDays keeps only the newest 60 days of a long range");

const dup = fillDays([{ date: new Date("2026-11-03T05:00:00Z"), impressions: 1, clicks: 0 }, { date: new Date("2026-11-03T00:00:00Z"), impressions: 2, clicks: 1 }], d("2026-11-03"), d("2026-11-03"));
assert.equal(dup[0].impressions, 3);
assert.equal(dup[0].clicks, 1);
ok("two rows of the same UTC day are added together");

// range
const now = new Date("2026-11-08T15:00:00Z");
assert.equal(rangeStart(d("2026-10-20"), d("2026-10-22"), now).toISOString(), "2026-10-20T00:00:00.000Z");
assert.equal(rangeStart(null, d("2026-10-22"), now).toISOString(), "2026-10-22T00:00:00.000Z");
assert.equal(rangeStart(null, null, now).getTime(), dayStart(now).getTime() - 29 * DAY_MS);
assert.equal(rangeEnd(null, now).toISOString(), "2026-11-08T00:00:00.000Z");
assert.equal(rangeEnd(d("2026-11-20"), now).toISOString(), "2026-11-08T00:00:00.000Z");
assert.equal(rangeEnd(d("2026-11-01"), now).toISOString(), "2026-11-01T00:00:00.000Z");
ok("the listed range starts at the start date and ends today or at the end date");

// summarize
const days = fillDays(
  [
    { date: d("2026-10-26"), impressions: 50, clicks: 5 },
    { date: d("2026-11-04"), impressions: 30, clicks: 3 },
    { date: d("2026-11-05"), impressions: 30, clicks: 0 },
    { date: d("2026-11-08"), impressions: 40, clicks: 4 },
  ],
  d("2026-10-26"),
  d("2026-11-08"),
);
const s = summarize(days);
assert.equal(s.impressions, 150);
assert.equal(s.clicks, 12);
assert.equal(s.ctr, "8.0%");
assert.equal(s.daysCounted, 14);
assert.equal(s.avgPerDay, 11);
assert.equal(s.bestDay?.date.toISOString(), "2026-10-26T00:00:00.000Z");
assert.equal(s.last7.impressions, 100);
assert.equal(s.before7.impressions, 50);
assert.deepEqual(s.trend, { change: "+100%", kind: "up" });
ok("summarize: totals, click rate, average, best day, last 7 vs before");

const empty = summarize(fillDays([], d("2026-11-01"), d("2026-11-03")));
assert.equal(empty.ctr, "-");
assert.equal(empty.bestDay, null);
assert.equal(empty.trend.kind, "none");
assert.equal(summarize([]).avgPerDay, 0);
ok("summarize: an ad with nothing counted yet");

assert.deepEqual(weekTrend(5, 0), { change: "-", kind: "new" });
assert.deepEqual(weekTrend(5, 10), { change: "-50%", kind: "down" });
assert.deepEqual(weekTrend(10, 10), { change: "0%", kind: "same" });
ok("weekTrend");

// bars
assert.deepEqual(barPercents([0, 0]), [0, 0]);
assert.deepEqual(barPercents([10, 5, 0]), [100, 50, 0]);
assert.equal(barPercents([1000, 1])[1], 4);
ok("barPercents: biggest is 100, a small non-zero value stays visible");

// period
const p = periodInfo(d("2026-11-01"), d("2026-12-01"), now);
assert.deepEqual(p, { total: 30, passed: 8, left: 22 });
assert.equal(periodInfo(null, d("2026-12-01"), now), null);
assert.deepEqual(periodInfo(d("2026-11-20"), d("2026-12-20"), now), { total: 30, passed: 0, left: 30 });
assert.deepEqual(periodInfo(d("2026-09-01"), d("2026-10-01"), now), { total: 30, passed: 30, left: 0 });
ok("periodInfo: day N of M, days left, never out of range");

// spread
assert.deepEqual(spread([]), { count: 0, min: 0, avg: 0, max: 0 });
assert.deepEqual(spread([10, 20, 60]), { count: 3, min: 10, avg: 30, max: 60 });
ok("spread (fair rotation check)");

console.log("All ad detail tests passed.");
