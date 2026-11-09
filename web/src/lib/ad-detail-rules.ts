// Ad details (patch-ads-details): the numbers of ONE ad, worked out from its per-day totals.
// Pure functions, no database, so they can be tested: npm run test:ad-detail
// Nothing here knows anything about visitors: only per-ad per-day totals exist (ADS_PLAN decision 3).
import { ctrText } from "@/lib/ad-review-rules";

export const DAY_MS = 24 * 60 * 60 * 1000;
/** The most days the details screen lists (the chart and the table). Older days still count in the totals. */
export const DETAIL_MAX_DAYS = 60;

export type DayRow = { date: Date; impressions: number; clicks: number };

/** UTC midnight of a moment. */
export function dayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * One row for EVERY UTC day from `from` to `to` (both included, zeros where nothing was counted), oldest first.
 * If the range is longer than `maxDays`, only the newest `maxDays` days are kept.
 */
export function fillDays(rows: DayRow[], from: Date, to: Date, maxDays: number = DETAIL_MAX_DAYS): DayRow[] {
  const end = dayStart(to).getTime();
  let start = dayStart(from).getTime();
  if (start > end) return [];
  if ((end - start) / DAY_MS + 1 > maxDays) start = end - (maxDays - 1) * DAY_MS;
  const byDay = new Map<number, DayRow>();
  for (const r of rows) {
    const key = dayStart(r.date).getTime();
    const have = byDay.get(key);
    byDay.set(key, have ? { date: have.date, impressions: have.impressions + r.impressions, clicks: have.clicks + r.clicks } : { date: new Date(key), impressions: r.impressions, clicks: r.clicks });
  }
  const out: DayRow[] = [];
  for (let t = start; t <= end; t += DAY_MS) out.push(byDay.get(t) ?? { date: new Date(t), impressions: 0, clicks: 0 });
  return out;
}

/** Where the listed range should start: the first day the ad could have been shown (start date, else the first counted day), else 29 days ago. */
export function rangeStart(startDate: Date | null, firstStatDay: Date | null, now: Date): Date {
  if (startDate) return dayStart(startDate);
  if (firstStatDay) return dayStart(firstStatDay);
  return new Date(dayStart(now).getTime() - 29 * DAY_MS);
}

/** The last day of the listed range: the end date if it is already past, else today. */
export function rangeEnd(endDate: Date | null, now: Date): Date {
  const today = dayStart(now);
  if (endDate && dayStart(endDate).getTime() < today.getTime()) return dayStart(endDate);
  return today;
}

export type Trend = { change: string; kind: "up" | "down" | "same" | "new" | "none" };

/** "+12%" / "-5%" / "same" compared with the 7 days before. `new` = the ad had nothing before, `none` = nothing in both weeks. */
export function weekTrend(thisWeek: number, lastWeek: number): Trend {
  if (thisWeek === 0 && lastWeek === 0) return { change: "-", kind: "none" };
  if (lastWeek === 0) return { change: "-", kind: "new" };
  const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  if (pct === 0) return { change: "0%", kind: "same" };
  return { change: `${pct > 0 ? "+" : ""}${pct}%`, kind: pct > 0 ? "up" : "down" };
}

export type AdSummary = {
  impressions: number;
  clicks: number;
  ctr: string;
  daysCounted: number; // days in the range
  avgPerDay: number; // impressions per day, rounded
  bestDay: DayRow | null; // the day with the most impressions (earliest on a tie); null when nothing was shown
  last7: { impressions: number; clicks: number };
  before7: { impressions: number; clicks: number };
  trend: Trend;
};

/** Totals of the listed days. `days` must be oldest first. */
export function summarize(days: DayRow[]): AdSummary {
  const impressions = days.reduce((n, d) => n + d.impressions, 0);
  const clicks = days.reduce((n, d) => n + d.clicks, 0);
  let bestDay: DayRow | null = null;
  for (const d of days) if (d.impressions > 0 && (!bestDay || d.impressions > bestDay.impressions)) bestDay = d;
  const sum = (list: DayRow[]) => ({ impressions: list.reduce((n, d) => n + d.impressions, 0), clicks: list.reduce((n, d) => n + d.clicks, 0) });
  const last7 = sum(days.slice(-7));
  const before7 = sum(days.slice(-14, -7));
  return {
    impressions,
    clicks,
    ctr: ctrText(impressions, clicks),
    daysCounted: days.length,
    avgPerDay: days.length === 0 ? 0 : Math.round(impressions / days.length),
    bestDay,
    last7,
    before7,
    trend: weekTrend(last7.impressions, before7.impressions),
  };
}

/** Bar heights in whole percent (0..100) for a chart; the biggest value is 100, a non-zero value is never below 4 so it stays visible. */
export function barPercents(values: number[]): number[] {
  const max = Math.max(0, ...values);
  if (max === 0) return values.map(() => 0);
  return values.map((v) => (v <= 0 ? 0 : Math.max(4, Math.round((v / max) * 100))));
}

export type PeriodInfo = { total: number; passed: number; left: number } | null;

/** How far a running ad is: day N of M, and how many days are left. null when the ad has no start and end date. */
export function periodInfo(startDate: Date | null, endDate: Date | null, now: Date): PeriodInfo {
  if (!startDate || !endDate) return null;
  const s = dayStart(startDate).getTime();
  const e = dayStart(endDate).getTime();
  const today = dayStart(now).getTime();
  const total = Math.max(1, Math.round((e - s) / DAY_MS));
  const passed = Math.min(total, Math.max(0, Math.round((today - s) / DAY_MS) + 1));
  return { total, passed, left: Math.max(0, total - passed) };
}

/** The row for the "fair rotation" check: fewest / average / most impressions among running ads. */
export function spread(values: number[]): { count: number; min: number; avg: number; max: number } {
  if (values.length === 0) return { count: 0, min: 0, avg: 0, max: 0 };
  return {
    count: values.length,
    min: Math.min(...values),
    avg: Math.round(values.reduce((n, v) => n + v, 0) / values.length),
    max: Math.max(...values),
  };
}
