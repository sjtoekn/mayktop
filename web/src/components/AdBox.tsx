"use client";

// One ad box (client part). It asks the server for the candidate ads of its slot, picks one the browser
// has not shown lately (src/lib/ad-memory.ts), shows it, and tells the server once that it was really seen.
// What is kept about the visitor: nothing on the server. The server only adds 1 to the ad's daily total.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getRememberState, pickAd, setRemember, subscribeRemember } from "@/lib/ad-memory";
import AdMedia from "@/components/AdMedia";
import "./ad-social.css";

// format / imageUrl / videoUrl: Session 3b. imageUrl is the picture of an IMAGE ad, or the poster of a VIDEO ad.
type Ad = {
  id: number;
  title: string;
  body: string;
  host: string;
  format?: "TEXT" | "IMAGE" | "VIDEO";
  imageUrl?: string | null;
  videoUrl?: string | null;
};

export type AdLabels = {
  label: string; // aria-label of the box
  badge: string; // the visible "Ad" badge
  why: string; // "Why this ad?"
  whyBody: string;
  remember: string; // button text to switch the one-hour memory on
  rememberOn: string; // button text when it is on (click to switch off)
  blocked: string; // shown instead of the button when the browser sends a privacy signal
  advertiser?: string; // "Advertiser": the social variant names the advertiser as an advertiser, never as a person
  houseTitle: string;
  houseBody: string;
};

type Shown = { ad: Ad | null; key: number } | null; // null = still loading

const POOL_TTL_MS = 30_000;
const pools = new Map<string, { at: number; ads: Ad[] }>();

async function loadPool(slot: string, community: string | null): Promise<Ad[]> {
  const cacheKey = `${slot}:${community ?? ""}`;
  const hit = pools.get(cacheKey);
  if (hit && Date.now() - hit.at < POOL_TTL_MS) return hit.ads;
  try {
    const query = `slot=${slot}${community ? `&c=${encodeURIComponent(community)}` : ""}`;
    const res = await fetch(`/api/ad/pool?${query}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { ads?: Ad[] };
    const ads = Array.isArray(data.ads) ? data.ads : [];
    pools.set(cacheKey, { at: Date.now(), ads });
    return ads;
  } catch {
    return [];
  }
}

function communityFromPath(pathname: string): string | null {
  return /^\/c\/([a-z0-9-]+)/.exec(pathname)?.[1] ?? null;
}

function sendImpression(id: number) {
  const body = JSON.stringify({ id });
  if (typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon("/api/ad/impression", new Blob([body], { type: "application/json" }));
  } else {
    void fetch("/api/ad/impression", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => {});
  }
}

function RememberSwitch({ labels }: { labels: AdLabels }) {
  const state = useSyncExternalStore(subscribeRemember, getRememberState, () => "off" as const);
  if (state === "blocked") return <p className="mt-2 text-muted">{labels.blocked}</p>;
  return (
    <button type="button" className="mt-2 underline" onClick={() => setRemember(state !== "on")}>
      {state === "on" ? labels.rememberOn : labels.remember}
    </button>
  );
}

export default function AdBox({
  variant,
  noRepeatMinutes,
  labels,
}: {
  variant: "sidebar" | "feed" | "social";
  noRepeatMinutes: number;
  labels: AdLabels;
}) {
  const pathname = usePathname();
  const community = communityFromPath(pathname);
  const slot = variant === "sidebar" ? "SIDEBAR" : variant === "social" ? "SOCIAL_FEED" : "FEED";
  const [shown, setShown] = useState<Shown>(null);
  const boxRef = useRef<HTMLElement>(null);

  // Pick an ad on every page view (the sidebar stays mounted while the visitor moves between pages).
  useEffect(() => {
    let cancelled = false;
    void loadPool(slot, community).then((pool) => {
      if (cancelled) return;
      const ad = pickAd(pool, Date.now(), noRepeatMinutes * 60_000);
      setShown({ ad, key: Date.now() + Math.random() });
    });
    return () => {
      cancelled = true;
    };
  }, [slot, community, pathname, noRepeatMinutes]);

  // Count one impression, once, when at least half of the ad is on screen.
  const adId = shown?.ad?.id ?? null;
  const viewKey = shown?.key ?? null;
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
  }, [adId, viewKey]);

  const ad = shown?.ad ?? null;
  const height = variant === "sidebar" ? "min-h-64" : "min-h-24";
  // The social variant must look clearly different from a post (ADS_PLAN decision 11): own border + background (ad-social.css),
  // the "Ad" badge on top, the advertiser named as an advertiser; no avatar, no profile link, no like / repost / reply / share buttons.
  const social = variant === "social";

  return (
    <aside ref={boxRef} aria-label={labels.label} className={`card card-ad ${height}${social ? " ad-social" : ""}`}>
      <div className={social ? "ad-social-head" : "mb-2"}>
        <span className="badge badge-ad">{labels.badge}</span>
        {social && ad?.host && labels.advertiser && (
          <span className="ad-social-by text-xs text-muted">
            {labels.advertiser}: {ad.host}
          </span>
        )}
      </div>

      {ad ? (
        <div>
          {/* VIDEO: the player stays OUTSIDE the link, so pressing play never counts as a click. Never autoplay. */}
          {ad.format === "VIDEO" && (
            <div className="mb-2">
              <AdMedia format="VIDEO" imageUrl={ad.imageUrl ?? null} videoUrl={ad.videoUrl ?? null} title={ad.title} />
            </div>
          )}
          <a
            href={`/api/ad/click/${ad.id}`}
            target="_blank"
            rel="sponsored nofollow noopener noreferrer"
            className="block"
          >
            {ad.format === "IMAGE" && (
              <div className="mb-2">
                <AdMedia format="IMAGE" imageUrl={ad.imageUrl ?? null} videoUrl={null} title={ad.title} />
              </div>
            )}
            <strong className="type-heading block">{ad.title}</strong>
            <p className="type-small mt-1">{ad.body}</p>
            {!social && ad.host && <span className="mt-2 block text-xs text-muted">{ad.host}</span>}
          </a>
        </div>
      ) : shown ? (
        <Link href="/advertise" className="block">
          <strong className="type-heading block">{labels.houseTitle}</strong>
          <p className="type-small mt-1">{labels.houseBody}</p>
        </Link>
      ) : null}

      <details className="mt-3 text-xs text-muted">
        <summary className="cursor-pointer">{labels.why}</summary>
        <p className="mt-2">{labels.whyBody}</p>
        <RememberSwitch labels={labels} />
      </details>
    </aside>
  );
}
