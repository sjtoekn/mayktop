"use server";

// Saves a new post (TODO 31). Called from the Create a post form.
//
// The post is saved as the LOGGED-IN person (src/lib/session.ts). Nobody logged in: refused
// with { error: true, login: true } and nothing is saved.
import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

const MAX_TITLE = 120; // same limit as the form field
const MAX_BODY = 10_000;

export type CreatePostResult = { error: true; login?: true } | undefined; // login: true = not logged in

/** Saves the post, then sends the person to it. Returns { error: true } when nothing was saved. */
export async function createPost(input: {
  slug: string;
  title: string;
  body: string;
}): Promise<CreatePostResult> {
  // The browser is not trusted: check everything again here.
  if (
    typeof input?.slug !== "string" ||
    typeof input.title !== "string" ||
    typeof input.body !== "string"
  ) {
    return { error: true };
  }
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length === 0 || title.length > MAX_TITLE || body.length > MAX_BODY) {
    return { error: true };
  }

  const author = await getSessionUser();
  if (!author) return { error: true, login: true };

  let postId: number;
  try {
    const community = await prisma.community.findFirst({
      where: { slug: input.slug, archivedAt: null },
      select: { id: true },
    });
    if (!community) return { error: true };

    // One transaction: the post and the author's membership (as in the sample data, people who
    // post in a community are members of it) are saved together or not at all.
    const [post] = await prisma.$transaction([
      prisma.post.create({
        data: { communityId: community.id, authorId: author.id, title, body },
        select: { id: true },
      }),
      prisma.membership.upsert({
        where: { userId_communityId: { userId: author.id, communityId: community.id } },
        create: { userId: author.id, communityId: community.id },
        update: {},
      }),
    ]);
    postId = post.id;
  } catch (error) {
    console.error("createPost failed:", error);
    return { error: true };
  }

  // The pages are cached: tell them the data changed (see the tags in lib/queries.ts).
  updateTag("posts");
  updateTag("communities"); // member counts
  redirect(`/post/${postId}`); // outside try/catch: redirect works by throwing
}
