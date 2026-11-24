// Reputation and privileges, read from the database (SITE_PLAN B5). The rules and numbers are in reputation-rules.ts and
// `reputationConfig` (src/config/site.ts). Nothing is stored: the reputation is worked out from the votes, the accepted answers
// and the bounties every time, so it can never be out of step with them.
import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../generated/prisma/client";
import { ContentStatus, Role } from "../../generated/prisma/client";
import type { Privilege } from "@/config/site";
import { computeReputation, containsLink, hasPrivilege, heldPoints } from "@/lib/reputation-rules";

type Db = Prisma.TransactionClient | typeof prisma;

const shownContent = { status: ContentStatus.VISIBLE, deletedAt: null } as const;

/** The reputation of one person. */
export async function getReputation(userId: string, db: Db = prisma, now: Date = new Date()): Promise<number> {
  const [answerVotes, postVotes, accepted, offered, won] = await Promise.all([
    // Up- and down-votes on the person's answers (top-level comments on a question that anybody can see).
    db.commentVote.groupBy({
      by: ["value"],
      where: { comment: { authorId: userId, parentId: null, ...shownContent, post: { kind: "question", ...shownContent } } },
      _count: { _all: true },
    }),
    db.postVote.groupBy({ by: ["value"], where: { post: { authorId: userId, ...shownContent } }, _count: { _all: true } }),
    db.comment.count({ where: { authorId: userId, acceptedAt: { not: null }, ...shownContent } }),
    db.bounty.findMany({ where: { offeredById: userId }, select: { amount: true, status: true, expiresAt: true } }),
    db.bounty.aggregate({ where: { awardedToId: userId, status: "AWARDED" }, _sum: { amount: true } }),
  ]);
  const count = (rows: { value: number; _count: { _all: number } }[], value: number) => rows.find((r) => r.value === value)?._count._all ?? 0;
  return computeReputation({
    answerUp: count(answerVotes, 1),
    answerDown: count(answerVotes, -1),
    postUp: count(postVotes, 1),
    postDown: count(postVotes, -1),
    accepted,
    held: heldPoints(offered, now),
    won: won._sum.amount ?? 0,
  });
}

export type Access = { reputation: number; staff: boolean };

/** The reputation of a person and whether they are staff (moderators and admins may always do what reputation unlocks). */
export async function getAccess(userId: string, db: Db = prisma): Promise<Access> {
  const [reputation, user] = await Promise.all([
    getReputation(userId, db),
    db.user.findUnique({ where: { id: userId }, select: { role: true } }),
  ]);
  return { reputation, staff: user?.role === Role.ADMIN || user?.role === Role.MODERATOR };
}

/** May this person do this? (one database read) */
export async function mayDo(userId: string, privilege: Privilege): Promise<boolean> {
  const access = await getAccess(userId);
  return hasPrivilege(access.reputation, privilege, access.staff);
}

/** A text with no link is always fine; a text with a link needs the "link" privilege. */
export async function mayWriteText(userId: string, ...texts: string[]): Promise<boolean> {
  if (!texts.some((text) => containsLink(text))) return true;
  return mayDo(userId, "link");
}
