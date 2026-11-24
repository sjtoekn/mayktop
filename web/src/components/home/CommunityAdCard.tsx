"use client";

// The 5th card of the Home "Community" row: ALWAYS an ad card (same size and look as a community post card).
// It uses the FEED slot ads and the same rules as every ad box: a pick the browser has not shown lately (ad-memory),
// one impression when half of it is on screen, a click goes through /api/ad/click/<id>, clearly marked "Ad".
//  - IMAGE: the picture fills the picture area (cropped to fit).   - VIDEO: AdVideo (silent, self-starting, loops).
//  - TEXT: a plain tinted picture area with the advertiser's host.
// With no ad running the card is NOT left empty: it shows the house card ("Your ad could be here") linking to /advertise,
// so the 5th place is always taken.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AdVideo from "@/components/AdVideo";
import { loadPool, sendImpression, type Ad } from "@/components/AdBox";
import { adsConfig } from "@/config/site";
import { pickAd } from "@/lib/ad-memory";

export default function CommunityAdCard({
  noRepeatMinutes,
  labels,
}: {
  noRepeatMinutes: number;
  labels: { badge: string; label: string; houseTitle: string; houseBody: string };
}) {
  const [shown, setShown] = useState<{ ad: Ad | null } | null>(null); // null = still loading
  const boxRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    let cancelled = false;
    void loadPool("FEED", null).then((pool) => {
      if (cancelled) return;
      setShown({ ad: pickAd(pool, Date.now(), noRepeatMinutes * 60_000) });
    });
    return () => {
      cancelled = true;
    };
  }, [noRepeatMinutes]);

  const adId = shown?.ad?.id ?? null;
  useEffect(() => {
    const box = boxRef.current;
    if (adId === null || !box) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          sendImpression(adId);
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, [adId]);

  const ad = shown?.ad ?? null;

  return (
    <li ref={boxRef} className="card hd-card hd-card-ad" aria-label={labels.label}>
      {ad ? (
        <a href={`/api/ad/click/${ad.id}`} target="_blank" rel="sponsored nofollow noopener noreferrer" className="hd-link">
          <div className="hd-media hd-media-ad">
            {ad.format === "VIDEO" && ad.videoUrl ? (
              <AdVideo src={ad.videoUrl} title={ad.title} seconds={adsConfig.media.videoSeconds} />
            ) : ad.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- our own protected file (/api/ad/media/...)
              <img src={ad.imageUrl} alt="" loading="lazy" decoding="async" />
            ) : (
              <span className="hm-adHost" aria-hidden="true">{ad.host}</span>
            )}
            <span className="hd-flag">{labels.badge}</span>
          </div>
          <div className="hd-meta">
            <span className="hd-source">{ad.host || labels.badge}</span>
          </div>
          <h3 className="hd-title">{ad.title}</h3>
          {ad.body ? <p className="hd-excerpt">{ad.body}</p> : null}
        </a>
      ) : shown ? (
        <Link href="/advertise" className="hd-link">
          <div className="hd-media hd-media-ad">
            <span className="hm-adHost" aria-hidden="true">Ad</span>
            <span className="hd-flag">{labels.badge}</span>
          </div>
          <h3 className="hd-title">{labels.houseTitle}</h3>
          <p className="hd-excerpt">{labels.houseBody}</p>
        </Link>
      ) : (
        <div className="hd-link" aria-hidden="true">
          <div className="hd-media hd-media-ad" />
        </div>
      )}
    </li>
  );
}
