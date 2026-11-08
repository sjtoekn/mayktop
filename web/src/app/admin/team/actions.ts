"use server";

// "Add admin" on /admin/team. ONLY the super admin gets through (requireSuperAdmin); the actor is the logged-in
// person, never a value from the form. The rules (active person, not yourself, audit row) live in staff.ts.
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/admin";
import { makeAdmin, type StaffError } from "@/lib/staff";

export type AddAdminResult = { ok: true } | { error: StaffError | "other" };

export async function addAdmin(username: string): Promise<AddAdminResult> {
  const me = await requireSuperAdmin();
  const name = typeof username === "string" ? username.trim().replace(/^@/, "") : "";
  if (name.length === 0 || name.length > 100) return { error: "notfound" };
  try {
    const result = await makeAdmin({ actor: me.username, target: name });
    if ("error" in result) return { error: result.error };
    revalidatePath("/admin/team");
    revalidatePath("/admin/people");
    return { ok: true };
  } catch (error) {
    console.error("addAdmin failed:", error);
    return { error: "other" };
  }
}
