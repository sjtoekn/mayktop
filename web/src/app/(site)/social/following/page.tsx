import { nowMs } from "@/lib/now";
import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import { connection } from "next/server";
import Icon from "@/components/shell/Icon";
import SocialFeedList from "@/components/social/SocialFeedList";
import SocialFeedPager from "@/components/social/SocialFeedPager";
import SocialComposer from "@/components/social/SocialComposer";
import SocialDiscover from "@/components/social/SocialDiscover";
import SocialFeedTabs from "@/components/social/SocialFeedTabs";
import SocialNewPostsBanner from "@/components/social/SocialNewPostsBanner";
import { t } from "@/i18n";
import { getFollowingFeed } from "@/lib/queries";
import { getSessionUser } from "@/lib/session";
import { dropHiddenItems } from "@/lib/social-block-rules";
import { loadHiddenAuthors } from "@/lib/social-block-view";
import { cursorToText, parseCursor } from "@/lib/social-paging";
import { newestMs } from "@/lib/social-new-posts";

export const metadata: Metadata = {
  title: t("social.following.title"),
  robots: { index: false, follow: false },
};

// The Following feed (SOCIAL_TODO 17): posts and reposts of the people you follow and your own, newest first, never by
// popularity. ONLY for logged-in people (PROJECT.md 8j point 11): a visitor sees the log-in message and nothing is read.
// The feed belongs to one person, so it is not cached (getFollowingFeed).
export default async function SocialFollowingPage({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
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

  const fetched = await getFollowingFeed(viewer.id, cursor ? cursorToText(cursor) : null);
  // Block and Mute (SOCIAL_TODO A7): applied for this viewer only.
  const hidden = await loadHiddenAuthors(viewer.id);
  const items = dropHiddenItems(fetched.items, hidden.all);
  const { following, next } = fetched;

  return (
    <>
      <PageHero variant="social" parts={[t("social.hero.a"), t("social.hero.b"), t("social.hero.c")]} sub={t("social.hero.sub")} />

      <header className="card pg-head sf-feedHead">
        <SocialFeedTabs active="following" />
        <p className="pc-text">{t("social.following.sub")}</p>
      </header>

      <SocialComposer />

      {!cursor ? <SocialDiscover viewer={viewer} /> : null}

      {!cursor ? <SocialNewPostsBanner feed="following" since={newestMs(items, nowMs())} /> : null}

      {items.length === 0 && !cursor && !next ? (
        <section className="card pg-empty">
          <span className="pc-avatar pc-a4" aria-hidden="true"><Icon name="comment" size={26} /></span>
          <p>{following === 0 ? t("social.following.none") : t("social.following.quiet")}</p>
          <div className="fa-actions">
            <Link href="/social" className="pc-btn">{t("social.following.browse")}</Link>
          </div>
        </section>
      ) : (
        <>
          <SocialFeedList feed={items} viewer={viewer} withAds />
          <SocialFeedPager basePath="/social/following" next={next} isFirstPage={!cursor} />
        </>
      )}
    </>
  );
}
