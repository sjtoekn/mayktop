import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Icon from "@/components/shell/Icon";
import SocialFeedList from "@/components/social/SocialFeedList";
import SocialFeedPager from "@/components/social/SocialFeedPager";
import SocialFollowButton from "@/components/social/SocialFollowButton";
import SocialPeopleList from "@/components/social/SocialPeopleList";
import SocialProfileTabs from "@/components/social/SocialProfileTabs";
import SocialBlockButtons from "@/components/social/SocialBlockButtons";
import { socialBlockText } from "@/components/social/socialBlockProps";
import SocialReportMore from "@/components/social/SocialReportMore";
import { socialReportMoreProps } from "@/components/social/socialReportMoreProps";
import { formatMonthYear, t, tn } from "@/i18n";
import {
  getMyFollowing,
  getSocialPinnedPost,
  getSocialProfile,
  getSocialProfileFeed,
  getSocialProfileLikes,
  getSocialProfilePeople,
  getSocialProfileReplies,
  socialProfileListSize,
} from "@/lib/queries";
import { getSessionUser } from "@/lib/session";
import { dropHiddenItems, noRelation } from "@/lib/social-block-rules";
import { getBlockRelation, loadHiddenAuthors } from "@/lib/social-block-view";
import { cursorToText, parseCursor } from "@/lib/social-paging";
import { parseProfileTab, parseProfileUsername, profileHref } from "@/lib/social-profile";

// A Social profile (SOCIAL_TODO 2): the person's posts and reposts, replies, likes (only for yourself), followers and
// following. Social is ONLY for logged-in people (PROJECT.md 8j point 11), so, like the post page:
//  - the title is always the same plain words and the page is marked noindex;
//  - a visitor sees the log-in message for ANY name (nothing is read, it does not say whether the person exists);
//  - a logged-in person gets "not found" for a name that is invalid, unknown, or an account whose posts are not shown
//    (deleted, or deletion pending: the same rule as the feeds, social-visibility.ts).
export const metadata: Metadata = {
  title: t("social.profile.title"),
  robots: { index: false, follow: false },
};

// The page reads the login cookie and the database, so it runs per request, inside <Suspense>. The placeholder name only
// lets Next.js prepare the page shell at build time (the same way /social/[id] does it); it is never shown.
export function generateStaticParams() {
  return [{ username: "placeholder" }];
}

type Params = Promise<{ username: string }>;
type Search = Promise<{ tab?: string; before?: string }>;

export default function SocialProfilePage({ params, searchParams }: { params: Params; searchParams: Search }) {
  return (
    <Suspense fallback={<p className="pc-empty">…</p>}>
      <SocialProfileContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SocialProfileContent({ params, searchParams }: { params: Params; searchParams: Search }) {
  await connection();

  const { username: rawUsername } = await params;
  const { tab: rawTab, before } = await searchParams;
  const viewer = await getSessionUser();

  if (!viewer) {
    return (
      <>
        <header className="card pg-head">
          <h1 className="sf-h1">{t("social.feed.title")}</h1>
        </header>
        <section className="card pg-empty">
          <span className="pc-avatar pc-a4" aria-hidden="true"><Icon name="shield" size={26} /></span>
          <p>{t("social.feed.loginRequired")}</p>
          <div className="fa-actions">
            <Link href="/login" className="pc-btn">{t("topbar.login")}</Link>
            <Link href="/signup" className="pc-btn pc-btn-ghost">{t("topbar.signup")}</Link>
          </div>
        </section>
      </>
    );
  }

  const username = parseProfileUsername(rawUsername);
  if (username === null) notFound();
  const profile = await getSocialProfile(username);
  if (!profile) notFound();

  const isOwn = profile.id === viewer.id;
  // Block (SOCIAL_TODO A7): if THEY blocked me the page is "not found" (it never says why); if I blocked them I see a short
  // page with Unblock. Mute changes nothing here except a note and the Unmute button.
  const relation = isOwn ? noRelation : await getBlockRelation(viewer.id, profile.id);
  if (relation.blockedMe && !relation.blockedByMe) notFound();
  if (relation.blockedByMe) {
    return (
      <>
        <header className="card pg-head sp-profileHead">
          <h1 className="sf-h1">{profile.displayName?.trim() || profile.username}</h1>
          <p className="pc-meta" dir="ltr">@{profile.username}</p>
        </header>
        <section className="card pg-empty">
          <span className="pc-avatar pc-a4" aria-hidden="true"><Icon name="shield" size={26} /></span>
          <p>{t("social.block.profile", { username: profile.username })}</p>
          <SocialBlockButtons username={profile.username} initialMuted={false} initialBlocked={true} text={socialBlockText(profile.username)} />
        </section>
      </>
    );
  }
  const tab = parseProfileTab(rawTab, isOwn);
  const cursor = parseCursor(before); // only the Posts tab pages through older posts
  const name = profile.displayName?.trim() || profile.username;
  const tone = ((profile.username.charCodeAt(0) || 0) % 5) + 1;
  const following = isOwn ? false : (await getMyFollowing(viewer.id, [profile.username])).includes(profile.username);

  return (
    <>
      <header className="card pg-head sp-profileHead">
        <div className="sp-profileTop">
          <span className={`pc-avatar pc-a${tone} sp-profileAvatar`} aria-hidden="true">
            {profile.username.charAt(0).toUpperCase()}
          </span>
          <div>
            <h1 className="sf-h1">{name}</h1>
            <p className="pc-meta" dir="ltr">@{profile.username}</p>
          </div>
        </div>
        {profile.bio?.trim() ? <p className="pc-text sp-bio">{profile.bio.trim()}</p> : null}
        <p className="pc-meta">{t("social.profile.joined", { date: formatMonthYear(profile.joinedIso) })}</p>
        <p className="sp-counts">
          <span>{tn("social.profile.posts", profile.posts)}</span>
          <Link href={profileHref(profile.username, "followers")}>{tn("social.profile.followers", profile.followers)}</Link>
          <Link href={profileHref(profile.username, "following")}>{tn("social.profile.followingCount", profile.following)}</Link>
        </p>
        {isOwn ? (
          <p className="pc-text">{t("social.profile.you")}</p>
        ) : (
          <div>
            {relation.mutedByMe && <p className="pc-meta">{t("social.mute.note", { username: profile.username })}</p>}
            <SocialFollowButton
              username={profile.username}
              initialFollowing={following}
              text={{
                follow: t("social.follow"),
                following: t("social.following"),
                followLabel: t("social.follow.label", { username: profile.username }),
                unfollowLabel: t("social.unfollow.label", { username: profile.username }),
                login: t("social.follow.login"),
                tooMany: t("social.follow.toomany"),
                error: t("social.follow.error"),
              }}
            />
            <SocialReportMore target={{ kind: "account", username: profile.username }} {...socialReportMoreProps("account")} />
            <SocialBlockButtons username={profile.username} initialMuted={relation.mutedByMe} initialBlocked={false} text={socialBlockText(profile.username)} />
          </div>
        )}
        <SocialProfileTabs username={profile.username} active={tab} showLikes={isOwn} />
      </header>

      {tab === "posts" && <PostsTab profileId={profile.id} username={profile.username} cursorText={cursor ? cursorToText(cursor) : null} viewer={viewer} />}
      {tab === "replies" && <RepliesTab profileId={profile.id} viewerId={viewer.id} />}
      {tab === "likes" && isOwn && <LikesTab profileId={profile.id} viewer={viewer} />}
      {(tab === "followers" || tab === "following") && <PeopleTab profileId={profile.id} kind={tab} viewer={viewer} />}
    </>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <section className="card pg-empty">
      <span className="pc-avatar pc-a4" aria-hidden="true"><Icon name="comment" size={26} /></span>
      <p>{text}</p>
    </section>
  );
}

function LimitNote({ shown }: { shown: number }) {
  if (shown < socialProfileListSize) return null;
  return <p className="pc-text sp-limit">{t("social.profile.limit", { count: socialProfileListSize })}</p>;
}

type Viewer = { id: string; username: string };

async function PostsTab({ profileId, username, cursorText, viewer }: { profileId: string; username: string; cursorText: string | null; viewer: Viewer }) {
  const hidden = await loadHiddenAuthors(viewer.id);
  const fetched = await getSocialProfileFeed(profileId, cursorText);
  // Block hides what a blocked person wrote or reposted. A MUTED person's own profile still shows their posts.
  // Pinned post (SOCIAL_TODO B6): first page only, shown on top with a label and left out of the list below so it is not twice.
  const pinned = cursorText ? null : await getSocialPinnedPost(profileId);
  const items = dropHiddenItems(fetched.items, hidden.blocked).filter((item) => !pinned || item.kind !== "post" || item.post.id !== pinned.post.id);
  const page = { ...fetched, items };
  if (!pinned && page.items.length === 0 && !cursorText && !page.next) return <Empty text={t("social.profile.empty.posts")} />;
  return (
    <>
      {pinned && (
        <div className="sp-repostGroup">
          <p className="sp-repostNote sp-pinnedNote"><Icon name="pin" size={14} fill="currentColor" /> {t("social.pin.label")}</p>
          <SocialFeedList feed={[pinned]} viewer={viewer} />
        </div>
      )}
      <SocialFeedList feed={page.items} viewer={viewer} />
      <SocialFeedPager basePath={profileHref(username)} next={page.next} isFirstPage={!cursorText} />
    </>
  );
}

async function RepliesTab({ profileId, viewerId }: { profileId: string; viewerId: string }) {
  const hidden = await loadHiddenAuthors(viewerId);
  const replies = (await getSocialProfileReplies(profileId)).filter((reply) => !hidden.blocked.has(reply.postAuthor));
  if (replies.length === 0) return <Empty text={t("social.profile.empty.replies")} />;
  return (
    <>
      {replies.map((reply) => (
        <article key={reply.id} className="card pc-post sp-card">
          <div className="pc-body">
            <div className="pc-meta">
              {t("social.profile.replyingTo", { username: reply.postAuthor })}
              {" · "}
              <Link href={`/social/${reply.postId}#replies`}>{reply.time}</Link>
            </div>
            <p className="pc-text pc-text-full sp-body">{reply.body}</p>
          </div>
        </article>
      ))}
      <LimitNote shown={replies.length} />
    </>
  );
}

async function LikesTab({ profileId, viewer }: { profileId: string; viewer: Viewer }) {
  const hidden = await loadHiddenAuthors(viewer.id);
  const items = dropHiddenItems(await getSocialProfileLikes(profileId), hidden.all);
  return (
    <>
      <p className="pc-text sp-limit">{t("social.profile.likesPrivate")}</p>
      {items.length === 0 ? <Empty text={t("social.profile.empty.likes")} /> : <SocialFeedList feed={items} viewer={viewer} />}
      <LimitNote shown={items.length} />
    </>
  );
}

async function PeopleTab({ profileId, kind, viewer }: { profileId: string; kind: "followers" | "following"; viewer: Viewer }) {
  const hidden = await loadHiddenAuthors(viewer.id);
  const people = (await getSocialProfilePeople(profileId, kind)).filter((person) => !hidden.blocked.has(person.username));
  if (people.length === 0) return <Empty text={kind === "followers" ? t("social.profile.empty.followers") : t("social.profile.empty.following")} />;
  const followingNames = new Set(await getMyFollowing(viewer.id, people.map((person) => person.username)));
  return (
    <>
      <SocialPeopleList people={people} viewer={viewer.username} followingNames={followingNames} />
      <LimitNote shown={people.length} />
    </>
  );
}
