// Checks and cleans what a person types when uploading a short (SHORTS_TODO 18): title, description, privacy.
// Pure functions: no database, no disk. The browser is not trusted, so the server action calls these every time.
// Same cleaning as photos (photo-input.ts): control characters and bidi override / isolate characters are removed, the
// zero-width joiners that Sinhala, Hindi and Persian need stay.
//  - TITLE: required, ONE line, at most SHORT_TITLE_MAX.
//  - DESCRIPTION: optional (empty / invisible only = none), new lines kept, at most SHORT_DESCRIPTION_MAX.
//  - PRIVACY: exactly one of SHORT_PRIVACY (anything else is an ERROR, never changed into another value).
import { SHORT_DESCRIPTION_MAX, SHORT_PRIVACY, SHORT_TITLE_MAX, type ShortPrivacyKey } from "@/config/short-config";

const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g;
const INVISIBLE = /[\s\u200B-\u200F\u2060\uFEFF]/g;
const RAW_LIMIT = 20_000;

export type CleanShortTitleResult = { ok: true; title: string } | { ok: false; reason: "type" | "empty" | "long" };
export type CleanShortDescriptionResult = { ok: true; description: string | null } | { ok: false; reason: "type" | "long" };
export type ParseShortPrivacyResult = { ok: true; privacy: ShortPrivacyKey } | { ok: false; reason: "type" | "invalid" };

export function cleanShortTitle(input: unknown): CleanShortTitleResult {
  if (typeof input !== "string") return { ok: false, reason: "type" };
  if (input.length > RAW_LIMIT) return { ok: false, reason: "long" };
  const title = input
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL, (c) => (c === "\t" ? " " : ""))
    .replace(/[\n\t]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
  if (title.replace(INVISIBLE, "").length === 0) return { ok: false, reason: "empty" };
  if (title.length > SHORT_TITLE_MAX) return { ok: false, reason: "long" };
  return { ok: true, title };
}

/** `null` / "" / only invisible characters = no description (not an error). */
export function cleanShortDescription(input: unknown): CleanShortDescriptionResult {
  if (input === null || input === undefined) return { ok: true, description: null };
  if (typeof input !== "string") return { ok: false, reason: "type" };
  if (input.length > RAW_LIMIT) return { ok: false, reason: "long" };
  const description = input
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  if (description.replace(INVISIBLE, "").length === 0) return { ok: true, description: null };
  if (description.length > SHORT_DESCRIPTION_MAX) return { ok: false, reason: "long" };
  return { ok: true, description };
}

export function parseShortPrivacy(input: unknown): ParseShortPrivacyResult {
  if (typeof input !== "string") return { ok: false, reason: "type" };
  return (SHORT_PRIVACY as readonly string[]).includes(input) ? { ok: true, privacy: input as ShortPrivacyKey } : { ok: false, reason: "invalid" };
}
