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

const BAD_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g;
const INVISIBLE = /[\s\u200B-\u200F\u2060\uFEFF]/g;
const RAW_LIMIT = 5000;

/** Same words as RESERVED_USERNAMES in src/lib/auth.ts (copied because auth.ts loads the sign-in code; the test compares them). */
export const RESERVED_DISPLAY_NAMES = [
  "admin", "administrator", "moderator", "mod", "mods", "support", "staff", "system",
  "mayktop", "root", "help", "official", "deleted", "anonymous",
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
