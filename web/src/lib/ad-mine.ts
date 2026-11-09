// "My ads" (ADS_PLAN Sessions 4a + 4c, patch-ads-my-list): reads the logged-in advertiser's own ads with their status, review result
// and totals. It only READS (the rules for the buttons are in ad-own-rules.ts). Totals are per ad per day; nothing about visitors exists.
// patch-ads-my-list: the list is now TABS (all / running / waiting / rejected / ended), 10 ads a page, and the numbers of each ad can be
// shown for the last 7 / 30 / 90 days or all time. Only the ads of the page being shown are read in full.
import { prisma } from "@/lib/prisma";
import { endExpiredAds } from "@/lib/ad-review";
import { ctrText } from "@/lib/ad-review-rules";
import { checkOwnEdit, ownActions, wasPausedByAdvertiser, type OwnAction } from "@/lib/ad-own-rules";
import { loadAdAppealInfo, type AdAppealInfo } from "@/lib/appeals";
import { utcMidnight } from "@/lib/ad-stats";
import {
  MY_PAGE_SIZE, countsByView, myPageInfo, rangeStartDay, statusesFor, type MyQuery, type MyView,
} from "@/lib/ad-mine-list-rules";
import { AuditAction, AuditTarget, type AdStatus, type Prisma } from "../../generated/prisma/client";

export type MyAdDay = { date: Date; impressions: number; clicks: number };

export type MyAd = {
  id: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "ACTIVE" | "PAUSED" | "ENDED";
  format: "TEXT" | "IMAGE" | "VIDEO";
  slot: "SIDEBAR" | "FEED" | "SOCIAL_FEED" | "HEADER";
  title: string;
  body: string;
  imageUrl: string | null; // the picture of an IMAGE ad (our own address)
  videoUrl: string | null;
  host: string; // address shown under the ad
  community: string | null; // null = any page
  submittedAt: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  priceCents: number;
  currency: string;
  paid: boolean;
  reviewRule: string | null; // ad policy rule key of a rejection
  reviewNote: string | null; // the written reason
  pausedBy: "you" | "staff" | null; // only for a PAUSED ad
  impressions: number; // all time
  clicks: number; // all time
  ctr: string;
  range: { impressions: number; clicks: number; ctr: string } | null; // the chosen range (7 / 30 / 90 days); null = all time
  days: MyAdDay[]; // the last 7 UTC days, oldest first, zeros included
  actions: OwnAction[];
  canEdit: boolean; // a REJECTED ad can be fixed and sent again (Session 4b), unless an appeal of the rejection is open (4c)
  appeal: AdAppealInfo | null; // the appeal of the newest rejection: can appeal / open / accepted / rejected (Session 4c)
};

const DAY_MS = 24 * 60 * 60 * 1000;

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

export type MyAdsPage = {
  items: MyAd[];
  total: number; // ads in this tab
  counts: Record<MyView, number>; // ads per tab
  pages: number;
  page: number;
  from: number;
  to: number;
};

export async function loadMyAdsPage(userId: string, query: MyQuery): Promise<MyAdsPage> {
  await endExpiredAds(); // keep the statuses honest before showing them

  const grouped = await prisma.adCampaign.groupBy({ by: ["status"], where: { advertiserId: userId }, _count: { _all: true } });
  const counts = countsByView(grouped.map((g) => ({ status: g.status, count: g._count._all })));
  const total = counts[query.view];
  const info = myPageInfo(total, query.page);
  const empty: MyAdsPage = { items: [], total, counts, pages: info.pages, page: info.page, from: info.from, to: info.to };
  if (total === 0) return empty;

  const statuses = statusesFor(query.view);
  const where: Prisma.AdCampaignWhereInput = { advertiserId: userId };
  if (statuses) where.status = { in: [...statuses] as AdStatus[] };
  const ads = await prisma.adCampaign.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: info.skip,
    take: MY_PAGE_SIZE,
    select: {
      id: true, status: true, format: true, slot: true, title: true, body: true, imageUrl: true, videoUrl: true, destinationUrl: true,
      submittedAt: true, startDate: true, endDate: true, priceCents: true, currency: true, paymentStatus: true,
      reviewRule: true, reviewNote: true, community: { select: { slug: true } },
    },
  });
  if (ads.length === 0) return empty;
  const ids = ads.map((a) => a.id);

  const today = utcMidnight();
  const weekStart = new Date(today.getTime() - 6 * DAY_MS);
  const rangeStart = rangeStartDay(query.range, today); // null = all time
  const pausedIds = ads.filter((a) => a.status === "PAUSED").map((a) => String(a.id));
  const [totals, week, inRange, pauses] = await Promise.all([
    prisma.adDailyStat.groupBy({ by: ["adId"], where: { adId: { in: ids } }, _sum: { impressions: true, clicks: true } }),
    prisma.adDailyStat.findMany({
      where: { adId: { in: ids }, date: { gte: weekStart } },
      select: { adId: true, date: true, impressions: true, clicks: true },
    }),
    rangeStart === null
      ? Promise.resolve([] as { adId: number; _sum: { impressions: number | null; clicks: number | null } }[])
      : prisma.adDailyStat.groupBy({ by: ["adId"], where: { adId: { in: ids }, date: { gte: rangeStart } }, _sum: { impressions: true, clicks: true } }),
    pausedIds.length === 0
      ? Promise.resolve([] as { targetId: string; actorId: string }[])
      : prisma.auditLog.findMany({
          where: { targetType: AuditTarget.AD, targetId: { in: pausedIds }, action: AuditAction.AD_PAUSED },
          orderBy: { id: "desc" }, // newest first: the first row of each ad is the one that counts
          select: { targetId: true, actorId: true },
        }),
  ]);
  const appeals = await loadAdAppealInfo(userId, ads.map((a) => ({ id: a.id, status: a.status, advertiserId: userId })));
  const total2 = new Map(totals.map((r) => [r.adId, r._sum]));
  const ranged = new Map(inRange.map((r) => [r.adId, r._sum]));
  const lastPause = new Map<string, { actorId: string }>();
  for (const row of pauses) if (!lastPause.has(row.targetId)) lastPause.set(row.targetId, { actorId: row.actorId });

  const now = new Date();
  const items: MyAd[] = ads.map((a) => {
    const impressions = total2.get(a.id)?.impressions ?? 0;
    const clicks = total2.get(a.id)?.clicks ?? 0;
    const mine = week.filter((r) => r.adId === a.id);
    const days: MyAdDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart.getTime() + i * DAY_MS);
      const row = mine.find((r) => r.date.getTime() === date.getTime());
      days.push({ date, impressions: row?.impressions ?? 0, clicks: row?.clicks ?? 0 });
    }
    const pausedByYou = a.status === "PAUSED" && wasPausedByAdvertiser(lastPause.get(String(a.id)) ?? null, userId);
    const r = ranged.get(a.id);
    const rangeImpressions = r?.impressions ?? 0;
    const rangeClicks = r?.clicks ?? 0;
    return {
      id: a.id,
      status: a.status,
      format: a.format,
      slot: a.slot,
      title: a.title,
      body: a.body,
      imageUrl: a.imageUrl,
      videoUrl: a.videoUrl,
      host: hostOf(a.destinationUrl),
      community: a.community?.slug ?? null,
      submittedAt: a.submittedAt,
      startDate: a.startDate,
      endDate: a.endDate,
      priceCents: a.priceCents,
      currency: a.currency,
      paid: a.paymentStatus === "PAID",
      reviewRule: a.reviewRule,
      reviewNote: a.reviewNote,
      pausedBy: a.status === "PAUSED" ? (pausedByYou ? "you" : "staff") : null,
      impressions,
      clicks,
      ctr: ctrText(impressions, clicks),
      range: rangeStart === null ? null : { impressions: rangeImpressions, clicks: rangeClicks, ctr: ctrText(rangeImpressions, rangeClicks) },
      days,
      actions: ownActions({ status: a.status, advertiserId: userId, endDate: a.endDate }, userId, now, pausedByYou),
      canEdit: checkOwnEdit({ status: a.status, advertiserId: userId, endDate: a.endDate }, userId, appeals.get(a.id)?.state === "open") === null,
      appeal: appeals.get(a.id) ?? null,
    };
  });
  return { items, total, counts, pages: info.pages, page: info.page, from: info.from, to: info.to };
}
