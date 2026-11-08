// Block and Mute, the pure rules (SOCIAL_TODO A7, patch-social-block). No database code is loaded here, so a test can
// run these without a database. The database part is in social-block.ts (writes) and social-block-view.ts (reads).
//
// Words:
//  - BLOCK (A blocks B): A and B cannot interact. B cannot follow A, like, repost, quote, reply to or mention A; the two
//    never see each other's posts, reposts or replies; any follow between them (either way) is removed. B is never told.
//  - MUTE (A mutes B): A no longer sees B's posts, reposts and replies in feeds and under posts, and gets no notification
//    caused by B. B can still do everything, and is never told. A still follows B if A did.
// Both are private lists of the person who made them. Unblock / unmute is always allowed.

export type HiddenAuthors = {
  /** Usernames the viewer blocked OR who blocked the viewer (both directions hide the same things). */
  blocked: ReadonlySet<string>;
  /** Usernames the viewer muted. */
  muted: ReadonlySet<string>;
  /** blocked + muted: what a feed hides. */
  all: ReadonlySet<string>;
};

export const noHiddenAuthors: HiddenAuthors = { blocked: new Set(), muted: new Set(), all: new Set() };

/** What the viewer's own lists and other people's blocks say about ONE other person. */
export type BlockRelation = { blockedByMe: boolean; blockedMe: boolean; mutedByMe: boolean };

export const noRelation: BlockRelation = { blockedByMe: false, blockedMe: false, mutedByMe: false };

/** Build the sets from usernames (the database layer only reads the rows; the combining rule is here, so it is tested). */
export function makeHiddenAuthors(input: { blockedByMe: string[]; blockedMe: string[]; mutedByMe: string[] }): HiddenAuthors {
  const blocked = new Set([...input.blockedByMe, ...input.blockedMe]);
  const muted = new Set(input.mutedByMe);
  return { blocked, muted, all: new Set([...blocked, ...muted]) };
}

type FeedLike = { kind: string; reposter?: string; post?: { author?: string } };

/**
 * Remove from a list of feed items everything written or reposted by a hidden person, and every repost OF a hidden
 * person's post. Community items (kind "community") are never touched: Block and Mute are only for Social.
 * The same function is used for Home, /social, Following, the hashtag feed and the lists on a post or a profile page.
 * It runs AFTER the shared cache, because the cached feeds hold no personal data (queries.ts).
 */
export function dropHiddenItems<T extends { kind: string }>(items: T[], hidden: ReadonlySet<string>): T[] {
  if (hidden.size === 0) return items;
  return items.filter((item) => {
    const feed = item as unknown as FeedLike;
    if (feed.kind === "community") return true;
    if (feed.reposter !== undefined && hidden.has(feed.reposter)) return false;
    const author = feed.post?.author;
    return author === undefined || !hidden.has(author);
  });
}

/** Everything that has an `author` username (the replies under a post). */
export function dropHiddenAuthors<T extends { author: string }>(items: T[], hidden: ReadonlySet<string>): T[] {
  return hidden.size === 0 ? items : items.filter((item) => !hidden.has(item.author));
}
