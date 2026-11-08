// Deleting your OWN Social post (SOCIAL_TODO 13). Same idea as deleting a community post (TODO 33, manage/actions.ts):
// the text is erased for good and `deletedAt` is set, the ROW STAYS (id, time, likes, so counts, audit log and later
// replies keep working). Nothing is ever hard-deleted.
//
// Rules:
//  - only the author, and only while the post is VISIBLE. A hidden post is waiting for a second reviewer (PROJECT.md 8f);
//    the author must not be able to wipe it before the decision. The way out is the review result or an appeal (item 29).
//    A removed post is already gone from the site. (Deleting the whole account still erases everything: purge-social.ts.)
//  - the update itself matches only the author's row, so there is no gap between "check" and "save".
// Not here: login check and rate limit (the action does them first).
import type { Prisma } from "../../generated/prisma/client";
import { ContentStatus } from "../../generated/prisma/enums"; // plain constants: no database code is loaded

type Db = Prisma.TransactionClient;

export type SocialDeleteResult = { ok: true } | { ok: false; reason: "error" | "notfound" };

export async function applySocialDelete(
  db: Db,
  input: { id: number; authorId: string; now?: Date },
): Promise<SocialDeleteResult> {
  if (!Number.isSafeInteger(input.id) || input.id <= 0) return { ok: false, reason: "error" };

  const result = await db.socialPost.updateMany({
    where: { id: input.id, authorId: input.authorId, status: ContentStatus.VISIBLE, deletedAt: null },
    data: { body: "", mediaUrl: null, deletedAt: input.now ?? new Date() },
  });
  return result.count === 1 ? { ok: true } : { ok: false, reason: "notfound" };
}
