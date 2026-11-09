// patch-ads-my-list: the small PURE rules behind the tabs, the number range and the paging of /advertise/my. No database, no clock
// (the caller passes "today"). The database work is in ad-mine.ts (loadMyAdsPage); the screen is app/(site)/advertise/my/page.tsx.
/** Ads shown on one page of /advertise/my. PROVISIONAL: each card is large (preview + numbers), so the page is short. */
export const MY_PAGE_SIZE = 10;

export const MY_VIEWS = ["all", "running", "waiting", "rejected", "ended"] as const;
export type MyView = (typeof MY_VIEWS)[number];

type MyStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "ACTIVE" | "PAUSED" | "ENDED";

/** Which statuses a tab holds. "all" holds every status. A status is in exactly one of the four named tabs. */
export const MY_VIEW_STATUSES: Record<Exclude<MyView, "all">, readonly MyStatus[]> = {
  running: ["ACTIVE", "PAUSED"],
  waiting: ["DRAFT", "SUBMITTED", "APPROVED"],
  rejected: ["REJECTED"],
  ended: ["ENDED"],
};

/** The number range: the last N UTC days (today included), or all time. */
export const MY_RANGES = ["7", "30", "90", "all"] as const;
export type MyRange = (typeof MY_RANGES)[number];

export type MyQuery = { view: MyView; range: MyRange; page: number };

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Turns the address (?view=&range=&page=) into a safe query. Unknown values are ignored (never an error). */
export function parseMyQuery(sp: Record<string, string | string[] | undefined>): MyQuery {
  const view = one(sp.view);
  const range = one(sp.range);
  const page = Number.parseInt(one(sp.page), 10);
  return {
    view: (MY_VIEWS as readonly string[]).includes(view) ? (view as MyView) : "all",
    range: (MY_RANGES as readonly string[]).includes(range) ? (range as MyRange) : "7",
    page: Number.isInteger(page) && page >= 1 && page <= 100000 ? page : 1,
  };
}

/** The statuses to read for a tab; null = no filter (every status). */
export function statusesFor(view: MyView): readonly MyStatus[] | null {
  return view === "all" ? null : MY_VIEW_STATUSES[view];
}

/** Number of ads per tab from the per-status counts. */
export function countsByView(rows: { status: string; count: number }[]): Record<MyView, number> {
  const out: Record<MyView, number> = { all: 0, running: 0, waiting: 0, rejected: 0, ended: 0 };
  for (const { status, count } of rows) {
    out.all += count;
    for (const view of Object.keys(MY_VIEW_STATUSES) as Exclude<MyView, "all">[]) {
      if ((MY_VIEW_STATUSES[view] as readonly string[]).includes(status)) out[view] += count;
    }
  }
  return out;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The first UTC day of a range (today included): 7 -> today minus 6 days. All time -> null (no start). `today` is UTC midnight. */
export function rangeStartDay(range: MyRange, today: Date): Date | null {
  if (range === "all") return null;
  return new Date(today.getTime() - (Number.parseInt(range, 10) - 1) * DAY_MS);
}

/** Page count and the page to show (a page past the end falls back to the last one). */
export function myPageInfo(total: number, wanted: number, size: number = MY_PAGE_SIZE): { pages: number; page: number; skip: number; from: number; to: number } {
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(Math.max(1, wanted), pages);
  const skip = (page - 1) * size;
  return { pages, page, skip, from: total === 0 ? 0 : skip + 1, to: Math.min(total, skip + size) };
}

/** The address of a tab / range / page of /advertise/my. Default values are left out. */
export function myLink(query: MyQuery, change: Partial<MyQuery> = {}): string {
  const next = { ...query, ...change };
  const params = new URLSearchParams();
  if (next.view !== "all") params.set("view", next.view);
  if (next.range !== "7") params.set("range", next.range);
  if (next.page > 1) params.set("page", String(next.page));
  const text = params.toString();
  return text ? `/advertise/my?${text}` : "/advertise/my";
}
