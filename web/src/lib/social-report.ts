// Report a Social post (SOCIAL_TODO 30). ONE transaction body: the action in social/report/actions.ts calls it.
// Rules: only a post that may be shown can be reported (the feed rule); not your own post; one report per person per
// post (a second click changes nothing); the report only goes into the admin queue, nothing is hidden by a report.
import type { Prisma } from "../../generated/prisma/client";
import { isSocialAuthorShown } from "@/lib/social-visibility";
import { checkSocialReport } from "@/lib/social-review-rules";

type Db = Prisma.TransactionClient;

export type ApplyReportResult =
  | { ok: true; created: boolean }
  | { ok: false; reason: "invalid" | "self" | "notfound" };

export async function applySocialReport(
  tx: Db,
  input: { reporterId: string; socialPostId: number; siteRule: string; reason: string },
): Promise<ApplyReportResult> {
  const post = await tx.socialPost.findUnique({
    where: { id: input.socialPostId },
    select: { id: true, authorId: true, status: true, deletedAt: true, author: { select: { status: true, deletedAt: true } } },
  });
  if (!post) return { ok: false, reason: "notfound" };
  const checked = checkSocialReport({
    reporterId: input.reporterId,
    authorId: post.authorId,
    status: post.status,
    erased: post.deletedAt !== null,
    authorShown: isSocialAuthorShown(post.author),
    siteRule: input.siteRule,
    reason: input.reason,
  });
  if ("error" in checked) return { ok: false, reason: checked.error };

  const already = await tx.report.findFirst({
    where: { reporterId: input.reporterId, socialPostId: post.id },
    select: { id: true },
  });
  if (already) return { ok: true, created: false };

  await tx.report.create({
    data: { reporterId: input.reporterId, socialPostId: post.id, siteRule: checked.siteRule, reason: checked.reason },
  });
  return { ok: true, created: true };
}
