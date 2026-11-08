// Cache tags of the Social reads (SOCIAL_TODO C3, patch-social-cache-tags). ONE place, so a typo cannot leave a cache stale.
//
//   SOCIAL_POSTS_TAG   WHICH items are in the feeds and what they say: a new, edited, deleted, hidden, removed or restored post,
//                      a repost or an undo, an admin decision, an accepted appeal. Everything cached for Social carries it.
//   SOCIAL_REPLIES_TAG the reply list under ONE post page (getSocialReplies): a new, deleted or hidden reply, a like on a reply.
//   socialPostTag(id)  ONE post's own page (getSocialPost): its like and reply numbers.
//
// A LIKE, a reply like and a plain new reply change only numbers or one reply list, so they no longer flush every feed:
// they update the tags below, and the numbers on the feed cards follow within the cache time (`cacheLife("minutes")`,
// about one minute). The person who clicked sees the new number at once (the action returns it).
export const SOCIAL_POSTS_TAG = "social-posts";
export const SOCIAL_REPLIES_TAG = "social-replies";

export function socialPostTag(socialPostId: number): string {
  return `social-post-${socialPostId}`;
}
