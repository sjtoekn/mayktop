// Settles finished ads into the creator ledger (TODO 12, S4). Server only.
// An ad is settled ONCE, when it is finished (ENDED, or its end date has passed), was paid for and has not been settled yet.
// The rules are in creator-settle-rules.ts (pure) and creator-rules.ts. Safe to run twice: a settled ad is skipped.
import { prisma } from "@/lib/prisma";
import { pickOtherAnswerAuthors, type PageAuthors } from "@/lib/creator-rules";
import { buildSettlement, dayStart, type Settlement, type SettleCreator, type SettleDay } from "@/lib/creator-settle-rules";
import { AdPaymentStatus, AdStatus, ContentStatus, SuspensionKind, UserStatus } from "../../generated/prisma/client";

const DAY_MS = 86_400_000;

export type SettleSummary = {
  adId: number;
  title: string;
  poolMicro: number;
  activeMicro: number;
  voidMicro: number;
  rows: number;
  people: number;
  written: boolean; // false for a preview (dry run) or when the ad was already settled
};

export type Computed = { title: string; built: Settlement; periodStartMs: number; periodEndMs: number };

/**
 * Works out what ONE paid, not yet settled ad would give the creators, without writing anything. Null: the ad does not exist,
 * is not paid, or was settled already. settleOneAd writes this result; the Creator Overview uses it for its "estimate".
 */
export async function computeSettlement(adId: number, now: Date): Promise<Computed | null> {
  const ad = await prisma.adCampaign.findUnique({
    where: { id: adId },
    select: { id: true, title: true, priceCents: true, startDate: true, endDate: true, paymentStatus: true, creatorSettledAt: true },
  });
  if (!ad || ad.creatorSettledAt || ad.paymentStatus !== AdPaymentStatus.PAID) return null;

  const total = await prisma.adDailyStat.aggregate({ where: { adId }, _sum: { impressions: true } });
  const stats = await prisma.contentAdStat.findMany({
    where: { adId, contentType: "POST" },
    select: { date: true, contentId: true, impressions: true },
  });
  const days: SettleDay[] = stats.map((s) => ({ contentId: s.contentId, dayMs: s.date.getTime(), impressions: s.impressions }));

  // The pages and who earns on each of them.
  const postIds = [...new Set(days.map((d) => d.contentId))];
  const posts = postIds.length
    ? await prisma.post.findMany({ where: { id: { in: postIds } }, select: { id: true, authorId: true, status: true, deletedAt: true } })
    : [];
  const comments = postIds.length
    ? await prisma.comment.findMany({
        where: { postId: { in: postIds }, parentId: null, status: ContentStatus.VISIBLE, deletedAt: null },
        select: { postId: true, authorId: true, acceptedAt: true, createdAt: true, votes: { select: { value: true } } },
      })
    : [];

  const pages = new Map<number, PageAuthors | null>();
  for (const p of posts) {
    if (p.status !== ContentStatus.VISIBLE || p.deletedAt) {
      pages.set(p.id, null);
      continue;
    }
    const mine = comments.filter((c) => c.postId === p.id);
    const accepted = mine.find((c) => c.acceptedAt !== null);
    pages.set(p.id, {
      askerId: p.authorId,
      acceptedId: accepted?.authorId ?? null,
      othersByVotes: pickOtherAnswerAuthors(
        mine.filter((c) => c !== accepted).map((c) => ({ authorId: c.authorId, score: c.votes.reduce((n, v) => n + v.value, 0), createdAtMs: c.createdAt.getTime() })),
      ),
    });
  }

  // Who is in the program (and since when).
  const authorIds = new Set<string>();
  for (const pg of pages.values()) {
    if (!pg) continue;
    authorIds.add(pg.askerId);
    if (pg.acceptedId) authorIds.add(pg.acceptedId);
    pg.othersByVotes.forEach((id) => authorIds.add(id));
  }
  const profiles = authorIds.size
    ? await prisma.creatorProfile.findMany({
        where: { userId: { in: [...authorIds] } },
        select: { userId: true, joinedAt: true, user: { select: { status: true, suspensionKind: true } } },
      })
    : [];
  const creators = new Map<string, SettleCreator>();
  for (const pr of profiles) {
    const banned = pr.user.status === UserStatus.SUSPENDED && pr.user.suspensionKind === SuspensionKind.BAN;
    creators.set(pr.userId, { joinedAtMs: pr.joinedAt.getTime(), blocked: banned || pr.user.status === UserStatus.DELETED });
  }

  const firstDay = days.length ? Math.min(...days.map((d) => d.dayMs)) : dayStart(now.getTime());
  const periodStartMs = ad.startDate ? dayStart(ad.startDate.getTime()) : firstDay;
  const periodEndMs = dayStart((ad.endDate ?? now).getTime()) + DAY_MS; // end day included
  const built = buildSettlement({
    adId,
    priceCents: ad.priceCents,
    adTotalImpressions: total._sum.impressions ?? 0,
    periodStartMs,
    days,
    pages,
    creators,
  });
  return { title: ad.title, built, periodStartMs, periodEndMs };
}

/** Settles one ad. `write: false` only calculates. */
export async function settleOneAd(adId: number, opts: { write: boolean; now?: Date }): Promise<SettleSummary | null> {
  const now = opts.now ?? new Date();
  const computed = await computeSettlement(adId, now);
  if (!computed) return null;
  const { built, periodStartMs, periodEndMs } = computed;

  const summary: SettleSummary = {
    adId,
    title: computed.title,
    poolMicro: built.poolMicro,
    activeMicro: built.activeMicro,
    voidMicro: built.voidMicro,
    rows: built.rows.length,
    people: new Set(built.rows.map((r) => r.userId)).size,
    written: false,
  };
  if (!opts.write) return summary;

  // All or nothing: claim the ad first (so two runs at once cannot both settle it), then write the rows.
  const wrote = await prisma.$transaction(async (tx) => {
    const claim = await tx.adCampaign.updateMany({ where: { id: adId, creatorSettledAt: null }, data: { creatorSettledAt: now } });
    if (claim.count === 0) return false;
    for (const r of built.rows) {
      await tx.earningEntry.create({
        data: {
          userId: r.userId,
          kind: "SHARE",
          status: r.status,
          amountMicroUsd: r.micro,
          adId,
          contentType: "POST",
          contentId: r.contentId,
          periodStart: new Date(periodStartMs),
          periodEnd: new Date(periodEndMs),
          dedupeKey: r.dedupeKey,
          note: r.status === "VOID" ? "account banned or erased when the ad was settled" : null,
        },
      });
    }
    return true;
  });
  return { ...summary, written: wrote };
}

/** The ads that are finished, paid and not settled yet. */
export async function dueAdIds(now: Date = new Date()): Promise<number[]> {
  const ads = await prisma.adCampaign.findMany({
    where: {
      creatorSettledAt: null,
      paymentStatus: AdPaymentStatus.PAID,
      priceCents: { gt: 0 },
      OR: [{ status: AdStatus.ENDED }, { status: AdStatus.ACTIVE, endDate: { lte: now } }],
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  return ads.map((a) => a.id);
}
