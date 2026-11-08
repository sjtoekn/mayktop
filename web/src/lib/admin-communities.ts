// Admin Part 7 (Communities & moderators): the data for the screen. No rule lives here. "Large", the limit and the
// over-limit list come from moderators-rules.ts / moderators.ts (isLarge, findOverLimit); appointing and removing are
// done by appointModerator / removeModerator. This file only READS and puts it in a shape the screen can show.
import { prisma } from "@/lib/prisma";
import { modConfig } from "@/config/site";
import { isLarge } from "@/lib/moderators-rules";
import { findOverLimit, type OverLimit } from "@/lib/moderators";
import { MemberRole } from "../../generated/prisma/client";

export type CommunityMod = { person: string; since: Date };
export type CommunityRow = {
  slug: string;
  name: string;
  members: number;
  large: boolean;
  mods: CommunityMod[];
};
export type CommunitiesView = {
  communities: CommunityRow[];
  overLimit: OverLimit[];
  threshold: number; // modConfig.largeMemberThreshold
  max: number; // modConfig.maxLargeCommunities
};

/** Every community that is not archived: members, large or small, and its moderators. Biggest first. */
export async function loadCommunities(): Promise<CommunitiesView> {
  const [communities, counts, modRows, overLimit] = await Promise.all([
    prisma.community.findMany({ where: { archivedAt: null }, select: { id: true, slug: true, name: true } }),
    prisma.membership.groupBy({ by: ["communityId"], _count: { _all: true } }),
    prisma.membership.findMany({
      where: { role: MemberRole.MODERATOR, community: { archivedAt: null } },
      orderBy: { joinedAt: "asc" },
      select: { communityId: true, joinedAt: true, user: { select: { username: true } } },
    }),
    findOverLimit(),
  ]);

  const members = new Map(counts.map((c) => [c.communityId, c._count._all]));
  const mods = new Map<number, CommunityMod[]>();
  for (const m of modRows) {
    const list = mods.get(m.communityId) ?? [];
    list.push({ person: m.user.username, since: m.joinedAt });
    mods.set(m.communityId, list);
  }

  const rows: CommunityRow[] = communities.map((c) => {
    const count = members.get(c.id) ?? 0;
    return {
      slug: c.slug,
      name: c.name,
      members: count,
      large: isLarge(count, modConfig.largeMemberThreshold),
      mods: mods.get(c.id) ?? [],
    };
  });
  rows.sort((a, b) => b.members - a.members || a.slug.localeCompare(b.slug));

  return {
    communities: rows,
    overLimit,
    threshold: modConfig.largeMemberThreshold,
    max: modConfig.maxLargeCommunities,
  };
}
