import Link from "next/link";
import { t } from "@/i18n";

/**
 * "Older posts" under a Social feed (SOCIAL_TODO 4). Plain links (no script): the next page is /social?before=<cursor>,
 * the cursor comes from src/lib/social-paging.ts. Server component.
 * `next` = the cursor of the next page (null = this is the last page); `isFirstPage` = no cursor in the URL.
 */
export default function SocialFeedPager({
  basePath,
  next,
  isFirstPage,
}: {
  basePath: string;
  next: string | null;
  isFirstPage: boolean;
}) {
  if (!next && isFirstPage) return null;
  return (
    <nav className="card sp-pager" aria-label={t("social.feed.pageLabel")}>
      {!isFirstPage ? (
        <Link href={basePath} className="pc-btn pc-btn-ghost">
          {t("social.feed.newest")}
        </Link>
      ) : null}
      {next ? (
        <Link href={`${basePath}${basePath.includes("?") ? "&" : "?"}before=${next}`} className="pc-btn" rel="next">
          {t("social.feed.older")}
        </Link>
      ) : (
        <p className="pc-text">{t("social.feed.end")}</p>
      )}
    </nav>
  );
}
