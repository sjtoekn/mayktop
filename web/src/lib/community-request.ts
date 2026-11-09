// Member asks -> admin decides. Nothing is a Community until an admin approves.
//  - submitCommunityRequest: a logged-in person sends name, /c/slug, description and 3-5 rules.
//  - approveCommunityRequest: ONE transaction creates the community, its rules and the requester as its MODERATOR.
//  - rejectCommunityRequest: needs a written note (shown to the requester).
// Every admin decision writes an audit row (COMMUNITY_APPROVED / COMMUNITY_REJECTED).
import { prisma } from "@/lib/prisma";
import { takeActionDb } from "@/lib/rate-limit-db";
import {
  checkRequestInput, crLimits, COMMUNITY_APPROVED_NOTIFICATION, COMMUNITY_REJECTED_NOTIFICATION,
  type CommunityRule, type CrError,
} from "@/lib/community-request-rules";
import {
  AuditAction, AuditTarget, CommunityRequestStatus, MemberRole, Role, UserStatus,
} from "../../generated/prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

export type CrResult = { ok: true; slug?: string } | { error: CrError };

export async function submitCommunityRequest(user: { id: string }, raw: unknown): Promise<CrResult> {
  const checked = checkRequestInput(raw);
  if ("error" in checked) return checked;
  const input = checked.value;

  const pending = await prisma.communityRequest.count({
    where: { requesterId: user.id, status: CommunityRequestStatus.PENDING },
  });
  if (pending >= crLimits.maxPending) return { error: "pending" };

  const [community, waiting] = await Promise.all([
    prisma.community.findUnique({ where: { slug: input.slug }, select: { id: true } }),
    prisma.communityRequest.findFirst({
      where: { slug: input.slug, status: CommunityRequestStatus.PENDING },
      select: { id: true },
    }),
  ]);
  if (community || waiting) return { error: "taken" };

  const turn = await takeActionDb(`community-request:${user.id}`, [{ max: crLimits.perDay, windowMs: DAY_MS }]);
  if (!turn.ok) return { error: "limit" };

  await prisma.communityRequest.create({
    data: {
      requesterId: user.id,
      slug: input.slug,
      name: input.name,
      description: input.description,
      rules: JSON.stringify(input.rules),
    },
  });
  return { ok: true };
}

class Refused extends Error {
  constructor(public code: CrError) {
    super(code);
  }
}

export async function approveCommunityRequest(admin: { id: string }, requestId: number): Promise<CrResult> {
  try {
    const slug = await prisma.$transaction(async (tx) => {
      const req = await tx.communityRequest.findUnique({ where: { id: requestId } });
      if (!req) throw new Refused("notfound");
      if (req.status !== CommunityRequestStatus.PENDING) throw new Refused("decided");
      const person = await tx.user.findUnique({ where: { id: req.requesterId }, select: { status: true } });
      if (!person || person.status !== UserStatus.ACTIVE) throw new Refused("other");
      if (await tx.community.findUnique({ where: { slug: req.slug }, select: { id: true } })) throw new Refused("taken");

      const rules = JSON.parse(req.rules) as CommunityRule[];
      const community = await tx.community.create({
        data: {
          slug: req.slug,
          name: req.name,
          description: req.description,
          createdById: req.requesterId,
          rules: { create: rules.map((r, i) => ({ position: i + 1, sortOrder: i, title: r.title, text: r.text })) },
          memberships: { create: { userId: req.requesterId, role: MemberRole.MODERATOR } },
        },
        select: { id: true, slug: true },
      });
      await tx.communityRequest.update({
        where: { id: req.id },
        data: { status: CommunityRequestStatus.APPROVED, decidedById: admin.id, decidedAt: new Date(), communityId: community.id },
      });
      await tx.auditLog.create({
        data: {
          actorId: admin.id, actorRole: Role.ADMIN, action: AuditAction.COMMUNITY_APPROVED,
          targetType: AuditTarget.COMMUNITY, targetId: String(community.id), communityId: community.id,
        },
      });
      // Tell the requester (shows on /notifications and in the bell).
      await tx.notification.create({
        data: { recipientId: req.requesterId, actorId: admin.id, type: COMMUNITY_APPROVED_NOTIFICATION, communityRequestId: req.id },
      });
      return community.slug;
    });
    return { ok: true, slug };
  } catch (error) {
    if (error instanceof Refused) return { error: error.code };
    throw error;
  }
}

export async function rejectCommunityRequest(admin: { id: string }, requestId: number, noteRaw: string): Promise<CrResult> {
  const note = typeof noteRaw === "string" ? noteRaw.trim() : "";
  if (note.length < crLimits.noteMin || note.length > crLimits.noteMax) return { error: "note" };
  const req = await prisma.communityRequest.findUnique({ where: { id: requestId }, select: { id: true, status: true, requesterId: true } });
  if (!req) return { error: "notfound" };
  if (req.status !== CommunityRequestStatus.PENDING) return { error: "decided" };
  await prisma.$transaction([
    prisma.communityRequest.update({
      where: { id: requestId },
      data: { status: CommunityRequestStatus.REJECTED, decidedById: admin.id, decidedAt: new Date(), decisionNote: note },
    }),
    prisma.auditLog.create({
      data: {
        actorId: admin.id, actorRole: Role.ADMIN, action: AuditAction.COMMUNITY_REJECTED,
        targetType: AuditTarget.COMMUNITY, targetId: `request:${requestId}`, reason: note,
      },
    }),
    prisma.notification.create({
      data: { recipientId: req.requesterId, actorId: admin.id, type: COMMUNITY_REJECTED_NOTIFICATION, communityRequestId: requestId },
    }),
  ]);
  return { ok: true };
}

export type RequestRow = {
  id: number; slug: string; name: string; description: string; rules: CommunityRule[];
  status: CommunityRequestStatus; note: string | null; createdAt: Date; requester: string;
};

function toRow(r: {
  id: number; slug: string; name: string; description: string; rules: string; status: CommunityRequestStatus;
  decisionNote: string | null; createdAt: Date; requester: { username: string };
}): RequestRow {
  let rules: CommunityRule[] = [];
  try { rules = JSON.parse(r.rules) as CommunityRule[]; } catch { rules = []; }
  return { id: r.id, slug: r.slug, name: r.name, description: r.description, rules, status: r.status, note: r.decisionNote, createdAt: r.createdAt, requester: r.requester.username };
}

const select = {
  id: true, slug: true, name: true, description: true, rules: true, status: true, decisionNote: true, createdAt: true,
  requester: { select: { username: true } },
} as const;

/** This person's own requests, newest first. */
export async function loadMyRequests(userId: string): Promise<RequestRow[]> {
  const rows = await prisma.communityRequest.findMany({ where: { requesterId: userId }, orderBy: { createdAt: "desc" }, take: 10, select });
  return rows.map(toRow);
}

/** Admin: waiting requests (oldest first) and the last decided ones. */
export async function loadAdminRequests(): Promise<{ pending: RequestRow[]; decided: RequestRow[] }> {
  const [pending, decided] = await Promise.all([
    prisma.communityRequest.findMany({ where: { status: CommunityRequestStatus.PENDING }, orderBy: { createdAt: "asc" }, select }),
    prisma.communityRequest.findMany({ where: { status: { not: CommunityRequestStatus.PENDING } }, orderBy: { decidedAt: "desc" }, take: 15, select }),
  ]);
  return { pending: pending.map(toRow), decided: decided.map(toRow) };
}

export async function countPendingRequests(): Promise<number> {
  return prisma.communityRequest.count({ where: { status: CommunityRequestStatus.PENDING } });
}
