import Link from "next/link";
import { t } from "@/i18n";
import { searchHref, type SearchTab } from "@/lib/social-search";

/** "Posts | People | Hashtags" under the search box (SOCIAL_TODO B1). Plain links that keep the text searched. Server component. */
export default function SocialSearchTabs({ q, active }: { q: string; active: SearchTab }) {
  const tabs: { tab: SearchTab; label: string }[] = [
    { tab: "posts", label: t("social.search.tab.posts") },
    { tab: "people", label: t("social.search.tab.people") },
    { tab: "tags", label: t("social.search.tab.tags") },
  ];
  return (
    <nav className="sp-tabs" aria-label={t("social.search.tabs.label")}>
      {tabs.map(({ tab, label }) => (
        <Link
          key={tab}
          href={searchHref(q, tab)}
          className={`sp-tab${active === tab ? " is-active" : ""}`}
          aria-current={active === tab ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
