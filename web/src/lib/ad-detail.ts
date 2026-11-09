// Ad details (patch-ads-details): reads ONE ad with its full numbers, for the advertiser (own ad only) or for an admin (any ad),
// and the numbers of all ads for the admin overview. It only READS. Totals are per ad per day; nothing about visitors exists (ADS_PLAN decision 3).
import { prisma } from "@/lib/prisma";
import { endExpiredAds } from "@/lib/ad-review";
import { ctrText } from "@/lib/ad-review-rules";
import { DAY_MS, DETAIL_MAX_DAYS, dayStart, fillDays, periodInfo, rangeEnd, rangeStart, spread, summarize, type AdSummary, type DayRow, type PeriodInfo } from "@/lib/ad-detail-rules";
import { AdStatus, AuditTarget } from "../../generated/prisma/client";

export type AdDetailViewer = { kind: "advertiser"; userId: string } | { kind: "admin" };

export type AdHistoryRow = { id: number; action: string; at: Date; actor: string; role: string; reason: string | null };

export type AdDetail = {
  id: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "ACTIVE" | "PAUSED" | "ENDED";
  format: "TEXT" | "IMAGE" | "VIDEO";
  slot: "SIDEBAR" | "FEED" | "SOCIAL_FEED" | "HEADER";
  title: string;
  body: string;
  imageUrl: string | null;
  videoUrl: string | null;
  destinationUrl: string;
  host: string;
  community: string | null;
  advertiser: string; // username (shown to admins only)
  contactEmail: string; // shown to admins only
  submittedAt: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  priceCents: number;
  currency: string;
  paid: boolean;
  paidAt: Date | null;
  summary: AdSummary; // all days ever counted
  days: DayRow[]; // the newest DETAIL_MAX_DAYS days, oldest first, zeros included
  allDays: DayRow[]; // every day of the range, oldest first (used by the CSV download)
  olderDays: number; // days that are in the totals but not listed
  period: PeriodInfo;
  history: AdHistoryRow[]; // admin only; empty for the advertiser
};

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

export async function loadAdDetail(adId: number, viewer: AdDetailViewer): Promise<AdDetail | null> {
  if (!Number.isInteger(adId) || adId < 1) return null;
  await endExpiredAds(); // keep the statuses honest before showing them
  const ad = await prisma.adCampaign.findFirst({
    where: viewer.kind === "advertiser" ? { id: adId, advertiserId: viewer.userId } : { id: adId },
    select: {
      id: true, status: true, format: true, slot: true, title: true, body: true, imageUrl: true, videoUrl: true, destinationUrl: true,
      contactEmail: true, submittedAt: true, startDate: true, endDate: true, priceCents: true, currency: true, paymentStatus: true, paidAt: true,
      advertiser: { select: { username: true } }, community: { select: { slug: true } },
    },
  });
  if (!ad) return null;

  const [rows, history] = await Promise.all([
    prisma.adDailyStat.findMany({ where: { adId }, orderBy: { date: "asc" }, select: { date: true, impressions: true, clicks: true } }),
    viewer.kind === "admin"
      ? prisma.auditLog.findMany({
          where: { targetType: AuditTarget.AD, targetId: String(adId) },
          orderBy: { id: "desc" },
          take: 50,
          select: { id: true, action: true, createdAt: true, reason: true, actorRole: true, actor: { select: { username: true } } },
        })
      : Promise.resolve([]),
  ]);

  const now = new Date();
  const from = rangeStart(ad.startDate, rows[0]?.date ?? null, now);
  // A day with counts before the start date (it should not happen) is still shown: start the range at the first counted day if it is earlier.
  const first = rows[0] ? dayStart(rows[0].date) : null;
  const start = first && first.getTime() < from.getTime() ? first : from;
  const all = fillDays(rows, start, rangeEnd(ad.endDate, now), 100000);
  const days = all.slice(-DETAIL_MAX_DAYS);

  return {
    id: ad.id,
    status: ad.status,
    format: ad.format,
    slot: ad.slot,
    title: ad.title,
    body: ad.body,
    imageUrl: ad.imageUrl,
    videoUrl: ad.videoUrl,
    destinationUrl: ad.destinationUrl,
    host: hostOf(ad.destinationUrl),
    community: ad.community?.slug ?? null,
    advertiser: ad.advertiser.username,
    contactEmail: ad.contactEmail,
    submittedAt: ad.submittedAt,
    startDate: ad.startDate,
    endDate: ad.endDate,
    priceCents: ad.priceCents,
    currency: ad.currency,
    paid: ad.paymentStatus === "PAID",
    paidAt: ad.paidAt,
    summary: summarize(all),
    days,
    allDays: all,
    olderDays: Math.max(0, all.length - days.length),
    period: ad.status === "ACTIVE" || ad.status === "PAUSED" ? periodInfo(ad.startDate, ad.endDate, now) : null,
    history: history.map((h) => ({ id: h.id, action: h.action, at: h.createdAt, actor: h.actor.username, role: h.actorRole, reason: h.reason })),
  };
}

// ---------------------------------------------------------------- admin overview (all ads)

export type OverviewPeriod = { impressions: number; clicks: number; ctr: string };
export type OverviewGroup = { key: string; running: number; impressions: number; clicks: number; ctr: string }; // last 30 days
export type OverviewRow = {
  id: number; title: string; advertiser: string; status: AdDetail["status"]; slot: AdDetail["slot"]; format: AdDetail["format"];
  impressions: number; clicks: number; ctr: string; week: number;
};
export type AdsOverview = {
  p7: OverviewPeriod;
  p30: OverviewPeriod;
  all: OverviewPeriod;
  bySlot: OverviewGroup[];
  byFormat: OverviewGroup[];
  fair: { count: number; min: number; avg: number; max: number }; // impressions in the last 7 days among running ads
  rows: OverviewRow[]; // the 200 ads with the most impressions
  totalAds: number;
};

const ROW_LIMIT = 200;

export async function loadAdsOverview(): Promise<AdsOverview> {
  await endExpiredAds();
  const today = dayStart(new Date());
  const from7 = new Date(today.getTime() - 6 * DAY_MS);
  const from30 = new Date(today.getTime() - 29 * DAY_MS);
  const [ads, allTime, last30, last7] = await Promise.all([
    prisma.adCampaign.findMany({
      where: { status: { not: AdStatus.DRAFT } },
      select: { id: true, title: true, status: true, slot: true, format: true, advertiser: { select: { username: true } } },
    }),
    prisma.adDailyStat.groupBy({ by: ["adId"], _sum: { impressions: true, clicks: true } }),
    prisma.adDailyStat.groupBy({ by: ["adId"], where: { date: { gte: from30 } }, _sum: { impressions: true, clicks: true } }),
    prisma.adDailyStat.groupBy({ by: ["adId"], where: { date: { gte: from7 } }, _sum: { impressions: true, clicks: true } }),
  ]);
  const toMap = (list: { adId: number; _sum: { impressions: number | null; clicks: number | null } }[]) =>
    new Map(list.map((r) => [r.adId, { impressions: r._sum.impressions ?? 0, clicks: r._sum.clicks ?? 0 }]));
  const allMap = toMap(allTime);
  const m30 = toMap(last30);
  const m7 = toMap(last7);
  const zero = { impressions: 0, clicks: 0 };

  const sumOf = (map: Map<number, { impressions: number; clicks: number }>): OverviewPeriod => {
    let impressions = 0;
    let clicks = 0;
    for (const v of map.values()) { impressions += v.impressions; clicks += v.clicks; }
    return { impressions, clicks, ctr: ctrText(impressions, clicks) };
  };

  const group = (keyOf: (a: (typeof ads)[number]) => string): OverviewGroup[] => {
    const out = new Map<string, OverviewGroup>();
    for (const a of ads) {
      const key = keyOf(a);
      const g = out.get(key) ?? { key, running: 0, impressions: 0, clicks: 0, ctr: "-" };
      const s = m30.get(a.id) ?? zero;
      g.impressions += s.impressions;
      g.clicks += s.clicks;
      if (a.status === AdStatus.ACTIVE) g.running += 1;
      out.set(key, g);
    }
    return [...out.values()].map((g) => ({ ...g, ctr: ctrText(g.impressions, g.clicks) })).sort((a, b) => a.key.localeCompare(b.key));
  };

  const running = ads.filter((a) => a.status === AdStatus.ACTIVE);
  const rows: OverviewRow[] = ads
    .map((a) => {
      const s = allMap.get(a.id) ?? zero;
      return {
        id: a.id, title: a.title, advertiser: a.advertiser.username, status: a.status, slot: a.slot, format: a.format,
        impressions: s.impressions, clicks: s.clicks, ctr: ctrText(s.impressions, s.clicks), week: m7.get(a.id)?.impressions ?? 0,
      };
    })
    .sort((a, b) => b.impressions - a.impressions || b.id - a.id)
    .slice(0, ROW_LIMIT);

  return {
    p7: sumOf(m7),
    p30: sumOf(m30),
    all: sumOf(allMap),
    bySlot: group((a) => a.slot),
    byFormat: group((a) => a.format),
    fair: spread(running.map((a) => m7.get(a.id)?.impressions ?? 0)),
    rows,
    totalAds: ads.length,
  };
}
