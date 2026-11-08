// The small, plain rules of "shared power" (TODO 42, PROJECT.md principle 5 + 8h): one person must not lead many LARGE
// communities. No database here, so they are easy to read and to test (npm run test:mods). src/lib/moderators.ts does the work;
// the numbers are in `modConfig` (src/config/site.ts).

export type ModError =
  | "actor" // the first name is not an active admin
  | "notfound" // no such community / person
  | "target" // the person cannot be a moderator (not an active account)
  | "reason" // written reason missing, too short or too long
  | "already" // already a moderator of that community
  | "limit" // would lead more large communities than allowed
  | "notmod" // not a moderator of that community
  | "last"; // the last moderator cannot be removed (the community would have none)

/** A community is LARGE from `threshold` members on. */
export function isLarge(memberCount: number, threshold: number): boolean {
  return memberCount >= threshold;
}

/**
 * May this person become a moderator of this community? `largeLed` = how many LARGE communities the person already leads.
 * The limit only matters when the community they would join is large itself (small communities are not limited).
 */
export function checkAppoint(p: {
  targetActive: boolean;
  alreadyModerator: boolean;
  communityIsLarge: boolean;
  largeLed: number;
  max: number;
}): ModError | null {
  if (!p.targetActive) return "target";
  if (p.alreadyModerator) return "already";
  if (p.communityIsLarge && p.largeLed >= p.max) return "limit";
  return null;
}

/** May this moderator be removed? Never the last one. */
export function checkRemove(p: { isModerator: boolean; moderatorCount: number }): ModError | null {
  if (!p.isModerator) return "notmod";
  if (p.moderatorCount <= 1) return "last";
  return null;
}

/**
 * A person already over the limit (a community they lead grew past the threshold, or the limit was lowered) keeps what they
 * have: nothing is taken away silently. They just cannot take another large one, and `npm run mods -- check` lists them.
 */
export function isOverLimit(largeLed: number, max: number): boolean {
  return largeLed > max;
}
