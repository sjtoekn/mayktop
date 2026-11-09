"use server";

// Change the password / the email while logged in (patch-profile-security).
//  - Both ask for the CURRENT password again (a stolen login cookie alone is not enough), the same rule as "Delete your account".
//  - Every attempt, right or wrong, counts against a small limit (profileConfig.passwordChange / emailChange), so a stolen login
//    cannot be used to guess the password.
//  - Password: the library changes it and logs every OTHER device out; a notice goes to the account email.
//  - Email: the library sends a link to the CURRENT email (approve), then a link to the NEW one (verify); the email only changes
//    after both. The answer is the same whether or not the new address is already used, so nobody can test which addresses exist.
// The person comes from the login cookie only; the browser is not trusted.
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { loadAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { getSessionUser } from "@/lib/session";
import { takeActionDb } from "@/lib/rate-limit-db";
import { checkNewPassword, cleanNewEmail, PASSWORD_MAX } from "@/lib/profile-rules";
import { profileConfig, siteConfig } from "@/config/site";
import { t } from "@/i18n";

const passwordRules = profileConfig.passwordChange.map((rule) => ({ max: rule.max, windowMs: rule.windowSeconds * 1000 }));
const emailRules = profileConfig.emailChange.map((rule) => ({ max: rule.max, windowMs: rule.windowSeconds * 1000 }));

export type PasswordErrorCode = "login" | "tooMany" | "wrong" | "short" | "long" | "same" | "generic";
export type EmailErrorCode = "login" | "tooMany" | "wrong" | "invalid" | "same" | "generic";
export type PasswordResult = { ok: true } | { error: PasswordErrorCode };
export type EmailResult = { ok: true } | { error: EmailErrorCode };

/** True when `password` is the right current password of this person (Better Auth's own verifier). */
async function currentPasswordIsRight(userId: string, password: string): Promise<boolean | null> {
  if (password.length === 0 || password.length > PASSWORD_MAX) return false;
  const credential = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { password: true },
  });
  if (!credential?.password) return null; // no password login on this account (cannot be confirmed here)
  const context = await auth.$context;
  return context.password.verify({ hash: credential.password, password });
}

export async function changeMyPassword(input: { current: string; next: string }): Promise<PasswordResult> {
  const viewer = await getSessionUser();
  if (!viewer) return { error: "login" };

  const bad = checkNewPassword(input?.current, input?.next);
  if (bad === "short" || bad === "long" || bad === "same") return { error: bad };
  if (bad) return { error: "generic" };

  if (!(await takeActionDb(`password-change:${viewer.id}`, passwordRules)).ok) return { error: "tooMany" };

  try {
    const right = await currentPasswordIsRight(viewer.id, input.current);
    if (right === null) return { error: "generic" };
    if (!right) return { error: "wrong" };

    await auth.api.changePassword({
      body: { currentPassword: input.current, newPassword: input.next, revokeOtherSessions: true },
      headers: await headers(),
    });

    // A notice to the account email: if this was not the owner, they find out. Not awaited (same reason as the other emails).
    const account = await loadAccount(viewer.id);
    if (account) {
      void sendEmail({
        to: account.email,
        subject: t("email.passwordChanged.subject", { site: siteConfig.name }),
        text: t("email.passwordChanged.body", { name: account.username }),
      }).catch((error) => console.error("sendEmail failed:", error));
    }
    return { ok: true };
  } catch (error) {
    console.error("changeMyPassword failed:", error);
    return { error: "generic" };
  }
}

export async function changeMyEmail(input: { newEmail: string; password: string }): Promise<EmailResult> {
  const viewer = await getSessionUser();
  if (!viewer) return { error: "login" };

  const account = await loadAccount(viewer.id);
  if (!account) return { error: "login" };
  const clean = cleanNewEmail(input?.newEmail, account.email);
  if (!clean.ok) return { error: clean.reason === "same" ? "same" : clean.reason === "invalid" ? "invalid" : "generic" };
  if (typeof input?.password !== "string") return { error: "generic" };

  if (!(await takeActionDb(`email-change:${viewer.id}`, emailRules)).ok) return { error: "tooMany" };

  try {
    const right = await currentPasswordIsRight(viewer.id, input.password);
    if (right === null) return { error: "generic" };
    if (!right) return { error: "wrong" };

    await auth.api.changeEmail({
      body: { newEmail: clean.email, callbackURL: "/settings/security" },
      headers: await headers(),
    });
    return { ok: true };
  } catch (error) {
    // Includes "this address is already used": the person is told only that it did not work, never why.
    console.error("changeMyEmail failed:", error);
    return { error: "generic" };
  }
}
