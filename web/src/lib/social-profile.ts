// The Social profile page (SOCIAL_TODO 2, patch-social-profile): /social/u/<username>?tab=...
// Plain rules, no database, so a test can run them. The database reads are in queries.ts (getSocialProfile and friends).

export const PROFILE_TABS = ["posts", "replies", "likes", "followers", "following"] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];

// Same rule as USERNAME_PATTERN in src/lib/auth.ts (lower case letters, numbers, underscore, 3-20). It is copied here
// because auth.ts loads the sign-in code; scripts/test-social-profile.ts checks that the two stay equal.
export const PROFILE_USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

/** The username from the URL, in lower case, or null when it cannot be a username (the page answers "not found"). */
export function parseProfileUsername(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().toLowerCase();
  return PROFILE_USERNAME_PATTERN.test(name) ? name : null;
}

/**
 * The tab from ?tab=... Unknown, repeated or missing: "posts". "likes" is only for the person themselves
 * (decision for this patch: nobody else can see which posts you liked); for anybody else it is "posts".
 */
export function parseProfileTab(raw: unknown, isOwnProfile: boolean): ProfileTab {
  if (typeof raw !== "string") return "posts";
  const tab = (PROFILE_TABS as readonly string[]).includes(raw) ? (raw as ProfileTab) : "posts";
  if (tab === "likes" && !isOwnProfile) return "posts";
  return tab;
}

/** The address of a profile (and of one of its tabs). The first tab has no ?tab. */
export function profileHref(username: string, tab: ProfileTab = "posts"): string {
  return tab === "posts" ? `/social/u/${username}` : `/social/u/${username}?tab=${tab}`;
}
