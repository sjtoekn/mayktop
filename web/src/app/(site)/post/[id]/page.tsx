import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import PostCard from "@/components/PostCard";
import CommentItem from "@/components/CommentItem";
import CommentForm from "@/components/CommentForm";
import BountyBox from "@/components/BountyBox";
import { formatNumber, t } from "@/i18n";
import type { Metadata } from "next";
import { bountyConfig, reputationConfig, siteConfig } from "@/config/site";
import { getComments, getPost, getPostIds } from "@/lib/queries";
import { noIndexMetadata, pageMetadata } from "@/lib/seo-text";
import { jsonLdString, postJsonLd } from "@/lib/seo-jsonld";

// Tell Next.js which posts exist so each page can be prepared in advance.
export async function generateStaticParams() {
  const ids = await getPostIds();
  return ids.map((id) => ({ id: String(id) }));
}

// The page header for search engines and share cards (SEO stage 2): the post's own title and the start of its text.
// A missing, hidden, removed or erased post is kept out of search engines.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const postId = Number((await params).id);
  if (!Number.isInteger(postId) || postId < 1 || postId > 2_147_483_647) return noIndexMetadata;
  const post = await getPost(postId);
  if (!post || post.deleted || post.hidden || !post.title) return noIndexMetadata;
  return pageMetadata({ path: `/post/${post.id}`, title: post.title, siteName: siteConfig.name, description: post.body, type: "article" });
}

export default function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<p className="pc-empty">…</p>}>
      <PostContent params={params} />
    </Suspense>
  );
}

async function PostContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Ids are whole numbers that fit the database column; anything else is simply "not found".
  const postId = Number(id);
  if (!Number.isInteger(postId) || postId < 1 || postId > 2_147_483_647) notFound();
  const post = await getPost(postId);
  if (!post) notFound();
  const comments = await getComments(post.id);
  // A question can have an accepted answer and a bounty (SITE_PLAN B4, B6). Both are only offered while it is visible.
  const isQuestion = post.kind === "question" && !post.hidden && !post.deleted;
  const qa = isQuestion ? { postAuthor: post.author, locked: post.bounty?.paid === true } : undefined;

  return (
    <>
      <Link href={`/c/${post.community}`} className="pc-back">
        <span aria-hidden="true" className="inline-block rtl:rotate-180">←</span>
        {t("post.back", { slug: post.community })}
      </Link>

      {/* Structured data for search engines (SEO stage 3): only for a post that anybody may see. */}
      {!post.hidden && !post.deleted && post.title && post.author && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdString(postJsonLd({ id: post.id, title: post.title, body: post.body, author: post.author, createdAtMs: post.createdAtMs, comments: post.comments })),
          }}
        />
      )}

      <PostCard post={post} full />

      {/* The asker may put a bounty on a question that has no accepted answer and no running bounty (the box shows only to the asker). */}
      {isQuestion && !post.answered && !post.bounty && (
        <BountyBox
          postId={post.id}
          postAuthor={post.author}
          min={bountyConfig.min}
          max={bountyConfig.max}
          need={reputationConfig.privileges.bounty}
          text={{
            title: t("bounty.title"),
            help: t("bounty.help", { days: bountyConfig.days }),
            amount: t("bounty.amount"),
            submit: t("bounty.submit"),
            saving: t("submit.saving"),
            error: t("bounty.error"),
            errorAmount: t("bounty.error.amount"),
            errorReputation: t("bounty.error.reputation"),
            errorPoints: t("bounty.error.points"),
          }}
        />
      )}

      {/* A post hidden for review cannot be commented on (the server refuses it too). */}
      {!post.hidden && !post.deleted && (
        <section className="card pc-composer">
          <div className="pc-avatar pc-a1" aria-hidden="true">👤</div>
          <CommentForm
            postId={post.id}
            text={{
              label: t("comment.write.label"),
              placeholder: t("comment.write.placeholder"),
              submit: t("comment.submit"),
              saving: t("submit.saving"),
              error: t("comment.error"),
              errorLink: t("comment.error.link"),
              cancel: t("submit.cancel"),
              login: t("auth.required"),
              loginLink: t("topbar.login"),
            }}
          />
        </section>
      )}

      <section className="card pc-comments">
        <div className="pc-comments-head">
          <h2>{t("comments.title")} · {formatNumber(post.comments)}</h2>
          <span className="type-small">{t("comments.fairnote")}</span>
        </div>

        {comments.length === 0 ? (
          <p className="pc-empty">{t("comments.empty")}</p>
        ) : (
          <div className="grid gap-6">
            {comments.map((c) => (
              <CommentItem key={c.id} comment={c} postId={post.id} qa={qa} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
