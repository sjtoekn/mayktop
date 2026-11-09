import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { formatCompact, getLocale, t, tn } from "@/i18n";
import Icon from "@/components/shell/Icon";
import PhotoLikeButton from "@/components/photos/PhotoLikeButton";
import PhotoBookmarkButton from "@/components/photos/PhotoBookmarkButton";
import PhotoCollectionButton from "@/components/photos/PhotoCollectionButton";
import PhotoShareButton from "@/components/photos/PhotoShareButton";
import PhotoViewCount from "@/components/photos/PhotoViewCount";
import { countPhotographerPhotos, getMorePhotos, getPhotoDetail, getPhotoNeighbours, hasLikedPhoto, type PhotoThumb } from "@/lib/photo-detail";
import {
  parsePhotoId,
  photoCategoryKeyOf,
  photoDateText,
  photoDownloadName,
  photoInitials,
  photoMegapixels,
  photoMoreLimit,
  photoOrientation,
  photoThumbFile,
} from "@/lib/photo-detail-rules";
import { photoFileUrl } from "@/lib/photo-file";
import { hasSavedPhoto } from "@/lib/photo-bookmark-view";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { loadHiddenAuthors } from "@/lib/social-block-view";
import { isSocialAuthorShown } from "@/lib/social-visibility";
import type { PhotoCategory } from "@/config/site";
import { ContentStatus, Role } from "../../../../../generated/prisma/client";
import "../photos.css";

// One photo (PHOTO_TODO 6). Anybody, also a visitor, may open a photo that may be shown (VISIBLE, not deleted, owner shown:
// the same rule as /api/photos/media). A hidden photo opens only for its owner and for admins (with a notice); everybody
// else, and any number that is invalid, missing or deleted, gets "not found". A person who blocked you, or whom you
// blocked, is "not found" too (like Social). The page title is the same plain words for every photo.
// Likes (PHOTO_TODO 7): the button is shown only for a photo that may be shown; a visitor sees it and gets the log-in message.
// Download (PHOTO_TODO 6d): the same stored file the page shows (our own media route, same address), saved as photo-<id>.<ext>.
// Views (PHOTO_TODO 6c): a bare running total (Photo.viewCount), counted by POST /api/photos/view only for a logged-in person who
// is not the owner. "Public photo" is true because this page opens for visitors too (see above).
// One card (PHOTO_TODO 6b): picture, Like + Share, title, one line of facts (day, size, orientation), caption, tags, then the
// photographer and Previous / Next. "More from the photographer" is a second card. All of this only for a photo that is shown.
// Layout (like the 3001 demo): left = picture card + "More from"; right = Details (with Download), photographer, Previous / Next.
// Not yet here: comments (8), links of the category / tags / photographer (9, 10, 11), edit / delete (12).
export const metadata: Metadata = {
  title: t("photo.detail.pageTitle"),
};

// The placeholder id only lets Next.js prepare the page shell (menu, sidebar) at build time, like /social/[id]; no photo is
// read for it.
export function generateStaticParams() {
  return [{ id: "1" }];
}

type Params = Promise<{ id: string }>;

export default function PhotoPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<p className="pc-empty">…</p>}>
      <PhotoContent params={params} />
    </Suspense>
  );
}

async function PhotoContent({ params }: { params: Params }) {
  await connection();
  const { id: rawId } = await params;
  const id = parsePhotoId(rawId);
  if (id === null) notFound();

  const photo = await getPhotoDetail(id);
  if (!photo || photo.deletedAt) notFound();

  const viewer = await getSessionUser(); // null = a visitor
  const shown = photo.status === ContentStatus.VISIBLE && isSocialAuthorShown(photo.owner);
  const isOwner = viewer !== null && viewer.id === photo.ownerId;
  if (!shown) {
    if (!viewer) notFound();
    if (!isOwner) {
      const row = await prisma.user.findUnique({ where: { id: viewer.id }, select: { role: true } }); // read from the database, never from the cookie
      if (row?.role !== Role.ADMIN) notFound();
    }
  }
  if (!isOwner) {
    const hidden = await loadHiddenAuthors(viewer?.id ?? null);
    if (hidden.blocked.has(photo.owner.username)) notFound();
  }

  const categoryNames: Record<PhotoCategory, string> = {
    nature: t("photo.category.nature"),
    people: t("photo.category.people"),
    animals: t("photo.category.animals"),
    food: t("photo.category.food"),
    travel: t("photo.category.travel"),
    buildings: t("photo.category.buildings"),
    vehicles: t("photo.category.vehicles"),
    art: t("photo.category.art"),
    sports: t("photo.category.sports"),
    other: t("photo.category.other"),
  };
  const liked = viewer && shown ? await hasLikedPhoto(viewer.id, photo.id) : false;
  const saved = viewer && shown ? await hasSavedPhoto(viewer.id, photo.id) : false;
  const title = photo.title || t("photo.list.photoAlt");
  const name = photo.owner.displayName || photo.owner.username;
  const orientationNames = {
    landscape: t("photo.orientation.landscape"),
    portrait: t("photo.orientation.portrait"),
    square: t("photo.orientation.square"),
  };
  const [photoCount, near, more] = shown
    ? await Promise.all([
        countPhotographerPhotos(photo.ownerId),
        getPhotoNeighbours(photo),
        getMorePhotos(photo.ownerId, photo.id, photoMoreLimit),
      ])
    : [0, { newer: null, older: null }, [] as PhotoThumb[]];

  return (
    <>
      <Link href="/photos" className="pc-back">
        <span aria-hidden="true" className="inline-block rtl:rotate-180">←</span>
        {t("photo.detail.back")}
      </Link>

      {!shown ? (
        <div className="notice" role="status">
          {t("photo.detail.hidden")}
        </div>
      ) : null}

      <div className={shown ? "ph-layout" : "ph-layout ph-layout-single"}>
      <div className="ph-col">
      <article className="card ph-view">
        <a href={photoFileUrl(photo.file)} target="_blank" rel="noopener" className="ph-viewLink" aria-label={t("photo.detail.open")}>
          {/* eslint-disable-next-line @next/next/no-img-element -- the full copy from our own media route */}
          <img className="ph-viewImg" src={photoFileUrl(photo.file)} alt={title} width={photo.width} height={photo.height} decoding="async" />
        </a>

        <div className="ph-viewBody">
          {shown ? (
            <div className="ph-actions">
              <PhotoLikeButton
                photoId={photo.id}
                initialLiked={liked}
                initialCount={photo._count.likes}
                text={{
                  like: t("photo.like.like"),
                  unlike: t("photo.like.unlike"),
                  likeTitle: t("photo.like.likeTitle"),
                  unlikeTitle: t("photo.like.unlikeTitle"),
                  login: t("photo.like.login"),
                  tooMany: t("photo.like.tooMany"),
                  error: t("photo.like.error"),
                }}
              />
              <PhotoShareButton path={`/photos/${photo.id}`} label={t("photo.share.label")} copiedLabel={t("photo.share.copied")} title={title} />
              <PhotoBookmarkButton
                photoId={photo.id}
                initialBookmarked={saved}
                text={{
                  save: t("photo.bookmark.save"),
                  saved: t("photo.bookmark.saved"),
                  saveTitle: t("photo.bookmark.save.title"),
                  savedTitle: t("photo.bookmark.saved.title"),
                  login: t("photo.bookmark.login"),
                  tooMany: t("photo.bookmark.toomany"),
                  full: t("photo.bookmark.full"),
                  error: t("photo.bookmark.error"),
                }}
              />
              <PhotoCollectionButton
                photoId={photo.id}
                text={{
                  label: t("photo.collection.label"),
                  title: t("photo.collection.title"),
                  heading: t("photo.collection.heading"),
                  empty: t("photo.collection.empty"),
                  newName: t("photo.collection.new"),
                  create: t("photo.collection.create"),
                  login: t("photo.collection.login"),
                  tooMany: t("photo.collection.tooMany"),
                  full: t("photo.collection.full"),
                  exists: t("photo.collection.exists"),
                  badName: t("photo.collection.badName"),
                  error: t("photo.collection.error"),
                  loading: t("photo.collection.loading"),
                }}
              />
              <span className="ph-public">{t("photo.visibility.public")}</span>
            </div>
          ) : null}

          <h1 className="ph-viewTitle sf-h1">{title}</h1>
          <p className="ph-viewMeta">
            {shown ? (
              <PhotoViewCount
                photoId={photo.id}
                text={formatCompact(photo.viewCount)}
                label={tn("photo.views", photo.viewCount)}
                title={t("photo.views.title")}
                countable={viewer !== null && !isOwner}
              />
            ) : null}
            <span>
              {t("photo.detail.by")}{" "}
              <Link href={`/u/${photo.owner.username}`}>{name}</Link>
            </span>
            <span>{categoryNames[photoCategoryKeyOf(photo.category)]}</span>
            <time dateTime={photo.createdAt.toISOString()}>{photoDateText(photo.createdAt, getLocale())}</time>
            <span>{t("photo.info.sizeValue", { width: photo.width, height: photo.height, mp: photoMegapixels(photo.width, photo.height) })}</span>
            <span>{orientationNames[photoOrientation(photo.width, photo.height)]}</span>
            {photo.editedAt ? <span>{t("photo.detail.edited")}</span> : null}
          </p>

          {photo.caption ? <p className="ph-viewCaption pc-text">{photo.caption}</p> : null}

          {photo.tags.length > 0 ? (
            <ul className="ph-chips" aria-label={t("photo.detail.tags")}>
              {photo.tags.map((row) => (
                <li key={row.tag} className="ph-chip">
                  <Link href={`/photos?tag=${encodeURIComponent(row.tag)}`} title={t("photo.tag.more", { tag: row.tag })}>
                    #{row.tag}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

      </article>

      {shown && more.length > 0 ? (
        <section className="card ph-others" aria-labelledby="ph-more-title">
          <h2 id="ph-more-title" className="ph-sideTitle">{t("photo.more.title", { name })}</h2>
          <ul className="ph-othersGrid">
            {more.map((other) => (
              <li key={other.id}>
                <Link href={`/photos/${other.id}`} aria-label={other.title || t("photo.list.photoAlt")}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- the small copy from our own media route */}
                  <img src={photoFileUrl(photoThumbFile(other.file))} alt={other.title || t("photo.list.photoAlt")} width={other.width} height={other.height} loading="lazy" decoding="async" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      </div>

      {shown ? (
        <aside className="ph-side">
          <section className="card ph-panel" aria-labelledby="ph-details-title">
            <h2 id="ph-details-title" className="ph-panelTitle">{t("photo.side.title")}</h2>
            <dl className="ph-dl">
              <div><dt>{t("photo.info.size")}</dt><dd>{t("photo.info.sizeValue", { width: photo.width, height: photo.height, mp: photoMegapixels(photo.width, photo.height) })}</dd></div>
              <div><dt>{t("photo.info.orientation")}</dt><dd>{orientationNames[photoOrientation(photo.width, photo.height)]}</dd></div>
              <div><dt>{t("photo.side.views")}</dt><dd>{formatCompact(photo.viewCount)}</dd></div>
              <div><dt>{t("photo.side.visibility")}</dt><dd>{t("photo.side.everyone")}</dd></div>
            </dl>
            <a className="ph-dlBtn" href={photoFileUrl(photo.file)} download={photoDownloadName(photo.id, photo.file)} title={t("photo.download.title")}>
              {t("photo.download.label")}
              <Icon name="down" size={16} />
            </a>
          </section>

          <section className="card ph-panel">
            <div className="ph-owner">
              <span className="ph-avatar" aria-hidden="true">{photoInitials(name)}</span>
              <div className="ph-ownerText">
                <b className="ph-ownerName">{name}</b>
                <span className="ph-ownerCount">{tn("photo.owner.photos", photoCount)}</span>
              </div>
            </div>
            <Link href={`/u/${photo.owner.username}`} className="ph-dlBtn">
              {t("photo.owner.view")}
            </Link>
          </section>

          {near.newer || near.older ? (
            <nav className="card ph-panel ph-nav" aria-label={t("photo.nav.label")}>
              {near.newer ? <NeighbourLink photo={near.newer} label={t("photo.nav.previous")} arrow="←" /> : null}
              {near.older ? <NeighbourLink photo={near.older} label={t("photo.nav.next")} arrow="→" /> : null}
            </nav>
          ) : null}
        </aside>
      ) : null}
      </div>
    </>
  );
}

/** One of the two links Previous / Next: a small picture, the word and the title. `arrow` is mirrored for right-to-left languages. */
function NeighbourLink({ photo, label, arrow }: { photo: PhotoThumb; label: string; arrow: string }) {
  const title = photo.title || t("photo.list.photoAlt");
  return (
    <Link href={`/photos/${photo.id}`} className="ph-navLink">
      {/* eslint-disable-next-line @next/next/no-img-element -- the small copy from our own media route */}
      <img src={photoFileUrl(photoThumbFile(photo.file))} alt="" width={photo.width} height={photo.height} loading="lazy" decoding="async" />
      <span className="ph-navText">
        <small>
          <span aria-hidden="true" className="inline-block rtl:rotate-180">{arrow}</span> {label}
        </small>
        <span className="ph-navTitle">{title}</span>
      </span>
    </Link>
  );
}
