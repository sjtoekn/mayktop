import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import PostCard from "@/components/PostCard";
import CommentItem from "@/components/CommentItem";
import CommentForm from "@/components/CommentForm";
import { formatNumber, t } from "@/i18n";
import { getComments, getPost, getPostIds } from "@/lib/queries";

// Tell Next.js which posts exist so each page can be prepared in advance.
export async function generateStaticParams() {
  const ids = await getPostIds();
  return ids.map((id) => ({ id: String(id) }));
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

  return (
    <>
      <Link href={`/c/${post.community}`} className="pc-back">
        <span aria-hidden="true" className="inline-block rtl:rotate-180">←</span>
        {t("post.back", { slug: post.community })}
      </Link>

      <PostCard post={post} full />

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
              <CommentItem key={c.id} comment={c} postId={post.id} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
