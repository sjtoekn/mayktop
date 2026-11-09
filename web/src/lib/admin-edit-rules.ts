// The small, plain rules of "an admin edits a person's profile" (admin panel, People). No database here, so they are easy
// to read and to test (npm run test:admin-edit). src/lib/admin-edit.ts does the work.
import { isValidUsername, normalizeUsername } from "./username";

export type EditField = "displayName" | "bio" | "username" | "email";
export type ProfileValues = { displayName: string | null; bio: string | null; username: string; email: string };
/** What the form sends: all four fields, as the admin left them (the form starts with the current values). */
export type ProfileInput = { displayName: string; bio: string; username: string; email: string };
export type EditProblem = "name" | "bio" | "username" | "email" | "nochange";
export type EditLimits = { maxName: number; maxBio: number };
export type EditPlan =
  | { problem: EditProblem }
  | { problem: null; data: Partial<ProfileValues>; changed: EditField[] };

const NAME_BAD = /[\u0000-\u001f\u007f]/; // no control characters, no line breaks in a name
const BIO_BAD = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/; // a bio may have line breaks, nothing else of that kind

export function looksLikeEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function length(value: string): number {
  return [...value].length; // characters, not UTF-16 units: an emoji or a Sinhala letter counts once
}

/**
 * Compares the form with the person as they are now. Only fields that really changed are checked and written
 * (an old account with a username the rules would refuse today can still have its bio edited).
 */
export function planEdit(current: ProfileValues, input: ProfileInput, limits: EditLimits): EditPlan {
  const data: Partial<ProfileValues> = {};
  const changed: EditField[] = [];

  const displayName = input.displayName.trim();
  if (displayName.length > 0 && (length(displayName) > limits.maxName || NAME_BAD.test(displayName))) return { problem: "name" };
  if ((displayName || null) !== current.displayName) {
    data.displayName = displayName || null;
    changed.push("displayName");
  }

  const bio = input.bio.replace(/\r\n/g, "\n").trim();
  if (bio.length > 0 && (length(bio) > limits.maxBio || BIO_BAD.test(bio))) return { problem: "bio" };
  if ((bio || null) !== current.bio) {
    data.bio = bio || null;
    changed.push("bio");
  }

  const username = normalizeUsername(input.username);
  if (username !== current.username) {
    if (!isValidUsername(username)) return { problem: "username" };
    data.username = username;
    changed.push("username");
  }

  const email = input.email.trim().toLowerCase();
  if (email !== current.email) {
    if (!looksLikeEmail(email)) return { problem: "email" };
    data.email = email;
    changed.push("email");
  }

  if (changed.length === 0) return { problem: "nochange" };
  return { problem: null, data, changed };
}

/** The super admin must type the person's username (with or without @) before an account is erased at once. */
export function confirmMatches(typed: string, username: string): boolean {
  return normalizeUsername(typed.trim().replace(/^@/, "")) === username;
}

/** The text of the audit row: NAMES of the fields only, never the values (audit rows are kept for good). */
export function editAuditReason(changed: EditField[], reason: string): string {
  return `Profile edited (${changed.join(", ")}): ${reason}`;
}
