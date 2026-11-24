import Link from "next/link";
import SocialReplyDelete from "@/components/social/SocialReplyDelete";
import SocialReplyForm from "@/components/social/SocialReplyForm";
import SocialReplyHideButton from "@/components/social/SocialReplyHideButton";
import SocialReplyLikeButton from "@/components/social/SocialReplyLikeButton";
import SocialReportMore from "@/components/social/SocialReportMore";
import { socialReportMoreProps } from "@/components/social/socialReportMoreProps";
import { reputationConfig, socialReplyConfig } from "@/config/site";
import { t } from "@/i18n";
import type { SocialReplyItem } from "@/lib/social-replies-query";
import type { ReplyPolicy } from "@/lib/social-reply-control-rules";
import type { ReplySort } from "@/lib/social-fair-rank-rules";

/**
 * The "Replies" part of a Social post page (SOCIAL_TODO 18 + B9 + B10): the reply box (or the notice), the sort choice, then the replies.
 * The page already put `replies` in the order of `sort` (oldest, or the fair "Top" order); this part only shows them in the order given.
 */
export default function SocialReplyList({
  postId,
  replies,
  viewer,
  postAuthor,
  policy,
  canReply,
  sort,
  likedReplyIds,
  risingIds,
}: {
  postId: number;
  replies: SocialReplyItem[];
  /** Username of the logged-in person (needed to show Delete under their own replies). */
  viewer: string | null;
  /** Username of the author of the post (the one who may hide replies, and who is named in the notice). */
  postAuthor: string;
  /** Who may reply (SOCIAL_TODO B9) and whether the logged-in person may. */
  policy: ReplyPolicy;
  canReply: boolean;
  /** The order the replies are in (SOCIAL_TODO B10). */
  sort: ReplySort;
  /** Ids of the replies THIS person liked. */
  likedReplyIds: number[];
  /** Ids of replies that took a reserved "new voice" place in the "Top" order (they get the small label). */
  risingIds: number[];
}) {
  const isPostAuthor = viewer !== null && viewer === postAuthor;
  const shown = replies.filter((reply) => !reply.hiddenByAuthor);
  const hidden = replies.filter((reply) => reply.hiddenByAuthor);
  const policyLabel = policy === "EVERYONE" ? t("social.replyControl.everyone") : policy === "FOLLOWING" ? t("social.replyControl.following") : t("social.replyControl.mentioned");

  const liked = new Set(likedReplyIds);
  const rising = new Set(risingIds);

  const renderReply = (reply: SocialReplyItem) => {
    const name = reply.displayName?.trim() || reply.author;
    const tone = ((reply.author.charCodeAt(0) || 0) % 5) + 1;
    return (
      <article key={reply.id} className="card pc-post sp-card sp-reply">
        <div className={`pc-avatar pc-a${tone}`} aria-hidden="true">{reply.author.charAt(0).toUpperCase()}</div>
        <div className="pc-body">
          <div className="pc-meta">
            <strong>{name}</strong>
            {" · @"}{reply.author}
            {" · "}{reply.time}
            {rising.has(reply.id) && (
              <>
                {" · "}
                <Link href="/fairness" className="pc-badge pc-badge-info" title={t("post.newvoice.why")}>{t("post.newvoice")}</Link>
              </>
            )}
          </div>
          <p className="pc-text pc-text-full sp-body">{reply.body}</p>
          <SocialReplyLikeButton
            replyId={reply.id}
            initialLiked={liked.has(reply.id)}
            initialCount={reply.likes}
            text={{
              like: t("social.replyLike.like"),
              unlike: t("social.replyLike.unlike"),
              login: t("social.like.login"),
              tooMany: t("social.like.toomany"),
              error: t("social.like.error"),
            }}
          />
          {viewer !== null && reply.author !== viewer && <SocialReportMore target={{ kind: "reply", id: reply.id }} {...socialReportMoreProps("reply")} />}
          {reply.author === viewer && (
            <SocialReplyDelete
              id={reply.id}
              text={{
                delete: t("social.reply.delete"),
                confirm: t("social.reply.delete.confirm"),
                yes: t("social.reply.delete.yes"),
                no: t("social.reply.delete.no"),
                error: t("social.reply.delete.error"),
              }}
            />
          )}
          {isPostAuthor && reply.author !== viewer && (
            <SocialReplyHideButton
              id={reply.id}
              hidden={reply.hiddenByAuthor}
              text={{
                hide: t("social.replyControl.hide"),
                unhide: t("social.replyControl.unhide"),
                error: t("social.replyControl.hide.error"),
              }}
            />
          )}
        </div>
      </article>
    );
  };

  return (
    <section id="replies" aria-labelledby="sp-replies-title">
      <h2 id="sp-replies-title" className="sp-quotesTitle">{t("social.replies.title", { count: shown.length })}</h2>

      {isPostAuthor && policy !== "EVERYONE" && (
        <p className="sp-replyNotice" role="status">{t("social.replyControl.current", { who: policyLabel })}</p>
      )}

      {viewer === null ? (
        <p className="sp-replyNotice" role="status">
          <Link href="/login">{t("social.reply.login")}</Link>
        </p>
      ) : canReply ? (
        <SocialReplyForm
          postId={postId}
          max={socialReplyConfig.maxBody}
          text={{
            field: t("social.reply.field"),
            submit: t("social.reply.submit"),
            saving: t("social.reply.saving"),
            login: t("social.reply.login"),
            tooMany: t("social.reply.toomany", { minutes: "{minutes}" }),
            duplicate: t("social.reply.duplicate"),
            invalid: t("social.reply.invalid", { max: socialReplyConfig.maxBody }),
            link: t("submit.error.link", { need: reputationConfig.privileges.link }),
            restricted: t("social.reply.restricted"),
            error: t("social.reply.error"),
          }}
        />
      ) : (
        <p className="sp-replyNotice" role="status">
          {t(policy === "FOLLOWING" ? "social.replyControl.notice.following" : "social.replyControl.notice.mentioned", { name: postAuthor })}
        </p>
      )}

      {shown.length > 1 && (
        <nav className="sp-replySort" aria-label={t("social.replyRank.label")}>
          <Link href="?sort=oldest" replace scroll={false} className={`pc-pill${sort === "oldest" ? " is-active" : ""}`} aria-current={sort === "oldest" ? "true" : undefined}>
            {t("social.replyRank.oldest")}
          </Link>
          <Link href="?sort=top" replace scroll={false} className={`pc-pill${sort === "top" ? " is-active" : ""}`} aria-current={sort === "top" ? "true" : undefined}>
            {t("social.replyRank.top")}
          </Link>
          <Link href="/fairness" className="sp-replySortHow">{t("social.replyRank.how")}</Link>
        </nav>
      )}

      {shown.length === 0 ? (
        <p className="pc-empty">{t("social.replies.empty")}</p>
      ) : (
        shown.map(renderReply)
      )}

      {hidden.length > 0 && (
        <details className="sp-hiddenReplies">
          <summary>{t("social.replyControl.hiddenTitle", { count: hidden.length })}</summary>
          <p className="sp-replyNotice">{t("social.replyControl.hiddenNote")}</p>
          {hidden.map(renderReply)}
        </details>
      )}
    </section>
  );
}
