import Link from "next/link";
import SocialFollowButton from "@/components/social/SocialFollowButton";
import { t } from "@/i18n";
import type { SocialPerson } from "@/lib/queries";
import { profileHref } from "@/lib/social-profile";

/**
 * Followers / Following list on a Social profile (SOCIAL_TODO 2): name, @username (a link to that profile) and a Follow
 * button (never for yourself). `followingNames` = which of these people THIS viewer follows (getMyFollowing).
 */
export default function SocialPeopleList({
  people,
  viewer,
  followingNames,
}: {
  people: SocialPerson[];
  viewer: string | null;
  followingNames: Set<string>;
}) {
  return (
    <section className="card sp-people">
      <ul className="sp-peopleList">
        {people.map((person) => {
          const name = person.displayName?.trim() || person.username;
          const tone = ((person.username.charCodeAt(0) || 0) % 5) + 1;
          return (
            <li key={person.username} className="sp-person">
              <span className={`pc-avatar pc-a${tone}`} aria-hidden="true">
                {person.username.charAt(0).toUpperCase()}
              </span>
              <Link href={profileHref(person.username)} className="sp-personName">
                <strong>{name}</strong> <span dir="ltr">@{person.username}</span>
              </Link>
              {viewer !== null && person.username !== viewer && (
                <SocialFollowButton
                  username={person.username}
                  initialFollowing={followingNames.has(person.username)}
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
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
