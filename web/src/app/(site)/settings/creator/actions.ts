"use server";

// Join the creator program, and save payout settings (TODO 12, S6). The person comes from the login cookie only.
//   - join: terms must be accepted; a country is chosen; payout details are optional now.
//   - save: the PASSWORD is asked again (a stolen login cookie alone cannot redirect the money), and the account's
//     e-mail gets a notice. A real change starts a waiting time before the next payout (creatorsConfig.detailsChangeHoldDays).
// The rules are in src/lib/creator-profile-rules.ts (tested by `npm run test:creator-profile`).
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { loadAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { takeActionDb } from "@/lib/rate-limit-db";
import { sendEmail } from "@/lib/email";
import { accountConfig, creatorsConfig } from "@/config/site";
import { joinCreator, savePayout, type SaveResult } from "@/lib/creator-profile";
import { t } from "@/i18n";

const rules = creatorsConfig.settingsRateLimit.map((rule) => ({ max: rule.max, windowMs: rule.windowSeconds * 1000 }));

export type CreatorErrorCode =
  | "login" | "tooMany" | "terms" | "country" | "method" | "paypal" | "bank" | "noKey" | "exists" | "notJoined"
  | "password" | "passwordTries" | "generic";
export type CreatorActionResult = { ok: true } | { error: CreatorErrorCode };

export type CreatorFormInput = {
  acceptTerms?: boolean;
  country: string;
  method: string;
  paypalEmail: string;
  bank: { bankName: string; branch: string; holderName: string; accountNumber: string };
  password?: string;
};

// Wrong passwords per person, in server memory (same approach as the delete form; a shared limiter is TODO 50).
const failures = new Map<string, number[]>();
function recentFailures(userId: string, now: number): number[] {
  const windowMs = accountConfig.deletePasswordWindowMinutes * 60 * 1000;
  const recent = (failures.get(userId) ?? []).filter((time) => now - time < windowMs);
  if (recent.length > 0) failures.set(userId, recent);
  else failures.delete(userId);
  return recent;
}

function payoutInput(input: CreatorFormInput) {
  const bank = input?.bank && typeof input.bank === "object" ? input.bank : undefined;
  return { country: input?.country, method: input?.method, paypalEmail: input?.paypalEmail, bank };
}

function toResult(result: SaveResult): CreatorActionResult {
  return result.ok ? { ok: true } : { error: result.error };
}

async function notifyChange(userId: string) {
  try {
    const account = await loadAccount(userId);
    if (!account?.email) return;
    await sendEmail({
      to: account.email,
      subject: t("creator.mail.subject"),
      text: t("creator.mail.text", { days: creatorsConfig.detailsChangeHoldDays }),
    });
  } catch (error) {
    console.error("creator payout change notice failed (the change is saved):", error); // a missing mail service must not undo it
  }
}

export async function joinCreatorProgram(input: CreatorFormInput): Promise<CreatorActionResult> {
  const viewer = await getSessionUser();
  if (!viewer) return { error: "login" };
  if (!(await takeActionDb(`creator-settings:${viewer.id}`, rules)).ok) return { error: "tooMany" };
  try {
    const result = await joinCreator(viewer.id, { ...payoutInput(input), acceptTerms: input?.acceptTerms });
    if (result.ok && result.changed) await notifyChange(viewer.id);
    revalidatePath("/settings/creator");
    return toResult(result);
  } catch (error) {
    console.error("joinCreatorProgram failed:", error);
    return { error: "generic" };
  }
}

export async function saveCreatorPayout(input: CreatorFormInput): Promise<CreatorActionResult> {
  const viewer = await getSessionUser();
  if (!viewer) return { error: "login" };
  if (!(await takeActionDb(`creator-settings:${viewer.id}`, rules)).ok) return { error: "tooMany" };
  if (typeof input?.password !== "string" || input.password.length === 0) return { error: "password" };
  if (input.password.length > 128) return { error: "password" }; // passwords are 8-128 characters

  try {
    const now = Date.now();
    if (recentFailures(viewer.id, now).length >= accountConfig.deletePasswordMaxFailures) return { error: "passwordTries" };
    const credential = await prisma.account.findFirst({
      where: { userId: viewer.id, providerId: "credential" },
      select: { password: true },
    });
    if (!credential?.password) return { error: "generic" };
    const context = await auth.$context;
    const correct = await context.password.verify({ hash: credential.password, password: input.password });
    if (!correct) {
      failures.set(viewer.id, [...recentFailures(viewer.id, now), now]);
      return { error: "password" };
    }
    failures.delete(viewer.id);

    const result = await savePayout(viewer.id, payoutInput(input));
    if (result.ok && result.changed) await notifyChange(viewer.id);
    revalidatePath("/settings/creator");
    return toResult(result);
  } catch (error) {
    console.error("saveCreatorPayout failed:", error);
    return { error: "generic" };
  }
}
