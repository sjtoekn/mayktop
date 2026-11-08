// The "n new posts" banner (SOCIAL_TODO B4, patch-social-newposts): the pure rules. No database and no imports, so a test
// can run them (scripts/test-social-new-posts.ts). The count itself is read in queries.ts (countNewSocialItems), the browser
// part is src/components/social/SocialNewPostsBanner.tsx, and the address it asks is /api/social/new-count.
//
// How it works: the feed page tells the banner "the newest thing you are showing is from <since>" (milliseconds). Every
// minute, while the tab is open and visible, the banner asks how many Social posts and reposts are NEWER than that. If the
// answer is more than 0 it shows a button "3 new posts". The feed is NEVER changed by itself (nothing jumps under the
// reader's finger): only the button reloads the page. Rules for what counts:
//  - the same visibility rules as the feeds (visible, not deleted, account shown);
//  - never the viewer's own posts and reposts (they know what they just wrote);
//  - never blocked or muted people (the same lists as the feed);
//  - on the Following feed only the people the viewer follows.
export const NEW_POSTS_POLL_MS = 60_000;
/** The most that is counted (and read from the database); the banner says "99+" from here. */
export const NEW_POSTS_CAP = 100;
/** "99+" is shown when the count reaches this. */
export const NEW_POSTS_MANY = NEW_POSTS_CAP;

export const NEW_POSTS_FEEDS = ["all", "following"] as const;
export type NewPostsFeed = (typeof NEW_POSTS_FEEDS)[number];

/** ?feed= : only the two known feeds; anything else (or repeated) is null. */
export function parseNewPostsFeed(raw: unknown): NewPostsFeed | null {
  return typeof raw === "string" && (NEW_POSTS_FEEDS as readonly string[]).includes(raw) ? (raw as NewPostsFeed) : null;
}

/** ?since= : whole milliseconds, digits only (1 to 15 of them). Anything else is null. */
export function parseSince(raw: unknown): number | null {
  if (typeof raw !== "string" || !/^\d{1,15}$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

/** The time of the newest item a page shows, or `fallback` (the time of the request) when it shows nothing. */
export function newestMs(items: { createdAtMs: number }[], fallback: number): number {
  let newest = 0;
  for (const item of items) if (item.createdAtMs > newest) newest = item.createdAtMs;
  return newest > 0 ? newest : fallback;
}

/** A count from the database, made safe for the answer: a whole number from 0 to the cap. */
export function clampNewCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Math.floor(value), NEW_POSTS_CAP);
}
