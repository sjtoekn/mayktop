// The number in /social/<id> (SOCIAL_TODO 14). Pure function: a test runs it without a database.
// Only the plain canonical form is accepted ("12", not "012", "1e3", "12.0", " 12", "+12"), so a post has ONE address.
export const MAX_SOCIAL_ID = 2_147_483_647; // the database column is a 32-bit integer

/** The post number, or null when the text is not a valid post number. */
export function parseSocialPostId(raw: unknown): number | null {
  if (typeof raw !== "string" || !/^[1-9]\d{0,9}$/.test(raw)) return null;
  const id = Number(raw);
  return id <= MAX_SOCIAL_ID ? id : null;
}
