import { nowMs } from "@/lib/now";
import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import FeedTypeTabs from "@/components/feed/FeedTypeTabs";
import { connection } from "next/server";
import Icon from "@/components/shell/Icon";
import SocialFeedList from "@/components/social/SocialFeedList";
import SocialFeedPager from "@/components/social/SocialFeedPager";
import SocialComposer from "@/components/social/SocialComposer";
import SocialDiscover from "@/components/social/SocialDiscover";
import SocialFeedTabs from "@/components/social/SocialFeedTabs";
import SocialNewPostsBanner from "@/components/social/SocialNewPostsBanner";
import { t } from "@/i18n";
import { getSocialFeed } from "@/lib/queries";
import { getSessionUser } from "@/lib/session";
import { dropHiddenItems } from "@/lib/social-block-rules";
import { loadHiddenAuthors } from "@/lib/social-block-view";
import { cursorToText, parseCursor } from "@/lib/social-paging";
import { newestMs } from "@/lib/social-new-posts";

export const metadata: Metadata = {
  title: t("social.feed.title"),
};

// The Social feed (SOCIAL_TODO 11): Social posts only, newest first. The mixed feed stays on Home.
// Tabs "All | Following" (SOCIAL_TODO 17); the Following tab is /social/following.
// Social posts are ONLY for logged-in people (PROJECT.md 8j point 11): a visitor sees a short log-in message,
// and the posts are not even read from the database.
// Loading: app/(site)/loading.tsx. Unexpected error: app/(site)/error.tsx. Both cover this page.
export default async function SocialFeedPage({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  await connection();
  const { before } = await searchParams;
  const cursor = parseCursor(before); // anything that is not a cursor means the first page

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

  const fetched = await getSocialFeed(cursor ? cursorToText(cursor) : null);
  // Block and Mute (SOCIAL_TODO A7): applied after the shared cache, for this viewer only.
  const hidden = await loadHiddenAuthors(viewer.id);
  const page = { ...fetched, items: dropHiddenItems(fetched.items, hidden.all) };

  return (
    <>
      <PageHero variant="social" parts={[t("social.hero.a"), t("social.hero.b"), t("social.hero.c")]} sub={t("social.hero.sub")} />

      <FeedTypeTabs active="social" />

      <header className="card pg-head sf-feedHead">
        <SocialFeedTabs active="all" />
        <p className="pc-text">{t("social.feed.sub")}</p>
      </header>

      <SocialComposer />

      {!cursor ? <SocialDiscover viewer={viewer} /> : null}

      {!cursor ? <SocialNewPostsBanner feed="all" since={newestMs(page.items, nowMs())} /> : null}

      {page.items.length === 0 && !cursor && !page.next ? (
        <section className="card pg-empty">
          <span className="pc-avatar pc-a4" aria-hidden="true"><Icon name="comment" size={26} /></span>
          <p>{t("social.feed.empty")}</p>
        </section>
      ) : (
        <>
          <SocialFeedList feed={page.items} viewer={viewer} withAds />
          <SocialFeedPager basePath="/social" next={page.next} isFirstPage={!cursor} />
        </>
      )}
    </>
  );
}
