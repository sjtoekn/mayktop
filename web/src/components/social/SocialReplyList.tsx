import SocialReplyDelete from "@/components/social/SocialReplyDelete";
import SocialReplyForm from "@/components/social/SocialReplyForm";
import SocialReportMore from "@/components/social/SocialReportMore";
import { socialReportMoreProps } from "@/components/social/socialReportMoreProps";
import { socialReplyConfig } from "@/config/site";
import { t } from "@/i18n";
import type { SocialReplyItem } from "@/lib/social-replies-query";

/** The "Replies" part of a Social post page (SOCIAL_TODO 18): the reply box, then the replies, oldest first. */
export default function SocialReplyList({
  postId,
  replies,
  viewer,
}: {
  postId: number;
  replies: SocialReplyItem[];
  /** Username of the logged-in person (needed to show Delete under their own replies). */
  viewer: string;
}) {
  return (
    <section id="replies" aria-labelledby="sp-replies-title">
      <h2 id="sp-replies-title" className="sp-quotesTitle">{t("social.replies.title", { count: replies.length })}</h2>

      <SocialReplyForm
        postId={postId}
        max={socialReplyConfig.maxBody}
        text={{
          field: t("social.reply.field"),
          submit: t("social.reply.submit"),
          saving: t("social.reply.saving"),
          login: t("social.reply.login"),
          tooMany: t("social.reply.toomany", { minutes: "{minutes}" }),
          invalid: t("social.reply.invalid", { max: socialReplyConfig.maxBody }),
          error: t("social.reply.error"),
        }}
      />

      {replies.length === 0 ? (
        <p className="pc-empty">{t("social.replies.empty")}</p>
      ) : (
        replies.map((reply) => {
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
                </div>
                <p className="pc-text pc-text-full sp-body">{reply.body}</p>
                {reply.author !== viewer && <SocialReportMore target={{ kind: "reply", id: reply.id }} {...socialReportMoreProps("reply")} />}
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
              </div>
            </article>
          );
        })
      )}
    </section>
  );
}
