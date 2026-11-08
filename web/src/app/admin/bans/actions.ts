"use server";

// Approve or reject a ban proposal (admin Part 3). The ACTOR is the logged-in admin, never a form value.
// The two-admin rule (the proposer cannot approve), the ladder and the audit row are enforced in staff.ts (decideBan).
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { decideBan, type StaffError } from "@/lib/staff";

export type BanDecisionResult = { ok: true } | { error: StaffError | "other" };

export async function banDecision(input: { proposalId: number; approve: boolean; note: string }): Promise<BanDecisionResult> {
  const me = await requireAdmin(); // not logged in -> login page; not an admin -> 404
  if (!input || typeof input.proposalId !== "number" || typeof input.approve !== "boolean" || typeof input.note !== "string") {
    return { error: "other" };
  }
  try {
    const result = await decideBan({ actor: me.username, proposalId: input.proposalId, approve: input.approve, note: input.note });
    if ("error" in result) return { error: result.error };
    revalidatePath("/admin/bans");
    revalidatePath("/admin/people");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    console.error("banDecision failed:", error);
    return { error: "other" };
  }
}
