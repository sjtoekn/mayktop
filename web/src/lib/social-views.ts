// View counts on Social posts (SOCIAL_TODO B5, patch-social-views): the pure rules. No database and no imports, so a test
// can run them (scripts/test-social-views.ts). The database part is src/lib/social-view-db.ts, the browser part is
// src/components/social/SocialViewCount.tsx and the address it calls is POST /api/social/view.
//
// DECISION (2026-11-08): ONE running total per post (`SocialPost.viewCount`), growing for as long as the post exists.
// Nothing about WHO looked is saved: no user id, no IP, no table of views. A bare total is not personal data.
// Like YouTube and Facebook, a view is only counted when it is a real one:
//  - the post was on screen for a moment (the browser waits VIEW_VISIBLE_MS with at least half of the post visible);
//  - not a crawler or script (User-Agent), and only a logged-in person (Social is for logged-in people);
//  - never the author's own view;
//  - the same person counts at most once per post per VIEW_SEEN_HOURS (refreshing the page does not add views);
//  - a rate limit per person (socialLimits.views) stops a script that opens posts in a loop.
// To remember "this person already looked at this post today" the server keeps `<personId>:<postId>` in its own MEMORY for
// 24 hours. It is never written to disk or to the database, and it is gone at a restart (the cost: after a restart the
// same person can add one more view of the same post, so the total is a close count, not an exact one).

/** The browser counts a view after the post has been on screen (at least half of it) for this long. */
export const VIEW_VISIBLE_MS = 1000;
/** The same person adds at most one view to the same post in this many hours. */
export const VIEW_SEEN_HOURS = 24;
/** When this many "seen" entries are in memory, the expired ones are thrown away. */
export const VIEW_SEEN_SWEEP_AT = 50_000;
/** A hard ceiling: if memory is still full after a sweep, the oldest entries go. */
export const VIEW_SEEN_MAX = 200_000;

/** A post id from the browser: a whole number from 1 up, nothing else. */
export function parsePostId(raw: unknown): number | null {
  return typeof raw === "number" && Number.isSafeInteger(raw) && raw > 0 ? raw : null;
}

const seen = new Map<string, number>(); // "<viewerId>:<postId>" -> time of the counted view (ms). Memory only.

/**
 * True the FIRST time this person is seen on this post within VIEW_SEEN_HOURS (and remembers it); false for a repeat.
 * `now` can be given by a test.
 */
export function firstViewInWindow(viewerId: string, postId: number, now: number = Date.now()): boolean {
  const windowMs = VIEW_SEEN_HOURS * 60 * 60 * 1000;
  const key = `${viewerId}:${postId}`;
  const before = seen.get(key);
  if (before !== undefined && now - before < windowMs) return false;

  seen.delete(key); // so a refreshed entry moves to the end of the Map (oldest first)
  seen.set(key, now);

  if (seen.size > VIEW_SEEN_SWEEP_AT) {
    for (const [k, time] of seen) if (now - time >= windowMs) seen.delete(k);
    // Still too many (a very busy site): drop the oldest. A Map keeps insertion order, so the first keys are the oldest.
    while (seen.size > VIEW_SEEN_MAX) {
      const oldest = seen.keys().next().value;
      if (oldest === undefined) break;
      seen.delete(oldest);
    }
  }
  return true;
}

/** Test helper: forget everything. */
export function resetViewMemory(): void {
  seen.clear();
}

/** Test helper: how many entries are kept. */
export function viewMemorySize(): number {
  return seen.size;
}
