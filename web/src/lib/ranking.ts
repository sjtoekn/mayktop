// Fair ranking for the Popular page (TODO 37, PROJECT.md 8e). PURE: no database, no clock of its own,
// no random numbers; give it the same posts and the same `now` and it gives the same order.
// That is on purpose: anyone can test it and explain it. The numbers live in `rankingConfig` (site.ts).
//
// Three rules, in this order:
//  1. QUALITY: votes count with diminishing returns (log2) and fade with age (half-life), so one old
//     post with thousands of votes cannot sit on top for ever, and the 1000th vote counts far less than the 10th.
//  2. ONE ACCOUNT CANNOT FILL THE PAGE: every earlier post of the same author already placed halves the score
//     of that author's next post.
//  3. NEW VOICES GET A FIXED SHARE: every `risingEvery`-th place is reserved for a recent post by a new voice
//     (young account or few posts) that is not downvoted. A fixed share means abuse can never take more than that share.
// Ranking never hides anything: every post is still in the list (just lower), and Home and community pages stay newest first.
import type { rankingConfig as RankingConfigValue } from "@/config/site";

export type RankingConfig = typeof RankingConfigValue;

export type RankItem = {
  id: number;
  authorKey: string; // the author's id (never shown)
  createdAtMs: number; // when the post was made
  votes: number; // up minus down
  authorCreatedAtMs: number; // when the author's account was made
  authorPosts: number; // how many visible posts the author has in total
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Quality score: 0 for no votes, grows slowly with votes, halves every `halfLifeHours`. Negative votes: see tier(). */
export function baseScore(item: RankItem, nowMs: number, cfg: RankingConfig): number {
  const ageHours = Math.max(0, nowMs - item.createdAtMs) / HOUR;
  const decay = Math.pow(0.5, ageHours / cfg.halfLifeHours);
  return Math.log2(1 + Math.max(0, item.votes)) * decay;
}

/** A "new voice": a young account, or an account that has posted very little. */
export function isNewVoice(item: RankItem, nowMs: number, cfg: RankingConfig): boolean {
  const accountAgeDays = (nowMs - item.authorCreatedAtMs) / DAY;
  return accountAgeDays < cfg.newAccountDays || item.authorPosts <= cfg.newVoiceMaxPosts;
}

/** A number from 0 up to (not including) 1 that depends only on the post and the current "seed window". Stable inside the window. */
export function jitter(id: number, nowMs: number, cfg: RankingConfig): number {
  const bucket = Math.floor(nowMs / (cfg.seedHours * HOUR));
  let h = 2166136261 ^ id; // FNV-1a style mixing of two integers
  h = Math.imul(h ^ (bucket & 0xffff), 16777619);
  h = Math.imul(h ^ (bucket >>> 16), 16777619);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** Score for the reserved "new voice" places: votes help, luck helps too, so a post with no votes yet still has a chance. */
export function risingScore(item: RankItem, nowMs: number, cfg: RankingConfig): number {
  return Math.log2(1 + Math.max(0, item.votes)) + jitter(item.id, nowMs, cfg) * cfg.risingLuck;
}

export function isRisingCandidate(item: RankItem, nowMs: number, cfg: RankingConfig): boolean {
  const ageHours = (nowMs - item.createdAtMs) / HOUR;
  return item.votes >= 0 && ageHours <= cfg.risingWindowHours && isNewVoice(item, nowMs, cfg);
}

/**
 * The order of post ids for the Popular page.
 * Downvoted posts (net votes below 0) always come after the others; they are never hidden.
 */
export function rankPopular(items: RankItem[], nowMs: number, cfg: RankingConfig): number[] {
  return rankPopularDetailed(items, nowMs, cfg).ids;
}

/** Same order as rankPopular, plus the ids that took a reserved "new voice" place (the page labels those posts). */
export function rankPopularDetailed(
  items: RankItem[],
  nowMs: number,
  cfg: RankingConfig,
): { ids: number[]; rising: Set<number> } {
  // Newest first, then id, so equal scores never depend on the order the database returned.
  const byAge = (a: RankItem, b: RankItem) => b.createdAtMs - a.createdAtMs || b.id - a.id;
  const base = new Map(items.map((i) => [i.id, baseScore(i, nowMs, cfg)]));
  const inTier = (i: RankItem) => (i.votes < 0 ? 1 : 0);
  const byBase = (a: RankItem, b: RankItem) =>
    inTier(a) - inTier(b) ||
    (a.votes < 0 ? b.votes - a.votes : base.get(b.id)! - base.get(a.id)!) ||
    byAge(a, b);

  const sorted = [...items].sort(byBase);
  // Only the best `maxCandidates` take part in the careful (slower) placing; the rest follow in plain order.
  const pool = sorted.slice(0, cfg.maxCandidates);
  const tail = sorted.slice(cfg.maxCandidates);

  // Reserved places: the new-voice lane, taken from ALL posts (not only the pool).
  const lane = items
    .filter((i) => isRisingCandidate(i, nowMs, cfg))
    .sort((a, b) => risingScore(b, nowMs, cfg) - risingScore(a, nowMs, cfg) || byAge(a, b));

  const placedIds = new Set<number>();
  const perAuthor = new Map<string, number>();
  const out: number[] = [];
  const rising = new Set<number>(); // ids placed in a reserved place
  const place = (item: RankItem) => {
    placedIds.add(item.id);
    perAuthor.set(item.authorKey, (perAuthor.get(item.authorKey) ?? 0) + 1);
    out.push(item.id);
  };

  for (;;) {
    const position = out.length + 1;

    if (position % cfg.risingEvery === 0) {
      // A reserved place: the best new-voice post whose author is not on the page yet.
      const pick = lane.find((i) => !placedIds.has(i.id) && !perAuthor.has(i.authorKey));
      if (pick) {
        place(pick);
        rising.add(pick.id);
        continue;
      }
    }

    // A normal place: the best remaining post after the "same author again" penalty.
    // `pool` is sorted so that downvoted posts are last; they are used only when nothing else is left.
    let best: RankItem | undefined;
    let bestValue = -Infinity;
    for (const i of pool) {
      if (placedIds.has(i.id)) continue;
      if (i.votes < 0) {
        best ??= i; // first downvoted post in order, only if nothing better turns up
        continue;
      }
      const value = (base.get(i.id) ?? 0) * Math.pow(cfg.sameAuthorFactor, perAuthor.get(i.authorKey) ?? 0);
      if (best === undefined || best.votes < 0 || value > bestValue) {
        best = i;
        bestValue = value;
      }
    }
    if (!best) break;
    place(best);
  }

  for (const i of tail) if (!placedIds.has(i.id)) out.push(i.id);
  return { ids: out, rising };
}
