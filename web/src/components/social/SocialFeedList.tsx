import { Fragment } from "react";
import AdSlot, { isSocialAdPosition } from "@/components/AdSlot";
import SocialPostCard from "@/components/social/SocialPostCard";
import SocialRepostCard from "@/components/social/SocialRepostCard";
import { getMyFollowing, getMySocialLikes, getMySocialReposts, type SocialFeedItem } from "@/lib/queries";
import { getMySocialBookmarks } from "@/lib/social-bookmark-view";
import { getMyPinnedSocialPostId } from "@/lib/social-pin-view";

/**
 * The cards of a Social feed (used by /social and /social/following). The feed itself may be shared (cached);
 * "did I like / repost it" and "do I follow the author" are asked here for THIS person only, never cached.
 * Every item has a `post`: a post, or the ORIGINAL post inside a repost.
 */
export default async function SocialFeedList({
  feed,
  viewer,
  withAds = false,
}: {
  feed: SocialFeedItem[];
  /** null = a visitor who is not logged in: the cards show no personal state (liked, reposted, saved, following). */
  viewer: { id: string; username: string } | null;
  /** Social ads (ADS_PLAN decision 11): ONLY the main feeds (/social, /social/following) pass true. Search, tags, bookmarks and profiles never show ads. */
  withAds?: boolean;
}) {
  const posts = feed.map((item) => item.post);
  const postIds = posts.map((post) => post.id);
  const likedIds = new Set(viewer ? await getMySocialLikes(viewer.id, postIds) : []);
  const followingNames = new Set(viewer ? await getMyFollowing(viewer.id, posts.map((post) => post.author)) : []);
  const repostedIds = new Set(viewer ? await getMySocialReposts(viewer.id, postIds) : []);
  const bookmarkedIds = new Set(viewer ? await getMySocialBookmarks(viewer.id, postIds) : []); // private (SOCIAL_TODO B2)

  // Pin (SOCIAL_TODO B6): only the author sees the Pin button, so ask only when one of these posts is the viewer's own.
  const pinnedId = viewer && posts.some((post) => post.author === viewer.username) ? await getMyPinnedSocialPostId(viewer.id) : null;

  return (
    <>
      {feed.map((item, index) => (
        <Fragment key={item.kind === "repost" ? `repost-${item.repostId}` : `post-${item.post.id}`}>
        {item.kind === "repost" ? (
          <SocialRepostCard
            item={item}
            isBookmarked={bookmarkedIds.has(item.post.id)}
            isPinned={pinnedId === item.post.id}
            isLiked={likedIds.has(item.post.id)}
            isReposted={repostedIds.has(item.post.id)}
            viewer={viewer?.username ?? null}
            isFollowing={followingNames.has(item.post.author)}
          />
        ) : (
          <SocialPostCard
            post={item.post}
            isBookmarked={bookmarkedIds.has(item.post.id)}
            isPinned={pinnedId === item.post.id}
            isLiked={likedIds.has(item.post.id)}
            isReposted={repostedIds.has(item.post.id)}
            viewer={viewer?.username ?? null}
            isFollowing={followingNames.has(item.post.author)}
          />
        )}
        {withAds && isSocialAdPosition(index) && <AdSlot variant="social" />}
        </Fragment>
      ))}
    </>
  );
}
