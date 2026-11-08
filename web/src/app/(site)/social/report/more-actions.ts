"use server";

// Report a Social reply or a Social account (patch-social-report-more). Same steps as reportSocialPost in actions.ts:
//  1. Nobody logged in (or the account is suspended / banned / deleting): refused with login: true.
//  2. Rate limit: the SAME per-person limit as post reports (socialReportConfig.reports; one counter for all three kinds).
//  3. The rules are in src/lib/social-report-more-rules.ts. The person comes from the login cookie only. A report hides
//     nothing: it goes into the admin queue (/admin/social).
import { revalidatePath } from "next/cache";
import type { Prisma } from "../../../../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { socialReportConfig } from "@/config/site";
import { takeAction } from "@/lib/social-limits";
import { applySocialAccountReport, applySocialReplyReport } from "@/lib/social-report-more";
import type { ApplyReportResult } from "@/lib/social-report";

const reportRules = socialReportConfig.reports.map((rule) => ({ max: rule.max, windowMs: rule.windowSeconds * 1000 }));

export type SocialReportMoreResult =
  | { error: true; login?: true; tooMany?: true; invalid?: true }
  | { reported: true; already: boolean };

async function run(
  reporterId: string,
  work: (tx: Prisma.TransactionClient) => Promise<ApplyReportResult>,
  label: string,
): Promise<SocialReportMoreResult> {
  // Two quick clicks can both pass the "no report yet" check; the database refuses the second row (P2002).
  // One more try then sees the first row and simply says "already reported".
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await prisma.$transaction((tx) => work(tx));
      if (!result.ok) return result.reason === "invalid" ? { error: true, invalid: true } : { error: true };
      if (result.created) revalidatePath("/admin/social");
      return { reported: true, already: !result.created };
    } catch (error) {
      if ((error as { code?: string } | null)?.code === "P2002" && attempt === 0) continue;
      console.error(`${label} failed (reporter ${reporterId}):`, error);
      return { error: true };
    }
  }
  return { error: true };
}

export async function reportSocialReply(input: {
  replyId: number;
  siteRule: string;
  reason: string;
}): Promise<SocialReportMoreResult> {
  if (typeof input !== "object" || input === null) return { error: true };
  const { replyId, siteRule, reason } = input;
  if (!Number.isSafeInteger(replyId) || replyId <= 0 || typeof siteRule !== "string" || typeof reason !== "string") {
    return { error: true };
  }
  const viewer = await getSessionUser();
  if (!viewer) return { error: true, login: true };
  if (!takeAction(`report:${viewer.id}`, reportRules).ok) return { error: true, tooMany: true };
  return run(viewer.id, (tx) => applySocialReplyReport(tx, { reporterId: viewer.id, socialReplyId: replyId, siteRule, reason }), "reportSocialReply");
}

export async function reportSocialAccount(input: {
  username: string;
  siteRule: string;
  reason: string;
}): Promise<SocialReportMoreResult> {
  if (typeof input !== "object" || input === null) return { error: true };
  const { username, siteRule, reason } = input;
  if (typeof username !== "string" || username.length < 1 || username.length > 40 || typeof siteRule !== "string" || typeof reason !== "string") {
    return { error: true };
  }
  const viewer = await getSessionUser();
  if (!viewer) return { error: true, login: true };
  if (!takeAction(`report:${viewer.id}`, reportRules).ok) return { error: true, tooMany: true };
  return run(
    viewer.id,
    (tx) => applySocialAccountReport(tx, { reporterId: viewer.id, username: username.toLowerCase(), siteRule, reason }),
    "reportSocialAccount",
  );
}
