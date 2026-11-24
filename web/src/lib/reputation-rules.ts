// The plain rules of reputation, privileges and bounties (SITE_PLAN B4-B6). No database here, so they are easy to read and to
// test (npm run test:reputation). src/lib/reputation.ts and src/lib/answers.ts read the numbers and call these.
import { bountyConfig, reputationConfig, type Privilege } from "@/config/site";

export type ReputationCounts = {
  answerUp: number; // up-votes on the person's answers
  answerDown: number;
  postUp: number; // up-votes on the person's own questions / articles / videos
  postDown: number;
  accepted: number; // how many of the person's answers were accepted
  held: number; // points held in the person's own OPEN bounties and in bounties that were already paid out
  won: number; // points the person received from bounties
};

/** The reputation of a person. Never below 0. */
export function computeReputation(c: ReputationCounts): number {
  const p = reputationConfig.points;
  const total = c.answerUp * p.answerUp + c.answerDown * p.answerDown + c.postUp * p.postUp + c.postDown * p.postDown + c.accepted * p.accepted + c.won - c.held;
  return Math.max(0, total);
}

/** May a person with this reputation do this? `staff` (moderator or admin) always may. */
export function hasPrivilege(reputation: number, privilege: Privilege, staff = false): boolean {
  return staff || reputation >= reputationConfig.privileges[privilege];
}

/** Does the text contain a web link? Deliberately wide (also "www.x.com" and "x.com/page"), so a link cannot be hidden by a small trick. */
export function containsLink(text: string): boolean {
  return /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|lk|info|biz|xyz|ly|me|app|dev|link|click|top|ru|cn|tk)\b)/i.test(text);
}

export type BountyRow = { amount: number; status: string; expiresAt: Date };

/** An OPEN bounty that has not run out yet. */
export function isBountyActive(b: BountyRow | null | undefined, now: Date = new Date()): boolean {
  return !!b && b.status === "OPEN" && b.expiresAt.getTime() > now.getTime();
}

/** The points a person has tied up in bounties they offered: the active ones and the ones that were paid out. */
export function heldPoints(rows: BountyRow[], now: Date = new Date()): number {
  return rows.reduce((sum, b) => sum + (b.status === "AWARDED" || isBountyActive(b, now) ? b.amount : 0), 0);
}

export type BountyOfferError = "kind" | "accepted" | "exists" | "amount" | "reputation" | "points";

/**
 * May this person put this bounty on this question? `available` is their reputation (the held points are already taken out of it).
 * `existing` is the question's earlier bounty: one that is paid out or still running blocks a new one; one that ran out may be replaced.
 */
export function checkBountyOffer(input: {
  amount: unknown;
  postKind: string;
  hasAcceptedAnswer: boolean;
  existing: BountyRow | null;
  available: number;
  staff?: boolean;
  now?: Date;
}): { ok: true; amount: number } | { ok: false; error: BountyOfferError } {
  const now = input.now ?? new Date();
  if (input.postKind !== "question") return { ok: false, error: "kind" };
  if (input.hasAcceptedAnswer) return { ok: false, error: "accepted" };
  if (input.existing && (input.existing.status === "AWARDED" || isBountyActive(input.existing, now))) return { ok: false, error: "exists" };
  const amount = input.amount;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < bountyConfig.min || amount > bountyConfig.max) return { ok: false, error: "amount" };
  if (!hasPrivilege(input.available, "bounty", input.staff)) return { ok: false, error: "reputation" };
  if (!input.staff && amount > input.available) return { ok: false, error: "points" };
  return { ok: true, amount };
}

/** When a bounty offered now runs out. */
export function bountyExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + bountyConfig.days * 24 * 60 * 60 * 1000);
}

export type AcceptError = "kind" | "owner" | "self" | "answer" | "paid";

/**
 * May the asker accept (or take back) this answer?
 *  - only on a question, only by its asker, never on the asker's own comment;
 *  - only a top-level, visible comment counts as an answer;
 *  - once a bounty was paid for the accepted answer, the choice is final (otherwise points could be paid twice).
 */
export function checkAccept(input: {
  postKind: string;
  postAuthorId: string;
  actorId: string;
  commentAuthorId: string;
  commentIsTopLevel: boolean;
  commentVisible: boolean;
  bountyPaid: boolean; // a bounty of this question was already paid out
}): { ok: true } | { ok: false; error: AcceptError } {
  if (input.postKind !== "question") return { ok: false, error: "kind" };
  if (input.actorId !== input.postAuthorId) return { ok: false, error: "owner" };
  if (input.commentAuthorId === input.actorId) return { ok: false, error: "self" };
  if (!input.commentIsTopLevel || !input.commentVisible) return { ok: false, error: "answer" };
  if (input.bountyPaid) return { ok: false, error: "paid" };
  return { ok: true };
}

// The `type` of the Notification row made when the asker accepts an answer. It is about the person's OWN answer, so (like the
// community decisions) it is always shown: it has no on/off switch.
export const ANSWER_ACCEPTED_NOTIFICATION = "ANSWER_ACCEPTED";
