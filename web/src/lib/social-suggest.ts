// Who to follow: the read (SOCIAL_TODO B7, patch-social-discover). Rules: social-discover-rules.ts, ACCOUNT_RULES.md 3.19.
// NOT cached (the answer belongs to one viewer). Never call it from inside a cached function.
// Who is looked at: people whose account is ACTIVE (a suspended account is not promoted) and who made a visible Social post in
// the last `suggestActiveDays` days, newest activity first, at most `suggestPool`. Left out: yourself, people you already follow,
// and (by the page's `hidden` set) people you blocked, who blocked you, or whom you muted.
import { prisma } from "@/lib/prisma";
import { socialLimits } from "@/config/site";
import { ContentStatus, UserStatus } from "../../generated/prisma/enums";
import { pickSuggestions, suggestSeed, type SuggestCandidate } from "@/lib/social-discover-rules";

const MAX_MY_FOLLOWING = 2000;

export async function getWhoToFollow(viewerId: string, hidden: ReadonlySet<string>, nowMs: number): Promise<SuggestCandidate[]> {
  const config = socialLimits.discover;
  try {
    const since = new Date(nowMs - config.suggestActiveDays * 86_400_000);
    // One row per author (newest activity first), counted by the database, so a busy site does not load every post.
    const active = await prisma.socialPost.groupBy({
      by: ["authorId"],
      where: {
        status: ContentStatus.VISIBLE,
        deletedAt: null,
        createdAt: { gte: since },
        author: {
          status: UserStatus.ACTIVE,
          deletedAt: null,
          id: { not: viewerId },
          followers: { none: { followerId: viewerId } },
        },
      },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: "desc" } },
      take: config.suggestPool,
    });
    if (active.length === 0) return [];
    const users = await prisma.user.findMany({
      where: { id: { in: active.map((row) => row.authorId) } },
      select: { id: true, username: true, displayName: true },
    });
    const people = users.filter((user) => !hidden.has(user.username));
    if (people.length === 0) return [];

    // "Followed by people you follow": how many of MY follows follow each candidate.
    const mine = await prisma.follow.findMany({ where: { followerId: viewerId }, select: { followingId: true }, take: MAX_MY_FOLLOWING });
    const mutualCount = new Map<string, number>();
    if (mine.length > 0) {
      const links = await prisma.follow.findMany({
        where: { followerId: { in: mine.map((row) => row.followingId) }, followingId: { in: people.map((p) => p.id) } },
        select: { followingId: true },
      });
      for (const link of links) mutualCount.set(link.followingId, (mutualCount.get(link.followingId) ?? 0) + 1);
    }

    const candidates = people.map((p) => ({ username: p.username, displayName: p.displayName, mutual: mutualCount.get(p.id) ?? 0 }));
    return pickSuggestions(candidates, { seed: suggestSeed(viewerId, nowMs), size: config.suggestSize });
  } catch (error) {
    console.error("getWhoToFollow failed:", error);
    return [];
  }
}
