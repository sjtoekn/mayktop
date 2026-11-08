"use server";

// Which posts / comments has the LOGGED-IN person voted on? (patch: logged-in saving)
//
// The pages are cached and shared by everybody, so they cannot hold "my vote". After a page
// opens, <MyVotesProvider> asks this action once for all arrows on the page. Nobody logged in:
// userId is null and the lists are empty.
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

const MAX_ID = 2_147_483_647; // the largest whole number the database column holds
const MAX_IDS = 300; // per kind, per request (a page never shows more)

export type MyVotesResult = {
  userId: string | null;
  posts: Record<number, 1 | -1>;
  comments: Record<number, 1 | -1>;
};

function cleanIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const ok = value.filter(
    (v): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= MAX_ID,
  );
  return [...new Set(ok)].slice(0, MAX_IDS);
}

export async function getMyVotes(input: {
  posts: number[];
  comments: number[];
}): Promise<MyVotesResult> {
  const empty: MyVotesResult = { userId: null, posts: {}, comments: {} };
  const user = await getSessionUser();
  if (!user) return empty;

  const postIds = cleanIds(input?.posts);
  const commentIds = cleanIds(input?.comments);

  try {
    const [postVotes, commentVotes] = await Promise.all([
      postIds.length
        ? prisma.postVote.findMany({
            where: { userId: user.id, postId: { in: postIds } },
            select: { postId: true, value: true },
          })
        : Promise.resolve([]),
      commentIds.length
        ? prisma.commentVote.findMany({
            where: { userId: user.id, commentId: { in: commentIds } },
            select: { commentId: true, value: true },
          })
        : Promise.resolve([]),
    ]);

    const result: MyVotesResult = { userId: user.id, posts: {}, comments: {} };
    for (const v of postVotes) result.posts[v.postId] = v.value === -1 ? -1 : 1;
    for (const v of commentVotes) result.comments[v.commentId] = v.value === -1 ? -1 : 1;
    return result;
  } catch (error) {
    console.error("getMyVotes failed:", error);
    return { ...empty, userId: user.id };
  }
}
