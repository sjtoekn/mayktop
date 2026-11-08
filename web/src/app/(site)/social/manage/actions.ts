"use server";

// Edit (SOCIAL_TODO 12) and delete (SOCIAL_TODO 13) your OWN Social post.
//  1. Nobody logged in: refused with login: true.
//  2. Rate limit: socialLimits.edits per person (server memory).
//  3. The text rules and the "own post, still visible" rule are in src/lib/social-edit.ts (one transaction).
// The browser is not trusted: the person comes from the login cookie only.
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { socialLimits } from "@/config/site";
import { takeActionDb } from "@/lib/rate-limit-db";
import { applySocialEdit } from "@/lib/social-edit";
import { applySocialDelete } from "@/lib/social-delete";
import { deleteSocialImages } from "@/lib/social-image-storage";
import { removeSocialTags, syncSocialTags } from "@/lib/social-tag-sync";
import { removeSocialPinOfPost } from "@/lib/social-pin";

const editRules = [{ max: socialLimits.edits.max, windowMs: socialLimits.edits.windowMinutes * 60_000 }];
const deleteRules = [{ max: socialLimits.deletes.max, windowMs: socialLimits.deletes.windowMinutes * 60_000 }];

export type EditSocialPostResult =
  | { ok: true }
  | { error: true; login?: true; invalid?: true; tooMany?: true; waitMinutes?: number };

export async function editSocialPost(input: { id: number; body: string }): Promise<EditSocialPostResult> {
  if (typeof input?.id !== "number") return { error: true };

  const user = await getSessionUser();
  if (!user) return { error: true, login: true };

  const rate = await takeActionDb(`social-edit:${user.id}`, editRules);
  if (!rate.ok) {
    return { error: true, tooMany: true, waitMinutes: Math.max(1, Math.ceil(rate.retryAfterMs / 60_000)) };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const edited = await applySocialEdit(tx, { id: input.id, authorId: user.id, body: input.body });
      if (edited.ok && edited.changed) {
        // Hashtags and mentions follow the new text (SOCIAL_TODO 6), in the same transaction.
        const row = await tx.socialPost.findUnique({ where: { id: input.id }, select: { body: true } });
        if (row) await syncSocialTags(tx, { socialPostId: input.id, authorId: user.id, body: row.body });
      }
      return edited;
    });
    if (!result.ok) return result.reason === "invalid" ? { error: true, invalid: true } : { error: true };
    if (result.changed) updateTag("social-posts");
    return { ok: true };
  } catch (error) {
    console.error("editSocialPost failed:", error);
    return { error: true };
  }
}

export type DeleteSocialPostResult =
  | { ok: true }
  | { error: true; login?: true; tooMany?: true; waitMinutes?: number };

/** Erase your own visible Social post: the text is emptied for good, the row stays (src/lib/social-delete.ts). */
export async function deleteSocialPost(input: { id: number }): Promise<DeleteSocialPostResult> {
  if (typeof input?.id !== "number") return { error: true };

  const user = await getSessionUser();
  if (!user) return { error: true, login: true };

  const rate = await takeActionDb(`social-delete:${user.id}`, deleteRules);
  if (!rate.ok) {
    return { error: true, tooMany: true, waitMinutes: Math.max(1, Math.ceil(rate.retryAfterMs / 60_000)) };
  }

  try {
    let pictureUrl: string | null = null; // the picture file leaves the disk after the commit (patch-social-images)
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.socialPost.findFirst({ where: { id: input.id, authorId: user.id, deletedAt: null }, select: { mediaUrl: true } });
      const deleted = await applySocialDelete(tx, { id: input.id, authorId: user.id });
      if (deleted.ok) {
        await removeSocialTags(tx, input.id); // its hashtags and mentions go with the text (SOCIAL_TODO 6)
        await removeSocialPinOfPost(tx, input.id); // a deleted post cannot stay pinned (SOCIAL_TODO B6)
        pictureUrl = before?.mediaUrl ?? null;
      }
      return deleted;
    });
    if (!result.ok) return { error: true };
    await deleteSocialImages([pictureUrl]); // never throws; a leftover file is harmless, nothing points to it
    updateTag("social-posts");
    return { ok: true };
  } catch (error) {
    console.error("deleteSocialPost failed:", error);
    return { error: true };
  }
}
