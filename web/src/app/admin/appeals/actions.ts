"use server";

// Accept or reject ONE open appeal (admin Part 6). The ACTOR is the logged-in admin, never a form value.
// "Not the appellant", "not anyone who decided the first time", the written note, the audit row and the email
// are all enforced in appeals.ts (decideAppeal).
import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { decideAppeal, type AppealError } from "@/lib/appeals";

export type AppealDecisionResult = { ok: true } | { error: AppealError | "other" };

export async function appealDecision(input: { appealId: number; accept: boolean; note: string }): Promise<AppealDecisionResult> {
  const me = await requireAdmin(); // not logged in -> login page; not an admin -> 404
  if (!input || typeof input.appealId !== "number" || typeof input.accept !== "boolean" || typeof input.note !== "string") {
    return { error: "other" };
  }
  try {
    const result = await decideAppeal({ actor: me.username, appealId: input.appealId, accept: input.accept, note: input.note });
    if ("error" in result) return { error: result.error };
    // Accepting can make a post / comment visible again and the public pages are cached.
    updateTag("posts");
    updateTag("comments");
    updateTag("social-posts"); // accepting can make a Social post / reply visible again (the feeds are cached)
    revalidatePath("/admin/appeals");
    revalidatePath("/admin/people");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    console.error("appealDecision failed:", error);
    return { error: "other" };
  }
}
