import type { SocialPostSummary } from "@/lib/queries";
import SocialFollowButton from "@/components/social/SocialFollowButton";
import SocialBody from "@/components/social/SocialBody";
import SocialLinkPreview from "@/components/social/SocialLinkPreview";
import { findPostLink } from "@/lib/social-links";
import SocialLikeButton from "@/components/social/SocialLikeButton";
import SocialBookmarkButton from "@/components/social/SocialBookmarkButton";
import SocialPinButton from "@/components/social/SocialPinButton";
import SocialRepostButton from "@/components/social/SocialRepostButton";
import SocialReportButton from "@/components/social/SocialReportButton";
import { socialReportConfig, staffConfig } from "@/config/site";
import type { MessageKey } from "@/i18n/messages/en";
import SocialOwnerActions from "@/components/social/SocialOwnerActions";
import SocialShareButton from "@/components/social/SocialShareButton";
import Link from "next/link";
import { formatCompact, t, tn } from "@/i18n";
import SocialViewCount from "@/components/social/SocialViewCount";

export default function SocialPostCard({
  post,
  isLiked = false,
  permalink = true,
  viewer = null,
  isFollowing = false,
  isReposted = false,
  isBookmarked = false,
  isPinned = false,
}: {
  post: SocialPostSummary;
  isLiked?: boolean;
  /** The time is a link to the post's own page. Off on that page itself. */
  permalink?: boolean;
  /** Username of the logged-in person (Social pages are for logged-in people only). Needed for the Follow button. */
  viewer?: string | null;
  /** Does the logged-in person already follow the author? (getMyFollowing) */
  isFollowing?: boolean;
  /** Has the logged-in person reposted (or quoted) this post? (getMySocialReposts) */
  isReposted?: boolean;
  /** Has the logged-in person saved this post? (getMySocialBookmarks) Private: no count is shown. */
  isBookmarked?: boolean;
  /** Is this post the logged-in person's pinned post? (getMyPinnedSocialPostId) Only used on your own posts. */
  isPinned?: boolean;
}) {
  const name = post.displayName?.trim() || post.author;
  const tone = ((post.author.charCodeAt(0) || 0) % 5) + 1;
  // Follow is shown to a logged-in person on somebody else's post. Never on your own post.
  const canFollow = Boolean(viewer) && viewer !== post.author;

  return (
    <article className="card pc-post sp-card">
      <div className={`pc-avatar pc-a${tone}`} aria-hidden="true">
        {post.author.charAt(0).toUpperCase()}
      </div>

      <div className="pc-body">
        <div className="pc-meta">
          <strong><Link href={`/social/u/${post.author}`} className="sp-nameLink">{name}</Link></strong>
          {" · @"}{post.author}
          {" · "}
          {permalink ? <Link href={`/social/${post.id}`}>{post.time}</Link> : post.time}
          {post.edited ? ` · ${t("social.edited")}` : ""}
        </div>

        <SocialBody body={post.body} mentions={post.mentions} />

        <SocialLinkPreview
          link={findPostLink(post.body)}
          text={{
            play: t("social.video.play"),
            title: t("social.video.title"),
            open: t("social.video.open"),
            linkLabel: t("social.link.open", { host: "{host}" }),
          }}
        />

        {post.image && (
          <div className="sp-media">
            <a href={post.image} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- our own protected file (login only); a plain <img> keeps the route simple */}
              <img src={post.image} alt={t("social.image.alt", { name })} loading="lazy" decoding="async" />
            </a>
          </div>
        )}

        <div className="pc-actions sp-stats">
          <SocialLikeButton
            postId={post.id}
            initialLiked={isLiked}
            initialCount={post.likes}
            text={{
              like: t("social.like"),
              unlike: t("social.unlike"),
              likeTitle: t("social.like.title"),
              unlikeTitle: t("social.unlike.title"),
              login: t("social.like.login"),
              tooMany: t("social.like.toomany"),
              error: t("social.like.error"),
            }}
          />
          <SocialRepostButton
            postId={post.id}
            initialReposted={isReposted}
            initialCount={post.reposts}
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
          <Link href={`/social/${post.id}#replies`} className="pc-pill" aria-label={t("social.reply.label")}>
            💬 {post.replies}
          </Link>
          <SocialViewCount
            postId={post.id}
            text={formatCompact(post.views)}
            label={tn("social.views", post.views)}
            title={t("social.views.title")}
            countable={viewer !== post.author}
          />
          <SocialShareButton
            path={`/social/${post.id}`}
            label={t("post.share")}
            copiedLabel={t("social.share.copied")}
            title={t("social.label")}
          />
          {Boolean(viewer) && (
            <SocialBookmarkButton
              postId={post.id}
              initialBookmarked={isBookmarked}
              text={{
                save: t("social.bookmark.save"),
                saved: t("social.bookmark.saved"),
                saveTitle: t("social.bookmark.save.title"),
                savedTitle: t("social.bookmark.saved.title"),
                login: t("social.bookmark.login"),
                tooMany: t("social.bookmark.toomany"),
                full: t("social.bookmark.full"),
                error: t("social.bookmark.error"),
              }}
            />
          )}
          {Boolean(viewer) && viewer === post.author && (
            <SocialPinButton
              postId={post.id}
              initialPinned={isPinned}
              text={{
                pin: t("social.pin.pin"),
                pinned: t("social.pin.pinned"),
                pinTitle: t("social.pin.pin.title"),
                pinnedTitle: t("social.pin.pinned.title"),
                login: t("social.pin.login"),
                tooMany: t("social.pin.toomany"),
                notfound: t("social.pin.notfound"),
                error: t("social.pin.error"),
              }}
            />
          )}
          {canFollow && (
            <SocialFollowButton
              username={post.author}
              initialFollowing={isFollowing}
              text={{
                follow: t("social.follow"),
                following: t("social.following"),
                followLabel: t("social.follow.label", { username: post.author }),
                unfollowLabel: t("social.unfollow.label", { username: post.author }),
                login: t("social.follow.login"),
                tooMany: t("social.follow.toomany"),
                error: t("social.follow.error"),
              }}
            />
          )}
          {canFollow && (
            <SocialReportButton
              postId={post.id}
              rules={staffConfig.siteRules.map((rule) => ({ key: rule.key, label: t(`siteRule.${rule.key}` as MessageKey) }))}
              limits={{ min: socialReportConfig.minReason, max: socialReportConfig.maxReason }}
              text={{
                report: t("social.report"),
                rule: t("social.report.rule"),
                reason: t("social.report.reason"),
                submit: t("social.report.submit"),
                cancel: t("social.report.cancel"),
                sending: t("social.report.sending"),
                done: t("social.report.done"),
                already: t("social.report.already"),
                login: t("social.report.login"),
                tooMany: t("social.report.toomany"),
                invalid: t("social.report.invalid"),
                error: t("social.report.error"),
              }}
            />
          )}
          <span className="sp-label">{t("social.label")}</span>
        </div>

        <SocialOwnerActions
          id={post.id}
          author={post.author}
          body={post.body}
          text={{
            edit: t("social.edit"),
            field: t("social.edit.field"),
            save: t("social.edit.save"),
            cancel: t("social.edit.cancel"),
            saving: t("social.edit.saving"),
            error: t("social.edit.error"),
            invalid: t("social.edit.invalid"),
            tooMany: t("social.edit.toomany"),
            login: t("social.edit.login"),
            loginLink: t("topbar.login"),
            delete: t("social.delete"),
            deleteConfirm: t("social.delete.confirm"),
            deleteYes: t("social.delete.yes"),
            deleteNo: t("social.delete.no"),
            deleteError: t("social.delete.error"),
            deleteTooMany: t("social.delete.toomany"),
            deleteLogin: t("social.delete.login"),
          }}
        />
      </div>
    </article>
  );
}
