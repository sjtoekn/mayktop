"use server";

// Report a Social post (SOCIAL_TODO 30).
//  1. Nobody logged in (or the account is suspended / banned / deleting): refused with login: true.
//  2. Rate limit: socialReportConfig.reports per person (server memory; a shared limiter is TODO 50).
//  3. The rules (a post that may be shown, not your own, one report per person per post, a site rule and a written
//     reason) are in src/lib/social-report.ts. The person comes from the login cookie only. A report hides nothing:
//     it goes into the admin queue (/admin/social).
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { socialReportConfig } from "@/config/site";
import { takeActionDb } from "@/lib/rate-limit-db";
import { limitsFor } from "@/lib/account-limits";
import { applySocialReport } from "@/lib/social-report";

const reportRules = socialReportConfig.reports.map((rule) => ({ max: rule.max, windowMs: rule.windowSeconds * 1000 }));

export type SocialReportActionResult =
  | { error: true; login?: true; tooMany?: true; invalid?: true }
  | { reported: true; already: boolean };

export async function reportSocialPost(input: {
  postId: number;
  siteRule: string;
  reason: string;
}): Promise<SocialReportActionResult> {
  if (typeof input !== "object" || input === null) return { error: true };
  const { postId, siteRule, reason } = input;
  if (!Number.isSafeInteger(postId) || postId <= 0 || typeof siteRule !== "string" || typeof reason !== "string") {
    return { error: true };
  }

  const viewer = await getSessionUser();
  if (!viewer) return { error: true, login: true };

  if (!(await takeActionDb(`report:${viewer.id}`, limitsFor(reportRules, viewer))).ok) return { error: true, tooMany: true };

  // Two quick clicks can both pass the "no report yet" check; the database refuses the second row (P2002).
  // One more try then sees the first row and simply says "already reported".
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await prisma.$transaction((tx) =>
        applySocialReport(tx, { reporterId: viewer.id, socialPostId: postId, siteRule, reason }),
      );
      if (!result.ok) return result.reason === "invalid" ? { error: true, invalid: true } : { error: true };
      if (result.created) revalidatePath("/admin/social");
      return { reported: true, already: !result.created };
    } catch (error) {
      if ((error as { code?: string } | null)?.code === "P2002" && attempt === 0) continue;
      console.error("reportSocialPost failed:", error);
      return { error: true };
    }
  }
  return { error: true };
}
