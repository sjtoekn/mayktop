// Admin panel helpers (TODO 48, admin.md). The panel only shows screens; every RULE lives in
// staff.ts / review.ts / appeals.ts / moderators.ts / purge.ts and is called from there.
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { staffConfig } from "@/config/site";
import {
  AdStatus,
  AppealStatus,
  BanProposalStatus,
  ContentStatus,
  ReportStatus,
  Role,
  UserStatus,
} from "../../generated/prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

export type AdminUser = { id: string; username: string; isSuperAdmin: boolean };

/**
 * Only an ACTIVE ADMIN gets past this. Not logged in -> the login page. Logged in but not an admin ->
 * 404 (the panel does not even admit that it exists). The role is read from the database on every
 * call, never from the cookie, so removing admin rights works at once.
 */
export async function requireAdmin(): Promise<AdminUser> {
  await connection(); // read per request, never at build time
  const me = await getSessionUser();
  if (!me) redirect("/login");
  const row = await prisma.user.findUnique({
    where: { id: me.id },
    select: { id: true, username: true, role: true, status: true, isSuperAdmin: true },
  });
  if (!row || row.role !== Role.ADMIN || row.status !== UserStatus.ACTIVE) notFound();
  return { id: row.id, username: row.username, isSuperAdmin: row.isSuperAdmin };
}

/** Like requireAdmin, but only the SUPER admin gets through (everyone else sees a 404). Used by /admin/team. */
export async function requireSuperAdmin(): Promise<AdminUser> {
  const me = await requireAdmin();
  if (!me.isSuperAdmin) notFound();
  return me;
}

export type Overview = {
  totals: { users: number; communities: number; posts: number; comments: number };
  waiting: { reports: number; appeals: number; review: number; bans: number; ads: number };
};

export async function getOverview(): Promise<Overview> {
  await connection(); // counts and Date.now() are per request
  const proposalCutoff = new Date(Date.now() - staffConfig.banProposalDays * DAY_MS);
  const [users, communities, posts, comments, reports, appeals, hiddenPosts, hiddenComments, bans, ads] =
    await Promise.all([
      prisma.user.count({ where: { status: { not: UserStatus.DELETED } } }),
      prisma.community.count(),
      prisma.post.count({ where: { status: ContentStatus.VISIBLE } }),
      prisma.comment.count({ where: { status: ContentStatus.VISIBLE } }),
      prisma.report.count({ where: { status: { in: [ReportStatus.OPEN, ReportStatus.IN_REVIEW] } } }),
      prisma.appeal.count({ where: { status: AppealStatus.OPEN } }),
      prisma.post.count({ where: { status: ContentStatus.HIDDEN_PENDING_REVIEW } }),
      prisma.comment.count({ where: { status: ContentStatus.HIDDEN_PENDING_REVIEW } }),
      prisma.banProposal.count({ where: { status: BanProposalStatus.PENDING, createdAt: { gte: proposalCutoff } } }),
      prisma.adCampaign.count({ where: { status: AdStatus.SUBMITTED } }),
    ]);
  return {
    totals: { users, communities, posts, comments },
    waiting: { reports, appeals, review: hiddenPosts + hiddenComments, bans, ads },
  };
}
