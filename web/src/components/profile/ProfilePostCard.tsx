import Icon from "@/components/shell/Icon";
import Avatar, { VerifiedBadge } from "./Avatar";
import { PostArt } from "./Art";
import { getProfile, type ProfilePost } from "@/data/profiles";
import { formatNumber, t, tn } from "@/i18n";

// One post in a profile feed (Posts / Likes / Saved tabs).
export default function ProfilePostCard({ post }: { post: ProfilePost }) {
  const author = getProfile(post.author);
  if (!author) return null;

  return (
    <article className="card pf-post">
      <div className="pf-postHead">
        <Avatar
          profile={author}
          label={t("profile.avatar.alt", { name: author.name })}
          className="pf-avatarSm"
        />
        <div className="pf-postWho">
          <b>
            {author.name}
            {author.verified && <VerifiedBadge label={t("profile.verified")} size={20} />}
          </b>
          <small>
            {post.time} <span aria-hidden="true">•</span>
            {post.isPublic && (
              <>
                <Icon name="globe" size={15} /> {t("profile.post.public")}
              </>
            )}
          </small>
        </div>
        <button type="button" className="pf-more" aria-label={t("profile.post.more")}>
          <Icon name="dots" size={24} strokeWidth={3} />
        </button>
      </div>

      <p className="pf-postText">{post.text}</p>

      {post.art && (
        <div className="pf-postArt">
          <PostArt kind={post.art} />
        </div>
      )}

      <div className="pc-actions">
        <span className="pc-pill" aria-label={`${t("profile.post.like")}: ${formatNumber(post.likes)}`}>
          <Icon name="thumb" size={20} /> {formatNumber(post.likes)}
        </span>
        <span className="pc-pill" aria-label={tn("post.comments", post.comments)}>
          <Icon name="comment" size={20} /> {formatNumber(post.comments)}
        </span>
        <span className="pc-pill"><Icon name="share" size={20} /> {t("post.share")}</span>
        <span className="pc-pill"><Icon name="bookmark" size={20} /> {t("post.save")}</span>
      </div>
    </article>
  );
}
