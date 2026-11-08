// Report a Social REPLY or a Social ACCOUNT (patch-social-report-more). ONE transaction body each: the actions in
// social/report/more-actions.ts call them. Same ideas as src/lib/social-report.ts (posts): what a person cannot see they
// cannot report, not yourself, ONE report per person per target (a second click changes nothing), and a report alone
// hides nothing: it only goes into the admin queue (/admin/social).
import type { Prisma } from "../../generated/prisma/client";
import { isSocialAuthorShown } from "@/lib/social-visibility";
import { checkSocialAccountReport, checkSocialReplyReport } from "@/lib/social-report-more-rules";
import type { ApplyReportResult } from "@/lib/social-report";

type Db = Prisma.TransactionClient;

export async function applySocialReplyReport(
  tx: Db,
  input: { reporterId: string; socialReplyId: number; siteRule: string; reason: string },
): Promise<ApplyReportResult> {
  const reply = await tx.socialReply.findUnique({
    where: { id: input.socialReplyId },
    select: {
      id: true,
      authorId: true,
      status: true,
      deletedAt: true,
      author: { select: { status: true, deletedAt: true } },
      socialPost: { select: { status: true, deletedAt: true, author: { select: { status: true, deletedAt: true } } } },
    },
  });
  if (!reply) return { ok: false, reason: "notfound" };
  const parent = reply.socialPost;
  const checked = checkSocialReplyReport({
    reporterId: input.reporterId,
    authorId: reply.authorId,
    status: reply.status,
    erased: reply.deletedAt !== null,
    authorShown: isSocialAuthorShown(reply.author),
    parentShown: parent.status === "VISIBLE" && parent.deletedAt === null && isSocialAuthorShown(parent.author),
    siteRule: input.siteRule,
    reason: input.reason,
  });
  if ("error" in checked) return { ok: false, reason: checked.error };

  const already = await tx.report.findFirst({
    where: { reporterId: input.reporterId, socialReplyId: reply.id },
    select: { id: true },
  });
  if (already) return { ok: true, created: false };

  await tx.report.create({
    data: { reporterId: input.reporterId, socialReplyId: reply.id, siteRule: checked.siteRule, reason: checked.reason },
  });
  return { ok: true, created: true };
}

export async function applySocialAccountReport(
  tx: Db,
  input: { reporterId: string; username: string; siteRule: string; reason: string },
): Promise<ApplyReportResult> {
  const user = await tx.user.findUnique({
    where: { username: input.username },
    select: { id: true, status: true, deletedAt: true },
  });
  if (!user) return { ok: false, reason: "notfound" };
  const checked = checkSocialAccountReport({
    reporterId: input.reporterId,
    reportedId: user.id,
    shown: isSocialAuthorShown(user),
    siteRule: input.siteRule,
    reason: input.reason,
  });
  if ("error" in checked) return { ok: false, reason: checked.error };

  const already = await tx.report.findFirst({
    where: { reporterId: input.reporterId, reportedUserId: user.id },
    select: { id: true },
  });
  if (already) return { ok: true, created: false };

  await tx.report.create({
    data: { reporterId: input.reporterId, reportedUserId: user.id, siteRule: checked.siteRule, reason: checked.reason },
  });
  return { ok: true, created: true };
}
