"use server";

// The buttons on a person's page (admin Part 2). The ACTOR is always the logged-in admin (requireAdmin),
// never a value sent by the form. All fairness rules live in staff.ts and are checked again there.
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { liftSuspension, makeAdmin, proposeBan, removeAdmin, suspendUser, type StaffError, type StaffResult } from "@/lib/staff";

export type PersonActionInput = {
  kind: "suspend" | "lift" | "makeAdmin" | "removeAdmin" | "proposeBan";
  username: string;
  rule?: string;
  days?: number;
  reason?: string;
};
export type PersonActionResult = { ok: true } | { error: StaffError | "other" };

export async function personAction(input: PersonActionInput): Promise<PersonActionResult> {
  const me = await requireAdmin(); // not logged in -> login page; not an admin -> 404
  if (!input || typeof input.username !== "string" || input.username.length === 0 || input.username.length > 100) {
    return { error: "other" };
  }
  const target = input.username;
  const reason = typeof input.reason === "string" ? input.reason : "";
  try {
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
    } else {
      return { error: "other" };
    }
    if ("error" in result) return { error: result.error };
    revalidatePath("/admin/people");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    console.error("personAction failed:", error);
    return { error: "other" };
  }
}
