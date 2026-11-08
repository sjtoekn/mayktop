// Editing your OWN Social post (SOCIAL_TODO 12). The server action calls applySocialEdit() inside a transaction;
// a test calls it too, so the rules live in ONE place.
//
// Rules:
//  - the new text goes through cleanSocialBody (same checks as a new post: 1-5,000, no control / bidi-override characters);
//  - only the author, only while the post is VISIBLE and not deleted (a hidden / removed post is in moderation: the author
//    cannot change the evidence; an appeal is the way, SOCIAL_TODO 29);
//  - the text is really different: saving the same text changes nothing (no "Edited" label from a click that changed nothing);
//  - the update itself matches only the author's row, so there is no gap between "check" and "save".
// Not here: login check and rate limit (the action does them first).
import type { Prisma } from "../../generated/prisma/client";
import { ContentStatus } from "../../generated/prisma/enums"; // plain constants: no database code is loaded
import { cleanSocialBody } from "@/lib/social-input";

type Db = Prisma.TransactionClient;

export type SocialEditResult =
  | { ok: true; changed: boolean }
  | { ok: false; reason: "error" | "invalid" | "notfound" };

export async function applySocialEdit(
  db: Db,
  input: { id: number; authorId: string; body: unknown; now?: Date },
): Promise<SocialEditResult> {
  if (!Number.isSafeInteger(input.id) || input.id <= 0) return { ok: false, reason: "error" };

  const cleaned = cleanSocialBody(input.body);
  if (!cleaned.ok) return { ok: false, reason: cleaned.reason === "type" ? "error" : "invalid" };

  const where = {
    id: input.id,
    authorId: input.authorId,
    status: ContentStatus.VISIBLE,
    deletedAt: null,
  } satisfies Prisma.SocialPostWhereInput;

  const current = await db.socialPost.findFirst({ where, select: { body: true } });
  if (!current) return { ok: false, reason: "notfound" };
  if (current.body === cleaned.body) return { ok: true, changed: false };

  const result = await db.socialPost.updateMany({
    where,
    data: { body: cleaned.body, editedAt: input.now ?? new Date() },
  });
  if (result.count !== 1) return { ok: false, reason: "notfound" };
  return { ok: true, changed: true };
}
