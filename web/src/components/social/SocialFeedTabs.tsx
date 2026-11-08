import Link from "next/link";
import { t } from "@/i18n";

/** "All | Following" under the Social title (SOCIAL_TODO 17). Server component: the page says which tab is open. */
export default function SocialFeedTabs({ active }: { active: "all" | "following" | "bookmarks" }) {
  return (
    <nav className="sp-tabs" aria-label={t("social.tabs.label")}>
      <Link href="/social" className={`sp-tab${active === "all" ? " is-active" : ""}`} aria-current={active === "all" ? "page" : undefined}>
        {t("social.tabs.all")}
      </Link>
      <Link href="/social/following" className={`sp-tab${active === "following" ? " is-active" : ""}`} aria-current={active === "following" ? "page" : undefined}>
        {t("social.tabs.following")}
      </Link>
      <Link href="/social/bookmarks" className={`sp-tab${active === "bookmarks" ? " is-active" : ""}`} aria-current={active === "bookmarks" ? "page" : undefined}>
        {t("social.tabs.bookmarks")}
      </Link>
    </nav>
  );
}
