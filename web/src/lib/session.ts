// "Who is logged in?" for server code (TODO 33-35 patch: posts, comments and votes are saved
// as the logged-in person). Server actions call getSessionUser() and refuse when it is null.
//
// The login cookie only says WHICH account; the account itself is read from the database again
// on every call, so a suspended or deleted person is refused at once (never trust the cookie
// alone for a write).
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { loadAccount } from "@/lib/account";
import { UserStatus } from "../../generated/prisma/client";

export type SessionUser = { id: string; username: string; createdAt: Date };

/** The logged-in, active person, or null (nobody logged in, session expired, account not active). */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const id = session?.user?.id;
    if (!id) return null;
    const user = await loadAccount(id); // also lifts a temporary suspension that has ended
    if (!user || user.status !== UserStatus.ACTIVE) return null;
    return { id: user.id, username: user.username, createdAt: user.createdAt };
  } catch (error) {
    if ((error as { digest?: string })?.digest === "HANGING_PROMISE_REJECTION") return null; // build-time prerender only, not a real failure
    console.error("getSessionUser failed:", error);
    return null;
  }
}
