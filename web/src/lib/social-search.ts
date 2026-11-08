// Social search (SOCIAL_TODO B1, patch-social-search): the pure rules. No database, no imports from the app, so a test
// can run them (scripts/test-social-search.ts). The database reads are in queries.ts (searchSocialPosts, ...People, ...Tags).
//
// What the person types is turned into ONE clean search here, and the page, the queries and the tests all use it:
//  - the text is trimmed, runs of spaces become one space, control and zero-width characters are dropped, at most
//    SOCIAL_SEARCH_MAX_LENGTH characters (counted as whole characters, so Sinhala and emoji are never cut in half);
//  - at least SOCIAL_SEARCH_MIN_LENGTH characters, otherwise there is nothing to search ("short");
//  - three kinds: posts, people, hashtags (`?tab=`). With no `?tab`, a text that starts with `#` opens Hashtags and a text
//    that starts with `@` opens People, anything else opens Posts;
//  - posts: every word must be in the post text (at most SOCIAL_SEARCH_MAX_WORDS words count, the rest are ignored);
//  - people: the username or the display name contains the text (a leading `@` is ignored);
//  - hashtags: the saved form of a hashtag (a leading `#` is ignored; NFC + lower case, as in social-tags.ts).
// Order is always NEWEST first (posts, hashtags by their latest use) and for people exact name first, then names that
// start with the text, then the rest: never by popularity (the fair-ranking rule).
export const SOCIAL_SEARCH_MIN_LENGTH = 2;
export const SOCIAL_SEARCH_MAX_LENGTH = 100;
export const SOCIAL_SEARCH_MAX_WORDS = 5;
/** People and hashtag results show at most this many (no paging for them yet). */
export const SOCIAL_SEARCH_LIST_SIZE = 30;

export const SEARCH_TABS = ["posts", "people", "tags"] as const;
export type SearchTab = (typeof SEARCH_TABS)[number];

export type SocialSearch =
  | { state: "empty"; q: ""; tab: SearchTab }
  | { state: "short"; q: string; tab: SearchTab }
  | {
      state: "ready";
      /** The cleaned text, as shown back in the search box. */
      q: string;
      tab: SearchTab;
      /** Posts tab: the words that must all be in the text. */
      words: string[];
      /** People tab: the text without `@`, lower case. */
      person: string;
      /** Hashtags tab: the saved form of a hashtag name, without `#`. */
      tag: string;
    };

// Control characters, zero-width characters (but NOT U+200C / U+200D, which Sinhala, Hindi and Arabic words need),
// line and paragraph separators, and the BOM.
const STRIP_RE = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B\u2028\u2029\u2060\uFEFF]/gu;

function lengthOf(text: string): number {
  return [...text].length;
}

/** The text the person typed, cleaned (see the top of this file). Never throws; anything that is not a string is "". */
export function cleanSearchText(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const spaced = raw.replace(STRIP_RE, " ").replace(/\s+/gu, " ").trim();
  return [...spaced].slice(0, SOCIAL_SEARCH_MAX_LENGTH).join("").trim();
}

/** `?tab=` : anything unknown or repeated is "no choice" (null). */
export function parseSearchTab(raw: unknown): SearchTab | null {
  return typeof raw === "string" && (SEARCH_TABS as readonly string[]).includes(raw) ? (raw as SearchTab) : null;
}

function defaultTab(q: string): SearchTab {
  if (q.startsWith("#")) return "tags";
  if (q.startsWith("@")) return "people";
  return "posts";
}

/** The words of a post search: split on spaces, a leading `#` or `@` is kept (the post text has it too), different, at most 5. */
function postWords(q: string): string[] {
  const words: string[] = [];
  for (const word of q.split(" ")) {
    const lower = word.toLowerCase();
    if (lower === "" || words.includes(lower)) continue;
    if (words.length >= SOCIAL_SEARCH_MAX_WORDS) break;
    words.push(lower);
  }
  return words;
}

/** The saved form of a hashtag name from what was typed (`#Colombo`, `colombo`): NFC + lower case, no `#`, no spaces. */
export function searchTagName(q: string): string {
  return q.replace(/^#+/u, "").replace(/\s+/gu, "").replace(/[\u200C\u200D]+$/u, "").normalize("NFC").toLowerCase();
}

/** The username part of a people search: no `@`, lower case (usernames are saved in lower case). */
export function searchPersonName(q: string): string {
  return q.replace(/^@+/u, "").trim().toLowerCase();
}

/** ?q= and ?tab= from the address, as one search. */
export function parseSocialSearch(rawQ: unknown, rawTab: unknown): SocialSearch {
  const q = cleanSearchText(rawQ);
  const tab = parseSearchTab(rawTab) ?? defaultTab(q);
  if (q === "") return { state: "empty", q: "", tab };

  const person = searchPersonName(q);
  const tag = searchTagName(q);
  // The part that is really searched must be long enough (a lone `#` or `@` is nothing).
  const searched = tab === "people" ? person : tab === "tags" ? tag : q.replace(/^[#@]+/u, "");
  if (lengthOf(searched) < SOCIAL_SEARCH_MIN_LENGTH) return { state: "short", q, tab };

  return { state: "ready", q, tab, words: postWords(q), person, tag };
}

/** The address of a search page (the first tab, Posts, has no `?tab`; a cursor `before` is only for the posts list). */
export function searchHref(q: string, tab: SearchTab = "posts", before?: string | null): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (tab !== "posts") params.set("tab", tab);
  if (before) params.set("before", before);
  const text = params.toString();
  return text ? `/social/search?${text}` : "/social/search";
}

type Named = { username: string; displayName: string | null };

/** How well a person matches (0 = best): exact username, username starts with it, name starts with it, anything else. */
function personRank(person: Named, term: string): number {
  const username = person.username.toLowerCase();
  const name = (person.displayName ?? "").toLowerCase();
  if (username === term) return 0;
  if (username.startsWith(term)) return 1;
  if (name.startsWith(term)) return 2;
  return 3;
}

/**
 * Orders the people found: best match first, then by username (a stable, plain order; NOT by followers or activity).
 * Different people only (the first one of a username wins), at most `limit`.
 */
export function rankPeople<T extends Named>(people: T[], term: string, limit = SOCIAL_SEARCH_LIST_SIZE): T[] {
  const seen = new Set<string>();
  const unique = people.filter((person) => (seen.has(person.username) ? false : (seen.add(person.username), true)));
  return unique
    .map((person) => ({ person, rank: personRank(person, term) }))
    .sort((a, b) => a.rank - b.rank || (a.person.username < b.person.username ? -1 : a.person.username > b.person.username ? 1 : 0))
    .slice(0, limit)
    .map((entry) => entry.person);
}

/** Hashtags found, with the exact one (if it is there) first, the rest in the order given (already newest use first). */
export function rankTags(tags: string[], term: string, limit = SOCIAL_SEARCH_LIST_SIZE): string[] {
  const unique = [...new Set(tags)];
  const exact = unique.filter((tag) => tag === term);
  const rest = unique.filter((tag) => tag !== term);
  return [...exact, ...rest].slice(0, limit);
}
