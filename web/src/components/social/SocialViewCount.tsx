"use client";

import { useEffect, useRef } from "react";
import { VIEW_VISIBLE_MS } from "@/lib/social-views";

// The "👁 1.3K" figure on a Social post card (SOCIAL_TODO B5). `text` is the short number and `label` the full sentence for
// screen readers ("1,280 views"), both made on the server in the person's language. The number does not change while the
// page is open. When `countable` is true (not the author's own post) the card also reports a view to /api/social/view
// after at least half of it has been on screen for VIEW_VISIBLE_MS. A post is reported once per page load; the server
// decides whether it counts (login, bots, repeats, own posts). Nothing about the person is sent except the post number.
const reported = new Set<number>();

export default function SocialViewCount({
  postId,
  text,
  label,
  title,
  countable,
}: {
  postId: number;
  text: string;
  label: string;
  title: string;
  countable: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!countable || reported.has(postId)) return;
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
        if (timer || reported.has(postId)) return;
        timer = setTimeout(() => {
          timer = undefined;
          if (document.visibilityState !== "visible" || reported.has(postId)) return;
          reported.add(postId);
          observer.disconnect();
          void fetch("/api/social/view", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: postId }),
            keepalive: true,
          }).catch(() => {
            // offline or busy: this view is simply not counted
          });
        }, VIEW_VISIBLE_MS);
      },
      { threshold: 0.5 },
    );
    observer.observe(card);
    return () => {
      stop();
      observer.disconnect();
    };
  }, [postId, countable]);

  return (
    <span ref={ref} className="sp-views" title={title} role="img" aria-label={label}>
      👁 {text}
    </span>
  );
}
