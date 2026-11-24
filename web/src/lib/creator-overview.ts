// The read model of the Creator Overview page (TODO 12, S5). Server only, read-only: it never writes anything.
// What it shows: impressions on the person's question / answer pages (from the day they joined, like their earnings),
// the ledger added up (creator-overview-rules.ts), an ESTIMATE for ads that are not settled yet, and the payout history.
// Nothing here is about a visitor: only per-page, per-day totals.
import { prisma } from "@/lib/prisma";
import { computeSettlement } from "@/lib/creator-settle";
import { dayStart } from "@/lib/creator-settle-rules";
import { getCreatorSettings, type CreatorSettings } from "@/lib/creator-profile";
import { isPayoutCountry } from "@/lib/creator-rules";
import {
  balancesFrom,
  lastDays,
  monthImpressions,
  nextPayout,
  roleOf,
  type Balances,
  type NextPayout,
  type PageRole,
} from "@/lib/creator-overview-rules";
import { AdPaymentStatus, ContentStatus } from "../../generated/prisma/client";

const DAY_MS = 86_400_000;
export const OVERVIEW_DAYS = 30;
const MAX_PAGES = 1000; // pages looked at per person (most recent first)
const MAX_SHOWN = 25; // rows in the page table
const MAX_ESTIMATE_ADS = 50;

export type OverviewPage = { postId: number; title: string; role: PageRole; impressions: number; earnedMicro: number };
export type OverviewPayout = { id: number; amountMicro: number; status: string; method: string; paidAt: Date | null; createdAt: Date };

export type Overview = {
  settings: CreatorSettings;
  isPayoutCountry: boolean;
  days: { dayMs: number; impressions: number }[]; // the last OVERVIEW_DAYS days, oldest first
  impressions30: number;
  impressionsMonth: number;
  balances: Balances;
  estimateMicro: number; // what ads that are not settled yet would give now (a guess: it changes until the ad is settled)
  estimateAds: number;
  next: NextPayout;
  pages: OverviewPage[];
  pagesTotal: number; // how many pages have numbers (pages beyond MAX_SHOWN are not listed)
  payouts: OverviewPayout[];
};

/** Everything the page needs for one person, or null when they have not joined the program. */
export async function getCreatorOverview(userId: string, now: Date = new Date()): Promise<Overview | null> {
  const settings = await getCreatorSettings(userId, now);
  if (!settings) return null;
  const nowMs = now.getTime();

  // ---- the person's pages: questions they asked, and questions they answered (visible only)
  const [asked, answers] = await Promise.all([
    prisma.post.findMany({
      where: { authorId: userId, status: ContentStatus.VISIBLE, deletedAt: null },
      orderBy: { id: "desc" },
      take: MAX_PAGES,
      select: { id: true, title: true },
    }),
    prisma.comment.findMany({
      where: { authorId: userId, parentId: null, status: ContentStatus.VISIBLE, deletedAt: null },
      orderBy: { id: "desc" },
      take: MAX_PAGES,
      select: { postId: true },
    }),
  ]);
  const askedIds = new Set(asked.map((p) => p.id));
  const answeredIds = new Set(answers.map((a) => a.postId));
  const extraIds = [...answeredIds].filter((id) => !askedIds.has(id));
  const extra = extraIds.length
    ? await prisma.post.findMany({
        where: { id: { in: extraIds }, status: ContentStatus.VISIBLE, deletedAt: null },
        select: { id: true, title: true },
      })
    : [];
  const titles = new Map<number, string>([...asked, ...extra].map((p) => [p.id, p.title]));
  const pageIds = [...titles.keys()];

  // ---- impressions from the day they joined (same rule as earnings, decision D4)
  const joinDay = dayStart(settings.joinedAt.getTime());
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const since = Math.max(joinDay, Math.min(monthStart, dayStart(nowMs) - (OVERVIEW_DAYS - 1) * DAY_MS));
  const stats = pageIds.length
    ? await prisma.contentAdStat.findMany({
        where: { contentType: "POST", contentId: { in: pageIds }, date: { gte: new Date(since) } },
        select: { date: true, contentId: true, impressions: true },
      })
    : [];
  const byDay = new Map<number, number>();
  const byPage = new Map<number, number>();
  const windowStart = dayStart(nowMs) - (OVERVIEW_DAYS - 1) * DAY_MS;
  for (const s of stats) {
    const d = s.date.getTime();
    byDay.set(d, (byDay.get(d) ?? 0) + s.impressions);
    if (d >= windowStart) byPage.set(s.contentId, (byPage.get(s.contentId) ?? 0) + s.impressions);
  }
  const days = lastDays(nowMs, OVERVIEW_DAYS, byDay).map((d) => (d.dayMs < joinDay ? { ...d, impressions: 0 } : d));

  // ---- the ledger
  const ledger = await prisma.earningEntry.findMany({
    where: { userId },
    select: {
      amountMicroUsd: true,
      status: true,
      kind: true,
      createdAt: true,
      payoutId: true,
      contentType: true,
      contentId: true,
      payout: { select: { status: true } },
    },
  });
  const balances = balancesFrom(
    ledger.map((e) => ({
      amountMicroUsd: e.amountMicroUsd,
      status: e.status,
      createdAtMs: e.createdAt.getTime(),
      payoutId: e.payoutId,
      payoutStatus: e.payout?.status ?? null,
    })),
    settings.country,
    nowMs,
  );
  const earnedByPage = new Map<number, number>();
  for (const e of ledger) {
    if (e.kind === "SHARE" && e.status === "ACTIVE" && e.contentType === "POST" && e.contentId !== null) {
      earnedByPage.set(e.contentId, (earnedByPage.get(e.contentId) ?? 0) + e.amountMicroUsd);
    }
  }

  // ---- the estimate: ads that are paid but not settled yet, worked out exactly as the settlement would (nothing is written)
  let estimateMicro = 0;
  let estimateAds = 0;
  if (pageIds.length) {
    const open = await prisma.contentAdStat.findMany({
      where: { contentType: "POST", contentId: { in: pageIds }, ad: { paymentStatus: AdPaymentStatus.PAID, creatorSettledAt: null } },
      select: { adId: true },
      distinct: ["adId"],
      take: MAX_ESTIMATE_ADS,
    });
    for (const { adId } of open) {
      const c = await computeSettlement(adId, now);
      if (!c) continue;
      const mine = c.built.rows.filter((r) => r.userId === userId && r.status === "ACTIVE").reduce((n, r) => n + r.micro, 0);
      if (mine > 0) {
        estimateMicro += mine;
        estimateAds += 1;
      }
    }
  }

  // ---- the page table: pages with impressions in the last 30 days or with earnings
  const rows: OverviewPage[] = pageIds
    .map((id) => ({
      postId: id,
      title: titles.get(id) ?? "",
      role: roleOf(askedIds.has(id), answeredIds.has(id)),
      impressions: byPage.get(id) ?? 0,
      earnedMicro: earnedByPage.get(id) ?? 0,
    }))
    .filter((r) => r.impressions > 0 || r.earnedMicro > 0)
    .sort((a, b) => b.impressions - a.impressions || b.earnedMicro - a.earnedMicro || b.postId - a.postId);

  const payouts = await prisma.payout.findMany({
    where: { userId },
    orderBy: { id: "desc" },
    take: 10,
    select: { id: true, amountMicroUsd: true, status: true, method: true, paidAt: true, createdAt: true },
  });

  const payoutCountry = isPayoutCountry(settings.country);
  return {
    settings,
    isPayoutCountry: payoutCountry,
    days,
    impressions30: days.reduce((n, d) => n + d.impressions, 0),
    impressionsMonth: monthImpressions(nowMs, new Map([...byDay].filter(([d]) => d >= joinDay))),
    balances,
    estimateMicro,
    estimateAds,
    next: nextPayout(
      {
        country: settings.country,
        isPayoutCountry: payoutCountry,
        frozen: settings.frozen,
        hasDetails: settings.hasDetails,
        holdUntilMs: settings.holdUntil ? settings.holdUntil.getTime() : null,
      },
      balances.payableMicro,
    ),
    pages: rows.slice(0, MAX_SHOWN),
    pagesTotal: rows.length,
    payouts: payouts.map((p) => ({ id: p.id, amountMicro: p.amountMicroUsd, status: p.status, method: p.method, paidAt: p.paidAt, createdAt: p.createdAt })),
  };
}
