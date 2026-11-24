// Fair choice of who or what is shown on one slide of the "Best of the community" box. PURE: no database,
// no clock of its own, no random numbers; the same candidates and the same `nowMs` give the same answer.
//
// Rules (same spirit as the Popular page, src/lib/ranking.ts):
//  1. The best SCORES come first (the score is already softened with log2 by the caller, so the 1000th vote counts far less than the 10th).
//  2. ONE PERSON takes ONE place on a slide.
//  3. Every `risingEvery`-th place is RESERVED for a new voice (young account or very few items), chosen by score plus a
//     fair draw, so a new person with no votes yet still has a chance. A fixed share means abuse can never take more than that share.
//  4. Nobody is hidden or punished by this box; it only decides what fits in a few places.

export type FairConfig = { risingEvery: number; risingLuck: number; seedHours: number };

export type Candidate<T> = {
  key: string; // unique inside one slide (e.g. "p12")
  authorKey: string; // the person's id (never shown)
  score: number; // 0 or more; 0 = nothing earned yet
  isNew: boolean; // a "new voice"
  data: T;
};

/** A number from 0 up to (not including) 1 that depends only on the key and the current "seed window". Stable inside the window. */
export function luck(key: string, nowMs: number, seedHours: number): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  const bucket = Math.floor(nowMs / (seedHours * 3_600_000));
  h = Math.imul(h ^ (bucket & 0xffff), 16777619);
  h = Math.imul(h ^ (bucket >>> 16), 16777619);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

export function pickFair<T>(items: Candidate<T>[], size: number, nowMs: number, cfg: FairConfig): Candidate<T>[] {
  const byKey = (a: Candidate<T>, b: Candidate<T>) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0);
  const earned = items.filter((i) => i.score > 0).sort((a, b) => b.score - a.score || byKey(a, b));
  const laneValue = (i: Candidate<T>) => i.score + luck(i.key, nowMs, cfg.seedHours) * cfg.risingLuck;
  const lane = items.filter((i) => i.isNew).sort((a, b) => laneValue(b) - laneValue(a) || byKey(a, b));

  const out: Candidate<T>[] = [];
  const usedKeys = new Set<string>();
  const usedAuthors = new Set<string>();
  const free = (i: Candidate<T>) => !usedKeys.has(i.key) && !usedAuthors.has(i.authorKey);

  while (out.length < size) {
    const position = out.length + 1;
    let pick: Candidate<T> | undefined;
    if (position % cfg.risingEvery === 0) pick = lane.find(free); // the reserved place
    pick ??= earned.find(free); // a normal place: the best score
    pick ??= lane.find(free); // nothing earned is left: a new voice may fill the place
    if (!pick) break;
    usedKeys.add(pick.key);
    usedAuthors.add(pick.authorKey);
    out.push(pick);
  }
  return out;
}

/** Account is a "new voice": young, or very little posted so far. */
export function isNewVoice(createdAtMs: number, itemCount: number, nowMs: number, newAccountDays: number, maxItems: number): boolean {
  return (nowMs - createdAtMs) / 86_400_000 < newAccountDays || itemCount <= maxItems;
}
