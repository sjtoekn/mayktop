"use client";

// The video of a VIDEO ad (changed 2026-11-08, ADS_PLAN decision 10b). It starts by itself, SILENT, while at least half of it is on
// screen, pauses when scrolled away, and shows only the first `seconds` seconds (10): at that second it starts again from the
// beginning. There are no controls and no poster: the whole ad is a link, so a click anywhere opens the advertiser's page.
// It does NOT start by itself when the visitor asked for less motion (prefers-reduced-motion) or for less data (Save-Data): it then
// shows the first picture of the video and nothing moves.
// Nothing is sent anywhere from here: no view or play is counted (the impression is counted by AdBox, like for every ad).
import { useEffect, useRef } from "react";

type SaveDataConnection = { saveData?: boolean };

export default function AdVideo({ src, title, seconds }: { src: string; title: string; seconds: number }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = true; // set on the element too: some browsers ignore the attribute for autoplay
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: SaveDataConnection }).connection?.saveData === true;
    if (reduced || saveData) return; // stays on the first picture

    const observer = new IntersectionObserver(
      ([entry]) => {
        const v = ref.current;
        if (!v) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          void v.play().catch(() => {}); // refused (for example battery saver): the first picture just stays
        } else if (!v.paused) {
          v.pause();
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [src]);

  return (
    <video
      ref={ref}
      // "#t=0.001" makes every browser (iPhone too) show the first picture before it plays: no poster is needed.
      src={`${src}#t=0.001`}
      muted
      loop
      playsInline
      preload="metadata"
      disablePictureInPicture
      controlsList="nodownload noremoteplayback"
      aria-label={title}
      onTimeUpdate={(event) => {
        const v = event.currentTarget;
        if (v.currentTime >= seconds) v.currentTime = 0; // never show more than `seconds` seconds, even of an uncut file
      }}
    />
  );
}
