// CSV download of ad numbers (patch-ads-csv). Pure functions, tested by: npm run test:ad-csv
// Only per-ad per-day totals; nothing about visitors. Text cells are protected against spreadsheet formulas.
import type { DayRow } from "@/lib/ad-detail-rules";
import { ctrText } from "@/lib/ad-review-rules";

/** One CSV cell. Quotes are doubled; a text that starts with = + - @ (or a tab / CR) gets a leading ' so Excel never runs it as a formula. */
export function csvCell(value: string | number): string {
  if (typeof value === "number") return String(value);
  let s = value.replace(/\r?\n/g, " ");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",;]/.test(s) || s !== value ? `"${s.replace(/"/g, '""')}"` : s;
}

function line(cells: (string | number)[]): string {
  return cells.map(csvCell).join(",");
}

const BOM = "\uFEFF"; // so Excel reads the file as UTF-8

/** One ad, one row per UTC day (oldest first). */
export function buildAdCsv(days: DayRow[]): string {
  const rows = [line(["date_utc", "shown", "clicks", "click_rate"])];
  for (const d of days) rows.push(line([d.date.toISOString().slice(0, 10), d.impressions, d.clicks, d.impressions > 0 ? ctrText(d.impressions, d.clicks) : ""]));
  return BOM + rows.join("\r\n") + "\r\n";
}

export type OverviewCsvRow = {
  id: number; title: string; advertiser: string; status: string; slot: string; format: string;
  impressions: number; clicks: number; ctr: string; week: number;
};

/** All ads, one row per ad. */
export function buildOverviewCsv(rows: OverviewCsvRow[]): string {
  const out = [line(["ad_id", "title", "advertiser", "status", "slot", "format", "shown_total", "clicks_total", "click_rate", "shown_last_7_days"])];
  for (const r of rows) out.push(line([r.id, r.title, r.advertiser, r.status, r.slot, r.format, r.impressions, r.clicks, r.impressions > 0 ? r.ctr : "", r.week]));
  return BOM + out.join("\r\n") + "\r\n";
}

/** A safe file name part ("ad-12-numbers.csv"). */
export function csvFileName(name: string): string {
  return name.replace(/[^a-z0-9-]/gi, "-").toLowerCase() + ".csv";
}

export function csvResponse(body: string, fileName: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFileName(fileName)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
