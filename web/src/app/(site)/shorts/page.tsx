import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { SHORTS_ROUTE } from "@/config/short-config";
import FeedTypeTabs from "@/components/feed/FeedTypeTabs";
import { SHORT_FEED_PAGE_SIZE } from "@/config/short-feed-config";
import { getShortsFeed } from "@/lib/short-queries";
import "./shorts.css";

export const metadata: Metadata = {
  title: "Shorts | MaykTop",
  description: "Discover short videos on MaykTop.",
};

type Search = Promise<{ before?: string }>;

export default function ShortsPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<section className="shorts-gallery-loading" aria-busy="true">Loading Shorts…</section>}>
      <ShortsGallery searchParams={searchParams} />
    </Suspense>
  );
}

async function ShortsGallery({ searchParams }: { searchParams: Search }) {
  await connection();
  const { before } = await searchParams;
  const page = await getShortsFeed(before ?? null, SHORT_FEED_PAGE_SIZE);

  return (
    <>
      <FeedTypeTabs active="shorts" />
      <section className="shorts-gallery">
      <header className="card shorts-gallery-head">
        <div>
          <h1>Shorts</h1>
          <p>Discover and watch short videos from the MaykTop community.</p>
        </div>
        <Link href={`${SHORTS_ROUTE}/upload`} className="btn btn-primary">Upload Short</Link>
      </header>

      {page.items.length === 0 ? (
        <section className="card pg-empty">
          <h2>No Shorts yet</h2>
          <p>Be the first to share a short video with the community.</p>
          <Link href={`${SHORTS_ROUTE}/upload`} className="btn btn-primary">Upload a Short</Link>
        </section>
      ) : (
        <>
          <div className="shorts-gallery-grid">
            {page.items.map((short) => (
              <Link href={`${SHORTS_ROUTE}/${short.id}`} className="shorts-gallery-card" key={short.id}>
                <div className="shorts-gallery-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail is served by MaykTop's protected media route */}
                  <img src={short.thumbUrl} alt={short.title || "Short video"} loading="lazy" />
                  <span className="shorts-gallery-play" aria-hidden="true">▶</span>
                  {short.durationMs ? (
                    <span className="shorts-gallery-duration">
                      {Math.floor(short.durationMs / 60000)}:{String(Math.floor((short.durationMs % 60000) / 1000)).padStart(2, "0")}
                    </span>
                  ) : null}
                </div>
                <div className="shorts-gallery-info">
                  <strong>{short.title || "Untitled Short"}</strong>
                  <span>@{short.username}</span>
                </div>
              </Link>
            ))}
          </div>

          {page.next ? (
            <nav className="shorts-gallery-more" aria-label="More Shorts">
              <Link href={`${SHORTS_ROUTE}?before=${encodeURIComponent(page.next)}`} className="btn btn-secondary">
                Load more Shorts
              </Link>
            </nav>
          ) : null}
        </>
      )}
      </section>
    </>
  );
}
