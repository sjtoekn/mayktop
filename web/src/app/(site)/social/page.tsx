import { nowMs } from "@/lib/now";
import type { Metadata } from "next";
import { Suspense } from "react";
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
// Visitors (not logged in) can READ the feed (decision changed 2026-11-08 from PROJECT.md 8j point 11): no composer,
// no "Who to follow", and no personal state on the cards. Writing (like, repost, reply, follow, save) still needs a login.
// Loading: app/(site)/loading.tsx. Unexpected error: app/(site)/error.tsx. Both cover this page.
// The page reads the login cookie and the database, so it runs per request: connection() and the data sit INSIDE <Suspense>
// (Next.js 16 "instant" check: dynamic data outside <Suspense> blocks the route), the same way /social/[id] does it.
type Search = Promise<{ before?: string }>;

export default function SocialFeedPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<p className="pc-empty">…</p>}>
      <SocialFeedContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SocialFeedContent({ searchParams }: { searchParams: Search }) {
  await connection();
  const { before } = await searchParams;
  const cursor = parseCursor(before); // anything that is not a cursor means the first page

  const viewer = await getSessionUser();

  const fetched = await getSocialFeed(cursor ? cursorToText(cursor) : null);
  // Block and Mute (SOCIAL_TODO A7): applied after the shared cache, for this viewer only.
  const hidden = await loadHiddenAuthors(viewer?.id ?? null);
  const page = { ...fetched, items: dropHiddenItems(fetched.items, hidden.all) };

  return (
    <>
      <PageHero variant="social" parts={[t("social.hero.a"), t("social.hero.b"), t("social.hero.c")]} sub={t("social.hero.sub")} />

      <FeedTypeTabs active="social" />

      <header className="card pg-head sf-feedHead">
        <SocialFeedTabs active="all" />
        <p className="pc-text">{t("social.feed.sub")}</p>
      </header>

      {viewer ? <SocialComposer /> : null}

      {!cursor && viewer ? <SocialDiscover viewer={viewer} /> : null}

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
