import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import Icon from "@/components/shell/Icon";
import { t } from "@/i18n";
import { loadCollectionPhotos } from "@/lib/photo-collection-view";
import { parsePhotoSavedCursor, photoSavedCursorToText } from "@/lib/photo-bookmark-rules";
import { PHOTO_ROW_HEIGHT, photoTileStyle } from "@/lib/photo-feed-rules";
import { photoThumbUrl } from "@/lib/photo-file";
import { getSessionUser } from "@/lib/session";
import { loadHiddenAuthors } from "@/lib/social-block-view";
import "../../photos.css";

export const metadata: Metadata = {
  title: t("photo.collections.title"),
  robots: { index: false, follow: false },
};

// One of YOUR collections (private; somebody else's collection is "not found"). The most recently ADDED first, same grid
// as /photos. Paging with ?before=<addedAtMs>.<photoId>, like the Saved photos page.
export function generateStaticParams() {
  return [{ id: "1" }];
}

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ before?: string | string[] }> };

export default function CollectionPage(props: Props) {
  return (
    <Suspense fallback={<p className="pc-empty">…</p>}>
      <CollectionContent {...props} />
    </Suspense>
  );
}

async function CollectionContent({ params, searchParams }: Props) {
  await connection();
  const { id: rawId } = await params;
  if (!/^[0-9]{1,9}$/.test(rawId)) notFound();
  const collectionId = Number(rawId);
  const { before } = await searchParams;
  const cursor = parsePhotoSavedCursor(before);

  const viewer = await getSessionUser();
  if (!viewer) {
    return (
      <>
        <header className="card pg-head">
          <h1 className="sf-h1">{t("photo.collections.title")}</h1>
        </header>
        <section className="card pg-empty">
          <span className="pc-avatar pc-a4" aria-hidden="true"><Icon name="shield" size={26} /></span>
          <p>{t("photo.collections.loginRequired")}</p>
          <div className="fa-actions">
            <Link href="/login" className="pc-btn">{t("topbar.login")}</Link>
            <Link href="/signup" className="pc-btn pc-btn-ghost">{t("topbar.signup")}</Link>
          </div>
        </section>
      </>
    );
  }

  const hidden = await loadHiddenAuthors(viewer.id);
  const page = await loadCollectionPhotos(viewer.id, collectionId, cursor, hidden.blocked);
  if (!page) notFound();
  const fallbackAlt = t("photo.list.photoAlt");
  const base = `/photos/collections/${collectionId}`;

  return (
    <>
      <header className="card pg-head ph-head">
        <div>
          <h1 className="sf-h1">{page.name}</h1>
          <p className="pc-text">{t("photo.collections.sub")}</p>
        </div>
        <Link href="/photos/collections" className="btn btn-secondary">{t("photo.collections.back")}</Link>
      </header>

      {page.items.length === 0 ? (
        <section className="card pg-empty">
          <p>{t("photo.collections.emptyOne")}</p>
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
              <Link href={base} className="btn btn-secondary">{t("photo.collections.newest")}</Link>
            ) : null}
            {page.next !== null ? (
              <Link href={`${base}?before=${photoSavedCursorToText(page.next)}`} className="btn btn-secondary">
                {t("photo.list.more")}
              </Link>
            ) : null}
          </nav>
        </>
      )}
    </>
  );
}
