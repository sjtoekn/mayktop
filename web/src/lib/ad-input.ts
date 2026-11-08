// Checks and cleans what an advertiser typed in the "Create an ad" form (ADS_PLAN Session 3).
// Pure functions: no database, no React, so `npm run test:ad-input` can run them. The browser is not trusted:
// the server action calls cleanAdInput() on every save, whatever the form already checked.
//
// What is checked (numbers and word lists live in `adsConfig`, src/config/site.ts):
//  - format: must be one of adsConfig.formats AND open today (adsConfig.formatsOpen: only TEXT until Session 3b)
//  - slot: SIDEBAR or FEED
//  - title / text: one line each, control and bidi-override characters removed, length limits, no web address inside
//    (the link goes in the link field, where it is checked), no phrase from adsConfig.blockedPhrases
//  - link: a full https:// address of a public website (no login in the address, no localhost, no number-only host)
//  - contact email: simple shape check
//  - earliest start date (optional): from today up to adsConfig.submit.maxStartDaysAhead days ahead, UTC
//  - the "I checked the rules" tick
// This is only a FIRST filter. Every ad is still read by an admin before it runs (ad-review.ts).
import { adsConfig } from "../config/site";

export type AdInputError =
  | "type" // something is not the kind of value it must be
  | "format" // format unknown or not open yet
  | "slot"
  | "title"
  | "body"
  | "textlink" // a web address inside the title or text
  | "words" // a blocked phrase (see `phrase` in the result)
  | "url"
  | "email"
  | "start"
  | "agree";

export type CleanAd = {
  format: (typeof adsConfig.formats)[number];
  slot: (typeof adsConfig.slots)[number];
  communitySlug: string | null; // null = any page; the server checks that the community exists
  title: string;
  body: string;
  destinationUrl: string;
  contactEmail: string;
  startDate: Date | null; // UTC midnight, or null = starts when the payment arrives
};

export type CleanAdResult =
  | { ok: true; value: CleanAd }
  | { ok: false; error: AdInputError; phrase?: string };

const RAW_LIMIT = 5_000;
// control characters, and the bidi override / isolate characters that make text read differently from how it is stored
const BAD_CHARS = /[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g;
const INVISIBLE = /[\s\u200B-\u200F\u2060\uFEFF]/g;
const DAY_MS = 24 * 60 * 60 * 1000;

/** One line of text: bad characters out, any run of spaces / new lines becomes one space, ends trimmed. */
export function cleanLine(input: string): string {
  return input.replace(BAD_CHARS, " ").replace(/\s+/g, " ").trim();
}

function hasVisible(text: string): boolean {
  return text.replace(INVISIBLE, "").length > 0;
}

/** Lower case, accents kept, every run of spaces one space: used to find blocked phrases. */
function forMatching(text: string): string {
  return text.toLowerCase().replace(/[\u200B-\u200F\u2060\uFEFF]/g, "").replace(/\s+/g, " ");
}

/** The first blocked phrase found in the text, or null. */
export function findBlockedPhrase(text: string, phrases: readonly string[] = adsConfig.blockedPhrases): string | null {
  const hay = forMatching(text);
  for (const phrase of phrases) {
    if (hay.includes(forMatching(phrase))) return phrase;
  }
  return null;
}

/** True when the text holds something that looks like a web address. */
export function hasWebAddress(text: string): boolean {
  return /https?:\/\/|www\.|\b[a-z0-9-]{2,}\.(com|net|org|lk)\b/i.test(text);
}

/** A full https:// address of a public website, or null. The returned text is the address as the URL parser writes it. */
export function cleanHttpsUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (raw.length === 0 || raw.length > adsConfig.urlMaxLength || /\s/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null; // https://trusted.com@evil.com style tricks
  const host = url.hostname.toLowerCase();
  if (host.startsWith("[")) return null; // IPv6 address
  if (!host.includes(".")) return null; // localhost, intranet names
  if (/^\d+(\.\d+){3}$/.test(host)) return null; // a bare IPv4 address
  if (host.endsWith(".local") || host.endsWith(".localhost") || host.endsWith(".internal")) return null;
  if (url.port && url.port !== "443") return null;
  return url.toString();
}

export function cleanEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const email = input.trim();
  if (email.length === 0 || email.length > 254) return null;
  if (/[\u0000-\u001F\u007F\s,;<>()]/.test(email)) return null;
  return /^[^@]+@[^@.][^@]*\.[^@.]{2,}$/.test(email) ? email : null;
}

/** "2026-12-01" -> that day at UTC midnight, or null when it is not a real date. */
export function parseDay(input: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return date.getUTCFullYear() === Number(m[1]) && date.getUTCMonth() === Number(m[2]) - 1 && date.getUTCDate() === Number(m[3])
    ? date
    : null;
}

/** Checks one form. Returns the cleaned ad, or the FIRST problem found. `now` is a parameter so a test can fix the date. */
export function cleanAdInput(input: unknown, now: Date = new Date()): CleanAdResult {
  if (typeof input !== "object" || input === null) return { ok: false, error: "type" };
  const raw = input as Record<string, unknown>;
  for (const key of ["format", "slot", "community", "title", "body", "url", "email", "start"]) {
    if (typeof raw[key] !== "string" || (raw[key] as string).length > RAW_LIMIT) return { ok: false, error: "type" };
  }
  if (raw.agree !== true) return { ok: false, error: "agree" };

  const format = (adsConfig.formats as readonly string[]).includes(raw.format as string) ? (raw.format as CleanAd["format"]) : null;
  if (!format || !(adsConfig.formatsOpen as readonly string[]).includes(format)) return { ok: false, error: "format" };

  const slot = (adsConfig.slots as readonly string[]).includes(raw.slot as string) ? (raw.slot as CleanAd["slot"]) : null;
  if (!slot) return { ok: false, error: "slot" };
  // The header banner is a wide PICTURE: no text-only or video ads there.
  if (slot === "HEADER" && format !== "IMAGE") return { ok: false, error: "format" };

  const communityRaw = (raw.community as string).trim().toLowerCase();
  if (communityRaw !== "" && !/^[a-z0-9-]{1,40}$/.test(communityRaw)) return { ok: false, error: "type" };

  const title = cleanLine(raw.title as string);
  if (!hasVisible(title) || title.length < adsConfig.titleMinLength || title.length > adsConfig.titleMaxLength) {
    return { ok: false, error: "title" };
  }
  const body = cleanLine(raw.body as string);
  if (!hasVisible(body) || body.length < adsConfig.bodyMinLength || body.length > adsConfig.bodyMaxLength) {
    return { ok: false, error: "body" };
  }
  if (hasWebAddress(title) || hasWebAddress(body)) return { ok: false, error: "textlink" };
  const phrase = findBlockedPhrase(`${title} ${body}`);
  if (phrase) return { ok: false, error: "words", phrase };

  const destinationUrl = cleanHttpsUrl(raw.url);
  if (!destinationUrl) return { ok: false, error: "url" };

  const contactEmail = cleanEmail(raw.email);
  if (!contactEmail) return { ok: false, error: "email" };

  let startDate: Date | null = null;
  const startRaw = (raw.start as string).trim();
  if (startRaw !== "") {
    startDate = parseDay(startRaw);
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    if (!startDate || startDate.getTime() < today || startDate.getTime() > today + adsConfig.submit.maxStartDaysAhead * DAY_MS) {
      return { ok: false, error: "start" };
    }
  }

  return {
    ok: true,
    value: { format, slot, communitySlug: communityRaw === "" || slot === "SOCIAL_FEED" ? null : communityRaw, title, body, destinationUrl, contactEmail, startDate },
  };
}

/**
 * May this person send one more ad now? `waiting` = their ads that are SUBMITTED (not decided yet),
 * `lastDay` = ads they created in the last 24 hours (any status). Both numbers come from the database.
 */
export function checkSubmitLimits(waiting: number, lastDay: number): "ok" | "waiting" | "day" {
  if (waiting >= adsConfig.submit.maxWaiting) return "waiting";
  if (lastDay >= adsConfig.submit.maxPerDay) return "day";
  return "ok";
}
