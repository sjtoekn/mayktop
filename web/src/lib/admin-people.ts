// Admin panel, Part 2 (People): the data behind /admin/people. Reading only; every ACTION on a person
// goes through staff.ts (suspendUser, liftSuspension, makeAdmin, removeAdmin), never through here.
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffConfig } from "@/config/site";
import { isSystemActor } from "@/lib/purge-rules";
import { AuditTarget, Role, UserStatus, type Prisma } from "../../generated/prisma/client";

export const PAGE_SIZE = 25;
export const PEOPLE_STATUSES = ["ACTIVE", "SUSPENDED", "DELETION_PENDING", "DELETED"] as const;
export const PEOPLE_ROLES = ["USER", "MODERATOR", "ADMIN"] as const;
export type PeopleStatus = (typeof PEOPLE_STATUSES)[number];
export type PeopleRole = (typeof PEOPLE_ROLES)[number];

export type PeopleQuery = { q: string; status: PeopleStatus | ""; role: PeopleRole | ""; page: number };

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Turns the address (?q=&status=&role=&page=) into a safe query. Unknown values are ignored. */
export function parsePeopleQuery(sp: Record<string, string | string[] | undefined>): PeopleQuery {
  const status = one(sp.status);
  const role = one(sp.role);
  const page = Number.parseInt(one(sp.page), 10);
  return {
    q: one(sp.q).trim().slice(0, 100),
    status: (PEOPLE_STATUSES as readonly string[]).includes(status) ? (status as PeopleStatus) : "",
    role: (PEOPLE_ROLES as readonly string[]).includes(role) ? (role as PeopleRole) : "",
    page: Number.isInteger(page) && page >= 1 && page <= 100000 ? page : 1,
  };
}

export type PersonRow = {
  username: string;
  displayName: string | null;
  email: string;
  role: Role;
  status: UserStatus;
  banned: boolean; // suspended with kind BAN
  createdAt: Date;
};

export async function listPeople(query: PeopleQuery) {
  await connection();
  const where: Prisma.UserWhereInput = {};
  if (query.q) where.OR = [{ username: { contains: query.q } }, { email: { contains: query.q } }];
  if (query.status) where.status = query.status;
  if (query.role) where.role = query.role;

  const total = await prisma.user.count({ where });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(query.page, pages);
  const rows = await prisma.user.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { username: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: { username: true, displayName: true, email: true, role: true, status: true, suspensionKind: true, createdAt: true },
  });
  const people: PersonRow[] = rows.map((r) => ({
    username: r.username,
    displayName: r.displayName,
    email: r.email,
    role: r.role,
    status: r.status,
    banned: r.status === UserStatus.SUSPENDED && r.suspensionKind === "BAN",
    createdAt: r.createdAt,
  }));
  return { people, total, pages, page };
}

export type PersonDetail = {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  verified: boolean; // has the "verified" badge (SITE_PLAN C7)
  email: string;
  role: Role;
  isSuperAdmin: boolean;
  status: UserStatus;
  banned: boolean;
  suspendedUntil: Date | null;
  suspensionNote: string | null;
  eraseAt: Date | null;
  createdAt: Date;
  posts: number;
  comments: number;
  history: { id: number; createdAt: Date; action: string; siteRule: string | null; reason: string | null; by: string | null }[]; // by = null: the purge job (system actor)
};

export async function getPerson(username: string): Promise<PersonDetail | null> {
  await connection();
  const user = await prisma.user.findUnique({
    where: { username: username.trim().toLowerCase() },
    select: {
      id: true, username: true, displayName: true, bio: true, verifiedAt: true, email: true, role: true, isSuperAdmin: true, status: true, suspensionKind: true,
      suspendedUntil: true, suspensionNote: true, eraseAt: true, createdAt: true,
    },
  });
  if (!user) return null;
  const [posts, comments, history] = await Promise.all([
    prisma.post.count({ where: { authorId: user.id, deletedAt: null } }),
    prisma.comment.count({ where: { authorId: user.id, deletedAt: null } }),
    prisma.auditLog.findMany({
      where: { targetType: AuditTarget.USER, targetId: user.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
      select: { id: true, createdAt: true, action: true, siteRule: true, reason: true, actorId: true, actor: { select: { username: true } } },
    }),
  ]);
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    verified: user.verifiedAt !== null,
    email: user.email,
    role: user.role,
    isSuperAdmin: user.isSuperAdmin,
    status: user.status,
    banned: user.status === UserStatus.SUSPENDED && user.suspensionKind === "BAN",
    suspendedUntil: user.suspendedUntil,
    suspensionNote: user.suspensionNote,
    eraseAt: user.eraseAt,
    createdAt: user.createdAt,
    posts,
    comments,
    history: history.map((h) => ({
      id: h.id,
      createdAt: h.createdAt,
      action: h.action,
      siteRule: h.siteRule,
      reason: h.reason,
      by: isSystemActor(h.actorId) ? null : h.actor.username,
    })),
  };
}

/** Days left before an open ban proposal lapses (never below 0). Kept here, not in a page, because it reads the clock. */
export function proposalDaysLeft(createdAt: Date): number {
  const spent = (Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000);
  return Math.max(0, Math.ceil(staffConfig.banProposalDays - spent));
}

export type PersonAction = "edit" | "suspend" | "lift" | "makeAdmin" | "removeAdmin" | "proposeBan" | "erase" | "verify" | "unverify";

/**
 * Which buttons to show. The rules themselves are enforced again in staff.ts / admin-edit.ts when the button is used.
 * "Make admin", "Remove admin" and "Erase now" are shown ONLY to the super admin; a super admin can never be removed or erased.
 * "Edit" is for any admin, on a plain user who is not erased (never on staff, never on yourself).
 */
export function actionsFor(
  person: Pick<PersonDetail, "role" | "status" | "banned" | "isSuperAdmin" | "verified">,
  isSelf: boolean,
  viewerIsSuper: boolean,
): PersonAction[] {
  if (isSelf) return [];
  if (person.role === Role.ADMIN) return viewerIsSuper && !person.isSuperAdmin ? ["removeAdmin"] : [];
  if (person.role !== Role.USER) return [];
  if (person.status === UserStatus.DELETED) return [];
  const out: PersonAction[] = ["edit"];
  if (person.status === UserStatus.ACTIVE) {
    out.push("suspend", "proposeBan");
    out.push(person.verified ? "unverify" : "verify");
    if (viewerIsSuper) out.push("makeAdmin");
  } else if (person.status === UserStatus.SUSPENDED) {
    // A ban can be proposed for an active person, one waiting for deletion, or one under a TEMPORARY suspension.
    out.push("lift");
    if (person.verified) out.push("unverify");
    if (!person.banned) out.push("proposeBan");
  } else if (person.status === UserStatus.DELETION_PENDING) {
    out.push("proposeBan");
  }
  if (viewerIsSuper) out.push("erase");
  return out;
}

export type AdminRow = { username: string; displayName: string | null; isSuperAdmin: boolean; since: Date };

/** Everyone who is an active admin (the team list on /admin/team). Super admin first. */
export async function listAdmins(): Promise<AdminRow[]> {
  await connection();
  const rows = await prisma.user.findMany({
    where: { role: Role.ADMIN, status: UserStatus.ACTIVE },
    orderBy: [{ isSuperAdmin: "desc" }, { username: "asc" }],
    select: { username: true, displayName: true, isSuperAdmin: true, updatedAt: true },
  });
  return rows.map((r) => ({ username: r.username, displayName: r.displayName, isSuperAdmin: r.isSuperAdmin, since: r.updatedAt }));
}
