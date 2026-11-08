import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import Icon from "@/components/shell/Icon";
import SocialFeedList from "@/components/social/SocialFeedList";
import SocialFeedPager from "@/components/social/SocialFeedPager";
import SocialPeopleList from "@/components/social/SocialPeopleList";
import SocialSearchForm from "@/components/social/SocialSearchForm";
import SocialSearchTabs from "@/components/social/SocialSearchTabs";
import { socialLimits } from "@/config/site";
import { t } from "@/i18n";
import { getMyFollowing, searchSocialPeople, searchSocialPosts, searchSocialTags } from "@/lib/queries";
import { getSessionUser } from "@/lib/session";
import { dropHiddenItems } from "@/lib/social-block-rules";
import { loadHiddenAuthors } from "@/lib/social-block-view";
import { takeActionDb } from "@/lib/rate-limit-db";
import { cursorToText, parseCursor } from "@/lib/social-paging";
import { parseSocialSearch, searchHref, SOCIAL_SEARCH_LIST_SIZE } from "@/lib/social-search";
import { tagHref } from "@/lib/social-tags";

// Search in Social (SOCIAL_TODO B1): /social/search?q=...&tab=posts|people|tags. Social is ONLY for logged-in people
// (PROJECT.md 8j point 11), so, like the feed, the profile and the hashtag page:
//  - the title is always the same plain words and the page is marked noindex (what people search is never in the address
//    of a public page, and Google never sees it);
//  - a visitor sees the log-in message and nothing is read from the database.
// Rules: src/lib/social-search.ts. Posts: every word must be in the text, newest first, paged like the feeds. People:
// best name match first. Hashtags: the exact one first, then the most recently used (never by popularity). Block and Mute
// are applied here for this viewer (blocked people never appear anywhere; a muted person's posts are hidden, their profile
// can still be found). Hidden, removed and deleted posts and accounts that are not shown are left out by the queries.
export const metadata: Metadata = {
  title: t("social.search.title"),
  robots: { index: false, follow: false },
};

type Search = Promise<{ q?: string | string[]; tab?: string | string[]; before?: string | string[] }>;

const searchRules = socialLimits.searches.map((rule) => ({ max: rule.max, windowMs: rule.windowSeconds * 1000 }));

export default async function SocialSearchPage({ searchParams }: { searchParams: Search }) {
  await connection();
  const params = await searchParams;
  const viewer = await getSessionUser();


  const search = parseSocialSearch(params.q, params.tab); // a repeated ?q=a&q=b is not a string: treated as nothing typed
  const header = (
    <header className="card pg-head">
      <h1 className="sf-h1">{search.q ? t("social.search.summary", { q: search.q }) : t("social.search.title")}</h1>
      <SocialSearchForm defaultValue={search.q} tab={search.tab} />
      <SocialSearchTabs q={search.q} active={search.tab} />
      <div>
        <Link href="/social" className="pc-btn pc-btn-ghost">{t("social.post.back")}</Link>
      </div>
    </header>
  );

  if (search.state === "empty") {
    return (
      <>
        {header}
        <section className="card pg-empty">
          <span className="pc-avatar pc-a4" aria-hidden="true"><Icon name="search" size={26} /></span>
          <p>{t("social.search.prompt")}</p>
        </section>
      </>
    );
  }

  if (search.state === "short") {
    return (
      <>
        {header}
        <section className="card pg-empty">
          <p>{t("social.search.short")}</p>
        </section>
      </>
    );
  }

  // Every search page that really reads the database counts (also "Older posts"). Server memory, like the other Social limits.
  // Visitors share ONE bucket (the project keeps no IP address); a logged-in person has their own.
  if (!(await takeActionDb(`social-search:${viewer ? viewer.id : "visitors"}`, searchRules)).ok) {
    return (
      <>
        {header}
        <section className="card pg-empty">
          <p>{t("social.search.limited")}</p>
        </section>
      </>
    );
  }

  const hidden = await loadHiddenAuthors(viewer?.id ?? null);

  if (search.tab === "people") {
    const people = await searchSocialPeople(search.person, hidden.blocked);
    if (people.length === 0) {
      return (
        <>
          {header}
          <section className="card pg-empty">
            <p>{t("social.search.empty.people", { q: search.q })}</p>
          </section>
        </>
      );
    }
    const followingNames = new Set(viewer ? await getMyFollowing(viewer.id, people.map((person) => person.username)) : []);
    return (
      <>
        {header}
        <SocialPeopleList people={people} viewer={viewer?.username ?? null} followingNames={followingNames} />
        {people.length >= SOCIAL_SEARCH_LIST_SIZE ? (
          <p className="ss-note">{t("social.search.more", { n: String(SOCIAL_SEARCH_LIST_SIZE) })}</p>
        ) : null}
      </>
    );
  }

  if (search.tab === "tags") {
    const tags = await searchSocialTags(search.tag);
    if (tags.length === 0) {
      return (
        <>
          {header}
          <section className="card pg-empty">
            <p>{t("social.search.empty.tags", { q: search.q })}</p>
          </section>
        </>
      );
    }
    return (
      <>
        {header}
        <section className="card sp-people">
          <ul className="sp-peopleList">
            {tags.map((tag) => (
              <li key={tag} className="sp-person">
                <Link href={tagHref(tag)} className="ss-tag" dir="auto">#{tag}</Link>
              </li>
            ))}
          </ul>
        </section>
        {tags.length >= SOCIAL_SEARCH_LIST_SIZE ? (
          <p className="ss-note">{t("social.search.more", { n: String(SOCIAL_SEARCH_LIST_SIZE) })}</p>
        ) : null}
      </>
    );
  }

  // Posts
  const cursor = parseCursor(typeof params.before === "string" ? params.before : undefined); // not a cursor = first page
  const fetched = await searchSocialPosts(search.words, cursor ? cursorToText(cursor) : null);
  const page = { ...fetched, items: dropHiddenItems(fetched.items, hidden.all) };

  return (
    <>
      {header}
      {page.items.length === 0 && !cursor && !page.next ? (
        <section className="card pg-empty">
          <span className="pc-avatar pc-a4" aria-hidden="true"><Icon name="comment" size={26} /></span>
          <p>{t("social.search.empty.posts", { q: search.q })}</p>
        </section>
      ) : (
        <>
          <SocialFeedList feed={page.items} viewer={viewer} />
          <SocialFeedPager basePath={searchHref(search.q, "posts")} next={page.next} isFirstPage={!cursor} />
        </>
      )}
    </>
  );
}
