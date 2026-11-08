// Checks and cleans the text of a Social post (SOCIAL_TODO 10). Pure function: the server action calls it,
// and a test runs it without a database. The browser is not trusted, so this runs on the server every time.
//
// What it does:
//  - the value must be a string (and not absurdly long: more than 20,000 is refused before anything else)
//  - line endings become "\n"
//  - control characters (NUL and the like) are removed, except the new line and the tab
//  - bidi override / isolate characters (U+202A-202E, U+2066-2069) are removed: they can make text read
//    differently from how it is stored. The ordinary left-to-right / right-to-left marks stay (Arabic, Hebrew need them),
//    and so do the zero-width joiners (U+200C, U+200D) that Sinhala, Hindi and Persian need.
//  - more than two empty lines in a row become two
//  - spaces at the start and end are removed
//  - a post with no visible character (only spaces, new lines, zero-width characters) is "empty"
//  - at most 5,000 characters (same count as the form's counter)
export const SOCIAL_MAX_BODY = 5000;
const RAW_LIMIT = 20_000;

export type CleanBodyResult =
  | { ok: true; body: string }
  | { ok: false; reason: "type" | "empty" | "long" };

export function cleanSocialBody(input: unknown): CleanBodyResult {
  if (typeof input !== "string") return { ok: false, reason: "type" };
  if (input.length > RAW_LIMIT) return { ok: false, reason: "long" };

  const body = input
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();

  if (body.replace(/[\s\u200B-\u200F\u2060\uFEFF]/g, "").length === 0) return { ok: false, reason: "empty" };
  if (body.length > SOCIAL_MAX_BODY) return { ok: false, reason: "long" };
  return { ok: true, body };
}
