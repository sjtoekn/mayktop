import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import Icon from "@/components/shell/Icon";
import { t } from "@/i18n";
import { loadSavedPhotos } from "@/lib/photo-bookmark-view";
import { parsePhotoSavedCursor, photoSavedCursorToText } from "@/lib/photo-bookmark-rules";
import { PHOTO_ROW_HEIGHT, photoTileStyle } from "@/lib/photo-feed-rules";
import { photoThumbUrl } from "@/lib/photo-file";
import { getSessionUser } from "@/lib/session";
import { loadHiddenAuthors } from "@/lib/social-block-view";
import "../photos.css";

export const metadata: Metadata = {
  title: t("photo.saved.title"),
  robots: { index: false, follow: false },
};

// Your saved photos (patch-photo-save): ONLY for logged-in people and ONLY your own list (private; there is no page for
// somebody else's). Not cached: the list belongs to one viewer. The most recently SAVED first, same grid as /photos.
// Hidden / removed / deleted photos and photos of a person who blocked you (or whom you blocked) are left out.
type Search = Promise<{ before?: string | string[] }>;

export default function SavedPhotosPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<p className="pc-empty">…</p>}>
      <SavedPhotosContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SavedPhotosContent({ searchParams }: { searchParams: Search }) {
  await connection();
  const { before } = await searchParams;
  const cursor = parsePhotoSavedCursor(before); // anything that is not a cursor means the first page

  const viewer = await getSessionUser();
  if (!viewer) {
    return (
      <>
        <header className="card pg-head">
          <h1 className="sf-h1">{t("photo.saved.title")}</h1>
        </header>
        <section className="card pg-empty">
          <span className="pc-avatar pc-a4" aria-hidden="true"><Icon name="shield" size={26} /></span>
          <p>{t("photo.saved.loginRequired")}</p>
          <div className="fa-actions">
            <Link href="/login" className="pc-btn">{t("topbar.login")}</Link>
            <Link href="/signup" className="pc-btn pc-btn-ghost">{t("topbar.signup")}</Link>
          </div>
        </section>
      </>
    );
  }

  const hidden = await loadHiddenAuthors(viewer.id);
  const page = await loadSavedPhotos(viewer.id, cursor, hidden.blocked);
  const fallbackAlt = t("photo.list.photoAlt");

  return (
    <>
      <header className="card pg-head ph-head">
        <div>
          <h1 className="sf-h1">{t("photo.saved.title")}</h1>
          <p className="pc-text">{t("photo.saved.sub")}</p>
        </div>
        <Link href="/photos" className="btn btn-secondary">{t("photo.saved.all")}</Link>
      </header>

      {page.items.length === 0 ? (
        <section className="card pg-empty">
          <p>{t("photo.saved.empty")}</p>
          <Link href="/photos" className="pc-btn">{t("photo.saved.browse")}</Link>
        </section>
      ) : (
        <>
          <ul className="ph-grid">
            {page.items.map((photo) => {
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

          <nav className="ph-more">
            {cursor !== null ? (
              <Link href="/photos/saved" className="btn btn-secondary">{t("photo.saved.newest")}</Link>
            ) : null}
            {page.next !== null ? (
              <Link href={`/photos/saved?before=${photoSavedCursorToText(page.next)}`} className="btn btn-secondary">
                {t("photo.list.more")}
              </Link>
            ) : null}
          </nav>
        </>
      )}
    </>
  );
}
