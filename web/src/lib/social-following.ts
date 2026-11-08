// The Following feed (SOCIAL_TODO 17): whose posts and reposts it shows. Pure function, no database, so a test can run it.
// Decision (PROJECT.md 8j.17): the feed shows the people you follow AND yourself (so a new person who follows nobody
// still sees what they just wrote). Which of those accounts may be shown is NOT decided here: the query adds
// `socialAuthorShown` (src/lib/social-visibility.ts), the same rule as every other Social feed.
export const MAX_FOLLOWING_IDS = 5000; // one person never follows more accounts than this in the feed query

export function followingAuthorIds(viewerId: string, followedIds: string[]): string[] {
  if (!viewerId) return [];
  const ids = new Set<string>([viewerId]);
  for (const id of followedIds) {
    if (typeof id === "string" && id.length > 0) ids.add(id);
    if (ids.size >= MAX_FOLLOWING_IDS + 1) break;
  }
  return [...ids];
}
