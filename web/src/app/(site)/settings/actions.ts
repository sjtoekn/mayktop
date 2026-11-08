"use server";

// Tells the banner (AccountBanner) whether the logged-in person's account is limited.
// Only the state is sent, never the email or the reason.
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { loadAccount } from "@/lib/account";

export type AccountState = "ACTIVE" | "SUSPENDED" | "DELETION_PENDING";

export async function getAccountState(): Promise<AccountState | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return null;
    const account = await loadAccount(session.user.id);
    if (!account) return null;
    return account.status === "SUSPENDED" || account.status === "DELETION_PENDING"
      ? account.status
      : "ACTIVE";
  } catch (error) {
    console.error("getAccountState failed:", error);
    return null;
  }
}
