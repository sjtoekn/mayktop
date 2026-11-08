"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NEW_POSTS_POLL_MS, type NewPostsFeed } from "@/lib/social-new-posts";

// The "n new posts" button above a Social feed (SOCIAL_TODO B4). `since` = the time (ms) of the newest item the page shows.
// About once a minute, while this tab is visible, it asks /api/social/new-count how many items are newer. It NEVER changes
// the feed by itself: only the button does (router.refresh(), then back to the top). The button text comes from the server
// (already in the person's language). The place is a polite live region so a screen reader hears that there is news.
// The answer is kept together with the `since` it was asked for, so a refreshed page (new `since`) starts again at 0.
type Answer = { since: number; count: number; label: string };

export default function SocialNewPostsBanner({ feed, since }: { feed: NewPostsFeed; since: number }) {
  const router = useRouter();
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function check() {
      try {
        const response = await fetch(`/api/social/new-count?feed=${feed}&since=${since}`, { cache: "no-store" });
        if (!response.ok) return; // too many questions (429) or a problem: stay quiet, try again next time
        const data = (await response.json()) as { count?: number; label?: string };
        if (!cancelled) setAnswer({ since, count: Number(data.count) || 0, label: String(data.label ?? "") });
      } catch {
        // offline or the server is busy: nothing to show
      }
    }
    function schedule() {
      timer = setTimeout(async () => {
        if (document.visibilityState === "visible") await check();
        if (!cancelled) schedule();
      }, NEW_POSTS_POLL_MS);
    }
    function onVisible() {
      if (document.visibilityState === "visible") void check(); // coming back to the tab: ask at once
    }

    document.addEventListener("visibilitychange", onVisible);
    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [feed, since]);

  const show = answer !== null && answer.since === since && answer.count > 0 ? answer : null;

  return (
    <div className="sp-newposts" role="status" aria-live="polite">
      {show ? (
        <button
          type="button"
          className="pc-btn"
          disabled={pending}
          onClick={() =>
            startTransition(() => {
              router.refresh();
              window.scrollTo({ top: 0 });
            })
          }
        >
          {show.label}
        </button>
      ) : null}
    </div>
  );
}
