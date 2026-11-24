// Offering a bounty on a question (SITE_PLAN B6): reputation POINTS, not money. The rules are in reputation-rules.ts
// (checkBountyOffer); the points are held (taken out of the asker's reputation) while the bounty runs, see getReputation.
import { prisma } from "@/lib/prisma";
import { ContentStatus } from "../../generated/prisma/client";
import { getAccess } from "@/lib/reputation";
import { bountyExpiry, checkBountyOffer, type BountyOfferError } from "@/lib/reputation-rules";

export type OfferBountyResult = { ok: true } | { ok: false; error: BountyOfferError | "missing" };

export async function offerBounty(actorId: string, postId: number, amount: unknown, now: Date = new Date()): Promise<OfferBountyResult> {
  return prisma.$transaction(async (tx) => {
    const post = await tx.post.findUnique({
      where: { id: postId },
      select: {
        id: true, kind: true, authorId: true, status: true, deletedAt: true,
        bounty: { select: { amount: true, status: true, expiresAt: true } },
        comments: { where: { acceptedAt: { not: null }, status: ContentStatus.VISIBLE, deletedAt: null }, select: { id: true }, take: 1 },
      },
    });
    if (!post || post.authorId !== actorId || post.status !== ContentStatus.VISIBLE || post.deletedAt) return { ok: false, error: "missing" } as const;

    const access = await getAccess(actorId, tx);
    const check = checkBountyOffer({
      amount, postKind: post.kind, hasAcceptedAnswer: post.comments.length > 0, existing: post.bounty,
      available: access.reputation, staff: access.staff, now,
    });
    if (!check.ok) return { ok: false, error: check.error } as const;

    const data = { offeredById: actorId, amount: check.amount, status: "OPEN", expiresAt: bountyExpiry(now), createdAt: now, awardedToId: null, awardedCommentId: null, awardedAt: null };
    await tx.bounty.upsert({ where: { postId: post.id }, create: { postId: post.id, ...data }, update: data });
    return { ok: true } as const;
  });
}
