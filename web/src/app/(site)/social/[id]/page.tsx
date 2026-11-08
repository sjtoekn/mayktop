import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import SocialPostCard from "@/components/social/SocialPostCard";
import SocialRepostCard from "@/components/social/SocialRepostCard";
import { t } from "@/i18n";
import { getMyFollowing, getMySocialLikes, getMySocialReposts, getSocialPost, getSocialQuotes } from "@/lib/queries";
import { getSessionUser } from "@/lib/session";
import { dropHiddenAuthors, dropHiddenItems } from "@/lib/social-block-rules";
import { getMySocialBookmarks } from "@/lib/social-bookmark-view";
import { getMyPinnedSocialPostId } from "@/lib/social-pin-view";
import { loadHiddenAuthors } from "@/lib/social-block-view";
import { parseSocialPostId } from "@/lib/social-id";
import { getSocialReplies } from "@/lib/social-replies-query";
import { getReplyAccess } from "@/lib/social-reply-control-view";
import SocialReplyList from "@/components/social/SocialReplyList";
import { socialReplyRank } from "@/config/site";
import { nowMs } from "@/lib/now";
import { orderReplies, parseReplySort } from "@/lib/social-fair-rank-rules";
import { getMyReplyLikes } from "@/lib/social-reply-like-view";

// One Social post (SOCIAL_TODO 14). Social posts are ONLY for logged-in people (PROJECT.md 8j point 11), so:
//  - the page title is always the same plain words, never the post text; no link preview is made from the post;
//  - the page is marked noindex;
//  - a visitor sees the log-in message for ANY number (it does not even say whether the post exists, and the post is not read);
//  - a logged-in person gets "not found" (404) for a number that is invalid, missing, hidden, removed or deleted.
export const metadata: Metadata = {
  title: t("social.label"),
  robots: { index: false, follow: false },
};

// The page reads the login cookie and the post, so it runs per request, inside <Suspense>. The placeholder id only
// lets Next.js prepare the page shell (menu, sidebar) at build time, the same way the post page and the appeal page
// do it; it is never shown and no post is read for it. Without this, `next build` stops with
// "usePathname() ... outside of <Suspense>" for this route.
export function generateStaticParams() {
  return [{ id: "1" }];
}

export default function SocialPostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sort?: string | string[] }> }) {
  return (
    <Suspense fallback={<p className="pc-empty">…</p>}>
      <SocialPostContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SocialPostContent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sort?: string | string[] }> }) {
  await connection();

  const { id: rawId } = await params;
  const sort = parseReplySort((await searchParams).sort); // SOCIAL_TODO B10: "oldest" (default) or "top"
  const viewer = await getSessionUser();


  const postId = parseSocialPostId(rawId);
  if (postId === null) notFound();
  const post = await getSocialPost(postId);
  if (!post) notFound();
  // Block (SOCIAL_TODO A7): a post of a person who blocked you, or whom you blocked, is "not found". A muted person's post opens.
  const hidden = await loadHiddenAuthors(viewer?.id ?? null);
  if (hidden.blocked.has(post.author)) notFound();

  const liked = viewer ? (await getMySocialLikes(viewer.id, [post.id])).includes(post.id) : false;
  const following = viewer ? (await getMyFollowing(viewer.id, [post.author])).includes(post.author) : false;
  const reposted = viewer ? (await getMySocialReposts(viewer.id, [post.id])).includes(post.id) : false;
  const bookmarked = viewer ? (await getMySocialBookmarks(viewer.id, [post.id])).includes(post.id) : false;
  const pinnedId = viewer && post.author === viewer.username ? await getMyPinnedSocialPostId(viewer.id) : null; // SOCIAL_TODO B6
  // Quote reposts of this post (SOCIAL_TODO 16): the post is already known to be shown, so the list is safe to read.
  const quotes = dropHiddenItems(await getSocialQuotes(post.id), hidden.all);
  // Replies (SOCIAL_TODO 18): the post is already known to be shown, so the list is safe to read.
  const replies = dropHiddenAuthors(await getSocialReplies(post.id), hidden.all);
  // Reply control (SOCIAL_TODO B9): who may reply to this post, and may THIS person (read per request, never cached).
  const replyAccess = viewer ? await getReplyAccess(viewer.id, post.id) : { policy: "EVERYONE" as const, canReply: false }; // a visitor sees "log in to reply"
  // Fair order of replies (SOCIAL_TODO B10): hidden-by-author replies stay in their own part, oldest first.
  const ordered = orderReplies(replies.filter((reply) => !reply.hiddenByAuthor), sort, nowMs(), socialReplyRank);
  const orderedReplies = [...ordered.items, ...replies.filter((reply) => reply.hiddenByAuthor)];
  const likedReplyIds = viewer ? await getMyReplyLikes(viewer.id, replies.map((reply) => reply.id)) : [];

  return (
    <>
      <Link href="/social" className="pc-back">
        <span aria-hidden="true" className="inline-block rtl:rotate-180">←</span>
        {t("social.post.back")}
      </Link>

      <SocialPostCard
        post={post}
        isLiked={liked}
        isReposted={reposted}
        isBookmarked={bookmarked}
        isPinned={pinnedId === post.id}
        permalink={false}
        viewer={viewer?.username ?? null}
        isFollowing={following}
      />

      <SocialReplyList
        postId={post.id}
        replies={orderedReplies}
        viewer={viewer?.username ?? null}
        postAuthor={post.author}
        policy={replyAccess.policy}
        canReply={replyAccess.canReply}
        sort={sort}
        likedReplyIds={likedReplyIds}
        risingIds={[...ordered.rising]}
      />

      {quotes.length > 0 && (
        <section aria-labelledby="sp-quotes-title">
          <h2 id="sp-quotes-title" className="sp-quotesTitle">{t("social.quotes.title", { count: quotes.length })}</h2>
          {quotes.map((item) => (
            <SocialRepostCard key={`repost-${item.repostId}`} item={item} showOriginal={false} />
          ))}
        </section>
      )}
    </>
  );
}
