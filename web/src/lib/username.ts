// The rules for a username, in one small file with no database and no login library, so the sign-up form,
// the login library (auth.ts) and the admin edit (admin-edit.ts) all use exactly the same rule, and tests can read it.

/** Usernames are lower case: 3-20 letters, numbers or underscores (they appear as /u/<name>). */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

/** Names that could be mistaken for staff or that the site itself uses. */
export const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "moderator", "mod", "mods", "support", "staff", "system",
  "falvenco", "mayktop", "maykpolis", "root", "help", "official", "deleted", "anonymous",
]);

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username) && !RESERVED_USERNAMES.has(username);
}
