// Detects the same text sent again and again (SOCIAL_TODO C2, part 3). Pure functions: no database, so a test can run them.
// The numbers live in `socialDuplicate` in src/config/site.ts.

/**
 * The text as it is compared: Unicode-normalised (NFKC), lower case, and ONLY letters, numbers and combining marks kept
 * (so spaces, line breaks, punctuation, emoji and zero-width characters are ignored). Sinhala / Hindi / Arabic letters and
 * their vowel signs are kept, so those texts compare correctly.
 */
export function normalizeForCompare(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, "");
}

/**
 * True when `body` is the same text as one of `earlierBodies` (texts the same person sent inside the time window).
 * Too-short texts are never repeats. Empty earlier texts (deleted posts keep an empty text) never match.
 */
export function isRepeat(body: string, earlierBodies: string[], minChars: number): boolean {
  const wanted = normalizeForCompare(body);
  if ([...wanted].length < minChars) return false;
  return earlierBodies.some((earlier) => normalizeForCompare(earlier) === wanted);
}
