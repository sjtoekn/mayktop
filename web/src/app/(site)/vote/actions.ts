"use server";

// Saves an upvote / downvote on a post or a comment (voting step).
//
// One vote per person per post / comment (the database key is userId + postId / commentId).
// Clicking the SAME arrow again takes the vote back; clicking the OTHER arrow switches it.
//
// The vote is saved for the LOGGED-IN person (src/lib/session.ts). Nobody logged in: refused
// with { error: true, login: true } and nothing is saved.
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { ContentStatus } from "../../../../generated/prisma/client";

const MAX_ID = 2_147_483_647; // the largest whole number the database column holds

export type VoteResult =
  | { ok: true; votes: number; myVote: -1 | 0 | 1 }
  | { error: true; login?: true }; // login: true = the person is not logged in

function isId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_ID;
}

/** Casts, switches or takes back the logged-in person's vote. Returns the new total. */
export async function castVote(input: {
  target: "post" | "comment";
  id: number;
  value: 1 | -1;
}): Promise<VoteResult> {
  // The browser is not trusted: check everything again here.
  if (input?.target !== "post" && input?.target !== "comment") return { error: true };
  if (!isId(input.id)) return { error: true };
  if (input.value !== 1 && input.value !== -1) return { error: true };
  const { target, id, value } = input;

  const user = await getSessionUser();
  if (!user) return { error: true, login: true };

  try {
    if (target === "post") {
      // Only a visible post can be voted on (a post hidden for review cannot).
      const post = await prisma.post.findUnique({
        where: { id },
        select: { id: true, status: true, deletedAt: true },
      });
      if (!post || post.status !== ContentStatus.VISIBLE || post.deletedAt) return { error: true };

      const key = { userId_postId: { userId: user.id, postId: post.id } };
      const existing = await prisma.postVote.findUnique({ where: key, select: { value: true } });
      let myVote: -1 | 0 | 1;
      if (existing?.value === value) {
        await prisma.postVote.deleteMany({ where: { userId: user.id, postId: post.id } });
        myVote = 0;
      } else {
        await prisma.postVote.upsert({
          where: key,
          create: { userId: user.id, postId: post.id, value },
          update: { value },
        });
        myVote = value;
      }
      const sum = await prisma.postVote.aggregate({ where: { postId: post.id }, _sum: { value: true } });
      // Post lists (Home, Popular, community pages) show the vote total: see the tags in lib/queries.ts.
      updateTag("posts");
      return { ok: true, votes: sum._sum.value ?? 0, myVote };
    }

    // A comment can be voted on while it and its post are visible.
    const comment = await prisma.comment.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true, post: { select: { status: true, deletedAt: true } } },
    });
    if (
      !comment ||
      comment.status !== ContentStatus.VISIBLE ||
      comment.deletedAt ||
      comment.post.status !== ContentStatus.VISIBLE ||
      comment.post.deletedAt
    ) {
      return { error: true };
    }

    const key = { userId_commentId: { userId: user.id, commentId: comment.id } };
    const existing = await prisma.commentVote.findUnique({ where: key, select: { value: true } });
    let myVote: -1 | 0 | 1;
    if (existing?.value === value) {
      await prisma.commentVote.deleteMany({ where: { userId: user.id, commentId: comment.id } });
      myVote = 0;
    } else {
      await prisma.commentVote.upsert({
        where: key,
        create: { userId: user.id, commentId: comment.id, value },
        update: { value },
      });
      myVote = value;
    }
    const sum = await prisma.commentVote.aggregate({
      where: { commentId: comment.id },
      _sum: { value: true },
    });
    updateTag("comments");
    return { ok: true, votes: sum._sum.value ?? 0, myVote };
  } catch (error) {
    console.error("castVote failed:", error);
    return { error: true };
  }
}
