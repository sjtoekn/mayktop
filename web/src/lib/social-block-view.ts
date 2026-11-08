// Block and Mute: the reads for one logged-in person (SOCIAL_TODO A7, patch-social-block). The shared feed caches hold no
// personal data (queries.ts), so Block / Mute are applied AFTER the cache, per request, with these two functions and the
// pure `dropHiddenItems` / `dropHiddenAuthors` in social-block-rules.ts. Never call them from inside a cached function.
// If the database fails the page fails (it never "fails open" and shows what the person blocked).
import { prisma } from "@/lib/prisma";
import { makeHiddenAuthors, type BlockRelation, type HiddenAuthors } from "@/lib/social-block-rules";

/** Usernames whose posts this person must not see: people they blocked, people who blocked them, people they muted. */
export async function loadHiddenAuthors(viewerId: string | null): Promise<HiddenAuthors> {
  // A visitor (not logged in) has no Block / Mute lists: nothing is hidden for them.
  if (viewerId === null) return makeHiddenAuthors({ blockedByMe: [], blockedMe: [], mutedByMe: [] });
  const [blockedByMe, blockedMe, mutedByMe] = await Promise.all([
    prisma.socialBlock.findMany({ where: { blockerId: viewerId }, select: { blocked: { select: { username: true } } } }),
    prisma.socialBlock.findMany({ where: { blockedId: viewerId }, select: { blocker: { select: { username: true } } } }),
    prisma.socialMute.findMany({ where: { muterId: viewerId }, select: { muted: { select: { username: true } } } }),
  ]);
  return makeHiddenAuthors({
    blockedByMe: blockedByMe.map((row) => row.blocked.username),
    blockedMe: blockedMe.map((row) => row.blocker.username),
    mutedByMe: mutedByMe.map((row) => row.muted.username),
  });
}

/** What the lists say about ONE other person (the profile page). */
export async function getBlockRelation(viewerId: string, otherId: string): Promise<BlockRelation> {
  const [mine, theirs, muted] = await Promise.all([
    prisma.socialBlock.findUnique({ where: { blockerId_blockedId: { blockerId: viewerId, blockedId: otherId } }, select: { blockerId: true } }),
    prisma.socialBlock.findUnique({ where: { blockerId_blockedId: { blockerId: otherId, blockedId: viewerId } }, select: { blockerId: true } }),
    prisma.socialMute.findUnique({ where: { muterId_mutedId: { muterId: viewerId, mutedId: otherId } }, select: { muterId: true } }),
  ]);
  return { blockedByMe: mine !== null, blockedMe: theirs !== null, mutedByMe: muted !== null };
}
