// Reply control (SOCIAL_TODO B9): WHO may reply to a Social post. Pure rules: no database, no imports, so a test can run them.
// Same three choices as X / Twitter: everyone, only the people the author follows, only the people the author @mentions.
// The author of the post can always reply to their own post. The choice is made when the post is written.
export const REPLY_POLICIES = ["EVERYONE", "FOLLOWING", "MENTIONED"] as const;
export type ReplyPolicy = (typeof REPLY_POLICIES)[number];
export const DEFAULT_REPLY_POLICY: ReplyPolicy = "EVERYONE";

function isPolicy(value: unknown): value is ReplyPolicy {
  return typeof value === "string" && (REPLY_POLICIES as readonly string[]).includes(value);
}

/** The choice sent by the post form. Nothing sent = the default; anything that is not one of the three = refused (null). */
export function parseReplyPolicyInput(value: unknown): ReplyPolicy | null {
  if (value === undefined || value === null || value === "") return DEFAULT_REPLY_POLICY;
  return isPolicy(value) ? value : null;
}

/**
 * The value read FROM the database. The column is NOT NULL with a default, so a missing value only happens in a test stand-in:
 * it means the default. A value nobody knows is treated as the STRICTEST choice (fail closed, never open).
 */
export function readStoredReplyPolicy(value: unknown): ReplyPolicy {
  if (value === undefined || value === null) return DEFAULT_REPLY_POLICY;
  return isPolicy(value) ? value : "MENTIONED";
}

export type ReplyFacts = {
  /** The person asking is the author of the post. */
  isPostAuthor: boolean;
  /** The author of the post follows the person asking. */
  authorFollowsReplier: boolean;
  /** The person asking is @mentioned in the post (saved mentions only: see social-tag-sync.ts). */
  replierMentioned: boolean;
};

/** May this person reply under this policy? ONE place: the page (box or notice) and the server action both use it. */
export function replyAllowed(policy: ReplyPolicy, facts: ReplyFacts): boolean {
  if (facts.isPostAuthor) return true;
  if (policy === "EVERYONE") return true;
  if (policy === "FOLLOWING") return facts.authorFollowsReplier;
  return facts.replierMentioned; // MENTIONED
}

/** Which facts must be read from the database for this policy (so a normal post with "everyone" costs no extra query). */
export function factsNeeded(policy: ReplyPolicy): { follow: boolean; mention: boolean } {
  return { follow: policy === "FOLLOWING", mention: policy === "MENTIONED" };
}
