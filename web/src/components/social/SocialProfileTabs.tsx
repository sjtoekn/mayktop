import Link from "next/link";
import { t } from "@/i18n";
import { profileHref, type ProfileTab } from "@/lib/social-profile";

/** "Posts | Replies | Likes | Followers | Following" on a Social profile (SOCIAL_TODO 2). Likes only on your own profile. */
export default function SocialProfileTabs({
  username,
  active,
  showLikes,
}: {
  username: string;
  active: ProfileTab;
  showLikes: boolean;
}) {
  const tabs: { tab: ProfileTab; label: string }[] = [
    { tab: "posts", label: t("social.profile.tab.posts") },
    { tab: "replies", label: t("social.profile.tab.replies") },
    ...(showLikes ? [{ tab: "likes" as const, label: t("social.profile.tab.likes") }] : []),
    { tab: "followers", label: t("social.profile.tab.followers") },
    { tab: "following", label: t("social.profile.tab.following") },
  ];
  return (
    <nav className="sp-tabs" aria-label={t("social.profile.tabs.label")}>
      {tabs.map(({ tab, label }) => (
        <Link
          key={tab}
          href={profileHref(username, tab)}
          className={`sp-tab${active === tab ? " is-active" : ""}`}
          aria-current={active === tab ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
