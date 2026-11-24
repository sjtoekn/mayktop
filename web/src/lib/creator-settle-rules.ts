// Turns the numbers of ONE finished ad into ledger rows (TODO 12, S4). Pure: no database. The database part is creator-settle.ts.
import { creatorsConfig as defaultCfg } from "@/config/site";
import { settleAd, shareKey, type CreatorsConfig, type PageAuthors } from "@/lib/creator-rules";

const DAY_MS = 86_400_000;

/** UTC midnight (ms) of the day a time falls on. */
export function dayStart(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

/** One row of ContentAdStat: this ad was shown `impressions` times on this page on this UTC day. */
export type SettleDay = { contentId: number; dayMs: number; impressions: number };
/** A person who joined the program. `blocked` = banned or erased: their rows are saved as VOID (history only). */
export type SettleCreator = { joinedAtMs: number; blocked: boolean };

export type SettleInput = {
  adId: number;
  priceCents: number;
  adTotalImpressions: number; // ALL impressions of the ad (AdDailyStat), not only on question pages
  periodStartMs: number;
  days: SettleDay[];
  pages: Map<number, PageAuthors | null>; // null / missing = the page is not VISIBLE any more: it earns nothing
  creators: Map<string, SettleCreator>; // only people in the program; everybody else earns nothing
};

export type SettleRow = {
  userId: string;
  contentId: number;
  micro: number;
  status: "ACTIVE" | "VOID";
  dedupeKey: string;
};

export type Settlement = {
  poolMicro: number;
  rows: SettleRow[];
  activeMicro: number; // what creators really get (ACTIVE rows)
  voidMicro: number; // what went to banned / erased people (kept for history, never paid)
};

/**
 * Pool of the ad -> pages (by their share of ALL the ad's impressions) -> the pages' authors (D2 split) -> one row per
 * person per page. Rules on top of settleAd:
 *  - a person earns only if they joined the program (CreatorProfile), and only from impressions on or after the day they joined (D4);
 *  - what a not-joined author would have got stays with the platform (it is NOT given to somebody else);
 *  - rows of banned / erased people are VOID.
 * The total of all rows can never be more than the pool of the ad.
 */
export function buildSettlement(input: SettleInput, cfg: CreatorsConfig = defaultCfg): Settlement {
  // Every (page, day) is settled on its own, so that "from the day they joined" can be applied exactly.
  const parts = input.days.map((d, i) => ({ contentId: i, impressions: d.impressions, authors: input.pages.get(d.contentId) ?? null }));
  const r = settleAd(input.priceCents, input.adTotalImpressions, parts, cfg);

  const sums = new Map<string, { userId: string; contentId: number; micro: number }>();
  for (const e of r.entries) {
    const day = input.days[e.contentId];
    const who = input.creators.get(e.userId);
    if (!who || day.dayMs < dayStart(who.joinedAtMs)) continue;
    const k = `${e.userId}|${day.contentId}`;
    const cur = sums.get(k);
    if (cur) cur.micro += e.micro;
    else sums.set(k, { userId: e.userId, contentId: day.contentId, micro: e.micro });
  }

  const rows: SettleRow[] = [...sums.values()]
    .filter((x) => x.micro > 0)
    .sort((a, b) => (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : a.contentId - b.contentId))
    .map((x) => ({
      userId: x.userId,
      contentId: x.contentId,
      micro: x.micro,
      status: input.creators.get(x.userId)?.blocked ? ("VOID" as const) : ("ACTIVE" as const),
      dedupeKey: shareKey(input.adId, input.periodStartMs, "POST", x.contentId, x.userId),
    }));

  return {
    poolMicro: r.poolMicro,
    rows,
    activeMicro: rows.filter((x) => x.status === "ACTIVE").reduce((n, x) => n + x.micro, 0),
    voidMicro: rows.filter((x) => x.status === "VOID").reduce((n, x) => n + x.micro, 0),
  };
}
