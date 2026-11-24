"use server";

// Saves a new post (TODO 31). Called from the Create a post form.
//
// The post is saved as the LOGGED-IN person (src/lib/session.ts). Nobody logged in: refused
// with { error: true, login: true } and nothing is saved.
import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { checkPostInput } from "@/lib/post-input-rules";
import { mayDo, mayWriteText } from "@/lib/reputation";

export type CreatePostResult = { error: true; login?: true; reason?: "link" | "video" } | undefined; // login: true = not logged in; reason: not enough reputation for a link / a video (SITE_PLAN B5)

/** Saves the post, then sends the person to it. Returns { error: true } when nothing was saved. */
export async function createPost(input: {
  slug: string;
  kind: string; // question | article | video (SITE_PLAN A3)
  title: string;
  body: string;
  videoUrl?: string; // only for a video
}): Promise<CreatePostResult> {
  // The browser is not trusted: check everything again here (the rules per kind are in lib/post-input-rules.ts).
  if (typeof input?.slug !== "string") return { error: true };
  const checked = checkPostInput(input);
  if (!checked.ok) return { error: true };
  const { kind, title, body, videoUrl } = checked.value;

  const author = await getSessionUser();
  if (!author) return { error: true, login: true };
  // Reputation unlocks a video post and web links (reputationConfig.privileges); staff may always.
  if (kind === "video" && !(await mayDo(author.id, "video"))) return { error: true, reason: "video" };
  if (!(await mayWriteText(author.id, title, body))) return { error: true, reason: "link" };

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
        data: { communityId: community.id, authorId: author.id, kind, title, body, videoUrl },
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
