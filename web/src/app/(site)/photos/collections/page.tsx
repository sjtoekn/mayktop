import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import Icon from "@/components/shell/Icon";
import { t, tn } from "@/i18n";
import { loadMyCollections } from "@/lib/photo-collection-view";
import { photoThumbUrl } from "@/lib/photo-file";
import { getSessionUser } from "@/lib/session";
import "../photos.css";

export const metadata: Metadata = {
  title: t("photo.collections.title"),
  robots: { index: false, follow: false },
};

// Your photo collections: ONLY for logged-in people and ONLY your own (private). Not cached.
export default function CollectionsPage() {
  return (
    <Suspense fallback={<p className="pc-empty">…</p>}>
      <CollectionsContent />
    </Suspense>
  );
}

async function CollectionsContent() {
  await connection();
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

  const collections = await loadMyCollections(viewer.id);

  return (
    <>
      <header className="card pg-head ph-head">
        <div>
          <h1 className="sf-h1">{t("photo.collections.title")}</h1>
          <p className="pc-text">{t("photo.collections.sub")}</p>
        </div>
        <Link href="/photos" className="btn btn-secondary">{t("photo.saved.all")}</Link>
      </header>

      {collections.length === 0 ? (
        <section className="card pg-empty">
          <p>{t("photo.collections.empty")}</p>
          <Link href="/photos" className="pc-btn">{t("photo.saved.browse")}</Link>
        </section>
      ) : (
        <ul className="ph-collGrid">
          {collections.map((collection) => (
            <li key={collection.id} className="card ph-collCard">
              <Link href={`/photos/collections/${collection.id}`} prefetch={false}>
                <span className="ph-collCover">
                  {collection.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element -- the small copy from our own media route
                    <img src={photoThumbUrl(collection.cover)} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <Icon name="folderPlus" size={32} />
                  )}
                </span>
                <b className="ph-collCardName">{collection.name}</b>
                <span className="ph-collCardCount">{tn("photo.collections.count", collection.count)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
