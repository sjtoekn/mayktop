// Sign-in for the whole site (TODO 30), built on Better Auth.
// The one place the library is configured. Pages and actions import `auth` from here.
//
// Needs two lines in web/.env:
//   BETTER_AUTH_SECRET=<32+ random characters>   (openssl rand -base64 32)
//   BETTER_AUTH_URL=http://localhost:3000
//
// Step 1: email + password. Step 2 (TODO 31, part 1): a new account must open the link in the
// verification email before it can log in. Step 3 (TODO 31, part 2, patch-38): password reset
// by emailed link. Google / GitHub, magic links and the sessions list come in later steps.
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { cancelPendingDeletion } from "@/lib/account";
import { siteConfig } from "@/config/site";
import { t } from "@/i18n";

/** Usernames are lower case: 3-20 letters, numbers or underscores (they appear as /u/<name>). */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

/** Names that could be mistaken for staff or that the site itself uses. */
export const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "moderator", "mod", "mods", "support", "staff", "system",
  "mayktop", "root", "help", "official", "deleted", "anonymous",
]);

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username) && !RESERVED_USERNAMES.has(username);
}

export const auth = betterAuth({
  // Our Prisma client (SQLite). Better Auth uses the models User, Session, Account, Verification.
  database: prismaAdapter(prisma, { provider: "sqlite" }),

  user: {
    // Better Auth calls the shown name "name"; in our table it is `displayName`.
    fields: { name: "displayName" },
    additionalFields: {
      username: { type: "string", required: true, input: true },
    },
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true, // a new account is logged in at once
    // A person cannot log in until the email is verified (Better Auth then also refuses to
    // create a login for a brand-new sign-up: the person is sent to /verify-email).
    requireEmailVerification: true,
    // Password reset (patch-38): the link is valid for one hour and works once. After a reset
    // every other login of that account is ended (someone who knew the old password is out).
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      // Not awaited on purpose, same reason as the verification email.
      void sendEmail({
        to: user.email,
        subject: t("email.reset.subject", { site: siteConfig.name }),
        text: t("email.reset.body", { name: user.name || user.email, url }),
      }).catch((error) => console.error("sendEmail failed:", error));
    },
  },

  emailVerification: {
    sendOnSignUp: true, // send the link right after sign-up
    sendOnSignIn: true, // not verified yet and tries to log in: send a NEW link
    autoSignInAfterVerification: true, // opening the link also logs the person in
    sendVerificationEmail: async ({ user, url }) => {
      // Not awaited on purpose (Better Auth advice: the answer must not reveal how long
      // sending took). A failure is only logged.
      void sendEmail({
        to: user.email,
        subject: t("email.verify.subject", { site: siteConfig.name }),
        text: t("email.verify.body", { name: user.name || user.email, url }),
      }).catch((error) => console.error("sendEmail failed:", error));
    },
  },

  databaseHooks: {
    user: {
      create: {
        // Last line of defence: the sign-up form already checks the username, but this also
        // protects the library's own /api/auth/sign-up/email endpoint.
        before: async (user) => {
          const username = normalizeUsername(String((user as { username?: unknown }).username ?? ""));
          if (!isValidUsername(username)) {
            throw new APIError("BAD_REQUEST", { message: "Invalid username" });
          }
          return { data: { ...user, username } };
        },
      },
    },
    session: {
      create: {
        // Every new login (password, verification link, ...) comes through here. A person whose
        // account waits to be deleted gets it back just by logging in (PROJECT.md 8c, point 1;
        // TODO 36c). A failure must not stop the login: the person then still sees "scheduled for
        // deletion" on /settings and can press "Keep my account".
        after: async (session) => {
          try {
            await cancelPendingDeletion(session.userId);
          } catch (error) {
            console.error("cancelPendingDeletion failed:", error);
          }
        },
      },
    },
  },

  // Lets server actions set the login cookie. Must be the LAST plugin in this list.
  plugins: [nextCookies()],
});
