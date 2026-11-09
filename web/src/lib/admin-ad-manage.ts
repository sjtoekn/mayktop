// Admin: edit or delete ANY ad (added 2026-11-09). Server only. The caller (the server action) has already checked that the person is an admin.
//  - Edit: title, text, link (https), contact email and the place (slot). The format and the picture / video stay as they are.
//    Same length / link / email checks as the "Create an ad" form (ad-input.ts); the blocked-words check is NOT applied: the admin is trusted.
//  - Delete: removes the ad and its daily counters for good. It is refused while an appeal about this ad is still open.
// No audit row is written for these two (the AuditAction list has no value for them yet; that needs a database change).
import { adsConfig } from "@/config/site";
import { cleanEmail, cleanHttpsUrl, cleanLine } from "@/lib/ad-input";
import { prisma } from "@/lib/prisma";
import { AppealStatus, AuditTarget } from "../../generated/prisma/client";

export type ManageError = "type" | "notfound" | "title" | "body" | "url" | "email" | "slot" | "appeal";
export type ManageResult = { ok: true } | { error: ManageError };

export async function adminEditAd(input: {
  adId: number;
  title: unknown;
  body: unknown;
  url: unknown;
  email: unknown;
  slot: unknown;
}): Promise<ManageResult> {
  if (!input || !Number.isInteger(input.adId)) return { error: "type" };
  if (typeof input.title !== "string" || typeof input.body !== "string" || typeof input.slot !== "string") return { error: "type" };

  const title = cleanLine(input.title);
  if (title.length < adsConfig.titleMinLength || title.length > adsConfig.titleMaxLength) return { error: "title" };
  const body = cleanLine(input.body);
  if (body.length < adsConfig.bodyMinLength || body.length > adsConfig.bodyMaxLength) return { error: "body" };
  const destinationUrl = cleanHttpsUrl(input.url);
  if (!destinationUrl) return { error: "url" };
  const contactEmail = cleanEmail(input.email);
  if (!contactEmail) return { error: "email" };
  if (!(adsConfig.slots as readonly string[]).includes(input.slot)) return { error: "slot" };
  const slot = input.slot as (typeof adsConfig.slots)[number];

  const ad = await prisma.adCampaign.findUnique({ where: { id: input.adId }, select: { id: true, format: true } });
  if (!ad) return { error: "notfound" };
  if (slot === "HEADER" && ad.format !== "IMAGE") return { error: "slot" }; // the header banner is a wide PICTURE

  await prisma.adCampaign.update({
    where: { id: ad.id },
    data: { title, body, destinationUrl, contactEmail, slot, ...(slot === "SOCIAL_FEED" ? { communityId: null } : {}) },
  });
  return { ok: true };
}

export async function adminDeleteAd(input: { adId: number }): Promise<ManageResult> {
  if (!input || !Number.isInteger(input.adId)) return { error: "type" };
  const ad = await prisma.adCampaign.findUnique({ where: { id: input.adId }, select: { id: true } });
  if (!ad) return { error: "notfound" };

  const openAppeals = await prisma.appeal.count({
    where: { status: AppealStatus.OPEN, auditLog: { targetType: AuditTarget.AD, targetId: String(ad.id) } },
  });
  if (openAppeals > 0) return { error: "appeal" };

  await prisma.$transaction([
    prisma.adDailyStat.deleteMany({ where: { adId: ad.id } }), // the database refuses to delete an ad that still has counters
    prisma.adCampaign.delete({ where: { id: ad.id } }),
  ]);
  return { ok: true };
}
