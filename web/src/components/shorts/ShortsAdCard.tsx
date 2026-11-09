"use client";

// The ad card between two shorts (SHORTS_TODO 27). It reuses the ad system as it is: the same candidate list (/api/ad/pool, slot FEED),
// the same "not the same ad again within an hour" pick (src/lib/ad-memory.ts), the same impression and click routes.
// Nothing about the visitor is sent or kept. Rules (PROJECT.md section 5): clearly labelled "Ad", no pop-up, no sound
// (a video ad is silent, see AdVideo.tsx), the whole ad is one link that opens the advertiser in a new tab.
//  - The ad is picked only when the card is near the screen, so ads far down the list do not use up the rotation.
//  - It is counted as seen once, after it has been the card on screen for `viewMs` (a quick flick past does not count).
import { useEffect, useRef, useState } from "react";
import AdMedia from "@/components/AdMedia";
import { loadPool, sendImpression, type Ad, type AdLabels } from "@/components/AdBox";
import { pickAd } from "@/lib/ad-memory";

type Props = {
  index: number;
  near: boolean;
  active: boolean;
  labels: AdLabels;
  noRepeatMinutes: number;
  viewMs: number;
  cardRef: (el: HTMLElement | null) => void;
};

export default function ShortsAdCard({ index, near, active, labels, noRepeatMinutes, viewMs, cardRef }: Props) {
  const [ad, setAd] = useState<Ad | null>(null);
  const started = useRef(false);
  const counted = useRef(false);

  useEffect(() => {
    if (!near || started.current) return;
    started.current = true;
    void loadPool("FEED", null).then((pool) => setAd(pickAd(pool, Date.now(), noRepeatMinutes * 60_000)));
  }, [near, noRepeatMinutes]);

  useEffect(() => {
    if (!active || !ad || counted.current) return;
    const timer = setTimeout(() => {
      counted.current = true;
      sendImpression(ad.id);
    }, viewMs);
    return () => clearTimeout(timer);
  }, [active, ad, viewMs]);

  return (
    <section className="shorts-card" data-index={index} ref={cardRef} aria-label={labels.label}>
      <div className="shorts-frame">
        <div className="shorts-ad">
          <span className="shorts-ad-badge">{labels.badge}</span>
          {ad && (
            <a href={`/api/ad/click/${ad.id}`} target="_blank" rel="sponsored nofollow noopener noreferrer" className="shorts-ad-link">
              {(ad.format === "IMAGE" || ad.format === "VIDEO") && (
                <AdMedia format={ad.format} imageUrl={ad.imageUrl ?? null} videoUrl={ad.videoUrl ?? null} title={ad.title} />
              )}
              <strong className="shorts-ad-title">{ad.title}</strong>
              <p className="shorts-ad-body">{ad.body}</p>
              {ad.host && <span className="shorts-ad-host">{ad.host}</span>}
            </a>
          )}
          <details className="shorts-ad-why">
            <summary>{labels.why}</summary>
            <p>{labels.whyBody}</p>
          </details>
        </div>
      </div>
    </section>
  );
}
