"use server";

// The buttons on a person's page (admin Part 2). The ACTOR is always the logged-in admin (requireAdmin),
// never a value sent by the form. All fairness rules live in staff.ts and are checked again there.
import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin, requireSuperAdmin } from "@/lib/admin";
import { liftSuspension, makeAdmin, proposeBan, removeAdmin, suspendUser, unverifyUser, verifyUser, type StaffResult } from "@/lib/staff";
import { editUser, eraseNow, type AdminEditError } from "@/lib/admin-edit";

export type PersonActionInput = {
  kind: "edit" | "suspend" | "lift" | "makeAdmin" | "removeAdmin" | "proposeBan" | "erase" | "verify" | "unverify";
  username: string;
  rule?: string;
  days?: number;
  reason?: string;
  // edit: the four fields as the admin left them
  displayName?: string;
  bio?: string;
  newUsername?: string;
  email?: string;
  // erase: the username typed as confirmation
  confirm?: string;
};
/** `next`: where the page must go now (the username changed, or the account is gone). `notes`: things to do by hand after an erasure. */
export type PersonActionResult = { ok: true; next?: string; notes?: string[] } | { error: AdminEditError | "other" };

const text = (value: unknown, max: number): string => (typeof value === "string" ? value.slice(0, max) : "");

export async function personAction(input: PersonActionInput): Promise<PersonActionResult> {
  if (!input || typeof input.username !== "string" || input.username.length === 0 || input.username.length > 100) {
    return { error: "other" };
  }
  // Making / removing admins and erasing an account at once: the SUPER admin only (everyone else gets a 404). The rest: any active admin.
  const me =
    input.kind === "makeAdmin" || input.kind === "removeAdmin" || input.kind === "erase" ? await requireSuperAdmin() : await requireAdmin();
  const target = input.username;
  const reason = typeof input.reason === "string" ? input.reason : "";
  try {
    if (input.kind === "edit") {
      const edited = await editUser({
        actor: me.username,
        target,
        reason,
        displayName: text(input.displayName, 2000),
        bio: text(input.bio, 5000),
        username: text(input.newUsername, 200),
        email: text(input.email, 500),
      });
      if ("error" in edited) return { error: edited.error };
      revalidatePath("/admin/people");
      revalidatePath("/admin");
      // A new username means a new address for this page.
      return edited.username !== target ? { ok: true, next: `/admin/people/${encodeURIComponent(edited.username)}` } : { ok: true };
    }
    if (input.kind === "erase") {
      const erased = await eraseNow({ actor: me.username, target, reason, confirm: text(input.confirm, 200) });
      if ("error" in erased) return { error: erased.error };
      revalidatePath("/admin/people");
      revalidatePath("/admin");
      // The account is an anonymous shell now: its old address no longer exists, its history lives at the new one.
      return { ok: true, next: `/admin/people/${encodeURIComponent(erased.erasedAs)}`, notes: erased.notes };
    }
    if (input.kind === "proposeBan") {
      const rule = typeof input.rule === "string" ? input.rule : "";
      const proposed = await proposeBan({ actor: me.username, target, rule, reason });
      if ("error" in proposed) return { error: proposed.error };
      revalidatePath("/admin/people");
      revalidatePath("/admin/bans");
      revalidatePath("/admin");
      return { ok: true };
    }
    let result: StaffResult;
    if (input.kind === "suspend") {
      const days = typeof input.days === "number" ? input.days : Number.NaN;
      const rule = typeof input.rule === "string" ? input.rule : "";
      result = await suspendUser({ actor: me.username, target, days, rule, reason });
    } else if (input.kind === "lift") {
      result = await liftSuspension({ actor: me.username, target, reason });
    } else if (input.kind === "makeAdmin") {
      result = await makeAdmin({ actor: me.username, target });
    } else if (input.kind === "removeAdmin") {
      result = await removeAdmin({ actor: me.username, target, reason });
    } else if (input.kind === "verify") {
      result = await verifyUser({ actor: me.username, target });
    } else if (input.kind === "unverify") {
      result = await unverifyUser({ actor: me.username, target, reason });
    } else {
      return { error: "other" };
    }
    if ("error" in result) return { error: result.error };
    revalidatePath("/admin/people");
    revalidatePath("/admin");
    // The badge shows on the public profile and on cached Social pages.
    if (input.kind === "verify" || input.kind === "unverify") {
      revalidatePath(`/u/${target}`);
      updateTag("social-posts");
    }
    return { ok: true };
  } catch (error) {
    console.error("personAction failed:", error);
    return { error: "other" };
  }
}
