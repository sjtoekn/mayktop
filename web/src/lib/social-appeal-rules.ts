// The small, plain rules of the SOCIAL APPEAL (SOCIAL_TODO 29, PROJECT.md 8g + 8j). No database here, so they are easy to
// test (npm run test:social-appeal). src/lib/social-appeal.ts (filing) and src/lib/appeals.ts (deciding) do the work.
//
// A Social post / reply is moderated in two steps (social-review.ts, social-reply-review.ts): one admin HIDES it, a DIFFERENT
// admin REMOVES it. The author may then appeal the REMOVAL once, within `appealConfig.windowDays`, and an admin who took part
// in neither step decides. The "may this person appeal" rule is the same as for community posts (checkFileContentAppeal in
// appeals-rules.ts); the "may this person decide" rule is checkDecideAppeal with kind "content" (a Social case has no
// community, so only admins can decide it).
// NOTE: because the hider and the remover are both excluded, deciding a Social appeal needs at least THREE active admins.

export type SocialKind = "post" | "reply";

/** "post" / "reply" from an address or a form; anything else is null. */
export function parseSocialKind(value: unknown): SocialKind | null {
  return value === "post" || value === "reply" ? value : null;
}

/** Where the author writes (and later reads the answer to) the appeal. */
export function socialAppealPath(kind: SocialKind, id: number): string {
  return `/appeal/social/${kind}/${id}`;
}

/** The Social post page; a reply lives on the page of the post under which it was written. */
export function socialViewPath(postId: number): string {
  return `/social/${postId}`;
}
