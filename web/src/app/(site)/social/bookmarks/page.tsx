import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import { connection } from "next/server";
import Icon from "@/components/shell/Icon";
import SocialFeedList from "@/components/social/SocialFeedList";
import SocialFeedPager from "@/components/social/SocialFeedPager";
import SocialFeedTabs from "@/components/social/SocialFeedTabs";
import { t } from "@/i18n";
import { getSocialBookmarks } from "@/lib/queries";
import { getSessionUser } from "@/lib/session";
import { dropHiddenItems } from "@/lib/social-block-rules";
import { loadHiddenAuthors } from "@/lib/social-block-view";
import { bookmarkCursorToText, parseBookmarkCursor } from "@/lib/social-bookmark-rules";

export const metadata: Metadata = {
  title: t("social.bookmarks.title"),
  robots: { index: false, follow: false },
};

// Your bookmarks (SOCIAL_TODO B2): the Social posts you saved, the most recently SAVED first. ONLY for logged-in people and
// ONLY your own list (it is private; there is no page for somebody else's). Not cached: the list belongs to one viewer.
// Posts that are hidden, removed or deleted, or whose author's account may not be shown, are left out (they come back when
// the post comes back). A post of a person who blocked you, or whom you blocked, is left out too (Block, ACCOUNT_RULES.md 3.16).
export default async function SocialBookmarksPage({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  await connection();
  const { before } = await searchParams;
  const cursor = parseBookmarkCursor(before); // anything that is not a cursor means the first page

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

  const fetched = await getSocialBookmarks(viewer.id, cursor ? bookmarkCursorToText(cursor) : null);
  const hidden = await loadHiddenAuthors(viewer.id);
  // Only BLOCK hides a saved post. A muted person's post stays: saving it was your own choice.
  const items = dropHiddenItems(fetched.items, hidden.blocked);
  const { next } = fetched;

  return (
    <>
      <PageHero variant="social" parts={[t("social.hero.a"), t("social.hero.b"), t("social.hero.c")]} sub={t("social.hero.sub")} />

      <header className="card pg-head sf-feedHead">
        <SocialFeedTabs active="bookmarks" />
        <p className="pc-text">{t("social.bookmarks.sub")}</p>
      </header>

      {items.length === 0 && !cursor && !next ? (
        <section className="card pg-empty">
          <span className="pc-avatar pc-a4" aria-hidden="true"><Icon name="bookmark" size={26} /></span>
          <p>{t("social.bookmarks.empty")}</p>
          <div className="fa-actions">
            <Link href="/social" className="pc-btn">{t("social.following.browse")}</Link>
          </div>
        </section>
      ) : (
        <>
          <SocialFeedList feed={items} viewer={viewer} />
          <SocialFeedPager basePath="/social/bookmarks" next={next} isFirstPage={!cursor} />
        </>
      )}
    </>
  );
}
