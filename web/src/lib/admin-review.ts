// Admin Part 4 (Content review): the list of hidden posts / comments that wait for a SECOND person.
// No rule lives here. The queue comes from listPending (review.ts); this file only adds what a screen
// needs (who wrote it, who hid it, a short preview) and says whether THIS admin may decide each item.
// The decision itself is decideReview (review.ts), which checks everything again.
import { prisma } from "@/lib/prisma";
import { checkDecide, excerpt } from "@/lib/review-rules";
import { findIncomplete, listPending, type Incomplete, type ReviewKind } from "@/lib/review";
import { AuditAction, AuditTarget } from "../../generated/prisma/client";

export const PREVIEW_LENGTH = 240;

export type QueueItem = {
  kind: ReviewKind;
  id: number;
  postId: number; // the post page to open (for a comment: the post it belongs to)
  community: string;
  author: string; // username
  hiddenBy: string | null; // username, null when the hide was not recorded
  hiddenAt: Date | null;
  rule: string;
  reason: string;
  overdue: boolean;
  title: string; // post title, empty for a comment
  text: string; // short preview of the body
  erased: boolean; // the author erased the text
  block: "self" | "same" | null; // why THIS admin cannot decide it (null = can decide)
};

export type ReviewQueue = { items: QueueItem[]; incomplete: Incomplete[] };

export async function loadReviewQueue(meId: string): Promise<ReviewQueue> {
  const pending = await listPending(); // oldest first, with rule, reason and the OVERDUE flag
  const postIds = pending.filter((p) => p.kind === "post").map((p) => p.id);
  const commentIds = pending.filter((p) => p.kind === "comment").map((p) => p.id);

  const [posts, comments, hides, incomplete] = await Promise.all([
    prisma.post.findMany({
      where: { id: { in: postIds } },
      select: { id: true, title: true, body: true, authorId: true, deletedAt: true, author: { select: { username: true } } },
    }),
    prisma.comment.findMany({
      where: { id: { in: commentIds } },
      select: { id: true, postId: true, body: true, authorId: true, deletedAt: true, author: { select: { username: true } } },
    }),
    prisma.auditLog.findMany({
      where: {
        action: AuditAction.CONTENT_HIDDEN,
        OR: [
          { targetType: AuditTarget.POST, targetId: { in: postIds.map(String) } },
          { targetType: AuditTarget.COMMENT, targetId: { in: commentIds.map(String) } },
        ],
      },
      orderBy: { id: "desc" }, // newest first: the first row per item is the hide that put it in the queue
      select: { targetType: true, targetId: true, actorId: true, actor: { select: { username: true } } },
    }),
    findIncomplete(),
  ]);

  const postById = new Map(posts.map((p) => [p.id, p]));
  const commentById = new Map(comments.map((c) => [c.id, c]));
  const hideBy = new Map<string, { actorId: string; username: string }>();
  for (const h of hides) {
    const key = `${h.targetType}:${h.targetId}`;
    if (!hideBy.has(key)) hideBy.set(key, { actorId: h.actorId, username: h.actor.username });
  }

  const items: QueueItem[] = [];
  for (const p of pending) {
    const isPost = p.kind === "post";
    const row = isPost ? postById.get(p.id) : commentById.get(p.id);
    if (!row) continue; // vanished between the two reads: skip it
    const hide = hideBy.get(`${isPost ? AuditTarget.POST : AuditTarget.COMMENT}:${p.id}`) ?? null;
    // The same check decideReview makes (an admin is always allowed; "self" and "same" are what is left).
    const refused = checkDecide({
      actor: { id: meId, isAdmin: true, isCommunityModerator: false },
      authorId: row.authorId,
      hiderId: hide?.actorId ?? null,
      status: "HIDDEN_PENDING_REVIEW",
    });
    const erased = row.deletedAt !== null;
    items.push({
      kind: p.kind,
      id: p.id,
      postId: "postId" in row ? row.postId : row.id,
      community: p.community,
      author: row.author.username,
      hiddenBy: hide?.username ?? null,
      hiddenAt: p.hiddenAt,
      rule: p.rule,
      reason: p.reason,
      overdue: p.overdue,
      title: !erased && "title" in row ? row.title : "", // only a post has a title
      text: erased ? "" : excerpt(row.body, PREVIEW_LENGTH),
      erased,
      block: refused === "self" || refused === "same" ? refused : null,
    });
  }
  return { items, incomplete };
}
