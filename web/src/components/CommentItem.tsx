import Link from "next/link";
import type { CommentNode } from "@/lib/queries";
import ReplyBox from "@/components/ReplyBox";
import VoteButtons from "@/components/VoteButtons";
import OwnerActions from "@/components/OwnerActions";
import AcceptAnswerButton from "@/components/AcceptAnswerButton";
import { ownerText } from "@/lib/manage-text";
import { getLocale, t } from "@/i18n";

// Replies are indented for two levels only. Deeper replies stay in line with
// their parent (still joined by the thread line), so long threads never get
// squeezed into a narrow column on a phone.
const MAX_INDENT = 2;

export default function CommentItem({
  comment,
  postId,
  depth = 0,
  qa,
}: {
  comment: CommentNode;
  postId: number;
  depth?: number;
  // Only given for a QUESTION: who asked it, and whether a bounty was already paid for its answer (then the choice is final).
  qa?: { postAuthor: string; locked: boolean };
}) {
  const tone = ((comment.author.charCodeAt(0) || 0) % 5) + 1;
  const size = depth === 0 ? "pc-avatar-sm" : "pc-avatar-xs";
  const flat = depth >= MAX_INDENT;
  return (
    <div className={`pc-comment${comment.accepted ? " pc-comment-accepted" : ""}`}>
      <div className={`pc-avatar ${size} pc-a${tone}`} aria-hidden="true">
        {comment.deleted ? "·" : comment.author.charAt(0).toUpperCase()}
      </div>
      <div className="pc-comment-body">
        <div className="pc-comment-meta">
          <b>{comment.deleted ? t("deleted.author") : comment.author}</b> · {comment.time}
          {comment.edited ? ` · ${t("manage.edited")}` : ""}
          {comment.accepted ? <> · <span className="pc-answered">✓ {t("answer.accepted")}</span></> : null}
        </div>
        {comment.deleted ? (
          <p className="type-small">{t("comment.deleted")}</p>
        ) : comment.hidden ? (
          <div className="notice notice-danger pc-hidden pc-hidden-comment">
            <div className="font-semibold">{t(comment.hidden.removed ? "comment.removed.title" : "comment.hidden.title")}</div>
            <p className="mt-1">{comment.hidden.note}</p>
            {comment.hidden.rule && (
              <p className="mt-1">
                {t("comment.hidden.reason")} <b>{comment.hidden.rule}</b>
              </p>
            )}
            {comment.hidden.removed ? (
              <Link href={`/appeal/comment/${comment.id}`} className="btn btn-secondary btn-sm mt-2">
                {t("comment.hidden.appeal")}
              </Link>
            ) : (
              <p className="mt-2 type-small">{t("comment.hidden.waiting")}</p>
            )}
          </div>
        ) : (
          <>
            <p>{comment.text}</p>
            <ReplyBox
              postId={postId}
              parentId={comment.id}
              replyLabel={t("comment.reply")}
              text={{
                label: t("comment.write.label"),
                placeholder: t("comment.write.placeholder"),
                submit: t("comment.submit"),
                saving: t("submit.saving"),
                error: t("comment.error"),
                errorLink: t("comment.error.link"),
                cancel: t("submit.cancel"),
                login: t("auth.required"),
                loginLink: t("topbar.login"),
              }}
            >
              <VoteButtons
                target="comment"
                id={comment.id}
                votes={comment.votes}
                locale={getLocale()}
                upLabel={t("post.upvote")}
                downLabel={t("post.downvote")}
                errorText={t("vote.error")}
                loginText={{ message: t("auth.required"), link: t("topbar.login") }}
                small
              />
            </ReplyBox>
            {qa && depth === 0 && !qa.locked ? (
              <div className="pc-actions">
                <AcceptAnswerButton
                  commentId={comment.id}
                  postAuthor={qa.postAuthor}
                  commentAuthor={comment.author}
                  accepted={!!comment.accepted}
                  text={{ accept: t("answer.accept"), unaccept: t("answer.unaccept"), error: t("answer.error") }}
                />
              </div>
            ) : null}
            <OwnerActions
              kind="comment"
              id={comment.id}
              author={comment.author}
              body={comment.text}
              text={ownerText()}
            />
          </>
        )}
        {comment.replies && comment.replies.length > 0 && (
          <div className={`pc-replies ${flat ? "pc-replies-flat" : ""}`}>
            {comment.replies.map((r) => (
              <CommentItem key={r.id} comment={r} postId={postId} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
