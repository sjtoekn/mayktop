// Accepting an answer (SITE_PLAN B4). The asker marks ONE top-level comment of their question as the accepted answer; the writer
// earns reputation for it (reputationConfig.points.accepted), and a running bounty on the question is paid to them. The rules are
// in reputation-rules.ts (checkAccept); this file does the saving, in ONE transaction, so a bounty can never be paid twice.
import { prisma } from "@/lib/prisma";
import { ContentStatus } from "../../generated/prisma/client";
import { ANSWER_ACCEPTED_NOTIFICATION, checkAccept, isBountyActive, type AcceptError } from "@/lib/reputation-rules";

export type SetAcceptedResult = { ok: true; awarded: number } | { ok: false; error: AcceptError | "missing" };

/** Accept (accept = true) or take back (false) the accepted mark of one comment. `actorId` is the logged-in person. */
export async function setAcceptedAnswer(actorId: string, commentId: number, accept: boolean, now: Date = new Date()): Promise<SetAcceptedResult> {
  return prisma.$transaction(async (tx) => {
    const comment = await tx.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true, postId: true, authorId: true, parentId: true, status: true, deletedAt: true, acceptedAt: true,
        post: { select: { kind: true, authorId: true, status: true, deletedAt: true, bounty: { select: { amount: true, status: true, expiresAt: true } } } },
      },
    });
    if (!comment || comment.post.status !== ContentStatus.VISIBLE || comment.post.deletedAt) return { ok: false, error: "missing" } as const;

    const check = checkAccept({
      postKind: comment.post.kind,
      postAuthorId: comment.post.authorId,
      actorId,
      commentAuthorId: comment.authorId,
      commentIsTopLevel: comment.parentId === null,
      commentVisible: comment.status === ContentStatus.VISIBLE && !comment.deletedAt,
      bountyPaid: comment.post.bounty?.status === "AWARDED",
    });
    if (!check.ok) return { ok: false, error: check.error } as const;

    if (!accept) {
      if (comment.acceptedAt !== null) await tx.comment.update({ where: { id: comment.id }, data: { acceptedAt: null } });
      return { ok: true, awarded: 0 } as const;
    }

    // Only one accepted answer per question: the earlier one (if any) loses the mark.
    await tx.comment.updateMany({ where: { postId: comment.postId, acceptedAt: { not: null }, id: { not: comment.id } }, data: { acceptedAt: null } });
    await tx.comment.update({ where: { id: comment.id }, data: { acceptedAt: comment.acceptedAt ?? now } });

    let awarded = 0;
    const bounty = comment.post.bounty;
    if (bounty && isBountyActive(bounty, now)) {
      await tx.bounty.update({
        where: { postId: comment.postId },
        data: { status: "AWARDED", awardedToId: comment.authorId, awardedCommentId: comment.id, awardedAt: now },
      });
      awarded = bounty.amount;
    }
    if (comment.acceptedAt === null) {
      await tx.notification.create({
        data: { recipientId: comment.authorId, actorId, type: ANSWER_ACCEPTED_NOTIFICATION, postId: comment.postId },
      });
    }
    return { ok: true, awarded } as const;
  });
}
