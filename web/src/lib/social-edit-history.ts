// Edit history of a Social post (SOCIAL_TODO item 6). Reads and erases the SocialPostEdit rows saved by applySocialEdit().
// The page (/social/<id>/history) first asks getSocialPost() whether the viewer may see the post at all (visible, not deleted,
// author shown, not blocked); only then are the earlier versions read, so a hidden or deleted post never leaks its history.
import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient;

export type SocialPostVersion = { id: number; body: string; writtenAt: Date };

/** Earlier versions of a post, NEWEST first (the current text is not in this list: it is on the post itself). */
export async function getSocialPostHistory(postId: number): Promise<SocialPostVersion[]> {
  return prisma.socialPostEdit.findMany({
    where: { socialPostId: postId },
    orderBy: { id: "desc" },
    select: { id: true, body: true, writtenAt: true },
  });
}

/** Deleting your own post erases its text for good, so the earlier versions go with it (same transaction as the delete). */
export async function eraseSocialPostEdits(db: Db, postId: number): Promise<number> {
  const result = await db.socialPostEdit.deleteMany({ where: { socialPostId: postId } });
  return result.count;
}
