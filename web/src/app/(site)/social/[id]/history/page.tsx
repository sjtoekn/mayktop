import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getLocale, t } from "@/i18n";
import { getSocialPost } from "@/lib/queries";
import { getSessionUser } from "@/lib/session";
import { loadHiddenAuthors } from "@/lib/social-block-view";
import { parseSocialPostId } from "@/lib/social-id";
import { getSocialPostHistory } from "@/lib/social-edit-history";
import "@/components/social/social-history.css";

// Edit history of one Social post (SOCIAL_TODO item 6): the current text and every earlier version, newest first.
// Same visibility as the post page itself (/social/<id>): only logged-in people; a number that is invalid, missing, hidden,
// removed or deleted (or of a person who blocked you / whom you blocked) is "not found", so history never leaks a post that
// the viewer may not see. Everybody who can see a post can see its earlier versions: that is what keeps edits honest.
// The title is always the same plain words, never the post text; the page is noindex.
export const metadata: Metadata = {
  title: t("social.history.title"),
  robots: { index: false, follow: false },
};

// The page reads the login cookie and the post, so it runs per request, inside <Suspense>. The placeholder id only lets
// Next.js prepare the page shell at build time (same reason as /social/<id>); no post is read for it.
export function generateStaticParams() {
  return [{ id: "1" }];
}

export default function SocialPostHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="pc-empty">…</p>}>
      <HistoryContent params={params} />
    </Suspense>
  );
}

function timeText(date: Date): string {
  return new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date) + " UTC";
}

async function HistoryContent({ params }: { params: Promise<{ id: string }> }) {
  await connection();

  const { id: rawId } = await params;
  const viewer = await getSessionUser();


  const postId = parseSocialPostId(rawId);
  if (postId === null) notFound();
  const post = await getSocialPost(postId);
  if (!post) notFound();
  const hidden = await loadHiddenAuthors(viewer?.id ?? null);
  if (hidden.blocked.has(post.author)) notFound();

  const versions = await getSocialPostHistory(post.id);
  const currentTime = timeText(new Date(post.editedAtMs ?? post.createdAtMs));

  return (
    <>
      <Link href={`/social/${post.id}`} className="pc-back">
        <span aria-hidden="true" className="inline-block rtl:rotate-180">←</span>
        {t("social.history.back")}
      </Link>

      <header className="card sh-head">
        <h1 className="sf-h1">{t("social.history.title")}</h1>
        <p>{t("social.history.intro")}</p>
      </header>

      <section className="card sh-version sh-current" aria-label={t("social.history.current", { time: currentTime })}>
        <div className="sh-when">{t("social.history.current", { time: currentTime })}</div>
        <p className="sh-text">{post.body}</p>
      </section>

      {versions.map((version) => (
        <section key={version.id} className="card sh-version">
          <div className="sh-when">{t("social.history.earlier", { time: timeText(version.writtenAt) })}</div>
          <p className="sh-text">{version.body}</p>
        </section>
      ))}

      {versions.length === 0 && (
        <p className="card sh-note">{post.edited ? t("social.history.unsaved") : t("social.history.none")}</p>
      )}
    </>
  );
}
