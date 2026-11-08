// Ad review and lifecycle (TODO 48 Part 8, ADS_PLAN Sessions 5 + 6). This is the ONE place these rules live; the small
// pure rules are in ad-review-rules.ts (tested by `npm run test:ad-review`), the numbers in `adsConfig` (src/config/site.ts).
//
//  approveAd   SUBMITTED -> APPROVED        (AD_APPROVED; the advertiser is emailed; nothing runs until it is paid)
//  rejectAd    SUBMITTED -> REJECTED        (AD_REJECTED; an ad policy rule + a written reason are mandatory; emailed)
//  markAdPaid  APPROVED + UNPAID -> ACTIVE  (AD_PAID; dates are set: starts now, runs adsConfig.periodDays; emailed)
//  pauseAd     ACTIVE -> PAUSED             (AD_PAUSED; written reason)
//  restoreAd   PAUSED -> ACTIVE             (AD_RESTORED; written reason; not after the end date)
// Every change and its audit-log row are saved in ONE transaction (no action without a record). Nobody reviews, pays for or
// restores their own ad. The ad policy rule key of a rejection is saved in AuditLog.siteRule (a community rule uses ruleId).
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { adsConfig, siteConfig, staffConfig } from "@/config/site";
import { isLocale, t, type Locale } from "@/i18n";
import { cleanText } from "@/lib/review-rules";
import {
  AD_RULE_TEXT,
  checkApprove,
  checkPaid,
  checkPause,
  checkReject,
  checkRestore,
  isPolicyRule,
  runDates,
  type AdError,
} from "@/lib/ad-review-rules";
import {
  AdPaymentStatus,
  AdStatus,
  AuditAction,
  AuditTarget,
  Role,
  UserStatus,
  type Prisma,
} from "../../generated/prisma/client";

export type { AdError };
export type AdResult = { ok: true; auditId: number } | { error: AdError };

class Refused extends Error {
  constructor(public code: AdError) {
    super(code);
  }
}

async function findAdmin(username: string) {
  const u = await prisma.user.findUnique({
    where: { username: username.trim().toLowerCase() },
    select: { id: true, role: true, status: true },
  });
  return u && u.role === Role.ADMIN && u.status === UserStatus.ACTIVE ? u : null;
}

const facts = {
  id: true,
  status: true,
  paymentStatus: true,
  advertiserId: true,
  startDate: true,
  endDate: true,
} as const;

type Outcome = "approved" | "rejected" | "active";

/** Email to the advertiser's contact address, in the advertiser's own language. Never fails the action (it is already saved). */
async function notifyAdvertiser(adId: number, outcome: Outcome, p: { rule?: string; reason?: string }) {
  try {
    const ad = await prisma.adCampaign.findUnique({
      where: { id: adId },
      select: {
        title: true,
        contactEmail: true,
        priceCents: true,
        currency: true,
        startDate: true,
        endDate: true,
        advertiser: { select: { username: true, displayName: true, language: true, status: true } },
      },
    });
    if (!ad || ad.advertiser.status === UserStatus.DELETED) return;
    const locale: Locale = isLocale(ad.advertiser.language) ? ad.advertiser.language : "en";
    const day = (d: Date | null) => (d ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(d) : "-");
    const params = {
      site: siteConfig.name,
      name: ad.advertiser.displayName || ad.advertiser.username,
      title: ad.title,
      rule: p.rule && isPolicyRule(p.rule) ? t(AD_RULE_TEXT[p.rule], undefined, locale) : (p.rule ?? ""),
      reason: p.reason ?? "",
      price: new Intl.NumberFormat("en", { style: "currency", currency: ad.currency }).format(ad.priceCents / 100),
      days: adsConfig.periodDays,
      start: day(ad.startDate),
      end: day(ad.endDate),
    };
    await sendEmail({
      to: ad.contactEmail,
      subject: t(`email.ad.${outcome}.subject`, params, locale),
      text: t(`email.ad.${outcome}.body`, params, locale),
    });
  } catch (error) {
    console.error("ad email failed:", error);
  }
}

type Change = {
  actor: { id: string; role: Role };
  adId: number;
  action: AuditAction;
  /** Looks at the ad INSIDE the transaction and returns an error code, or null to go on. */
  check: (ad: { status: string; paymentStatus: string; advertiserId: string; startDate: Date | null; endDate: Date | null }) => AdError | null;
  /** The status the ad must have right now (so two admins at once cannot both change it) and the data to save. */
  from: AdStatus;
  data: (ad: { startDate: Date | null; endDate: Date | null }) => Prisma.AdCampaignUpdateManyMutationInput;
  reason?: string;
  rule?: string;
};

async function change(c: Change): Promise<AdResult> {
  try {
    const auditId = await prisma.$transaction(async (tx) => {
      const ad = await tx.adCampaign.findUnique({ where: { id: c.adId }, select: facts });
      if (!ad) throw new Refused("notfound");
      const refused = c.check(ad);
      if (refused) throw new Refused(refused);
      const done = await tx.adCampaign.updateMany({ where: { id: c.adId, status: c.from }, data: c.data(ad) });
      if (done.count !== 1) throw new Refused("state");
      const row = await tx.auditLog.create({
        data: {
          actorId: c.actor.id,
          actorRole: c.actor.role,
          action: c.action,
          targetType: AuditTarget.AD,
          targetId: String(c.adId),
          reason: c.reason ?? null,
          siteRule: c.rule ?? null,
        },
        select: { id: true },
      });
      return row.id;
    });
    return { ok: true, auditId };
  } catch (error) {
    if (error instanceof Refused) return { error: error.code };
    throw error;
  }
}

/** Step 1 (good): the ad passed review. It runs only after it is paid. */
export async function approveAd(input: { actor: string; adId: number }): Promise<AdResult> {
  const actor = await findAdmin(input.actor);
  if (!actor) return { error: "actor" };
  const now = new Date();
  const result = await change({
    actor,
    adId: input.adId,
    action: AuditAction.AD_APPROVED,
    from: AdStatus.SUBMITTED,
    check: (ad) => checkApprove(ad, actor.id),
    data: () => ({ status: AdStatus.APPROVED, reviewedById: actor.id, reviewedAt: now, reviewRule: null, reviewNote: null }),
  });
  if ("ok" in result) await notifyAdvertiser(input.adId, "approved", {});
  return result;
}

/** Step 1 (bad): the ad failed review. An ad policy rule and a written reason are mandatory. */
export async function rejectAd(input: { actor: string; adId: number; rule: string; reason: string }): Promise<AdResult> {
  const reason = cleanText(input.reason, staffConfig.minReasonLength, staffConfig.maxReasonLength);
  if (!isPolicyRule(input.rule)) return { error: "rule" };
  if (!reason) return { error: "reason" };
  const actor = await findAdmin(input.actor);
  if (!actor) return { error: "actor" };
  const now = new Date();
  const result = await change({
    actor,
    adId: input.adId,
    action: AuditAction.AD_REJECTED,
    from: AdStatus.SUBMITTED,
    check: (ad) => checkReject(ad, actor.id, input.rule),
    data: () => ({ status: AdStatus.REJECTED, reviewedById: actor.id, reviewedAt: now, reviewRule: input.rule, reviewNote: reason }),
    reason,
    rule: input.rule,
  });
  if ("ok" in result) await notifyAdvertiser(input.adId, "rejected", { rule: input.rule, reason });
  return result;
}

/** The money arrived (marked by hand): the ad becomes ACTIVE, with its dates. */
export async function markAdPaid(input: { actor: string; adId: number }): Promise<AdResult> {
  const actor = await findAdmin(input.actor);
  if (!actor) return { error: "actor" };
  const now = new Date();
  const result = await change({
    actor,
    adId: input.adId,
    action: AuditAction.AD_PAID,
    from: AdStatus.APPROVED,
    check: (ad) => checkPaid(ad, actor.id, now),
    data: (ad) => ({
      status: AdStatus.ACTIVE,
      paymentStatus: AdPaymentStatus.PAID,
      paidAt: now,
      ...runDates(ad, now, adsConfig.periodDays),
    }),
  });
  if ("ok" in result) await notifyAdvertiser(input.adId, "active", {});
  return result;
}

/** Stop a running ad (a written reason is mandatory). */
export async function pauseAd(input: { actor: string; adId: number; reason: string }): Promise<AdResult> {
  const reason = cleanText(input.reason, staffConfig.minReasonLength, staffConfig.maxReasonLength);
  if (!reason) return { error: "reason" };
  const actor = await findAdmin(input.actor);
  if (!actor) return { error: "actor" };
  return change({
    actor,
    adId: input.adId,
    action: AuditAction.AD_PAUSED,
    from: AdStatus.ACTIVE,
    check: (ad) => checkPause(ad),
    data: () => ({ status: AdStatus.PAUSED }),
    reason,
  });
}

/** Let a paused ad run again (a written reason is mandatory). */
export async function restoreAd(input: { actor: string; adId: number; reason: string }): Promise<AdResult> {
  const reason = cleanText(input.reason, staffConfig.minReasonLength, staffConfig.maxReasonLength);
  if (!reason) return { error: "reason" };
  const actor = await findAdmin(input.actor);
  if (!actor) return { error: "actor" };
  const now = new Date();
  return change({
    actor,
    adId: input.adId,
    action: AuditAction.AD_RESTORED,
    from: AdStatus.PAUSED,
    check: (ad) => checkRestore(ad, actor.id, now),
    data: () => ({ status: AdStatus.ACTIVE }),
    reason,
  });
}

/**
 * Ads whose end date has passed become ENDED. Called whenever the admin Ads screen is opened (no background job needed:
 * the public pool already ignores an ad outside its dates, this only keeps the status honest). No person acts, so no audit row.
 */
export async function endExpiredAds(): Promise<number> {
  const done = await prisma.adCampaign.updateMany({
    where: { status: { in: [AdStatus.ACTIVE, AdStatus.PAUSED] }, endDate: { lt: new Date() } },
    data: { status: AdStatus.ENDED },
  });
  return done.count;
}
