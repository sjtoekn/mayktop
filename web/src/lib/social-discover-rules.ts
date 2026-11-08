// Trending hashtags and Who to follow: the plain rules (SOCIAL_TODO B7, patch-social-discover). No database, no imports, so a
// test can run them. ACCOUNT_RULES.md 3.19. The Social FEED stays newest first (no popularity); these two small lists are
// separate and follow their own written rules:
//  - TRENDING counts DIFFERENT PEOPLE, not posts: one person posting a tag ten times is one person. A tag needs `minPeople`.
//    Order: most people, then most recently used, then the tag itself (so the order is the same on every server).
//  - WHO TO FOLLOW is NOT ranked by follower count. Order: people followed by more of the people YOU follow first, then a
//    shuffle that is fixed for one person for one day (the same list all day, a different one tomorrow), so nobody sits on top
//    for ever and the list does not change on every page load.

export type TagUse = { tag: string; authorId: string; createdAtMs: number };
export type TrendingTag = { tag: string; people: number };

export function rankTrendingTags(rows: TagUse[], options: { minPeople: number; size: number }): TrendingTag[] {
  const byTag = new Map<string, { authors: Set<string>; lastMs: number }>();
  for (const row of rows) {
    const entry = byTag.get(row.tag) ?? { authors: new Set<string>(), lastMs: 0 };
    entry.authors.add(row.authorId);
    if (row.createdAtMs > entry.lastMs) entry.lastMs = row.createdAtMs;
    byTag.set(row.tag, entry);
  }
  return [...byTag.entries()]
    .filter(([, entry]) => entry.authors.size >= options.minPeople)
    .sort(([tagA, a], [tagB, b]) => b.authors.size - a.authors.size || b.lastMs - a.lastMs || (tagA < tagB ? -1 : tagA > tagB ? 1 : 0))
    .slice(0, Math.max(0, options.size))
    .map(([tag, entry]) => ({ tag, people: entry.authors.size }));
}

export type SuggestCandidate = { username: string; displayName: string | null; mutual: number };

/** FNV-1a, 32 bit: a small fixed shuffle key (not for security). */
export function shuffleKey(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** The seed for one person for one day (UTC): the same all day. */
export function suggestSeed(viewerId: string, nowMs: number): string {
  return `${viewerId}:${Math.floor(nowMs / 86_400_000)}`;
}

export function pickSuggestions(candidates: SuggestCandidate[], options: { seed: string; size: number }): SuggestCandidate[] {
  const seen = new Set<string>();
  const unique = candidates.filter((c) => (seen.has(c.username) ? false : (seen.add(c.username), true)));
  return unique
    .map((c) => ({ c, key: shuffleKey(`${options.seed}:${c.username}`) }))
    .sort((a, b) => b.c.mutual - a.c.mutual || a.key - b.key || (a.c.username < b.c.username ? -1 : 1))
    .slice(0, Math.max(0, options.size))
    .map((x) => x.c);
}
