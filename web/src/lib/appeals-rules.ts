// The small, plain rules of APPEALS (TODO 40, PROJECT.md 8g). No database here, so they are easy to read and to
// test (npm run test:appeals). src/lib/appeals.ts does the work; the numbers are in `appealConfig` and
// `staffConfig` (src/config/site.ts).
//
// Two kinds of appeal:
//  - "content": the AUTHOR of a post / comment that was REMOVED appeals the removal.
//  - "account": a suspended / banned person appeals the staff decision (the appeal is written in /settings, TODO 36d).
//  - "ad": the advertiser of a REJECTED ad appeals the rejection (filed on /advertise/my/<id>/appeal, ADS_PLAN Session 4c; rules in ad-appeal-rules.ts).
// Same fairness idea as everywhere (PROJECT.md 8d, 8f): a DIFFERENT person than everyone who decided the first time
// reads the appeal, writes why, and nobody judges their own case.

import { DAY_MS } from "@/lib/review-rules";

export type AppealKind = "content" | "account" | "ad";

export type AppealError =
  | "actor" // the name is not an active account
  | "notfound" // no such appeal / post / comment / person
  | "allowed" // this person may not do this (not the author; not a moderator of that community; not an admin)
  | "self" // nobody decides their own appeal
  | "same" // someone who already decided the case first time cannot decide the appeal
  | "state" // the case is not in a state where this applies (not removed, already decided, erased ...)
  | "window" // the removal is older than the appeal window
  | "exists" // this decision was already appealed (one appeal per decision)
  | "message"; // the written appeal / decision note is missing, too short or too long

export type Reviewer = { id: string; isAdmin: boolean; isCommunityModerator: boolean };

/**
 * May THIS person appeal THIS removed post / comment? null = yes, otherwise the reason it is refused.
 * Only the author, only while the account is active (a suspended person appeals the suspension, not the post),
 * only for a REMOVED item (a hidden one is still waiting for its second reviewer), only inside the window,
 * and only once per decision.
 */
export function checkFileContentAppeal(p: {
  appellantId: string;
  authorId: string;
  appellantActive: boolean;
  status: "VISIBLE" | "HIDDEN_PENDING_REVIEW" | "REMOVED";
  erased: boolean; // the author erased it themselves: nothing left to restore
  removedAt: Date | null;
  now: number;
  windowDays: number;
  alreadyAppealed: boolean;
}): AppealError | null {
  if (p.appellantId !== p.authorId) return "allowed";
  if (!p.appellantActive) return "actor";
  if (p.erased || p.status !== "REMOVED") return "state";
  if (p.alreadyAppealed) return "exists";
  if (p.removedAt !== null && p.now - p.removedAt.getTime() > p.windowDays * DAY_MS) return "window";
  return null;
}

/**
 * May THIS person decide THIS appeal? A DIFFERENT person than the appellant and than everyone who decided the
 * first time (`deciderIds`: the hider and the remover of a post; the admin who suspended, proposed or approved a ban).
 * Content appeals: a moderator of that community or an admin. Account and ad appeals: an admin.
 */
export function checkDecideAppeal(p: {
  kind: AppealKind;
  actor: Reviewer;
  appellantId: string;
  deciderIds: string[];
  status: "OPEN" | "ACCEPTED" | "REJECTED";
}): AppealError | null {
  const mayRead = p.kind === "content" ? p.actor.isAdmin || p.actor.isCommunityModerator : p.actor.isAdmin; // account and ad appeals: admins only
  if (!mayRead) return "allowed";
  if (p.actor.id === p.appellantId) return "self";
  if (p.status !== "OPEN") return "state";
  if (p.deciderIds.includes(p.actor.id)) return "same";
  return null;
}

/** The appeal text / decision note must have a real length (no one-word appeals, no one-word answers). */
export function cleanAppealText(text: string, min: number, max: number): string | null {
  const t = text.trim();
  return t.length >= min && t.length <= max ? t : null;
}

/** Waiting longer than `dueDays` for a decision: shown as OVERDUE in the open-appeals list. */
export function isAppealOverdue(createdAt: Date, now: number, dueDays: number): boolean {
  return now - createdAt.getTime() > dueDays * DAY_MS;
}
