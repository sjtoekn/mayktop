import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Icon from "@/components/shell/Icon";
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
import SocialReplyList from "@/components/social/SocialReplyList";

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

export default function SocialPostPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="pc-empty">…</p>}>
      <SocialPostContent params={params} />
    </Suspense>
  );
}

async function SocialPostContent({ params }: { params: Promise<{ id: string }> }) {
  await connection();

  const { id: rawId } = await params;
  const viewer = await getSessionUser();

  if (!viewer) {
    return (
      <>
        <header className="card pg-head">
          <h1 className="sf-h1">{t("social.feed.title")}</h1>
        </header>
        <section className="card pg-empty">
          <span className="pc-avatar pc-a4" aria-hidden="true"><Icon name="shield" size={26} /></span>
          <p>{t("social.feed.loginRequired")}</p>
          <div className="fa-actions">
            <Link href="/login" className="pc-btn">{t("topbar.login")}</Link>
            <Link href="/signup" className="pc-btn pc-btn-ghost">{t("topbar.signup")}</Link>
          </div>
        </section>
      </>
    );
  }

  const postId = parseSocialPostId(rawId);
  if (postId === null) notFound();
  const post = await getSocialPost(postId);
  if (!post) notFound();
  // Block (SOCIAL_TODO A7): a post of a person who blocked you, or whom you blocked, is "not found". A muted person's post opens.
  const hidden = await loadHiddenAuthors(viewer.id);
  if (hidden.blocked.has(post.author)) notFound();

  const liked = (await getMySocialLikes(viewer.id, [post.id])).includes(post.id);
  const following = (await getMyFollowing(viewer.id, [post.author])).includes(post.author);
  const reposted = (await getMySocialReposts(viewer.id, [post.id])).includes(post.id);
  const bookmarked = (await getMySocialBookmarks(viewer.id, [post.id])).includes(post.id);
  const pinnedId = post.author === viewer.username ? await getMyPinnedSocialPostId(viewer.id) : null; // SOCIAL_TODO B6
  // Quote reposts of this post (SOCIAL_TODO 16): the post is already known to be shown, so the list is safe to read.
  const quotes = dropHiddenItems(await getSocialQuotes(post.id), hidden.all);
  // Replies (SOCIAL_TODO 18): the post is already known to be shown, so the list is safe to read.
  const replies = dropHiddenAuthors(await getSocialReplies(post.id), hidden.all);

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
        viewer={viewer.username}
        isFollowing={following}
      />

      <SocialReplyList postId={post.id} replies={replies} viewer={viewer.username} />

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
