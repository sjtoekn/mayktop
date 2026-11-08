// Protection for ad counting (TODO 45, first part). Server only.
//  - looksLikeBot: crawlers and scripts are not counted.
//  - allowCount: at most N counted impressions / clicks per ad per minute. The limit is per AD, not per
//    person: nothing about the visitor (no IP, no id) is looked at or kept.
// The counters live in this server process's memory. With several servers a shared limiter is needed (TODO 50).
import { adsConfig } from "@/config/site";

const BOT_PATTERN =
  /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|scrapy|curl|wget|python|java\/|go-http|httpclient|facebookexternalhit|embedly/i;

/** True when the User-Agent is missing or looks like a crawler or script. */
export function looksLikeBot(userAgent: string | null): boolean {
  return !userAgent || BOT_PATTERN.test(userAgent);
}

const windows = new Map<string, { start: number; count: number }>();

/** Counts one event against the per-minute limit of this ad. Returns false when the limit is reached. */
export function allowCount(adId: number, kind: "impression" | "click", now: number = Date.now()): boolean {
  const limit =
    kind === "impression"
      ? adsConfig.counting.maxImpressionsPerAdPerMinute
      : adsConfig.counting.maxClicksPerAdPerMinute;
  const key = `${kind}:${adId}`;
  const w = windows.get(key);
  if (!w || now - w.start >= 60_000) {
    windows.set(key, { start: now, count: 1 });
    return true;
  }
  if (w.count >= limit) return false;
  w.count += 1;
  return true;
}
