// Editing your OWN Social post (SOCIAL_TODO 12, edit window + history = item 6). The server action calls applySocialEdit()
// inside a transaction; a test calls it too, so the rules live in ONE place.
//
// Rules:
//  - the new text goes through cleanSocialBody (same checks as a new post: 1-5,000, no control / bidi-override characters);
//  - only the author, only while the post is VISIBLE and not deleted (a hidden / removed post is in moderation: the author
//    cannot change the evidence; an appeal is the way, SOCIAL_TODO 29);
//  - the text is really different: saving the same text changes nothing (no "Edited" label from a click that changed nothing);
//  - EDIT WINDOW: only within `socialEdit.windowMinutes` after the post was written, and at most `socialEdit.maxEdits` times
//    (src/lib/social-edit-rules.ts). Refused with reason "window" or "limit";
//  - EDIT HISTORY: the text that is replaced is saved as a SocialPostEdit row in the same transaction, so every earlier
//    version can be shown to the people who can see the post (page /social/<id>/history);
//  - the update itself matches only the author's row AND the text we just read, so two edits at the same moment cannot
//    both pass the count check: the second one finds the text changed and is refused.
// Not here: login check and rate limit (the action does them first).
import type { Prisma } from "../../generated/prisma/client";
import { ContentStatus } from "../../generated/prisma/enums"; // plain constants: no database code is loaded
import { socialEdit } from "@/config/site";
import { cleanSocialBody } from "@/lib/social-input";
import { checkEditAllowed, type SocialEditConfig } from "@/lib/social-edit-rules";

type Db = Prisma.TransactionClient;

export type SocialEditResult =
  | { ok: true; changed: boolean }
  | { ok: false; reason: "error" | "invalid" | "notfound" | "window" | "limit" };

export async function applySocialEdit(
  db: Db,
  input: { id: number; authorId: string; body: unknown; now?: Date; rules?: SocialEditConfig },
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

  const current = await db.socialPost.findFirst({ where, select: { body: true, createdAt: true, editedAt: true } });
  if (!current) return { ok: false, reason: "notfound" };
  if (current.body === cleaned.body) return { ok: true, changed: false };

  const now = input.now ?? new Date();
  const editsMade = await db.socialPostEdit.count({ where: { socialPostId: input.id } });
  const allowed = checkEditAllowed(
    { createdAtMs: current.createdAt.getTime(), nowMs: now.getTime(), editsMade },
    input.rules ?? socialEdit,
  );
  if (!allowed.ok) return { ok: false, reason: allowed.reason };

  const result = await db.socialPost.updateMany({
    where: { ...where, body: current.body },
    data: { body: cleaned.body, editedAt: now },
  });
  if (result.count !== 1) return { ok: false, reason: "notfound" };

  // The version that was just replaced stays readable: it was written at the last edit, or when the post was made.
  await db.socialPostEdit.create({
    data: { socialPostId: input.id, body: current.body, writtenAt: current.editedAt ?? current.createdAt },
  });
  return { ok: true, changed: true };
}
