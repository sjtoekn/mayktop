// Moderators and the "shared power" limit (TODO 42, PROJECT.md principle 5 + 8h). This is the ONE place these rules live.
// Today it is called by `npm run mods` (scripts/mods.ts); the Phase 4 admin panel will call the same functions.
//
//  1. Only an ACTIVE ADMIN appoints or removes a moderator.
//  2. A written reason (min. length) is mandatory, and every change writes ONE audit-log row in the same transaction.
//  3. One person may lead at most `modConfig.maxLargeCommunities` LARGE communities (`modConfig.largeMemberThreshold` members or more).
//  4. The last moderator of a community cannot be removed (see also setMembership: a moderator cannot just leave).
//  5. Nothing is taken away silently: someone who is over the limit later (a community grew, or the limit was lowered)
//     keeps their roles; they cannot take another large community and `findOverLimit` lists them.
import { prisma } from "@/lib/prisma";
import { modConfig, staffConfig } from "@/config/site";
import { checkAppoint, checkRemove, isLarge, isOverLimit, type ModError } from "@/lib/moderators-rules";
import { cleanText } from "@/lib/review-rules";
import { AuditAction, AuditTarget, MemberRole, Role, UserStatus, type Prisma } from "../../generated/prisma/client";

export type { ModError };
export type ModResult = { ok: true; auditId: number } | { error: ModError };
type Db = Prisma.TransactionClient;

class Refused extends Error {
  constructor(public code: ModError) {
    super(code);
  }
}

async function findAdmin(username: string) {
  const u = await prisma.user.findUnique({
    where: { username: username.trim().toLowerCase() },
    select: { id: true, role: true, status: true },
  });
  return u && u.role === Role.ADMIN && u.status === UserStatus.ACTIVE ? u : null;
}

export type Led = { slug: string; members: number; large: boolean };

/** The communities (not archived) this person leads, with their member counts. */
async function communitiesLed(db: Db, userId: string): Promise<Led[]> {
  const rows = await db.membership.findMany({
    where: { userId, role: MemberRole.MODERATOR, community: { archivedAt: null } },
    select: { communityId: true, community: { select: { slug: true } } },
  });
  const out: Led[] = [];
  for (const r of rows) {
    const members = await db.membership.count({ where: { communityId: r.communityId } });
    out.push({ slug: r.community.slug, members, large: isLarge(members, modConfig.largeMemberThreshold) });
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

/** What a person leads (for `npm run mods -- led <person>`). */
export async function leadershipOf(username: string): Promise<{ led: Led[]; largeCount: number } | null> {
  const u = await prisma.user.findUnique({ where: { username: username.trim().toLowerCase() }, select: { id: true } });
  if (!u) return null;
  const led = await communitiesLed(prisma, u.id);
  return { led, largeCount: led.filter((l) => l.large).length };
}

/** An admin makes an ACTIVE person a moderator of a community. Refused when it would break the limit (rule 3). */
export async function appointModerator(input: { actor: string; community: string; person: string; reason: string }): Promise<ModResult> {
  const reason = cleanText(input.reason, staffConfig.minReasonLength, staffConfig.maxReasonLength);
  if (!reason) return { error: "reason" };
  const actor = await findAdmin(input.actor);
  if (!actor) return { error: "actor" };
  const community = await prisma.community.findFirst({
    where: { slug: input.community.trim().toLowerCase(), archivedAt: null },
    select: { id: true },
  });
  const person = await prisma.user.findUnique({
    where: { username: input.person.trim().toLowerCase() },
    select: { id: true, status: true },
  });
  if (!community || !person) return { error: "notfound" };

  try {
    const auditId = await prisma.$transaction(async (tx) => {
      // Everything is read INSIDE the transaction, so two appointments at once cannot both pass the limit.
      const members = await tx.membership.count({ where: { communityId: community.id } });
      const existing = await tx.membership.findUnique({
        where: { userId_communityId: { userId: person.id, communityId: community.id } },
        select: { role: true },
      });
      const led = await communitiesLed(tx, person.id);
      const refused = checkAppoint({
        targetActive: person.status === UserStatus.ACTIVE,
        alreadyModerator: existing?.role === MemberRole.MODERATOR,
        communityIsLarge: isLarge(members, modConfig.largeMemberThreshold),
        largeLed: led.filter((l) => l.large).length,
        max: modConfig.maxLargeCommunities,
      });
      if (refused) throw new Refused(refused);
      await tx.membership.upsert({
        where: { userId_communityId: { userId: person.id, communityId: community.id } },
        create: { userId: person.id, communityId: community.id, role: MemberRole.MODERATOR },
        update: { role: MemberRole.MODERATOR },
      });
      const row = await tx.auditLog.create({
        data: {
          actorId: actor.id, actorRole: actor.role, action: AuditAction.MODERATOR_ADDED,
          targetType: AuditTarget.USER, targetId: person.id, communityId: community.id, reason,
        },
        select: { id: true },
      });
      return row.id;
    });
    return { ok: true, auditId };
  } catch (error) {
    if (error instanceof Refused) return { error: error.code };
    throw error;
  }
}

/** An admin takes the moderator role away (the person stays a member). Never the last moderator. */
export async function removeModerator(input: { actor: string; community: string; person: string; reason: string }): Promise<ModResult> {
  const reason = cleanText(input.reason, staffConfig.minReasonLength, staffConfig.maxReasonLength);
  if (!reason) return { error: "reason" };
  const actor = await findAdmin(input.actor);
  if (!actor) return { error: "actor" };
  const community = await prisma.community.findFirst({ where: { slug: input.community.trim().toLowerCase() }, select: { id: true } });
  const person = await prisma.user.findUnique({ where: { username: input.person.trim().toLowerCase() }, select: { id: true } });
  if (!community || !person) return { error: "notfound" };

  try {
    const auditId = await prisma.$transaction(async (tx) => {
      const existing = await tx.membership.findUnique({
        where: { userId_communityId: { userId: person.id, communityId: community.id } },
        select: { role: true },
      });
      const moderatorCount = await tx.membership.count({ where: { communityId: community.id, role: MemberRole.MODERATOR } });
      const refused = checkRemove({ isModerator: existing?.role === MemberRole.MODERATOR, moderatorCount });
      if (refused) throw new Refused(refused);
      await tx.membership.update({
        where: { userId_communityId: { userId: person.id, communityId: community.id } },
        data: { role: MemberRole.MEMBER },
      });
      const row = await tx.auditLog.create({
        data: {
          actorId: actor.id, actorRole: actor.role, action: AuditAction.MODERATOR_REMOVED,
          targetType: AuditTarget.USER, targetId: person.id, communityId: community.id, reason,
        },
        select: { id: true },
      });
      return row.id;
    });
    return { ok: true, auditId };
  } catch (error) {
    if (error instanceof Refused) return { error: error.code };
    throw error;
  }
}

export type Mod = { person: string; since: Date };

/** The moderators of one community (for `npm run mods -- list <community>`). */
export async function moderatorsOf(slug: string): Promise<{ members: number; large: boolean; mods: Mod[] } | null> {
  const community = await prisma.community.findUnique({ where: { slug: slug.trim().toLowerCase() }, select: { id: true } });
  if (!community) return null;
  const members = await prisma.membership.count({ where: { communityId: community.id } });
  const rows = await prisma.membership.findMany({
    where: { communityId: community.id, role: MemberRole.MODERATOR },
    orderBy: { joinedAt: "asc" },
    select: { joinedAt: true, user: { select: { username: true } } },
  });
  return {
    members, large: isLarge(members, modConfig.largeMemberThreshold),
    mods: rows.map((r) => ({ person: r.user.username, since: r.joinedAt })),
  };
}

export type OverLimit = { person: string; large: string[] };

/** Everyone who leads MORE large communities than the limit allows (they keep them; they cannot take another). */
export async function findOverLimit(): Promise<OverLimit[]> {
  const rows = await prisma.membership.findMany({
    where: { role: MemberRole.MODERATOR, community: { archivedAt: null } },
    select: { userId: true, communityId: true, user: { select: { username: true } }, community: { select: { slug: true } } },
  });
  const counts = await prisma.membership.groupBy({ by: ["communityId"], _count: { _all: true } });
  const members = new Map(counts.map((c) => [c.communityId, c._count._all]));
  const byPerson = new Map<string, OverLimit>();
  for (const r of rows) {
    if (!isLarge(members.get(r.communityId) ?? 0, modConfig.largeMemberThreshold)) continue;
    const entry = byPerson.get(r.userId) ?? { person: r.user.username, large: [] };
    entry.large.push(r.community.slug);
    byPerson.set(r.userId, entry);
  }
  return [...byPerson.values()].filter((e) => isOverLimit(e.large.length, modConfig.maxLargeCommunities));
}
