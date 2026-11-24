// Pure rules of the Shorts feed (SHORTS_TODO 21-27). No database, no disk, no imports: tested alone (npm run test:short-feed).
//
// FAIR ORDER (Falvenco principle, SHORTS_TODO 27): the feed is NEWEST FIRST and never sorted by likes or views, so a person
// with many followers does not sit on top for ever. Inside one page, `spreadCreators` only moves things around so the same
// creator does not play twice in a row when somebody else is waiting; it never drops or adds an item.

/** Cursor of a page = the LAST item of the page in newest-first order: "<createdAt in ms>.<id>". */
export type ShortCursor = { createdAtMs: number; id: number };

export function encodeShortCursor(cursor: ShortCursor): string {
  return `${cursor.createdAtMs}.${cursor.id}`;
}

/** Anything that is not exactly digits.digits is ignored (the first page is shown). */
export function parseShortCursor(raw: unknown): ShortCursor | null {
  if (typeof raw !== "string") return null;
  const m = /^(\d{1,15})\.(\d{1,10})$/.exec(raw);
  if (!m) return null;
  const createdAtMs = Number(m[1]);
  const id = Number(m[2]);
  if (!Number.isSafeInteger(createdAtMs) || !Number.isSafeInteger(id)) return null;
  return { createdAtMs, id };
}

/** Same order, except: take the first waiting item whose creator is not the one just placed (if there is none, take the first). */
export function spreadCreators<T extends { ownerId: string }>(items: readonly T[]): T[] {
  const left = [...items];
  const out: T[] = [];
  while (left.length > 0) {
    const last = out.length > 0 ? out[out.length - 1].ownerId : null;
    let at = left.findIndex((item) => item.ownerId !== last);
    if (at < 0) at = 0;
    out.push(left.splice(at, 1)[0]);
  }
  return out;
}

/** "cover" (fill the screen) for a video that is nearly 9:16, otherwise "contain" (whole video, centred, with bars). */
export function fitMode(width: number | null, height: number | null, minRatio: number, maxRatio: number): "cover" | "contain" {
  if (!width || !height || width <= 0 || height <= 0) return "contain";
  const ratio = width / height;
  return ratio >= minRatio && ratio <= maxRatio ? "cover" : "contain";
}

/** 75.4 -> "1:15" */
export function formatClock(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** The new play position after a jump of `delta` seconds, kept inside the video. */
export function seekTarget(current: number, delta: number, duration: number): number {
  const end = Number.isFinite(duration) && duration > 0 ? duration : Math.max(0, current + delta);
  return Math.min(Math.max(0, current + delta), end);
}

/** Next / previous card index, kept inside the list (no wrap-around). */
export function stepIndex(index: number, direction: 1 | -1, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(0, index + direction), length - 1);
}

/** Should the next page be fetched now? */
export function shouldLoadMore(activeIndex: number, loaded: number, hasMore: boolean, loading: boolean, ahead: number): boolean {
  return hasMore && !loading && loaded > 0 && activeIndex >= loaded - ahead;
}

/** Position of the progress bar, 0..1000 (a whole number, for an <input type="range">). */
export function progressPermille(current: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(current) || current <= 0) return 0;
  return Math.min(1000, Math.round((current / duration) * 1000));
}

/** One card of the player: a short, or an ad card that sits after short number `afterShort`. */
export type FeedSlide = { kind: "short"; shortIndex: number } | { kind: "ad"; afterShort: number };

/**
 * The cards in order. An ad card follows every `adEvery`-th short, but never opens the list and never ends it
 * (a short always comes after it). `adEvery` below 3 (or not a whole number) means no ads, so two ads are never close.
 * Shorts keep their order: ads only sit between them.
 */
export function buildSlides(shortCount: number, adEvery: number, adsOn: boolean): FeedSlide[] {
  const slides: FeedSlide[] = [];
  const withAds = adsOn && Number.isInteger(adEvery) && adEvery >= 3;
  for (let i = 0; i < shortCount; i++) {
    slides.push({ kind: "short", shortIndex: i });
    if (withAds && (i + 1) % adEvery === 0 && i < shortCount - 1) slides.push({ kind: "ad", afterShort: i });
  }
  return slides;
}

/** The short a card stands for (an ad card counts as the short before it): used to decide when to load the next page. */
export function shortIndexOfSlide(slides: readonly FeedSlide[], slideIndex: number): number {
  const slide = slides[slideIndex];
  if (!slide) return 0;
  return slide.kind === "short" ? slide.shortIndex : slide.afterShort;
}
