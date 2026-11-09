// patch-ads-list: the small PURE rules behind the paged, searchable /admin/ads screen. No database, no clock.
// The database work is in admin-ads.ts (loadAdsPage); the screen is app/admin/ads/page.tsx.
// ADS_PLAN decision 9 expects hundreds or thousands of ads, so the screen never loads them all at once.

/** Ads shown on one page of /admin/ads. PROVISIONAL: change here only. */
export const ADS_PAGE_SIZE = 20;

/** The tabs of /admin/ads. "history" = ads that are over: REJECTED and ENDED. */
export const ADS_VIEWS = ["queue", "waiting", "active", "paused", "history"] as const;
export type AdsView = (typeof ADS_VIEWS)[number];

export const ADS_VIEW_STATUSES: Record<AdsView, readonly ("SUBMITTED" | "APPROVED" | "ACTIVE" | "PAUSED" | "REJECTED" | "ENDED")[]> = {
  queue: ["SUBMITTED"],
  waiting: ["APPROVED"],
  active: ["ACTIVE"],
  paused: ["PAUSED"],
  history: ["REJECTED", "ENDED"],
};

export const ADS_SLOTS = ["SIDEBAR", "FEED", "SOCIAL_FEED", "HEADER"] as const;
export const ADS_FORMATS = ["TEXT", "IMAGE", "VIDEO"] as const;
export type AdsSlotFilter = (typeof ADS_SLOTS)[number];
export type AdsFormatFilter = (typeof ADS_FORMATS)[number];

export type AdsQuery = {
  view: AdsView;
  q: string;
  slot: AdsSlotFilter | "";
  format: AdsFormatFilter | "";
  page: number;
};

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Turns the address (?view=&q=&slot=&format=&page=) into a safe query. Unknown values are ignored (never an error). */
export function parseAdsQuery(sp: Record<string, string | string[] | undefined>): AdsQuery {
  const view = one(sp.view);
  const slot = one(sp.slot);
  const format = one(sp.format);
  const page = Number.parseInt(one(sp.page), 10);
  return {
    view: (ADS_VIEWS as readonly string[]).includes(view) ? (view as AdsView) : "queue",
    q: one(sp.q).trim().slice(0, 100),
    slot: (ADS_SLOTS as readonly string[]).includes(slot) ? (slot as AdsSlotFilter) : "",
    format: (ADS_FORMATS as readonly string[]).includes(format) ? (format as AdsFormatFilter) : "",
    page: Number.isInteger(page) && page >= 1 && page <= 100000 ? page : 1,
  };
}

/** "#12", "12" -> 12 (search by ad number). Anything else -> null (search by words). */
export function adNumberFromSearch(q: string): number | null {
  const m = /^#?\s*(\d{1,9})$/.exec(q.trim());
  return m ? Number.parseInt(m[1], 10) : null;
}

/** Page count and the page to show (a page past the end falls back to the last one). */
export function pageInfo(total: number, wanted: number, size: number = ADS_PAGE_SIZE): { pages: number; page: number; skip: number; from: number; to: number } {
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(Math.max(1, wanted), pages);
  const skip = (page - 1) * size;
  return { pages, page, skip, from: total === 0 ? 0 : skip + 1, to: Math.min(total, skip + size) };
}

/** The address of a tab / page of /admin/ads that keeps the search and the filters. Default values are left out. */
export function adsLink(query: AdsQuery, change: Partial<AdsQuery> = {}): string {
  const next = { ...query, ...change };
  const params = new URLSearchParams();
  if (next.view !== "queue") params.set("view", next.view);
  if (next.q) params.set("q", next.q);
  if (next.slot) params.set("slot", next.slot);
  if (next.format) params.set("format", next.format);
  if (next.page > 1) params.set("page", String(next.page));
  const text = params.toString();
  return text ? `/admin/ads?${text}` : "/admin/ads";
}
