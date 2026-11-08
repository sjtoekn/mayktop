import Link from "next/link";
import SocialPostCard from "@/components/social/SocialPostCard";
import SocialRepostButton from "@/components/social/SocialRepostButton";
import type { SocialFeedItem } from "@/lib/queries";
import { t } from "@/i18n";

type RepostItem = Extract<SocialFeedItem, { kind: "repost" }>;

/**
 * A repost in a feed (SOCIAL_TODO 16).
 *  - plain repost: a short line "<name> reposted", then the ORIGINAL post as the normal card (with its own buttons);
 *  - quote repost: a card for the person who quoted (their text), with the original post shown inside it as a quiet box
 *    that links to the post's own page. `showOriginal={false}` (used on the post's own page, under "Quotes") leaves the box out.
 * It only shows what the feed query already allowed: the original is visible and both people's posts may be shown.
 */
export default function SocialRepostCard({
  item,
  isLiked = false,
  isReposted = false,
  isBookmarked = false,
  isPinned = false,
  viewer = null,
  isFollowing = false,
  showOriginal = true,
}: {
  item: RepostItem;
  isLiked?: boolean;
  isReposted?: boolean;
  isBookmarked?: boolean;
  isPinned?: boolean;
  viewer?: string | null;
  isFollowing?: boolean;
  showOriginal?: boolean;
}) {
  const name = item.reposterName?.trim() || item.reposter;
  const original = item.post;
  const originalName = original.displayName?.trim() || original.author;

  if (item.quote === null) {
    return (
      <div className="sp-repostGroup">
        <p className="sp-repostNote">↻ {item.alsoCount ? t("social.repost.byMany", { name, count: item.alsoCount }) : t("social.repost.by", { name })} <span dir="ltr">@{item.reposter}</span></p>
        <SocialPostCard post={original} isLiked={isLiked} isReposted={isReposted} isBookmarked={isBookmarked} isPinned={isPinned} viewer={viewer} isFollowing={isFollowing} />
      </div>
    );
  }

  const tone = ((item.reposter.charCodeAt(0) || 0) % 5) + 1;

  return (
    <article className="card pc-post sp-card">
      <div className={`pc-avatar pc-a${tone}`} aria-hidden="true">
        {item.reposter.charAt(0).toUpperCase()}
      </div>

      <div className="pc-body">
        <div className="pc-meta">
          <strong><Link href={`/social/u/${item.reposter}`} className="sp-nameLink">{name}</Link></strong>
          {" · @"}{item.reposter}
          {" · "}{item.time}
          {" · "}{t("social.quote.by")}
        </div>

        <p className="pc-text pc-text-full sp-body">{item.quote}</p>

        {showOriginal && (
          <div className="sp-quoted">
            <div className="pc-meta">
              <strong>{originalName}</strong>
              {" · @"}{original.author}
              {" · "}
              <Link href={`/social/${original.id}`}>{original.time}</Link>
            </div>
            <p className="pc-text pc-text-full sp-body">{original.body}</p>
          </div>
        )}

        {showOriginal && (
          <div className="pc-actions sp-stats">
            <SocialRepostButton
              postId={original.id}
              initialReposted={isReposted}
              initialCount={original.reposts}
              text={{
                repost: t("social.repost.label"),
                unrepost: t("social.unrepost.label"),
                quote: t("social.quote"),
                field: t("social.quote.field"),
                submit: t("social.quote.submit"),
                cancel: t("social.quote.cancel"),
                saving: t("social.quote.saving"),
                login: t("social.repost.login"),
                tooMany: t("social.repost.toomany"),
                invalid: t("social.quote.invalid"),
                error: t("social.repost.error"),
              }}
            />
          </div>
        )}
      </div>
    </article>
  );
}
