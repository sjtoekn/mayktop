"use client";

// One ad tile inside the /photos grid (PHOTO_TODO 16). A square box (about 300 x 300, never wider than 300 px), clearly marked "Ad".
// It uses the ads of the slots in PHOTO_AD_SLOTS (FEED, SIDEBAR, SOCIAL_FEED; no PHOTOS slot yet) and the same rules as every ad box: a pick the browser has not shown lately
// (ad-memory), one impression counted when half of it is on screen, a click goes through /api/ad/click/<id>.
//  - IMAGE: the picture fills the square (cropped to fit).
//  - VIDEO: AdVideo = starts by itself, SILENT, inline (playsInline), no controls, at most 10 s, loops; paused when scrolled away.
//  - TEXT: title + text on a plain card.
// With no ad running the tile disappears (no empty box). While the ad is loading an empty square keeps the place (no page jump).
// `group` = the page (cursor + tag): two tiles on one page never show the same ad when there is another one to show.
import { useEffect, useRef, useState } from "react";
import AdVideo from "@/components/AdVideo";
import { loadPool, sendImpression, type Ad } from "@/components/AdBox";
import { adsConfig } from "@/config/site";
import { pickAd } from "@/lib/ad-memory";

// The ad slots whose ads may appear in the photo grid. A running ad of any of these slots can be shown here.
// HEADER (wide banner pictures) is left out on purpose: it does not fit a square. Add "HEADER" to the list to include it.
const PHOTO_AD_SLOTS = ["FEED", "SIDEBAR", "SOCIAL_FEED"] as const;

async function loadPhotoAdPool(): Promise<Ad[]> {
  const pools = await Promise.all(PHOTO_AD_SLOTS.map((slot) => loadPool(slot, null)));
  const byId = new Map<number, Ad>();
  for (const pool of pools) for (const ad of pool) if (!byId.has(ad.id)) byId.set(ad.id, ad);
  return [...byId.values()];
}

const claimed = { group: "", ids: new Set<number>() };

export default function PhotoAdTile({
  group,
  noRepeatMinutes,
  labels,
}: {
  group: string;
  noRepeatMinutes: number;
  labels: { badge: string; label: string };
}) {
  const [shown, setShown] = useState<{ ad: Ad | null } | null>(null); // null = still loading
  const boxRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    let cancelled = false;
    void loadPhotoAdPool().then((pool) => {
      if (cancelled) return;
      if (claimed.group !== group) {
        claimed.group = group;
        claimed.ids.clear();
      }
      const fresh = pool.filter((ad) => !claimed.ids.has(ad.id));
      const ad = pickAd(fresh.length > 0 ? fresh : pool, Date.now(), noRepeatMinutes * 60_000);
      if (ad) claimed.ids.add(ad.id);
      setShown({ ad });
    });
    return () => {
      cancelled = true;
    };
  }, [group, noRepeatMinutes]);

  const adId = shown?.ad?.id ?? null;
  useEffect(() => {
    const box = boxRef.current;
    if (adId === null || !box) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          sendImpression(adId);
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, [adId]);

  if (shown && !shown.ad) return null;
  const ad = shown?.ad ?? null;

  return (
    <li className="ph-tile ph-adTile">
      {ad ? (
        <a
          ref={boxRef}
          href={`/api/ad/click/${ad.id}`}
          target="_blank"
          rel="sponsored nofollow noopener noreferrer"
          className="ph-adBox"
          aria-label={`${labels.label}: ${ad.title}`}
        >
          {ad.format === "VIDEO" && ad.videoUrl ? (
            <AdVideo src={ad.videoUrl} title={ad.title} seconds={adsConfig.media.videoSeconds} />
          ) : ad.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- our own protected file (/api/ad/media/...)
            <img src={ad.imageUrl} alt="" loading="lazy" decoding="async" />
          ) : (
            <span className="ph-adText">
              <strong>{ad.title}</strong>
              <span>{ad.body}</span>
              {ad.host ? <small>{ad.host}</small> : null}
            </span>
          )}
          <span className="badge badge-ad ph-adBadge">{labels.badge}</span>
        </a>
      ) : (
        <div className="ph-adBox ph-adLoading" aria-hidden="true" />
      )}
    </li>
  );
}
