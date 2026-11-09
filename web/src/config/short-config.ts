// Settings of the Shorts system (SHORTS_TODO step 0). The ONLY place where the limits live: change a number here and the
// whole system (upload form, checks, texts) follows. Pure constants: no database, no disk, safe for client code too.

/** The page of the Shorts feed (decided 2026-11-08). */
export const SHORTS_ROUTE = "/shorts";

/** Length of a short. 5-60 seconds is the FIRST plan; the final limit is decided later (change it here only). */
export const SHORT_MIN_SECONDS = 5;
export const SHORT_MAX_SECONDS = 60;

/** Biggest file we accept before processing (bytes). */
export const SHORT_MAX_BYTES = 50 * 1024 * 1024;

/** What we accept. The real type is sniffed from the bytes (never trusted from the name). */
export const SHORT_ALLOWED_TYPES = ["mp4", "webm", "mov"] as const;
export type ShortInputType = (typeof SHORT_ALLOWED_TYPES)[number];

/** 9:16 is recommended, NOT required (a wide video is shown centred with bars). */
export const SHORT_RECOMMENDED_ASPECT = 9 / 16;

/** The saved copy: H.264 MP4, at most this many pixels on the long side. */
export const SHORT_OUTPUT_MAX_SIDE = 1280;

export const SHORT_TITLE_MAX = 100;
export const SHORT_DESCRIPTION_MAX = 2000;

/** Who may see a short:
 *  PUBLIC   - in the feed, search and on the profile
 *  UNLISTED - only people who have the link (not in the feed)
 *  PRIVATE  - only the owner */
export const SHORT_PRIVACY = ["PUBLIC", "UNLISTED", "PRIVATE"] as const;
export type ShortPrivacyKey = (typeof SHORT_PRIVACY)[number];
export const SHORT_DEFAULT_PRIVACY: ShortPrivacyKey = "PUBLIC";

/** Where the files live (outside web/public). Same idea as photos: default web/storage/shorts/, or SHORT_MEDIA_DIR. */
export const SHORT_MEDIA_DIR_ENV = "SHORT_MEDIA_DIR";

/** Upload rate limits (SHORTS_TODO 19). Counted from the person's earlier shorts in the database, FAILED and hidden ones
 *  included, so deleting or failing does not give a new turn. A new account gets the stricter limits (limitsFor).
 *  Processing a video is heavy work for the server, so these are stricter than photos. */
export const SHORT_UPLOAD_LIMITS = [
  { max: 3, windowMinutes: 10 },
  { max: 15, windowMinutes: 24 * 60 },
];

/** Checking a file (looking inside the video) is work too: its own limit, taken before the file is even read. */
export const SHORT_CHECK_LIMIT = { max: 6, windowMinutes: 10 };

/** At most this many videos are processed at the same moment by this server (the others are asked to try again). */
export const SHORT_MAX_PARALLEL = 2;
