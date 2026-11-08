// Pause / resume / end / edit of an advertiser's OWN ad (ADS_PLAN Sessions 4a + 4b). Server only. Rules: ad-own-rules.ts.
// Every change and its audit-log row are saved in ONE transaction (no action without a record). The audit rows are the ones
// the admin screen uses (AD_PAUSED / AD_RESTORED) plus AD_ENDED and AD_RESUBMITTED; the actor tells who did it, and "resume"
// is allowed only when the newest AD_PAUSED row belongs to the advertiser (see wasPausedByAdvertiser).
import { prisma } from "@/lib/prisma";
import {
  checkOwnEdit,
  checkOwnEnd,
  checkOwnPause,
  checkOwnResume,
  endedDates,
  wasPausedByAdvertiser,
  type OwnAdError,
} from "@/lib/ad-own-rules";
import { checkSubmitLimits, cleanAdInput, type AdInputError } from "@/lib/ad-input";
import { AdStatus, AppealStatus, AuditAction, AuditTarget, type Prisma } from "../../generated/prisma/client";

export type OwnAdResult = { ok: true } | { error: OwnAdError };
export type EditAdResult = { ok: true } | { error: OwnAdError | AdInputError | "limit-waiting"; phrase?: string };

class Refused extends Error {
  constructor(public code: OwnAdError | "limit-waiting") {
    super(code);
  }
}

type Kind = "pause" | "resume" | "end";

async function ownChange(userId: string, adId: number, kind: Kind): Promise<OwnAdResult> {
  try {
    await prisma.$transaction(async (tx) => {
      const ad = await tx.adCampaign.findUnique({
        where: { id: adId },
        select: { status: true, advertiserId: true, endDate: true, advertiser: { select: { role: true } } },
      });
      if (!ad) throw new Refused("notfound");
      const now = new Date();
      let refused: OwnAdError | null;
      if (kind === "pause") {
        refused = checkOwnPause(ad, userId);
      } else if (kind === "end") {
        refused = checkOwnEnd(ad, userId);
      } else {
        const last = await tx.auditLog.findFirst({
          where: { targetType: AuditTarget.AD, targetId: String(adId), action: AuditAction.AD_PAUSED },
          orderBy: { id: "desc" },
          select: { actorId: true },
        });
        refused = checkOwnResume(ad, userId, now, wasPausedByAdvertiser(last, ad.advertiserId));
      }
      if (refused) throw new Refused(refused);
      const data: Prisma.AdCampaignUpdateManyMutationInput =
        kind === "pause" ? { status: AdStatus.PAUSED }
        : kind === "resume" ? { status: AdStatus.ACTIVE }
        : { status: AdStatus.ENDED, ...endedDates(ad, now) };
      // `status: ad.status` makes sure two quick clicks (or an admin at the same moment) cannot both change it.
      const done = await tx.adCampaign.updateMany({ where: { id: adId, status: ad.status }, data });
      if (done.count !== 1) throw new Refused("state");
      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorRole: ad.advertiser.role,
          action: kind === "pause" ? AuditAction.AD_PAUSED : kind === "resume" ? AuditAction.AD_RESTORED : AuditAction.AD_ENDED,
          targetType: AuditTarget.AD,
          targetId: String(adId),
          reason: null,
          siteRule: null,
        },
      });
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof Refused && error.code !== "limit-waiting") return { error: error.code };
    throw error;
  }
}

/** The advertiser stops their own running ad. */
export function pauseOwnAd(userId: string, adId: number): Promise<OwnAdResult> {
  return ownChange(userId, adId, "pause");
}

/** The advertiser runs their own ad again (only if THEY paused it, and only before its end date). */
export function resumeOwnAd(userId: string, adId: number): Promise<OwnAdResult> {
  return ownChange(userId, adId, "resume");
}

/** The advertiser ends their own ad for good (withdraws a waiting one, or stops a running / paused one). */
export function endOwnAd(userId: string, adId: number): Promise<OwnAdResult> {
  return ownChange(userId, adId, "end");
}

export type EditInput = { title: string; body: string; url: string; email: string; agree: boolean };

/**
 * Fix a REJECTED ad and send it again: the text, link and contact email are checked exactly like a new ad (cleanAdInput);
 * format, slot, community and the picture / video stay as they were. The ad goes back to SUBMITTED, the old rejection is
 * cleared from the ad (it stays in the audit log), and it counts as one more ad waiting for review.
 */
export async function resubmitOwnAd(userId: string, adId: number, input: EditInput): Promise<EditAdResult> {
  const ad = await prisma.adCampaign.findUnique({
    where: { id: adId },
    select: { status: true, advertiserId: true, endDate: true, format: true, slot: true, community: { select: { slug: true } }, advertiser: { select: { role: true } } },
  });
  if (!ad) return { error: "notfound" };
  const refused = checkOwnEdit(ad, userId);
  if (refused) return { error: refused };
  // (an open appeal of the rejection is checked inside the transaction below, where it cannot change under us)

  const cleaned = cleanAdInput({
    format: ad.format,
    slot: ad.slot,
    community: ad.community?.slug ?? "",
    title: input.title,
    body: input.body,
    url: input.url,
    email: input.email,
    start: "",
    agree: input.agree === true,
  });
  if (!cleaned.ok) return { error: cleaned.error, phrase: cleaned.phrase };
  const value = cleaned.value;
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      // An open appeal of the rejection must be answered first (Session 4c): two answers at once would clash.
      const openAppeal = await tx.appeal.findFirst({
        where: { appellantId: userId, status: AppealStatus.OPEN, auditLog: { targetType: AuditTarget.AD, targetId: String(adId) } },
        select: { id: true },
      });
      if (openAppeal) throw new Refused("state");
      const waiting = await tx.adCampaign.count({ where: { advertiserId: userId, status: AdStatus.SUBMITTED } });
      if (checkSubmitLimits(waiting, 0) !== "ok") throw new Refused("limit-waiting");
      const done = await tx.adCampaign.updateMany({
        where: { id: adId, status: AdStatus.REJECTED },
        data: {
          title: value.title,
          body: value.body,
          destinationUrl: value.destinationUrl,
          contactEmail: value.contactEmail,
          status: AdStatus.SUBMITTED,
          submittedAt: now,
          reviewedById: null,
          reviewedAt: null,
          reviewRule: null,
          reviewNote: null,
        },
      });
      if (done.count !== 1) throw new Refused("state");
      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorRole: ad.advertiser.role,
          action: AuditAction.AD_RESUBMITTED,
          targetType: AuditTarget.AD,
          targetId: String(adId),
          reason: null,
          siteRule: null,
        },
      });
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof Refused) return { error: error.code };
    throw error;
  }
}
