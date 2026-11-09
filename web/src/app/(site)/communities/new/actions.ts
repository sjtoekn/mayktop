"use server";

// Saves a member's request for a new community. The person is the LOGGED-IN account, never a form value.
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session";
import { submitCommunityRequest } from "@/lib/community-request";
import type { CrError } from "@/lib/community-request-rules";

export type CreateRequestResult = { ok: true } | { error: CrError };

export async function createCommunityRequest(input: unknown): Promise<CreateRequestResult> {
  const user = await getSessionUser();
  if (!user) return { error: "login" };
  try {
    const result = await submitCommunityRequest(user, input);
    if ("error" in result) return { error: result.error };
    revalidatePath("/communities/new");
    revalidatePath("/admin/communities/requests");
    return { ok: true };
  } catch (error) {
    console.error("createCommunityRequest failed:", error);
    return { error: "other" };
  }
}
