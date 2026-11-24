import Link from "next/link";
import { communityArt, defaultArt } from "@/data/sample";
import type { PostSummary } from "@/lib/queries";
import Icon from "@/components/shell/Icon";
import VoteButtons from "@/components/VoteButtons";
import OwnerActions from "@/components/OwnerActions";
import { ownerText } from "@/lib/manage-text";
import { parseVideoUrl } from "@/lib/post-input-rules";
import { formatNumber, getLocale, t } from "@/i18n";

export default function PostCard({
  post,
  full = false,
}: {
  post: PostSummary;
  full?: boolean;
}) {
  const tone = ((post.author.charCodeAt(0) || 0) % 5) + 1;
  const art = communityArt[post.community] ?? defaultArt;
  // A video post: the address is checked again here and the player is rebuilt from the video id (never the typed address).
  const video = post.kind === "video" && post.videoUrl ? parseVideoUrl(post.videoUrl) : null;
  const kindBadge = <span className="pc-kind">{t(`post.kind.${post.kind}`)}</span>;
  // "Answered" and the bounty (SITE_PLAN B4, B6). The end date is written from the stored time, so the card never reads the clock.
  const bountyEnds = post.bounty
    ? new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium", timeZone: "UTC" }).format(new Date(post.bounty.endsAtMs))
    : "";
  const statusBadges = (
    <>
      {post.answered ? <span className="pc-answered">✓ {t("post.answered")}</span> : null}
      {post.bounty ? (
        <span className="pc-bounty">
          {post.bounty.paid
            ? t("bounty.badge.paid", { amount: formatNumber(post.bounty.amount) })
            : t("bounty.badge", { amount: formatNumber(post.bounty.amount), date: bountyEnds })}
        </span>
      ) : null}
    </>
  );
  return (
    <article className={`card pc-post pc-cp${!full && !post.hidden && !post.deleted ? " pc-fixed" : ""}`}>
      <div className={`pc-avatar pc-a${tone}`} aria-hidden="true">
        {post.deleted ? "·" : post.author.charAt(0).toUpperCase()}
      </div>

      <div className="pc-body">
        <div className="pc-meta">
          <Link href={`/c/${post.community}`}>c/{post.community}</Link>{" "}
          · {t("post.by", { author: post.deleted ? t("deleted.author") : post.author })} · {post.time}
          {post.edited ? ` · ${t("manage.edited")}` : ""}
          {post.newVoice && !post.hidden && !post.deleted && (
            <>
              {" "}·{" "}
              <Link href="/fairness" className="pc-badge pc-badge-info" title={t("post.newvoice.why")}>
                {t("post.newvoice")}
              </Link>
            </>
          )}
        </div>

        {post.deleted ? (
          <div className="notice notice-info"><p>{t("post.deleted")}</p></div>
        ) : post.hidden ? (
          <div className="notice notice-danger pc-hidden">
            <div className="font-semibold">{t(post.hidden.removed ? "post.removed.title" : "post.hidden.title")}</div>
            <p className="mt-1">{post.hidden.note}</p>
            {post.hidden.rule && (
              <p className="mt-1">
                {t("post.hidden.reason")} <b>{post.hidden.rule}</b>
              </p>
            )}
            {post.hidden.removed ? (
              <Link href={`/appeal/post/${post.id}`} className="btn btn-secondary btn-sm mt-2">
                {t("post.hidden.appeal")}
              </Link>
            ) : (
              <p className="mt-2 type-small">{t("post.hidden.waiting")}</p>
            )}
          </div>
        ) : full ? (
          <>
            <h1 className="pc-title pc-title-lg">{kindBadge}{statusBadges}{post.title}</h1>
            {video ? (
              <div className="pc-video">
                <iframe
                  src={video.embedUrl}
                  title={post.title}
                  loading="lazy"
                  allow="fullscreen; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                />
              </div>
            ) : null}
            {video ? (
              <p className="pc-text">
                <a href={video.watchUrl} target="_blank" rel="noopener noreferrer nofollow ugc">{t("post.video.open")}</a>
              </p>
            ) : null}
            {post.body.trim() ? <p className="pc-text pc-text-full">{post.body}</p> : null}
          </>
        ) : (
          <>
            <h2 className="pc-title">
              {kindBadge}
              {statusBadges}
              <Link href={`/post/${post.id}`}>{post.title}</Link>
            </h2>
            {post.body.trim() ? <p className="pc-text">{post.body}</p> : null}
          </>
        )}

        <div className="pc-actions">
          <VoteButtons
            target="post"
            id={post.id}
            votes={post.votes}
            locale={getLocale()}
            upLabel={t("post.upvote")}
            downLabel={t("post.downvote")}
            errorText={t("vote.error")}
            loginText={{ message: t("auth.required"), link: t("topbar.login") }}
            disabled={!!post.hidden || !!post.deleted}
          />
          {full ? (
            <span className="pc-pill"><Icon name="comment" size={20} /> {formatNumber(post.comments)}</span>
          ) : (
            <Link href={`/post/${post.id}`} className="pc-pill">
              <Icon name="comment" size={20} /> {formatNumber(post.comments)}
            </Link>
          )}
          <button className="pc-pill"><Icon name="share" size={20} /> {t("post.share")}</button>
          <button className="pc-pill"><Icon name="bookmark" size={20} /> {t("post.save")}</button>
        </div>

        {full && !post.hidden && !post.deleted && (
          <div className="pc-pull">
            <OwnerActions
              kind="post"
              id={post.id}
              author={post.author}
              title={post.title}
              body={post.body}
              text={ownerText()}
            />
          </div>
        )}
      </div>

      {!post.hidden && !post.deleted && !full ? (
        <div className="pc-thumb" style={{ background: art.gradient }} aria-hidden="true">
          {art.emoji}
        </div>
      ) : null}
    </article>
  );
}
