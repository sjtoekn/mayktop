// Admin Part 8 (Ads): the data for the screen. No rule lives here: what an admin may do is decided in ad-review-rules.ts and
// checked again in ad-review.ts. This file only READS, adds the totals, and says which buttons to show.
import { prisma } from "@/lib/prisma";
import { endExpiredAds } from "@/lib/ad-review";
import { sendEndingSoonNotices } from "@/lib/ad-notices";
import { ctrText } from "@/lib/ad-review-rules";
import { AdStatus } from "../../generated/prisma/client";

export type AdAction = "approve" | "reject" | "paid" | "pause" | "restore";
export type AdSection = "queue" | "waiting" | "active" | "paused";

export type AdItem = {
  id: number;
  section: AdSection;
  title: string;
  body: string;
  format: "TEXT" | "IMAGE" | "VIDEO";
  imageUrl: string | null; // the picture, or the poster of a video ad (our own address)
  videoUrl: string | null;
  destinationUrl: string;
  host: string; // the address shown under the ad, as in the real box
  slot: "SIDEBAR" | "FEED" | "SOCIAL_FEED";
  community: string | null; // null = any page
  advertiser: string; // username
  contactEmail: string;
  submittedAt: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  priceCents: number;
  currency: string;
  paid: boolean;
  impressions: number;
  clicks: number;
  weekImpressions: number;
  ctr: string;
  actions: AdAction[]; // buttons this admin may press
  blockedSelf: boolean; // true = it is this admin's own ad, so the buttons that need another person are hidden
};

const SECTION_BY_STATUS: Partial<Record<AdStatus, AdSection>> = {
  [AdStatus.SUBMITTED]: "queue",
  [AdStatus.APPROVED]: "waiting",
  [AdStatus.ACTIVE]: "active",
  [AdStatus.PAUSED]: "paused",
};

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

export async function loadAds(meId: string): Promise<Record<AdSection, AdItem[]>> {
  await endExpiredAds(); // keep the statuses honest before showing them
  await sendEndingSoonNotices().catch((error) => console.error("ending-soon notices failed:", error)); // once per ad (Session 4c)
  const ads = await prisma.adCampaign.findMany({
    where: { status: { in: [AdStatus.SUBMITTED, AdStatus.APPROVED, AdStatus.ACTIVE, AdStatus.PAUSED] } },
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }], // oldest first
    select: {
      id: true, status: true, title: true, body: true, format: true, imageUrl: true, videoUrl: true, destinationUrl: true, slot: true, contactEmail: true,
      submittedAt: true, startDate: true, endDate: true, priceCents: true, currency: true, paymentStatus: true,
      advertiserId: true, advertiser: { select: { username: true } }, community: { select: { slug: true } },
    },
  });
  const ids = ads.map((a) => a.id);
  const weekStart = new Date();
  weekStart.setUTCHours(0, 0, 0, 0);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const [totals, week] = await Promise.all([
    prisma.adDailyStat.groupBy({ by: ["adId"], where: { adId: { in: ids } }, _sum: { impressions: true, clicks: true } }),
    prisma.adDailyStat.groupBy({ by: ["adId"], where: { adId: { in: ids }, date: { gte: weekStart } }, _sum: { impressions: true } }),
  ]);
  const total = new Map(totals.map((r) => [r.adId, r._sum]));
  const weekly = new Map(week.map((r) => [r.adId, r._sum.impressions ?? 0]));

  const out: Record<AdSection, AdItem[]> = { queue: [], waiting: [], active: [], paused: [] };
  for (const a of ads) {
    const section = SECTION_BY_STATUS[a.status];
    if (!section) continue;
    const own = a.advertiserId === meId;
    const impressions = total.get(a.id)?.impressions ?? 0;
    const clicks = total.get(a.id)?.clicks ?? 0;
    const actions: AdAction[] =
      section === "queue" ? (own ? [] : ["approve", "reject"])
      : section === "waiting" ? (own ? [] : ["paid"])
      : section === "active" ? ["pause"]
      : own ? [] : ["restore"];
    out[section].push({
      id: a.id,
      section,
      title: a.title,
      body: a.body,
      format: a.format,
      imageUrl: a.imageUrl,
      videoUrl: a.videoUrl,
      destinationUrl: a.destinationUrl,
      host: hostOf(a.destinationUrl),
      slot: a.slot,
      community: a.community?.slug ?? null,
      advertiser: a.advertiser.username,
      contactEmail: a.contactEmail,
      submittedAt: a.submittedAt,
      startDate: a.startDate,
      endDate: a.endDate,
      priceCents: a.priceCents,
      currency: a.currency,
      paid: a.paymentStatus === "PAID",
      impressions,
      clicks,
      weekImpressions: weekly.get(a.id) ?? 0,
      ctr: ctrText(impressions, clicks),
      actions,
      blockedSelf: own && actions.length === 0,
    });
  }
  return out;
}
