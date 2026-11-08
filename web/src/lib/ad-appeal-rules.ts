// The small, plain rules of APPEALING an ad rejection (ADS_PLAN Session 4c). No database here, so they are easy to read and to
// test (npm run test:ad-appeal). src/lib/appeals.ts does the work (the same `Appeal` table as content and account appeals).
//
//  1. Only the ADVERTISER of the ad can appeal. For anyone else the ad "does not exist" (we never admit it).
//  2. Only an ad that is REJECTED right now. If the advertiser already fixed it and sent it again (SUBMITTED), there is nothing to appeal.
//  3. Only while the account is active, only inside the appeal window (`appealConfig.windowDays`, counted from the rejection),
//     and only ONCE per rejection (a second rejection after a new send is a new decision and can be appealed again).
//  4. While an appeal is OPEN the advertiser cannot edit and resend the same ad (two answers at once would clash).
//  5. Deciding: an ADMIN who is not the advertiser and who never approved or rejected this ad before (checkDecideAppeal, kind "ad").
//  6. Accepting reverses the rejection: the ad becomes APPROVED (it runs after it is paid, like any approved ad).
//     Rejecting changes nothing except the record; the advertiser can still edit it and send it again as a new attempt.
import { DAY_MS } from "@/lib/review-rules";

export type AdAppealError =
  | "notfound" // no such ad, or it is not yours
  | "actor" // the account is not active
  | "state" // the ad is not REJECTED (or it changed while you looked)
  | "window" // the rejection is older than the appeal window
  | "exists" // this rejection was already appealed
  | "message"; // the written appeal is missing, too short or too long

export function checkFileAdAppeal(p: {
  appellantId: string;
  advertiserId: string;
  appellantActive: boolean;
  status: string; // AdStatus of the ad right now
  rejectedAt: Date | null; // when the rejection was written (the audit-log row)
  now: number;
  windowDays: number;
  alreadyAppealed: boolean; // this rejection (audit-log row) already has an appeal from this person
}): AdAppealError | null {
  if (p.appellantId !== p.advertiserId) return "notfound";
  if (!p.appellantActive) return "actor";
  if (p.status !== "REJECTED") return "state";
  if (p.alreadyAppealed) return "exists";
  if (p.rejectedAt !== null && p.now - p.rejectedAt.getTime() > p.windowDays * DAY_MS) return "window";
  return null;
}

/** What "My ads" shows under a rejected ad. */
export type AdAppealState = "can" | "open" | "accepted" | "rejected" | "none";

/**
 * `appeal` = this person's appeal of the newest rejection (or null). "none" = nothing can be done any more
 * (window over, or the account is not active), so the page shows no appeal button.
 */
export function adAppealState(appeal: { status: "OPEN" | "ACCEPTED" | "REJECTED" } | null, refused: AdAppealError | null): AdAppealState {
  if (appeal?.status === "OPEN") return "open";
  if (appeal?.status === "ACCEPTED") return "accepted";
  if (appeal?.status === "REJECTED") return "rejected";
  return refused === null ? "can" : "none";
}
