// Fair ranking of replies and of reposts in the feeds (SOCIAL_TODO B10, PROJECT.md 8e + 8j). PURE: no database, no clock of its own.
//  1. REPLIES, "Top" order: the SAME engine as the Popular page (src/lib/ranking.ts): likes count with diminishing returns and fade
//     with age, one account cannot fill the list, and every 4th place is reserved for a new voice. "Oldest" (the default) is plain
//     time order. The choice is the reader's, in the address (?sort=top). Ranking never hides a reply: every reply is in the list.
//  2. REPOSTS in a feed: several PLAIN reposts of the same post inside one feed page become ONE line ("A and 3 more reposted"), so one
//     popular post cannot fill the page. A quote repost is the person's own text and is never merged. Nothing is removed from the database.
import { rankPopularDetailed, type RankingConfig, type RankItem } from "@/lib/ranking";

export const REPLY_SORTS = ["oldest", "top"] as const;
export type ReplySort = (typeof REPLY_SORTS)[number];

/** The sort from the address. Missing or unknown = "oldest" (the order that was always used). A repeated parameter uses the first. */
export function parseReplySort(value: unknown): ReplySort {
  const first = Array.isArray(value) ? value[0] : value;
  return first === "top" ? "top" : "oldest";
}

export type RankableReply = {
  id: number;
  author: string; // username (the key of "one account")
  createdAtMs: number;
  likes: number;
  authorCreatedAtMs: number;
  authorPosts: number; // visible Social posts of the author
};

/** Put the replies in order. `rising` = ids that took a reserved "new voice" place (only in "top"). Always returns every reply once. */
export function orderReplies<T extends RankableReply>(
  replies: T[],
  sort: ReplySort,
  nowMs: number,
  cfg: RankingConfig,
): { items: T[]; rising: Set<number> } {
  if (sort === "oldest") {
    return { items: [...replies].sort((a, b) => a.createdAtMs - b.createdAtMs || a.id - b.id), rising: new Set() };
  }
  const rankItems: RankItem[] = replies.map((r) => ({
    id: r.id,
    authorKey: r.author,
    createdAtMs: r.createdAtMs,
    votes: Math.max(0, r.likes),
    authorCreatedAtMs: r.authorCreatedAtMs,
    authorPosts: r.authorPosts,
  }));
  const { ids, rising } = rankPopularDetailed(rankItems, nowMs, cfg);
  const byId = new Map(replies.map((r) => [r.id, r]));
  return { items: ids.map((id) => byId.get(id)!).filter(Boolean), rising };
}

type RepostLike = { kind: "repost"; quote: null; post: { id: number }; alsoCount?: number };

function isPlainRepost(item: unknown): item is RepostLike {
  const x = item as { kind?: unknown; quote?: unknown; post?: { id?: unknown } } | null;
  return x !== null && typeof x === "object" && x.kind === "repost" && x.quote === null && typeof x.post?.id === "number";
}

/**
 * Items are newest first. For each post, the NEWEST plain repost stays and gets `alsoCount` = how many older plain reposts of the same
 * post were merged into it. Quotes, posts and anything else stay exactly where they are. Works inside the list you give it (one page).
 */
export function collapsePlainReposts<T extends { kind: string }>(items: T[]): T[] {
  const firstAt = new Map<number, number>();
  const out: T[] = [];
  for (const item of items) {
    if (!isPlainRepost(item)) { out.push(item); continue; }
    const at = firstAt.get(item.post.id);
    if (at === undefined) { firstAt.set(item.post.id, out.length); out.push(item); continue; }
    const kept = out[at] as unknown as RepostLike;
    out[at] = { ...kept, alsoCount: (kept.alsoCount ?? 0) + 1 } as unknown as T;
  }
  return out;
}
