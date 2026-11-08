import "./profile.css";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Icon from "@/components/shell/Icon";
import Avatar, { VerifiedBadge } from "@/components/profile/Avatar";
import { CoverArt } from "@/components/profile/Art";
import ProfileTabs, { type TabItem } from "@/components/profile/ProfileTabs";
import ProfilePostCard from "@/components/profile/ProfilePostCard";
import ShareButton from "@/components/profile/ShareButton";
import { AboutCard, BadgesCard, InterestsCard } from "@/components/profile/SideCards";
import { siteConfig } from "@/config/site";
import { communities } from "@/data/sample";
import { currentUsername, getProfile, postsByIds, profiles, type Profile } from "@/data/profiles";
import { formatCompact, formatMonthYear, t, tn } from "@/i18n";

// Tell Next.js which profiles exist so each page can be prepared in advance.
export function generateStaticParams() {
  return profiles.map((p) => ({ username: p.username }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = getProfile(username);
  if (!profile) return {};
  return {
    title: `${profile.name} (@${profile.username}) · ${siteConfig.name}`,
    description: profile.bio,
  };
}

function PostFeed({ ids }: { ids: number[] }) {
  const posts = postsByIds(ids);
  if (posts.length === 0) {
    return <p className="card pf-empty">{t("profile.empty")}</p>;
  }
  return (
    <>
      {posts.map((post) => (
        <ProfilePostCard key={post.id} post={post} />
      ))}
    </>
  );
}

function AboutPanel({ profile }: { profile: Profile }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: t("profile.detail.name"), value: profile.name },
    { label: t("profile.detail.username"), value: `@${profile.username}` },
    { label: t("profile.detail.location"), value: profile.location },
    { label: t("profile.detail.joined"), value: formatMonthYear(profile.joined) },
  ];
  if (profile.website) {
    rows.push({
      label: t("profile.detail.website"),
      value: (
        <a href={`https://${profile.website}`} target="_blank" rel="noopener noreferrer">
          {profile.website}
        </a>
      ),
    });
  }
  return (
    <section className="card pf-aboutPanel">
      <h2>{t("profile.about.title")}</h2>
      <p className="pf-bio">{profile.bio}</p>
      <dl className="pf-details">
        {rows.map((r) => (
          <div key={r.label}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function CommunitiesPanel({ slugs }: { slugs: string[] }) {
  const list = slugs
    .map((slug) => communities.find((c) => c.slug === slug))
    .filter((c): c is (typeof communities)[number] => c !== undefined);
  if (list.length === 0) {
    return <p className="card pf-empty">{t("profile.empty")}</p>;
  }
  return (
    <div className="pf-commGrid">
      {list.map((c) => (
        <Link key={c.slug} href={`/c/${c.slug}`} className="card pf-comm">
          <span className="pf-commIcon"><Icon name="users" size={24} /></span>
          <span className="pf-commText">
            <b>{c.name}</b>
            <small>c/{c.slug} · {tn("community.members", c.members)}</small>
          </span>
        </Link>
      ))}
    </div>
  );
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = getProfile(username);
  if (!profile) notFound();

  const isOwner = profile.username === currentUsername;
  const avatarLabel = t("profile.avatar.alt", { name: profile.name });

  const tabs: TabItem[] = [
    { id: "posts", label: t("profile.tab.posts"), icon: "grid", panel: <PostFeed ids={profile.postIds} /> },
    { id: "about", label: t("profile.tab.about"), icon: "user", panel: <AboutPanel profile={profile} /> },
    { id: "likes", label: t("profile.tab.likes"), icon: "heart", panel: <PostFeed ids={profile.likedIds} /> },
    { id: "saved", label: t("profile.tab.saved"), icon: "bookmark", panel: <PostFeed ids={profile.savedIds} /> },
    { id: "communities", label: t("profile.tab.communities"), icon: "users", panel: <CommunitiesPanel slugs={profile.communities} /> },
  ];

  return (
    <>
      <section className="card pf-hero">
        {/* Cover photo */}
        <div
          className="pf-cover"
          style={profile.coverUrl ? { backgroundImage: `url(${profile.coverUrl})` } : undefined}
        >
          {!profile.coverUrl && <CoverArt />}
          <svg className="pf-wave" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 100 L0 50 C 14 50 22 84 48 90 C 66 94 84 100 100 100 Z" />
          </svg>
        </div>

        <div className="pf-info">
          {/* Profile photo */}
          <div className="pf-avatarWrap">
            <Avatar profile={profile} label={avatarLabel} className="pf-avatarLg" />
            {profile.verified && (
              <span className="pf-avatarTick">
                <VerifiedBadge label={t("profile.verified")} size={44} />
              </span>
            )}
          </div>

          <div className="pf-main">
            <div className="pf-nameRow">
              <div className="pf-who">
                <h1 className="pf-name">
                  {profile.name}
                  {profile.verified && <VerifiedBadge label={t("profile.verified")} size={32} />}
                </h1>
                <p className="pf-handle">@{profile.username}</p>
              </div>
              <div className="pf-btns">
                {isOwner ? (
                  <button type="button" className="pf-btn">
                    <Icon name="pencil" size={20} /> {t("profile.edit")}
                  </button>
                ) : (
                  <button type="button" className="pf-btn pf-btnPrimary">
                    {t("profile.follow")}
                  </button>
                )}
                <ShareButton
                  label={t("profile.share")}
                  copiedLabel={t("profile.share.copied")}
                  title={profile.name}
                />
              </div>
            </div>

            <p className="pf-tagline">{profile.tagline.join(" • ")}</p>

            <dl className="pf-stats">
              <div className="pf-stat">
                <dt>{t("profile.stat.posts")}</dt>
                <dd>{formatCompact(profile.stats.posts)}</dd>
              </div>
              <div className="pf-stat">
                <dt>{t("profile.stat.followers")}</dt>
                <dd>{formatCompact(profile.stats.followers)}</dd>
              </div>
              <div className="pf-stat">
                <dt>{t("profile.stat.following")}</dt>
                <dd>{formatCompact(profile.stats.following)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <ProfileTabs
        tabs={tabs}
        label={t("profile.tabs.label")}
        aside={
          <>
            <AboutCard profile={profile} />
            <InterestsCard profile={profile} />
            <BadgesCard profile={profile} />
          </>
        }
      />
    </>
  );
}
