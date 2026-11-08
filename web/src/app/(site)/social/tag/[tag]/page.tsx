import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Icon from "@/components/shell/Icon";
import SocialFeedList from "@/components/social/SocialFeedList";
import SocialFeedPager from "@/components/social/SocialFeedPager";
import { t } from "@/i18n";
import { getSocialTagFeed } from "@/lib/queries";
import { getSessionUser } from "@/lib/session";
import { dropHiddenItems } from "@/lib/social-block-rules";
import { loadHiddenAuthors } from "@/lib/social-block-view";
import { cursorToText, parseCursor } from "@/lib/social-paging";
import { parseTagParam, tagHref } from "@/lib/social-tags";

// The posts that use one hashtag (SOCIAL_TODO 6): /social/tag/<tag>. Social is ONLY for logged-in people (PROJECT.md 8j
// point 11), so, like the post page and the profile:
//  - the title is always the same plain words and the page is marked noindex;
//  - a visitor sees the log-in message for ANY name (nothing is read);
//  - a logged-in person gets "not found" for a name that cannot be a hashtag, and an empty page for a hashtag nobody uses.
// Social posts only, newest first (never by popularity), paged like the feeds. Hidden, removed and deleted posts, and posts
// of accounts that are not shown, are left out by the same rule as the feeds (queries.ts socialFeedWhere).
export const metadata: Metadata = {
  title: t("social.tag.title"),
  robots: { index: false, follow: false },
};

// The page reads the login cookie and the database, so it runs per request, inside <Suspense>. The placeholder only lets
// Next.js prepare the page shell at build time (the same way /social/[id] does it); it is never shown.
export function generateStaticParams() {
  return [{ tag: "placeholder" }];
}

type Params = Promise<{ tag: string }>;
type Search = Promise<{ before?: string }>;

export default function SocialTagPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  return (
    <Suspense fallback={<p className="pc-empty">…</p>}>
      <SocialTagContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SocialTagContent({ params, searchParams }: { params: Params; searchParams: Search }) {
  await connection();

  const { tag: rawTag } = await params;
  const { before } = await searchParams;
  const viewer = await getSessionUser();

  if (!viewer) {
    return (
      <>
        <header className="card pg-head">
          <h1 className="sf-h1">{t("social.tag.title")}</h1>
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

  const tag = parseTagParam(rawTag);
  if (!tag) notFound();

  const cursor = parseCursor(before); // anything that is not a cursor means the first page
  const fetched = await getSocialTagFeed(tag, cursor ? cursorToText(cursor) : null);
  // Block and Mute (SOCIAL_TODO A7): applied for this viewer only.
  const hidden = await loadHiddenAuthors(viewer.id);
  const page = { ...fetched, items: dropHiddenItems(fetched.items, hidden.all) };

  return (
    <>
      <header className="card pg-head">
        <h1 className="sf-h1">#{tag}</h1>
        <div>
          <Link href="/social" className="pc-btn pc-btn-ghost">{t("social.post.back")}</Link>
        </div>
      </header>

      {page.items.length === 0 && !cursor && !page.next ? (
        <section className="card pg-empty">
          <span className="pc-avatar pc-a4" aria-hidden="true"><Icon name="comment" size={26} /></span>
          <p>{t("social.tag.empty")}</p>
        </section>
      ) : (
        <>
          <SocialFeedList feed={page.items} viewer={viewer} />
          <SocialFeedPager basePath={tagHref(tag)} next={page.next} isFirstPage={!cursor} />
        </>
      )}
    </>
  );
}
