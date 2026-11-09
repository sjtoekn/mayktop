"use client";

import { useEffect, useRef } from "react";
import { VIEW_VISIBLE_MS } from "@/lib/social-views";

// The "👁 1.3K" figure of the photo page (PHOTO_TODO 6c). `text` is the short number and `label` the full sentence for
// screen readers, both made on the server in the person's language. The number does not change while the page is open.
// When `countable` is true (a logged-in person who is not the owner) the page also reports a view to /api/photos/view after
// at least half of the photo card has been on screen for VIEW_VISIBLE_MS. Once per page load; the server decides whether it
// counts (login, bots, repeats, own photo). Nothing about the person is sent except the photo number.
const reported = new Set<number>();

export default function PhotoViewCount({
  photoId,
  text,
  label,
  title,
  countable,
}: {
  photoId: number;
  text: string;
  label: string;
  title: string;
  countable: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!countable || reported.has(photoId)) return;
    const card = ref.current?.closest("article") ?? ref.current;
    if (!card) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
    };
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        if (!visible) return stop(); // scrolled past too fast: not a view
        if (timer || reported.has(photoId)) return;
        timer = setTimeout(() => {
          timer = undefined;
          if (document.visibilityState !== "visible" || reported.has(photoId)) return;
          reported.add(photoId);
          observer.disconnect();
          void fetch("/api/photos/view", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: photoId }),
            keepalive: true,
          }).catch(() => {
            // offline or busy: this view is simply not counted
          });
        }, VIEW_VISIBLE_MS);
      },
      { threshold: 0.3 }, // a photo card is tall: 30% of it is enough
    );
    observer.observe(card);
    return () => {
      stop();
      observer.disconnect();
    };
  }, [photoId, countable]);

  return (
    <span ref={ref} className="ph-views" title={title} role="img" aria-label={label}>
      👁 {text}
    </span>
  );
}
