"use server";

// Join / leave a community (TODO 34).
//
// Uses the existing `Membership` table (one row per person per community, no migration).
// The pages are cached and shared, so "am I a member?" is not part of the page: the Join
// button asks getMyMembership() after the page opens (like the highlighted vote arrows).
// A person can only change their OWN membership; the server checks who is logged in.
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { MemberRole } from "../../../../../generated/prisma/client";

const SLUG = /^[a-z0-9][a-z0-9_-]{0,49}$/;

export type MembershipState = { loggedIn: boolean; member: boolean };

export type SetMembershipResult =
  | { ok: true; member: boolean }
  | { error: true; login?: true; moderator?: true };

async function findCommunityId(slug: unknown): Promise<number | null> {
  if (typeof slug !== "string" || !SLUG.test(slug)) return null;
  const community = await prisma.community.findFirst({
    where: { slug, archivedAt: null },
    select: { id: true },
  });
  return community?.id ?? null;
}

/** Is the logged-in person a member of this community? Nobody logged in: not a member. */
export async function getMyMembership(slug: string): Promise<MembershipState> {
  const user = await getSessionUser();
  if (!user) return { loggedIn: false, member: false };
  try {
    const communityId = await findCommunityId(slug);
    if (communityId === null) return { loggedIn: true, member: false };
    const row = await prisma.membership.findUnique({
      where: { userId_communityId: { userId: user.id, communityId } },
      select: { userId: true },
    });
    return { loggedIn: true, member: row !== null };
  } catch (error) {
    console.error("getMyMembership failed:", error);
    return { loggedIn: true, member: false };
  }
}

/** Join (join: true) or leave (join: false). Joining twice or leaving twice is harmless. */
export async function setMembership(input: {
  slug: string;
  join: boolean;
}): Promise<SetMembershipResult> {
  if (typeof input?.slug !== "string" || typeof input.join !== "boolean") return { error: true };

  const user = await getSessionUser();
  if (!user) return { error: true, login: true };

  try {
    const communityId = await findCommunityId(input.slug);
    if (communityId === null) return { error: true };
    const key = { userId_communityId: { userId: user.id, communityId } };

    if (input.join) {
      await prisma.membership.upsert({
        where: key,
        create: { userId: user.id, communityId },
        update: {},
      });
    } else {
      const existing = await prisma.membership.findUnique({ where: key, select: { role: true } });
      // A moderator cannot just walk away (the community would be left without one).
      // Handing over moderation comes with the moderator tools in Phase 3.
      if (existing && existing.role !== MemberRole.MEMBER) return { error: true, moderator: true };
      await prisma.membership.deleteMany({ where: { userId: user.id, communityId } });
    }
  } catch (error) {
    console.error("setMembership failed:", error);
    return { error: true };
  }

  updateTag("communities"); // the member count is cached (see lib/queries.ts)
  return { ok: true, member: input.join };
}
