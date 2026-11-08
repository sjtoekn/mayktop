"use server";

// Restore or remove ONE hidden post / comment (admin Part 4). The ACTOR is the logged-in admin, never a form value.
// "A different person than the one who hid it", "not your own content", the written note and the audit row
// are all enforced in review.ts (decideReview).
import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { decideReview, type ReviewError } from "@/lib/review";

export type ReviewDecisionResult = { ok: true } | { error: ReviewError | "other" };

export async function reviewDecision(input: {
  kind: "post" | "comment";
  id: number;
  restore: boolean;
  note: string;
}): Promise<ReviewDecisionResult> {
  const me = await requireAdmin(); // not logged in -> login page; not an admin -> 404
  if (
    !input ||
    (input.kind !== "post" && input.kind !== "comment") ||
    typeof input.id !== "number" ||
    typeof input.restore !== "boolean" ||
    typeof input.note !== "string"
  ) {
    return { error: "other" };
  }
  try {
    const result = await decideReview({
      actor: me.username,
      kind: input.kind,
      id: input.id,
      decision: input.restore ? "restore" : "remove",
      note: input.note,
    });
    if ("error" in result) return { error: result.error };
    // The public pages are cached: make the change show up at once.
    updateTag("posts");
    updateTag("comments");
    revalidatePath("/admin/review");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    console.error("reviewDecision failed:", error);
    return { error: "other" };
  }
}
