// Checks and cleans what a person types when uploading a photo (PHOTO_TODO 4): title, caption, tags.
// Pure functions: no database, no disk, so `npm run test:photo-input` can run them. The browser is not trusted, so the
// server action calls these every time.
//
// Same cleaning as the text of a Social post (src/lib/social-input.ts): line endings become "\n", control characters and
// bidi override / isolate characters are removed (they can make text read differently from how it is stored), the
// zero-width joiners that Sinhala, Hindi and Persian need stay.
//  - TITLE: required, ONE line (new lines and tabs become spaces, repeated spaces become one), at most photoText.titleMax.
//  - CAPTION: optional (empty / invisible only = none), new lines kept (more than two empty lines in a row become two),
//    at most photoText.captionMax.
//  - CATEGORY: required, exactly one key of photoCategories (anything else is an ERROR, never changed into "other").
//  - TAGS: optional. Separated by commas, semicolons, spaces or new lines; a leading "#" is allowed. Every tag must be a
//    valid Social hashtag name (letters, numbers, "_", at least one letter, at most 50 characters). Saved lower case and
//    NFC. The same tag twice counts once. A tag that is not valid, or more than photoText.maxTags different tags, is an
//    ERROR (nothing is silently dropped).
import { photoCategories, photoText, type PhotoCategory } from "@/config/site";
import { parseSocialTags } from "@/lib/social-tags";

const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g;
const INVISIBLE = /[\s\u200B-\u200F\u2060\uFEFF]/g;
const RAW_LIMIT = 20_000;

export type CleanTitleResult = { ok: true; title: string } | { ok: false; reason: "type" | "empty" | "long" };
export type CleanCaptionResult = { ok: true; caption: string | null } | { ok: false; reason: "type" | "long" };
export type ParseCategoryResult = { ok: true; category: PhotoCategory } | { ok: false; reason: "type" | "invalid" };
export type ParseTagsResult = { ok: true; tags: string[] } | { ok: false; reason: "type" | "invalid" | "many" };

export function cleanPhotoTitle(input: unknown): CleanTitleResult {
  if (typeof input !== "string") return { ok: false, reason: "type" };
  if (input.length > RAW_LIMIT) return { ok: false, reason: "long" };
  const title = input
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL, (c) => (c === "\t" ? " " : ""))
    .replace(/[\n\t]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
  if (title.replace(INVISIBLE, "").length === 0) return { ok: false, reason: "empty" };
  if (title.length > photoText.titleMax) return { ok: false, reason: "long" };
  return { ok: true, title };
}

/** `null` / "" / only invisible characters = no caption (not an error). */
export function cleanPhotoCaption(input: unknown): CleanCaptionResult {
  if (input === null || input === undefined) return { ok: true, caption: null };
  if (typeof input !== "string") return { ok: false, reason: "type" };
  if (input.length > RAW_LIMIT) return { ok: false, reason: "long" };
  const caption = input
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  if (caption.replace(INVISIBLE, "").length === 0) return { ok: true, caption: null };
  if (caption.length > photoText.captionMax) return { ok: false, reason: "long" };
  return { ok: true, caption };
}

export function parsePhotoTags(input: unknown, max: number = photoText.maxTags): ParseTagsResult {
  if (input === null || input === undefined) return { ok: true, tags: [] };
  if (typeof input !== "string") return { ok: false, reason: "type" };
  if (input.length > 2000) return { ok: false, reason: "invalid" };

  const tags: string[] = [];
  for (const piece of input.split(/[\s,;]+/u)) {
    const token = piece.replace(/^#+/u, "");
    if (token === "") continue;
    const wanted = token.normalize("NFC").toLowerCase();
    // The Social scanner decides what a valid hashtag is. It must accept the WHOLE token: "a.b" would give only "a".
    const found = parseSocialTags(`#${token}`).tags;
    if (found.length !== 1 || found[0] !== wanted) return { ok: false, reason: "invalid" };
    if (!tags.includes(wanted)) tags.push(wanted);
  }
  if (tags.length > max) return { ok: false, reason: "many" };
  return { ok: true, tags };
}

/** The category chosen in the upload form: must be exactly one of photoCategories. */
export function parsePhotoCategory(input: unknown): ParseCategoryResult {
  if (typeof input !== "string") return { ok: false, reason: "type" };
  const found = photoCategories.find((key) => key === input);
  return found ? { ok: true, category: found } : { ok: false, reason: "invalid" };
}
