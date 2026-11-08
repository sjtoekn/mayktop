// The small, plain rules of what an ADVERTISER may do to their OWN ad (ADS_PLAN Sessions 4a + 4b). No database here, so they
// are easy to read and to test (npm run test:ad-own). src/lib/ad-own.ts does the work.
//
//  1. Only the advertiser of an ad may pause, resume, end or edit it. Anyone else gets "notfound" (we do not admit the ad exists).
//  2. Pause: only a running (ACTIVE) ad. Stopping is always safe.
//  3. Resume: only a PAUSED ad, only when the ADVERTISER paused it (an ad paused by our team stays paused until our team
//     restores it, so a pause for breaking a rule cannot be undone by the advertiser), and not after its end date.
//  4. The days of the paid period keep counting while an ad is paused (the flat fee buys a period, not a number of views).
//  5. End (4b): withdraw an ad that waits for review or payment, or stop a running / paused ad for good. It cannot be started again.
//  6. Edit (4b): only a REJECTED ad can be edited; sending it again puts it back in the review queue (a running ad is never
//     changed behind the reviewer's back). Not while an appeal of that rejection is open (4c).

export type OwnAdError =
  | "notfound" // no such ad, or it is not yours
  | "state" // the ad is not in the state this step needs (or it changed while you looked)
  | "staff" // our team paused it: only our team can run it again
  | "expired" // the end date has passed
  | "other";

export type OwnAdFacts = { status: string; advertiserId: string; endDate: Date | null };

export function checkOwnPause(ad: OwnAdFacts, userId: string): OwnAdError | null {
  if (ad.advertiserId !== userId) return "notfound";
  return ad.status === "ACTIVE" ? null : "state";
}

export function checkOwnResume(ad: OwnAdFacts, userId: string, now: Date, pausedByAdvertiser: boolean): OwnAdError | null {
  if (ad.advertiserId !== userId) return "notfound";
  if (ad.status !== "PAUSED") return "state";
  if (!pausedByAdvertiser) return "staff";
  if (ad.endDate && ad.endDate.getTime() < now.getTime()) return "expired";
  return null;
}

const ENDABLE = ["SUBMITTED", "APPROVED", "ACTIVE", "PAUSED"];

export function checkOwnEnd(ad: OwnAdFacts, userId: string): OwnAdError | null {
  if (ad.advertiserId !== userId) return "notfound";
  return ENDABLE.includes(ad.status) ? null : "state";
}

/** `hasOpenAppeal`: while an appeal of the rejection is open, the ad cannot be edited and sent again (Session 4c). */
export function checkOwnEdit(ad: OwnAdFacts, userId: string, hasOpenAppeal = false): OwnAdError | null {
  if (ad.advertiserId !== userId) return "notfound";
  if (ad.status !== "REJECTED") return "state";
  return hasOpenAppeal ? "state" : null;
}

/** `lastPause` = the newest AD_PAUSED audit row of the ad (or null). The advertiser paused it only if that row is theirs. */
export function wasPausedByAdvertiser(lastPause: { actorId: string } | null, advertiserId: string): boolean {
  return lastPause !== null && lastPause.actorId === advertiserId;
}

/** The date an ended ad stops running: now, unless its end date is already earlier (or it never had dates). */
export function endedDates(ad: { status: string; endDate: Date | null }, now: Date): { endDate?: Date } {
  if (ad.status !== "ACTIVE" && ad.status !== "PAUSED") return {}; // never started: no dates to change
  return ad.endDate && ad.endDate.getTime() < now.getTime() ? {} : { endDate: now };
}

export type OwnAction = "pause" | "resume" | "end";

/** Which buttons the advertiser sees under an ad (the server checks again when a button is pressed). */
export function ownActions(ad: OwnAdFacts, userId: string, now: Date, pausedByAdvertiser: boolean): OwnAction[] {
  const out: OwnAction[] = [];
  if (checkOwnPause(ad, userId) === null) out.push("pause");
  if (checkOwnResume(ad, userId, now, pausedByAdvertiser) === null) out.push("resume");
  if (checkOwnEnd(ad, userId) === null) out.push("end");
  return out;
}
