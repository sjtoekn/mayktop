import Link from "next/link";
import Icon from "@/components/shell/Icon";
import SocialFollowButton from "@/components/social/SocialFollowButton";
import { nowMs } from "@/lib/now";
import { t, tn } from "@/i18n";
import { getSocialTrendingTags } from "@/lib/queries";
import { loadHiddenAuthors } from "@/lib/social-block-view";
import { getWhoToFollow } from "@/lib/social-suggest";
import { profileHref } from "@/lib/social-profile";
import { tagHref } from "@/lib/social-tags";

/**
 * "Trending hashtags" and "Who to follow" (SOCIAL_TODO B7, ACCOUNT_RULES.md 3.19). Shown on the first page of /social and
 * /social/following, for logged-in people only. A part with nothing to show is left out; with nothing at all the card is not drawn.
 * Trending is shared and cached; Who to follow is asked for THIS person (not cached) and leaves out blocked, blocking and muted people.
 */
export default async function SocialDiscover({ viewer }: { viewer: { id: string; username: string } }) {
  const hidden = await loadHiddenAuthors(viewer.id);
  const [trending, suggestions] = await Promise.all([getSocialTrendingTags(), getWhoToFollow(viewer.id, hidden.all, nowMs())]);
  if (trending.length === 0 && suggestions.length === 0) return null;

  return (
    <section className="card sp-discover" aria-label={t("social.discover.label")}>
      {trending.length > 0 && (
        <div className="sp-discoverPart">
          <h2 className="sp-discoverTitle"><Icon name="flame" size={18} /> {t("social.discover.trending.title")}</h2>
          <p className="pc-meta">{t("social.discover.trending.sub")}</p>
          <ul className="sp-trendList">
            {trending.map((item) => (
              <li key={item.tag}>
                <Link href={tagHref(item.tag)} className="sp-trendTag"><span dir="auto">#{item.tag}</span></Link>
                <span className="pc-meta"> · {tn("social.discover.trending.people", item.people)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="sp-discoverPart">
          <h2 className="sp-discoverTitle"><Icon name="user" size={18} /> {t("social.discover.suggest.title")}</h2>
          <p className="pc-meta">{t("social.discover.suggest.sub")}</p>
          <ul className="sp-peopleList">
            {suggestions.map((person) => {
              const name = person.displayName?.trim() || person.username;
              const tone = ((person.username.charCodeAt(0) || 0) % 5) + 1;
              return (
                <li key={person.username} className="sp-person">
                  <span className={`pc-avatar pc-a${tone}`} aria-hidden="true">{person.username.charAt(0).toUpperCase()}</span>
                  <Link href={profileHref(person.username)} className="sp-personName">
                    <strong>{name}</strong> <span dir="ltr">@{person.username}</span>
                    {person.mutual > 0 && <span className="pc-meta sp-mutual">{tn("social.discover.suggest.mutual", person.mutual)}</span>}
                  </Link>
                  <SocialFollowButton
                    username={person.username}
                    initialFollowing={false}
                    text={{
                      follow: t("social.follow"),
                      following: t("social.following"),
                      followLabel: t("social.follow.label", { username: person.username }),
                      unfollowLabel: t("social.unfollow.label", { username: person.username }),
                      login: t("social.follow.login"),
                      tooMany: t("social.follow.toomany"),
                      error: t("social.follow.error"),
                    }}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
