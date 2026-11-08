"use server";

// Sign up, log in (TODO 30) and password reset (TODO 31, patch-38). The browser is not trusted: everything is checked again here.
// On success the person is logged in (cookie set by Better Auth) and sent to the home page.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { auth, isValidUsername, normalizeUsername } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type AuthErrorCode =
  | "credentials" // wrong email or password
  | "emailTaken"
  | "usernameTaken"
  | "usernameInvalid"
  | "passwordShort"
  | "emailNotVerified" // correct password, but the email link was not opened yet
  | "generic";

/** Nothing on success (the action redirects), or the reason it did not work. */
export type AuthResult = { error: AuthErrorCode } | undefined;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max;
}

export async function signUp(input: {
  username: string;
  name: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  if (
    !isText(input?.username, 100) ||
    !isText(input?.name, 100) ||
    !isText(input?.email, 254) ||
    !isText(input?.password, 1000)
  ) {
    return { error: "generic" };
  }
  const username = normalizeUsername(input.username);
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim().slice(0, 50) || username;

  if (!isValidUsername(username)) return { error: "usernameInvalid" };
  if (!EMAIL.test(email)) return { error: "generic" };
  if (input.password.length < 8 || input.password.length > 128) return { error: "passwordShort" };

  try {
    const [sameName, sameEmail] = await Promise.all([
      prisma.user.findUnique({ where: { username }, select: { id: true } }),
      prisma.user.findUnique({ where: { email }, select: { id: true } }),
    ]);
    if (sameName) return { error: "usernameTaken" };
    if (sameEmail) return { error: "emailTaken" };

    await auth.api.signUpEmail({
      body: { email, password: input.password, name, username, callbackURL: "/email-verified" },
      headers: await headers(),
    });
  } catch (error) {
    console.error("signUp failed:", error);
    return { error: "generic" };
  }
  // The account exists but is not logged in yet: the person must open the emailed link first.
  redirect("/verify-email");
}

export async function logIn(input: { email: string; password: string }): Promise<AuthResult> {
  if (!isText(input?.email, 254) || !isText(input?.password, 1000)) return { error: "generic" };
  const email = input.email.trim().toLowerCase();
  if (email.length === 0 || input.password.length === 0) return { error: "credentials" };

  try {
    await auth.api.signInEmail({
      body: { email, password: input.password, callbackURL: "/email-verified" },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      // 403 = right password, email not verified yet (a new link was sent);
      // 429 = too many attempts (Better Auth's built-in limit); anything else = wrong details.
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 403) return { error: "emailNotVerified" };
      return { error: status === 429 ? "generic" : "credentials" };
    }
    console.error("logIn failed:", error);
    return { error: "generic" };
  }
  redirect("/");
}

/** Result of asking for a reset link, or of choosing the new password. */
export type ResetResult =
  | { ok: true }
  | { error: "generic" | "passwordShort" | "invalidToken" };

/**
 * Step 1 of a reset: the person gives their email.
 * The answer is ALWAYS "ok" for a well-formed email, whether or not an account exists, so this
 * form cannot be used to find out who is registered. (Email format errors are not a secret.)
 */
export async function requestPasswordReset(input: { email: string }): Promise<ResetResult> {
  if (!isText(input?.email, 254)) return { error: "generic" };
  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email)) return { error: "generic" };

  try {
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: "/reset-password" },
      headers: await headers(),
    });
  } catch (error) {
    // Logged only; the person is told "sent" either way (see above).
    console.error("requestPasswordReset failed:", error);
  }
  return { ok: true };
}

/** Step 2 of a reset: the token from the emailed link plus the new password. */
export async function resetPassword(input: { token: string; password: string }): Promise<ResetResult> {
  if (!isText(input?.token, 500) || !isText(input?.password, 1000)) return { error: "generic" };
  if (input.token.length === 0) return { error: "invalidToken" };
  if (input.password.length < 8 || input.password.length > 128) return { error: "passwordShort" };

  try {
    await auth.api.resetPassword({
      body: { newPassword: input.password, token: input.token },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) return { error: "invalidToken" };
    console.error("resetPassword failed:", error);
    return { error: "generic" };
  }
  return { ok: true };
}
