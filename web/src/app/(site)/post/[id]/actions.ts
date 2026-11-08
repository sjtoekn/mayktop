"use server";

// Saves a new comment or reply (TODO 32). Called from the comment boxes on /post/<id>.
//
// Like createPost, it saves as the LOGGED-IN person (src/lib/session.ts). Nobody logged in:
// refused with { error: true, login: true } and nothing is saved.
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { ContentStatus } from "../../../../../generated/prisma/client";

const MAX_BODY = 5_000;
const MAX_ID = 2_147_483_647; // the largest whole number the database column holds

export type CreateCommentResult = { ok: true } | { error: true; login?: true }; // login: true = not logged in

function isId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_ID;
}

/** Saves a comment on a post (parentId left out) or a reply to a comment (parentId given). */
export async function createComment(input: {
  postId: number;
  parentId?: number;
  body: string;
}): Promise<CreateCommentResult> {
  // The browser is not trusted: check everything again here.
  if (!isId(input?.postId) || typeof input.body !== "string") return { error: true };
  if (input.parentId !== undefined && !isId(input.parentId)) return { error: true };
  const body = input.body.trim();
  if (body.length === 0 || body.length > MAX_BODY) return { error: true };

  const author = await getSessionUser();
  if (!author) return { error: true, login: true };

  try {
    const [post, parent] = await Promise.all([
      prisma.post.findUnique({
        where: { id: input.postId },
        select: { id: true, communityId: true, status: true, deletedAt: true },
      }),
      input.parentId === undefined
        ? Promise.resolve(null)
        : prisma.comment.findUnique({
            where: { id: input.parentId },
            select: { id: true, postId: true, status: true, deletedAt: true },
          }),
    ]);

    // Only a visible post can be commented on. A reply must point to a comment of the SAME post
    // that was not removed (a comment hidden for review can still be replied to).
    if (!post || post.status !== ContentStatus.VISIBLE || post.deletedAt) return { error: true };
    if (input.parentId !== undefined) {
      if (
        !parent ||
        parent.postId !== post.id ||
        parent.status === ContentStatus.REMOVED ||
        parent.deletedAt
      ) {
        return { error: true };
      }
    }

    // The comment and the author's membership (as in the sample data, people who comment in a
    // community are members of it) are saved together or not at all.
    await prisma.$transaction([
      prisma.comment.create({
        data: { postId: post.id, authorId: author.id, parentId: parent?.id ?? null, body },
      }),
      prisma.membership.upsert({
        where: { userId_communityId: { userId: author.id, communityId: post.communityId } },
        create: { userId: author.id, communityId: post.communityId },
        update: {},
      }),
    ]);
  } catch (error) {
    console.error("createComment failed:", error);
    return { error: true };
  }

  // The pages are cached: the thread changed, the comment count on posts changed, and so did
  // the member count of the community (see the tags in lib/queries.ts).
  updateTag("comments");
  updateTag("posts");
  updateTag("communities");
  return { ok: true };
}
