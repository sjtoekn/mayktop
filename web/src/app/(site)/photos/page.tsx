import type { Metadata } from "next";
import Link from "next/link";
import { Fragment, Suspense } from "react";
import { connection } from "next/server";
import PageHero from "@/components/PageHero";
import PhotoAdTile from "@/components/photos/PhotoAdTile";
import { adsConfig } from "@/config/site";
import { t } from "@/i18n";
import { isPhotoAdPosition } from "@/lib/ad-positions";
import { loadPhotoPage } from "@/lib/photo-feed";
import { parsePhotoBefore } from "@/lib/photo-feed-rules";
import { photoThumbUrl } from "@/lib/photo-file";
import { parseTagParam } from "@/lib/social-tags";
import "./photos.css";

export const metadata: Metadata = {
  title: t("photo.list.title"),
};

// /photos (PHOTO_TODO 5): the newest photos, in rows filled to the full width. Anybody (also a visitor) may look; a login is
// needed only to upload (decided 2026-11-08). The page reads the database, so it runs per request: connection() and the
// data sit INSIDE <Suspense>, the same way the Social feed does it (Next.js 16 "instant" check).
// "Load more" opens the next (older) page with ?before=<id of the last photo>; anything that is not a cursor means the first page.
// Not yet here: Block / Mute of authors, category filter (PHOTO_TODO 9), fair ranking (15), the ad tile (16).
type Search = Promise<{ before?: string | string[]; tag?: string | string[] }>;

export default function PhotosPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<p className="pc-empty">…</p>}>
      <PhotosContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PhotosContent({ searchParams }: { searchParams: Search }) {
  await connection();
  const { before, tag: rawTag } = await searchParams;
  const cursor = parsePhotoBefore(before);
  const tag = parseTagParam(rawTag);
  const page = await loadPhotoPage(cursor, tag);
  const baseHref = tag ? `/photos?tag=${encodeURIComponent(tag)}` : "/photos";
  const moreHref = (id: number) => (tag ? `${baseHref}&before=${id}` : `/photos?before=${id}`);
  const fallbackAlt = t("photo.list.photoAlt");
  const adGroup = `${tag ?? ""}:${cursor ?? 0}`;
  const adLabels = { badge: t("ad.badge"), label: t("ad.label") };

  return (
    <>
      <PageHero variant="photos" parts={[t("photos.hero.a"), t("photos.hero.b"), t("photos.hero.c")]} sub={t("photos.hero.sub")} />

      <header className="card pg-head ph-head">
        <div>
          <h2 className="sf-h1">{tag ? t("photo.tag.heading", { tag }) : t("photo.list.title")}</h2>
          <p className="pc-text">{t("photo.list.sub")}</p>
        </div>
        <div className="ph-headActions">
          <Link href="/photos/collections" className="btn btn-secondary">
            {t("photo.collections.link")}
          </Link>
          <Link href="/photos/saved" className="btn btn-secondary">
            {t("photo.saved.link")}
          </Link>
          <Link href="/photos/upload" className="btn btn-primary">
            {t("photo.list.upload")}
          </Link>
        </div>
      </header>

      {page.items.length === 0 ? (
        <section className="card pg-empty">
          <p>{t("photo.list.empty")}</p>
        </section>
      ) : (
        <>
          <ul className="ph-grid">
            {page.items.map((photo, index) => (
              <Fragment key={photo.id}>
              <li className="ph-tile">
                <Link href={`/photos/${photo.id}`} prefetch={false} aria-label={photo.title || fallbackAlt}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- the small copy from our own media route */}
                  <img src={photoThumbUrl(photo.file)} alt={photo.title || fallbackAlt} width={photo.width} height={photo.height} loading="lazy" decoding="async" />
                  {photo.title ? (
                    <span className="ph-tileTitle" aria-hidden="true">
                      {photo.title}
                    </span>
                  ) : null}
                </Link>
              </li>
              {isPhotoAdPosition(index) && index < page.items.length - 1 ? (
                <PhotoAdTile group={adGroup} noRepeatMinutes={adsConfig.rotation.noRepeatMinutes} labels={adLabels} />
              ) : null}
              </Fragment>
            ))}
          </ul>

          <nav className="ph-more">
            {cursor !== null ? (
              <Link href={baseHref} className="btn btn-secondary">
                {t("photo.list.newest")}
              </Link>
            ) : null}
            {page.next !== null ? (
              <Link href={moreHref(page.next)} className="btn btn-secondary">
                {t("photo.list.more")}
              </Link>
            ) : null}
          </nav>
        </>
      )}
    </>
  );
}
