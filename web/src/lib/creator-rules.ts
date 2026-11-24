// The rules of creator earnings (TODO 12, S1). Pure numbers and lists: no database, no React, so they are easy to test.
// Money is always a whole number of micro-USD (1 USD = 1_000_000). Nothing here can create money:
// everything paid out is taken from the creator pool of one ad, and rounding always rounds DOWN.
import { adsConfig, creatorsConfig as defaultCfg } from "@/config/site";

export type CreatorsConfig = typeof defaultCfg;

const MICRO_PER_CENT = 10_000;

/** The creator pool of one ad: its share of the ad's price, in micro-USD. */
export function poolMicro(priceCents: number, cfg: CreatorsConfig = defaultCfg): number {
  if (!Number.isInteger(priceCents) || priceCents <= 0) return 0;
  return Math.floor((priceCents * MICRO_PER_CENT * cfg.sharePercent) / 100);
}

/** The people on one question page who earn from it. Ids only; `othersByVotes` is already sorted best first. */
export type PageAuthors = {
  askerId: string;
  acceptedId: string | null;
  othersByVotes: string[];
};

/**
 * How ONE page impression is divided: user id -> weight in basis points (10000 = 100%). Rules (D2):
 *  asker 30, accepted answer 50, top-voted other answers share 20 (at most otherAnswersMax of them).
 *  No accepted answer: its part goes to the other answers. No other answers: their part goes to the asker.
 *  The same person in two roles gets both parts added up.
 */
export function pageWeights(a: PageAuthors, cfg: CreatorsConfig = defaultCfg): Map<string, number> {
  const s = cfg.split;
  let asker = s.askerPercent * 100;
  let accepted = s.acceptedPercent * 100;
  let others = s.othersPercent * 100;

  const accId = a.acceptedId;
  const list: string[] = [];
  for (const id of a.othersByVotes) {
    if (id === accId || list.includes(id)) continue; // one person is counted once in the "others"
    list.push(id);
    if (list.length >= cfg.otherAnswersMax) break;
  }

  if (!accId) {
    others += accepted;
    accepted = 0;
  }
  if (list.length === 0) {
    asker += others;
    others = 0;
  }

  const out = new Map<string, number>();
  const add = (id: string, w: number) => {
    if (w > 0) out.set(id, (out.get(id) ?? 0) + w);
  };
  add(a.askerId, asker);
  if (accId) add(accId, accepted);
  if (list.length > 0) {
    // Equal shares, in whole basis points. A leftover point goes to the best-voted ones first.
    const each = Math.floor(others / list.length);
    let left = others - each * list.length;
    for (const id of list) {
      add(id, each + (left > 0 ? 1 : 0));
      if (left > 0) left -= 1;
    }
  }
  return out;
}

export type AnswerForRanking = { authorId: string; score: number; createdAtMs: number };

/**
 * The authors of the "other" answers of a page (D2), best first: only answers with a positive vote score count,
 * highest score first, older first on a tie; one person appears once. (pageWeights keeps at most otherAnswersMax of them.)
 */
export function pickOtherAnswerAuthors(answers: AnswerForRanking[]): string[] {
  const out: string[] = [];
  for (const a of answers.filter((x) => x.score > 0).sort((x, y) => y.score - x.score || x.createdAtMs - y.createdAtMs)) {
    if (!out.includes(a.authorId)) out.push(a.authorId);
  }
  return out;
}

/**
 * Divides `total` micro-USD by weights into whole numbers that add up to EXACTLY `total`
 * (largest remainder; ties go to the smaller key, so the result never depends on the order of the input).
 */
export function allocate(total: number, weights: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  const keys = [...weights.keys()].sort();
  const sum = keys.reduce((n, k) => n + (weights.get(k) ?? 0), 0);
  if (!Number.isInteger(total) || total <= 0 || sum <= 0) return out;

  let given = 0;
  const parts = keys.map((k) => {
    const exact = (total * (weights.get(k) ?? 0)) / sum;
    const whole = Math.floor(exact);
    given += whole;
    return { k, whole, frac: exact - whole };
  });
  let left = total - given;
  parts
    .slice()
    .sort((x, y) => y.frac - x.frac || (x.k < y.k ? -1 : 1))
    .forEach((p) => {
      if (left > 0 && p.frac > 0) {
        p.whole += 1;
        left -= 1;
      }
    });
  for (const p of parts) if (p.whole > 0) out.set(p.k, p.whole);
  return out;
}

export type SettleContent = {
  contentId: number;
  impressions: number; // impressions of THIS ad on THIS page in the period (ContentAdStat)
  authors: PageAuthors | null; // null = the page is not VISIBLE any more: it earns nothing
};

export type SettleResult = {
  poolMicro: number;
  rateMicroPerImpression: number; // information only (pool / all impressions of the ad)
  byUser: Map<string, number>;
  byContent: Map<number, number>;
  entries: { userId: string; contentId: number; micro: number }[]; // one ledger row each (S4): who earned how much on which page

  totalMicro: number; // what creators get; always <= poolMicro
};

/**
 * Settles ONE paid ad for a period.
 *  pool = share of the ad's price;  a page earns  pool x (its impressions / ALL impressions of the ad)  (rounded down);
 *  that amount is divided among the page's authors (pageWeights).  Impressions on pages that are not creators' (header,
 *  home feed ...) are part of `adTotalImpressions` too, so that part of the pool simply stays with the platform.
 */
export function settleAd(
  priceCents: number,
  adTotalImpressions: number,
  contents: SettleContent[],
  cfg: CreatorsConfig = defaultCfg,
): SettleResult {
  const pool = poolMicro(priceCents, cfg);
  const attributed = contents.reduce((n, c) => n + Math.max(0, c.impressions), 0);
  // Safety: if the counters disagree (attributed > total), divide by the larger one so the pool can never be exceeded.
  const base = Math.max(adTotalImpressions, attributed);
  const byUser = new Map<string, number>();
  const byContent = new Map<number, number>();
  const entries: SettleResult["entries"] = [];
  let totalMicro = 0;
  if (pool <= 0 || base <= 0) {
    return { poolMicro: pool, rateMicroPerImpression: 0, byUser, byContent, entries, totalMicro: 0 };
  }

  for (const c of contents) {
    if (!c.authors || c.impressions <= 0) continue;
    const amount = Math.floor((pool * c.impressions) / base);
    if (amount <= 0) continue;
    const split = allocate(amount, pageWeights(c.authors, cfg));
    for (const [id, v] of split) {
      byUser.set(id, (byUser.get(id) ?? 0) + v);
      entries.push({ userId: id, contentId: c.contentId, micro: v });
    }
    byContent.set(c.contentId, (byContent.get(c.contentId) ?? 0) + amount);
    totalMicro += amount;
  }
  return { poolMicro: pool, rateMicroPerImpression: pool / base, byUser, byContent, entries, totalMicro };
}

// The words saved in the EarningEntry / Payout tables (they are plain text in the database).
export const EARNING_KINDS = ["SHARE", "REVERSAL", "CREDIT_SPEND"] as const;
export const EARNING_STATUSES = ["ACTIVE", "VOID"] as const;
export const PAYOUT_METHODS = ["PAYPAL", "BANK_LK"] as const;
export const PAYOUT_STATUSES = ["PENDING", "PAID", "FAILED"] as const;

/** The key that makes settlement safe to run twice (EarningEntry.dedupeKey). Same inputs, same key. */
export function shareKey(adId: number, periodStartMs: number, contentType: string, contentId: number, userId: string): string {
  return `share:${adId}:${new Date(periodStartMs).toISOString().slice(0, 10)}:${contentType}:${contentId}:${userId}`;
}

/** True when payouts to this country are open (ISO code, any case). No country chosen = not open. */
export function isPayoutCountry(code: string | null | undefined, cfg: CreatorsConfig = defaultCfg): boolean {
  if (!code) return false;
  return cfg.payoutCountries.includes(code.trim().toUpperCase());
}

export type EarningState = "HELD_COUNTRY" | "ACCRUED" | "PAYABLE";

/**
 * The state of one earning at a moment in time.
 *  HELD_COUNTRY: payouts are not open for the creator's country yet (the money is kept, never lost).
 *  ACCRUED: waiting in the hold period.  PAYABLE: can be paid (once the total reaches the minimum, see canPayout).
 */
export function earningState(
  country: string | null | undefined,
  accruedAtMs: number,
  nowMs: number,
  cfg: CreatorsConfig = defaultCfg,
): EarningState {
  if (!isPayoutCountry(country, cfg)) return "HELD_COUNTRY";
  return nowMs - accruedAtMs >= cfg.holdDays * 86_400_000 ? "PAYABLE" : "ACCRUED";
}

/** A payout may be made only when the PAYABLE total reaches the minimum. */
export function canPayout(payableMicro: number, cfg: CreatorsConfig = defaultCfg): boolean {
  return payableMicro >= cfg.minPayoutMicroUsd;
}

/** micro-USD as text with 2 decimals, rounded DOWN ("12.34"). For showing only; keep the whole number for maths. */
export function formatUsd(micro: number): string {
  const cents = Math.floor(Math.max(0, micro) / MICRO_PER_CENT);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/** Sanity check of the numbers in the config (used by the test; also run it once when the server starts if you like). */
export function creatorsConfigIsValid(cfg: CreatorsConfig = defaultCfg): boolean {
  const s = cfg.split;
  return (
    cfg.currency === adsConfig.currency &&
    cfg.sharePercent > 0 &&
    cfg.sharePercent <= 100 &&
    s.askerPercent + s.acceptedPercent + s.othersPercent === 100 &&
    cfg.otherAnswersMax >= 1 &&
    cfg.holdDays >= 0 &&
    cfg.minPayoutMicroUsd >= 0
  );
}
