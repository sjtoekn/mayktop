// When may an author still edit a Social post? (SOCIAL_TODO item 6: edit window + edit history). PURE: no database, no clock of
// its own (the caller passes "now"), so a test and the page use the very same rules. The numbers are `socialEdit` in site.ts.
//
// The usual way (X / Twitter): a post can be edited for a short time after it was written, a few times only, and the earlier
// versions stay visible to everybody who can see the post, so nobody can post one thing, collect likes and swap it for another.
export type SocialEditConfig = { windowMinutes: number; maxEdits: number };

export type SocialEditCheck = { ok: true } | { ok: false; reason: "window" | "limit" };

/**
 * `createdAtMs` = when the post was written (the window never moves, an edit does NOT restart it),
 * `editsMade` = how many times it was already changed (= saved earlier versions).
 * Exactly at the end of the window the edit is still allowed.
 */
export function checkEditAllowed(
  input: { createdAtMs: number; nowMs: number; editsMade: number },
  config: SocialEditConfig,
): SocialEditCheck {
  if (input.nowMs - input.createdAtMs > config.windowMinutes * 60_000) return { ok: false, reason: "window" };
  if (input.editsMade >= config.maxEdits) return { ok: false, reason: "limit" };
  return { ok: true };
}

/** Edits still allowed by the count rule (never below 0). The time window is checked separately. */
export function editsLeft(editsMade: number, config: SocialEditConfig): number {
  return Math.max(0, config.maxEdits - Math.max(0, Math.floor(editsMade)));
}

/** The moment the window closes, in milliseconds. */
export function editWindowEndsAtMs(createdAtMs: number, config: SocialEditConfig): number {
  return createdAtMs + config.windowMinutes * 60_000;
}
