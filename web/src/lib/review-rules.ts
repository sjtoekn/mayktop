// The small, plain rules of "hidden pending review" (TODO 38, PROJECT.md 8f). No database here, so they are
// easy to read and to test (npm run test:review). src/lib/review.ts does the work; the numbers are in
// `reviewConfig` and `staffConfig` (src/config/site.ts).

export const DAY_MS = 24 * 60 * 60 * 1000;

export type ReviewError =
  | "actor" // the first name is not an active person
  | "notfound" // no such post / comment (or the person is unknown)
  | "allowed" // the actor is not a moderator of that community and not an admin
  | "self" // nobody acts on their own post / comment
  | "rule" // not an open rule of that community (or missing)
  | "reason" // written reason / note missing, too short or too long
  | "state" // the post / comment is not in the state this step needs
  | "same"; // the person who hid it cannot be the one who decides

export type Actor = { id: string; isAdmin: boolean; isCommunityModerator: boolean };

/** Step 1 (hide): may THIS person hide THIS content? Returns null when yes, otherwise the reason it is refused. */
export function checkHide(p: {
  actor: Actor;
  authorId: string;
  status: "VISIBLE" | "HIDDEN_PENDING_REVIEW" | "REMOVED";
  erased: boolean; // the author erased it (deletedAt set): there is nothing to hide
}): ReviewError | null {
  if (!p.actor.isAdmin && !p.actor.isCommunityModerator) return "allowed";
  if (p.actor.id === p.authorId) return "self";
  if (p.erased || p.status !== "VISIBLE") return "state";
  return null;
}

/**
 * Step 2 (remove or restore): may THIS person decide? It must be a DIFFERENT person than the one who hid it
 * (a second pair of eyes is the whole point of "pending review"), and not the author.
 * `hiderId` is null when the hide was not recorded (for example a status set by hand in testing): then only
 * the other checks apply.
 */
export function checkDecide(p: {
  actor: Actor;
  authorId: string;
  hiderId: string | null;
  status: "VISIBLE" | "HIDDEN_PENDING_REVIEW" | "REMOVED";
}): ReviewError | null {
  if (!p.actor.isAdmin && !p.actor.isCommunityModerator) return "allowed";
  if (p.actor.id === p.authorId) return "self";
  if (p.status !== "HIDDEN_PENDING_REVIEW") return "state";
  if (p.hiderId !== null && p.hiderId === p.actor.id) return "same";
  return null;
}

/** A written reason / note must have a real length (no one-word decisions). Returns the trimmed text or null. */
export function cleanText(text: string, min: number, max: number): string | null {
  const t = text.trim();
  return t.length >= min && t.length <= max ? t : null;
}

/** Waiting longer than `dueDays` for the second person: shown as OVERDUE in the pending list. */
export function isOverdue(hiddenAt: Date | null, now: number, dueDays: number): boolean {
  return hiddenAt !== null && now - hiddenAt.getTime() > dueDays * DAY_MS;
}

/** A short preview of a post title / comment text for an email or the pending list (one line, cut with "..."). */
export function excerpt(text: string, max: number): string {
  const one = text.replace(/\s+/g, " ").trim();
  if (one.length <= max) return one;
  return one.slice(0, Math.max(1, max - 3)).trimEnd() + "...";
}
