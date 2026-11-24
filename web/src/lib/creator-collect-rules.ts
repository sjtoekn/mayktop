// Rules for counting an ad impression on a PAGE (TODO 12, S3). Pure and small: no database, no React.
// What the server learns: which ad, and which question page it was shown on. Nothing about the visitor.
import { creatorsConfig } from "@/config/site";

/** The question page a path belongs to: "/post/123" -> 123. Anything else (feeds, profiles, "/post/abc") -> null. */
export function postIdFromPath(pathname: string): number | null {
  const m = /^\/post\/(\d{1,9})\/?$/.exec(pathname);
  if (!m) return null;
  const id = Number(m[1]);
  return id > 0 ? id : null;
}

export type ImpressionBody = { id: number; post: number | null };

/**
 * Reads the JSON the browser sends: { "id": 12 } or { "id": 12, "post": 345 }.
 * A bad ad id refuses the whole call (null). A bad `post` is simply ignored, so the ad itself is still counted as before.
 */
export function parseImpressionBody(raw: unknown): ImpressionBody | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { id, post } = raw as { id?: unknown; post?: unknown };
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) return null;
  const okPost = typeof post === "number" && Number.isInteger(post) && post > 0 && post <= 999_999_999;
  return { id, post: okPost ? post : null };
}

/** True when the logged-in viewer is one of the people who earn from this page: their own views are not counted. */
export function viewerIsOwner(viewerId: string | null, ownerIds: (string | null | undefined)[]): boolean {
  return viewerId !== null && ownerIds.some((o) => o === viewerId);
}

// Per page per minute. Lives in this server process's memory (same as src/lib/ad-guard.ts).
const windows = new Map<number, { start: number; count: number }>();

/** Counts one event against the per-minute limit of this page. Returns false when the limit is reached. */
export function allowContentCount(contentId: number, now: number = Date.now(), limit: number = creatorsConfig.maxImpressionsPerContentPerMinute): boolean {
  const w = windows.get(contentId);
  if (!w || now - w.start >= 60_000) {
    windows.set(contentId, { start: now, count: 1 });
    return true;
  }
  if (w.count >= limit) return false;
  w.count += 1;
  return true;
}
