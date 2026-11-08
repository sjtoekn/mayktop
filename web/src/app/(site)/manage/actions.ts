"use server";

// Edit and delete your OWN posts and comments (TODO 33, patch-40).
//
// Why "delete" erases the text but keeps the row (decided 2026-11-07): many countries give people
// a right to have their personal data erased (for example Art. 17 of the EU GDPR), so the title and
// text are overwritten for good, not just hidden, and the author's name is no longer shown. The
// row itself stays (id, community, time, votes) so replies do not fall apart and the
// moderation log still makes sense. Staying free to keep records that a law or a safety case
// needs is a decision for the owner and a lawyer (see PROJECT.md); this code does not decide it.
//
// The browser is not trusted: every call checks who is logged in, and the database update itself
// only matches a row that belongs to that person, so there is no gap between "check" and "save".
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { ContentStatus } from "../../../../generated/prisma/client";

const MAX_TITLE = 150;
const MAX_POST_BODY = 10_000;
const MAX_COMMENT = 5_000;
const MAX_ID = 2_147_483_647;

export type ManageResult = { ok: true } | { error: true; login?: true };

function isId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_ID;
}

/** Change the title and text of your own post (only while it is visible). */
export async function editPost(input: { id: number; title: string; body: string }): Promise<ManageResult> {
  if (!isId(input?.id) || typeof input.title !== "string" || typeof input.body !== "string") {
    return { error: true };
  }
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length === 0 || title.length > MAX_TITLE || body.length > MAX_POST_BODY) return { error: true };

  const user = await getSessionUser();
  if (!user) return { error: true, login: true };

  try {
    const result = await prisma.post.updateMany({
      where: { id: input.id, authorId: user.id, status: ContentStatus.VISIBLE, deletedAt: null },
      data: { title, body, editedAt: new Date() },
    });
    if (result.count !== 1) return { error: true };
  } catch (error) {
    console.error("editPost failed:", error);
    return { error: true };
  }
  updateTag("posts");
  return { ok: true };
}

/** Erase your own post: the title and text are emptied for good. */
export async function deletePost(input: { id: number }): Promise<ManageResult> {
  if (!isId(input?.id)) return { error: true };
  const user = await getSessionUser();
  if (!user) return { error: true, login: true };

  try {
    const result = await prisma.post.updateMany({
      where: { id: input.id, authorId: user.id, deletedAt: null, status: { not: ContentStatus.REMOVED } },
      data: { title: "", body: "", deletedAt: new Date() },
    });
    if (result.count !== 1) return { error: true };
  } catch (error) {
    console.error("deletePost failed:", error);
    return { error: true };
  }
  updateTag("posts");
  return { ok: true };
}

/** Change the text of your own comment (only while it is visible). */
export async function editComment(input: { id: number; text: string }): Promise<ManageResult> {
  if (!isId(input?.id) || typeof input.text !== "string") return { error: true };
  const body = input.text.trim();
  if (body.length === 0 || body.length > MAX_COMMENT) return { error: true };

  const user = await getSessionUser();
  if (!user) return { error: true, login: true };

  try {
    const result = await prisma.comment.updateMany({
      where: { id: input.id, authorId: user.id, status: ContentStatus.VISIBLE, deletedAt: null },
      data: { body, editedAt: new Date() },
    });
    if (result.count !== 1) return { error: true };
  } catch (error) {
    console.error("editComment failed:", error);
    return { error: true };
  }
  updateTag("comments");
  return { ok: true };
}

/** Erase your own comment: the text is emptied for good, replies under it stay. */
export async function deleteComment(input: { id: number }): Promise<ManageResult> {
  if (!isId(input?.id)) return { error: true };
  const user = await getSessionUser();
  if (!user) return { error: true, login: true };

  try {
    const result = await prisma.comment.updateMany({
      where: { id: input.id, authorId: user.id, deletedAt: null, status: { not: ContentStatus.REMOVED } },
      data: { body: "", deletedAt: new Date() },
    });
    if (result.count !== 1) return { error: true };
  } catch (error) {
    console.error("deleteComment failed:", error);
    return { error: true };
  }
  updateTag("comments");
  return { ok: true };
}
