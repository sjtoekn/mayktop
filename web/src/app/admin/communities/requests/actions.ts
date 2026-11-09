"use server";

// Approve or reject ONE community request (admin). The ACTOR is the logged-in admin, never a form value.
import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { approveCommunityRequest, rejectCommunityRequest } from "@/lib/community-request";
import type { CrError } from "@/lib/community-request-rules";

export type RequestDecisionResult = { ok: true } | { error: CrError };

export async function decideCommunityRequest(input: { id: number; kind: "approve" | "reject"; note?: string }): Promise<RequestDecisionResult> {
  const me = await requireAdmin();
  if (!input || typeof input.id !== "number" || (input.kind !== "approve" && input.kind !== "reject")) return { error: "other" };
  try {
    const result = input.kind === "approve"
      ? await approveCommunityRequest(me, input.id)
      : await rejectCommunityRequest(me, input.id, input.note ?? "");
    if ("error" in result) return { error: result.error };
    updateTag("communities");
    revalidatePath("/admin/communities");
    revalidatePath("/admin/communities/requests");
    revalidatePath("/communities/new");
    return { ok: true };
  } catch (error) {
    console.error("decideCommunityRequest failed:", error);
    return { error: "other" };
  }
}
