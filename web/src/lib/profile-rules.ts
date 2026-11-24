// Plain rules for the profile (patch-profile-security). No database, no React: `npm run test:profile` runs them.
// The browser is never trusted: the server action runs these every time.
//
// Display name: one line, at most `profileConfig.displayNameMax` characters. Control characters and bidi-override
// characters are removed (they can make a name read differently from how it is stored); the joiners and direction marks
// that Sinhala, Hindi and Arabic need stay. Several spaces / a line break become one space. Empty = "no display name":
// the site then shows the username. A name that looks like the site's own or a staff name (admin, moderator, mayktop ...)
// is refused for ordinary people (site rule IMPERSONATION); staff may use it.
// Bio: at most `profileConfig.bioMax` characters, line breaks kept (three or more in a row become two). Empty = no bio.
import { profileConfig } from "../config/site";
import { cleanTypedLink, parseYouTube } from "./social-links";

const BAD_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g;
const INVISIBLE = /[\s\u200B-\u200F\u2060\uFEFF]/g;
const RAW_LIMIT = 5000;

/** Same words as RESERVED_USERNAMES in src/lib/auth.ts (copied because auth.ts loads the sign-in code; the test compares them). */
export const RESERVED_DISPLAY_NAMES = [
  "admin", "administrator", "moderator", "mod", "mods", "support", "staff", "system",
  "falvenco", "mayktop", "maykpolis", "root", "help", "official", "deleted", "anonymous",
] as const;

/** Lower case, and only letters and numbers: "A.d-m i n" and "admin" are the same word. */
export function squashName(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

const reserved = new Set<string>(RESERVED_DISPLAY_NAMES);

/** The number of characters a person sees (an emoji counts as one). */
export function charCount(value: string): number {
  return Array.from(value).length;
}

export type CleanNameResult =
  | { ok: true; name: string | null }
  | { ok: false; reason: "type" | "long" | "reserved" };

export function cleanDisplayName(input: unknown, isStaff = false): CleanNameResult {
  if (typeof input !== "string") return { ok: false, reason: "type" };
  if (input.length > RAW_LIMIT) return { ok: false, reason: "long" };
  const name = input.replace(BAD_CHARS, " ").replace(/\s+/g, " ").trim();
  if (name.replace(INVISIBLE, "").length === 0) return { ok: true, name: null };
  if (charCount(name) > profileConfig.displayNameMax) return { ok: false, reason: "long" };
  if (!isStaff && reserved.has(squashName(name))) return { ok: false, reason: "reserved" };
  return { ok: true, name };
}

export type CleanBioResult = { ok: true; bio: string | null } | { ok: false; reason: "type" | "long" };

export function cleanBio(input: unknown): CleanBioResult {
  if (typeof input !== "string") return { ok: false, reason: "type" };
  if (input.length > RAW_LIMIT) return { ok: false, reason: "long" };
  const bio = input
    .replace(/\r\n?/g, "\n")
    .replace(BAD_CHARS, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (bio.replace(INVISIBLE, "").length === 0) return { ok: true, bio: null };
  if (charCount(bio) > profileConfig.bioMax) return { ok: false, reason: "long" };
  return { ok: true, bio };
}

// ---------------------------------------------------------------- professional profile (SITE_PLAN C7)
// Profession: one line (cleaned like a display name, but no reserved-word check). Qualifications: free text, line breaks kept.
// Website and social links: only https addresses. An address typed without "https://" gets it. http:// is upgraded to https://.
// Refused: other schemes (javascript:, data: ...), a user name or password inside the address, an address that is a bare
// number (IP) or "localhost", and a name with no dot. The cleaned address is the one that is stored and shown.

export type CleanTextResult = { ok: true; value: string | null } | { ok: false; reason: "type" | "long" };

function cleanOneLine(input: unknown, max: number): CleanTextResult {
  if (typeof input !== "string") return { ok: false, reason: "type" };
  if (input.length > RAW_LIMIT) return { ok: false, reason: "long" };
  const text = input.replace(BAD_CHARS, " ").replace(/\s+/g, " ").trim();
  if (text.replace(INVISIBLE, "").length === 0) return { ok: true, value: null };
  if (charCount(text) > max) return { ok: false, reason: "long" };
  return { ok: true, value: text };
}

export function cleanProfession(input: unknown): CleanTextResult {
  return cleanOneLine(input, profileConfig.professionMax);
}

export function cleanQualifications(input: unknown): CleanTextResult {
  if (typeof input !== "string") return { ok: false, reason: "type" };
  if (input.length > RAW_LIMIT) return { ok: false, reason: "long" };
  const text = input
    .replace(/\r\n?/g, "\n")
    .replace(BAD_CHARS, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.replace(INVISIBLE, "").length === 0) return { ok: true, value: null };
  if (charCount(text) > profileConfig.qualificationsMax) return { ok: false, reason: "long" };
  return { ok: true, value: text };
}

export type CleanUrlResult = { ok: true; url: string | null } | { ok: false; reason: "type" | "long" | "invalid" };

function normaliseHttpsUrl(raw: string): URL | null {
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^[a-z0-9.-]+:\d+(\/|$)/i.test(raw) ? raw : "https://" + raw;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol === "http:") url.protocol = "https:";
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname;
  if (!host.includes(".") || host.endsWith(".")) return null;
  if (/^[\d.]+$/.test(host) || host.includes(":") || host === "localhost") return null;
  return url;
}

export function cleanWebsite(input: unknown): CleanUrlResult {
  if (typeof input !== "string") return { ok: false, reason: "type" };
  if (input.length > RAW_LIMIT) return { ok: false, reason: "long" };
  const raw = input.replace(BAD_CHARS, "").trim();
  if (raw.length === 0) return { ok: true, url: null };
  if (/\s/.test(raw)) return { ok: false, reason: "invalid" };
  const url = normaliseHttpsUrl(raw);
  if (!url) return { ok: false, reason: "invalid" };
  const href = url.href.replace(/\/$/, ""); // "https://example.com/" and "https://example.com" are the same
  if (charCount(href) > profileConfig.websiteMax) return { ok: false, reason: "long" };
  return { ok: true, url: href };
}

export type CleanVideoResult = { ok: true; url: string | null } | { ok: false; reason: "type" | "long" | "invalid" };

/** The profile video: ONE YouTube video (watch, youtu.be, shorts, embed, live). Stored in one normal form (a start time is kept), so only a checked id is ever stored. */
export function cleanProfileVideo(input: unknown): CleanVideoResult {
  if (typeof input !== "string") return { ok: false, reason: "type" };
  if (input.length > RAW_LIMIT) return { ok: false, reason: "long" };
  const raw = input.replace(BAD_CHARS, "").trim();
  if (raw.length === 0) return { ok: true, url: null };
  const typed = cleanTypedLink(raw);
  const video = typed ? parseYouTube(typed) : null;
  if (!video) return { ok: false, reason: "invalid" };
  return { ok: true, url: `https://www.youtube.com/watch?v=${video.id}${video.start > 0 ? `&t=${video.start}` : ""}` };
}

export type SocialLink = { kind: string; url: string };
export type CleanLinksResult = { ok: true; links: SocialLink[] } | { ok: false; reason: "type" | "invalid" };

function onHost(url: URL, hosts: string[]): boolean {
  const host = url.hostname.toLowerCase();
  return hosts.some((h) => host === h || host === "www." + h || host.endsWith("." + h));
}

/** Input: a list of { kind, url }. Empty addresses are dropped; one link per kind (the first wins); the order of profileConfig.socialSites is kept. */
export function cleanSocialLinks(input: unknown): CleanLinksResult {
  if (!Array.isArray(input)) return { ok: false, reason: "type" };
  if (input.length > 50) return { ok: false, reason: "invalid" };
  const found = new Map<string, string>();
  for (const item of input) {
    if (typeof item !== "object" || item === null) return { ok: false, reason: "type" };
    const { kind, url } = item as { kind?: unknown; url?: unknown };
    if (typeof kind !== "string" || typeof url !== "string") return { ok: false, reason: "type" };
    const hosts = Object.hasOwn(profileConfig.socialSites, kind) ? profileConfig.socialSites[kind] : undefined;
    if (!hosts) return { ok: false, reason: "invalid" };
    const cleaned = cleanWebsite(url);
    if (!cleaned.ok) return { ok: false, reason: "invalid" };
    if (cleaned.url === null || found.has(kind)) continue;
    const parsed = normaliseHttpsUrl(cleaned.url);
    if (!parsed || !onHost(parsed, hosts)) return { ok: false, reason: "invalid" };
    found.set(kind, cleaned.url);
  }
  const links = Object.keys(profileConfig.socialSites)
    .filter((kind) => found.has(kind))
    .map((kind) => ({ kind, url: found.get(kind) as string }));
  return { ok: true, links };
}

/** What is stored in User.socialLinks: null for none, else JSON text. */
export function serialiseSocialLinks(links: SocialLink[]): string | null {
  return links.length === 0 ? null : JSON.stringify(links);
}

/** Reads User.socialLinks for display. Never trusts the stored text: anything that is not a clean link is left out. */
export function parseSocialLinks(stored: string | null | undefined): SocialLink[] {
  if (!stored) return [];
  let data: unknown;
  try {
    data = JSON.parse(stored);
  } catch {
    return [];
  }
  const cleaned = cleanSocialLinks(data);
  return cleaned.ok ? cleaned.links : [];
}

// ---------------------------------------------------------------- sign-in security

export const PASSWORD_MIN = 8; // the same numbers as emailAndPassword in src/lib/auth.ts
export const PASSWORD_MAX = 128;

export type PasswordInputError = "short" | "long" | "same" | "type";

/** The new password: right length and not the same as the old one. (The old one is checked against the stored hash.) */
export function checkNewPassword(current: unknown, next: unknown): PasswordInputError | null {
  if (typeof current !== "string" || typeof next !== "string") return "type";
  if (next.length < PASSWORD_MIN) return "short";
  if (next.length > PASSWORD_MAX) return "long";
  if (next === current) return "same";
  return null;
}

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

export type CleanEmailResult = { ok: true; email: string } | { ok: false; reason: "type" | "invalid" | "same" };

/** A new email address: trimmed, lower case, plausible shape, at most 254 characters, different from the current one. */
export function cleanNewEmail(input: unknown, currentEmail: string): CleanEmailResult {
  if (typeof input !== "string") return { ok: false, reason: "type" };
  const email = input.trim().toLowerCase();
  if (email.length === 0 || email.length > 254 || !EMAIL_RE.test(email)) return { ok: false, reason: "invalid" };
  if (email === currentEmail.trim().toLowerCase()) return { ok: false, reason: "same" };
  return { ok: true, email };
}
