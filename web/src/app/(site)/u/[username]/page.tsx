import "./profile.css";
import "../../photos/photos.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Icon from "@/components/shell/Icon";
import { CoverArt } from "@/components/profile/Art";
import ProfileTabs, { type TabItem } from "@/components/profile/ProfileTabs";
import ShareButton from "@/components/profile/ShareButton";
import SocialFollowButton from "@/components/social/SocialFollowButton";
import { getProfile } from "@/data/profiles";
import { PHOTO_ROW_HEIGHT, photoTileStyle } from "@/lib/photo-feed-rules";
import { photoThumbUrl } from "@/lib/photo-file";
import { getProfileImage, getProfilePhotos } from "@/lib/profile-view";
import { getMyFollowing, getSocialProfile } from "@/lib/queries";
import { getSessionUser } from "@/lib/session";
import { parseProfileUsername, profileHref } from "@/lib/social-profile";
import { formatCompact, formatMonthYear, t, tn } from "@/i18n";
import SampleProfile from "./SampleProfile";

// The main profile of a person: /u/<username> (read from the database, so it runs per request inside <Suspense>, the same
// way /social/u/<username> does it). Anybody (also a visitor) may look. An account that Social and Photos do not show
// (deleted, or deletion pending) is "not found" here too (getSocialProfile). The old sample profile (data/profiles.ts)
// is kept only for a name that has no real account.
export const metadata: Metadata = {
  title: t("profile.page.title"),
};

// The placeholder only lets Next.js prepare the page shell at build time; it is never shown.
export function generateStaticParams() {
  return [{ username: "placeholder" }];
}

type Params = Promise<{ username: string }>;

export default function ProfilePage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<p className="pc-empty">…</p>}>
      <ProfileContent params={params} />
    </Suspense>
  );
}

async function ProfileContent({ params }: { params: Params }) {
  await connection();

  const { username: rawUsername } = await params;
  const username = parseProfileUsername(rawUsername);
  if (username === null) notFound();

  const profile = await getSocialProfile(username);
  if (!profile) {
    // No real account: show the old sample profile if there is one with this name, else "not found" (inside SampleProfile).
    if (getProfile(username)) return <SampleProfile username={username} />;
    notFound();
  }

  const viewer = await getSessionUser();
  const isOwn = viewer !== null && viewer.id === profile.id;
  const [photos, image, followingList] = await Promise.all([
    getProfilePhotos(profile.id),
    getProfileImage(profile.id),
    viewer && !isOwn ? getMyFollowing(viewer.id, [profile.username]) : Promise.resolve([] as string[]),
  ]);
  const following = followingList.includes(profile.username);

  const name = profile.displayName?.trim() || profile.username;
  const bio = profile.bio?.trim() ?? "";
  const tone = ((profile.username.charCodeAt(0) || 0) % 5) + 1;
  const initial = Array.from(name)[0]?.toUpperCase() ?? "?";
  const avatarLabel = t("profile.avatar.alt", { name });
  const fallbackAlt = t("photo.list.title");

  const photosPanel =
    photos.items.length === 0 ? (
      <p className="card pf-empty">{t("profile.photos.empty")}</p>
    ) : (
      <section className="card pf-photos">
        <ul className="ph-grid">
          {photos.items.map((photo) => {
            const tile = photoTileStyle(photo.width, photo.height, PHOTO_ROW_HEIGHT);
            return (
              <li key={photo.id} className="ph-tile" style={{ flexGrow: tile.grow, flexBasis: tile.basis }}>
                <Link href={`/photos/${photo.id}`} prefetch={false} style={{ paddingBottom: `${tile.ratioPercent}%` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- the small copy from our own media route */}
                  <img src={photoThumbUrl(photo.file)} alt={photo.title || fallbackAlt} width={photo.width} height={photo.height} loading="lazy" decoding="async" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    );

  const socialPanel = (
    <section className="card pf-aboutPanel">
      <h2>{t("profile.tab.social")}</h2>
      <p className="pf-bio">{profile.posts === 0 ? t("profile.social.empty") : tn("social.profile.posts", profile.posts)}</p>
      <Link href={profileHref(profile.username)} className="pf-btn pf-btnPrimary">
        <Icon name="message-circle" size={20} /> {t("profile.social.viewAll")}
      </Link>
    </section>
  );

  const aboutRows = [
    { label: t("profile.detail.name"), value: name },
    { label: t("profile.detail.username"), value: `@${profile.username}` },
    { label: t("profile.detail.joined"), value: formatMonthYear(profile.joinedIso) },
  ];
  const aboutPanel = (
    <section className="card pf-aboutPanel">
      <h2>{t("profile.about.title")}</h2>
      {bio ? <p className="pf-bio">{bio}</p> : null}
      <dl className="pf-details">
        {aboutRows.map((r) => (
          <div key={r.label}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );

  const tabs: TabItem[] = [
    { id: "photos", label: t("profile.tab.photos"), icon: "grid", panel: photosPanel },
    { id: "social", label: t("profile.tab.social"), icon: "message-circle", panel: socialPanel },
    { id: "about", label: t("profile.tab.about"), icon: "user", panel: aboutPanel },
  ];

  return (
    <>
      <section className="card pf-hero">
        <div className="pf-cover">
          <CoverArt />
          <svg className="pf-wave" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 100 L0 50 C 14 50 22 84 48 90 C 66 94 84 100 100 100 Z" />
          </svg>
        </div>

        <div className="pf-info">
          <div className="pf-avatarWrap">
            <div
              className={`pf-avatar pf-avatarLg pc-a${tone}`}
              style={image ? { backgroundImage: `url(${image})` } : undefined}
              role="img"
              aria-label={avatarLabel}
            >
              {image ? null : <span aria-hidden="true">{initial}</span>}
            </div>
          </div>

          <div className="pf-main">
            <div className="pf-nameRow">
              <div className="pf-who">
                <h1 className="pf-name">{name}</h1>
                <p className="pf-handle" dir="ltr">@{profile.username}</p>
              </div>
              <div className="pf-btns">
                {isOwn ? (
                  <Link href="/settings/profile" className="pf-btn">
                    <Icon name="pencil" size={20} /> {t("profile.edit")}
                  </Link>
                ) : (
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
                )}
                <ShareButton label={t("profile.share")} copiedLabel={t("profile.share.copied")} title={name} />
              </div>
            </div>

            {bio ? <p className="pf-tagline">{bio}</p> : null}

            <dl className="pf-stats">
              <div className="pf-stat">
                <dt>{t("profile.stat.photos")}</dt>
                <dd>{formatCompact(photos.total)}</dd>
              </div>
              <div className="pf-stat">
                <dt>{t("profile.stat.posts")}</dt>
                <dd>{formatCompact(profile.posts)}</dd>
              </div>
              <div className="pf-stat">
                <dt>{t("profile.stat.followers")}</dt>
                <dd>{formatCompact(profile.followers)}</dd>
              </div>
              <div className="pf-stat">
                <dt>{t("profile.stat.following")}</dt>
                <dd>{formatCompact(profile.following)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <ProfileTabs tabs={tabs} label={t("profile.tabs.label")} />
    </>
  );
}
