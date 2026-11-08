// Hashtags and @mentions in a Social post (SOCIAL_TODO 6, patch-social-tags). Plain functions, no database, so a test can
// run them. ONE scanner is used for saving (parseSocialTags) and for showing (tokenizeSocialBody), so what is saved and
// what is linked can never disagree.
//
// Rules (PROJECT.md 8j.6, limits provisional):
//  - A hashtag is `#` + letters, numbers, `_` and combining marks (Sinhala, Hindi and Arabic need the marks and the
//    zero-width joiners). It starts with a letter or a number, has at least one LETTER (`#123` is not a tag) and is at most
//    50 characters. It must not touch a letter, number, `#`, `/`, `&`, `\` or `@` on the left: `a#b`, `page#section` in a
//    web address and `##x` are not tags. The saved form is NFC + lower case (`#Colombo` and `#colombo` are one tag).
//  - A mention is `@` + a username (lower case letters, numbers, `_`, 3-20; typed in any case, saved in lower case). It must
//    not touch a letter, number, `_`, `/` or `@` on the left (`me@example.com` and `https://x.com/@name` are not mentions) and must not be followed by more
//    username characters (a 21-character name is not cut into a shorter one).
//  - At most 10 different hashtags and 5 different mentions count in one post. The ones after that stay plain text
//    (not saved, not linked, nobody is notified): no error, nothing to flood.
export const SOCIAL_MAX_TAGS = 10;
export const SOCIAL_MAX_MENTIONS = 5;
export const SOCIAL_TAG_MAX_LENGTH = 50;

const TAG_RE = /(?<![\p{L}\p{N}\p{M}_#&/\\@])#([\p{L}\p{N}_][\p{L}\p{N}\p{M}_\u200C\u200D]*)/gu;
// No `i` flag on purpose: with the `u` flag it would also accept look-alike letters (for example U+212A KELVIN SIGN).
const MENTION_RE = /(?<![\p{L}\p{N}\p{M}_@/])@([A-Za-z0-9_]{3,20})(?![A-Za-z0-9_])/gu;
const TAG_PARAM_RE = /^[\p{L}\p{N}_][\p{L}\p{N}\p{M}_\u200C\u200D]*$/u;

export type TagMatch = { kind: "tag" | "mention"; start: number; end: number; raw: string; value: string };

function lengthOf(text: string): number {
  return [...text].length;
}

/** The saved form of a hashtag name (no `#`), or null when it cannot be a hashtag. */
function cleanTagName(name: string): string | null {
  const trimmed = name.replace(/[\u200C\u200D]+$/u, ""); // a joiner at the very end means nothing
  if (trimmed === "" || lengthOf(trimmed) > SOCIAL_TAG_MAX_LENGTH) return null;
  if (!/\p{L}/u.test(trimmed)) return null; // numbers only (#123) is not a hashtag
  return trimmed.normalize("NFC").toLowerCase();
}

/** Every hashtag and mention shape in the text, in order, WITHOUT the limits (the callers apply them). */
function scan(body: string): TagMatch[] {
  const found: TagMatch[] = [];
  for (const m of body.matchAll(TAG_RE)) {
    const value = cleanTagName(m[1]);
    if (value === null) continue;
    const start = m.index ?? 0;
    const trimmedName = m[1].replace(/[\u200C\u200D]+$/u, "");
    found.push({ kind: "tag", start, end: start + 1 + trimmedName.length, raw: "#" + trimmedName, value });
  }
  for (const m of body.matchAll(MENTION_RE)) {
    const start = m.index ?? 0;
    found.push({ kind: "mention", start, end: start + m[0].length, raw: m[0], value: m[1].toLowerCase() });
  }
  return found.sort((a, b) => a.start - b.start);
}

/** The first N different values of one kind, in the order they appear. */
function firstDistinct(matches: TagMatch[], kind: TagMatch["kind"], max: number): string[] {
  const values: string[] = [];
  for (const match of matches) {
    if (match.kind !== kind || values.includes(match.value)) continue;
    if (values.length >= max) break;
    values.push(match.value);
  }
  return values;
}

/** What to save for a post: the hashtags and the usernames mentioned (both lower case, different, within the limits). */
export function parseSocialTags(body: string): { tags: string[]; mentions: string[] } {
  const matches = scan(typeof body === "string" ? body : "");
  return {
    tags: firstDistinct(matches, "tag", SOCIAL_MAX_TAGS),
    mentions: firstDistinct(matches, "mention", SOCIAL_MAX_MENTIONS),
  };
}

export type BodySegment =
  | { kind: "text"; text: string }
  | { kind: "tag"; text: string; value: string }
  | { kind: "mention"; text: string; value: string };

/**
 * The post text cut into plain text, hashtags and mentions, for showing. Putting every `text` together gives the original
 * text back. A mention is a link only when the person was really saved as mentioned (`resolved`: accounts that exist and
 * may be shown); a hashtag is a link when it is inside the limit.
 */
export function tokenizeSocialBody(body: string, resolved: Iterable<string> = []): BodySegment[] {
  const text = typeof body === "string" ? body : "";
  const matches = scan(text);
  const tags = new Set(firstDistinct(matches, "tag", SOCIAL_MAX_TAGS));
  const mentions = new Set(firstDistinct(matches, "mention", SOCIAL_MAX_MENTIONS));
  const people = new Set(resolved);

  const segments: BodySegment[] = [];
  let at = 0;
  for (const match of matches) {
    const active = match.kind === "tag" ? tags.has(match.value) : mentions.has(match.value) && people.has(match.value);
    if (!active) continue;
    if (match.start > at) segments.push({ kind: "text", text: text.slice(at, match.start) });
    segments.push({ kind: match.kind, text: text.slice(match.start, match.end), value: match.value });
    at = match.end;
  }
  if (at < text.length) segments.push({ kind: "text", text: text.slice(at) });
  return segments;
}

/** The hashtag from the address (`/social/tag/<tag>`): any case, with or without `#`, percent-encoded or not. Null = not a hashtag. */
export function parseTagParam(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let text = raw;
  try {
    text = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (text.startsWith("#")) text = text.slice(1);
  if (!TAG_PARAM_RE.test(text)) return null;
  return cleanTagName(text);
}

/** The address of the page of one hashtag (the name is already in its saved form). */
export function tagHref(tag: string): string {
  return `/social/tag/${encodeURIComponent(tag)}`;
}
