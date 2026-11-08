"use server";

// Social moderation actions (SOCIAL_TODO 27). The ACTOR is the logged-in admin, never a form value. "A different admin
// decides", "not your own post", the written reason and the audit row are all enforced in src/lib/social-review.ts.
import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import {
  decideSocialReview,
  dismissSocialReports,
  hideSocialPost,
  type ReviewError,
} from "@/lib/social-review";

export type SocialModerationResult = { ok: true } | { error: ReviewError | "other" };

function refresh() {
  updateTag("social-posts"); // the feeds are cached: make the change show up at once
  revalidatePath("/admin/social");
  revalidatePath("/admin");
}

export async function socialModeration(input: {
  action: "hide" | "dismiss" | "restore" | "remove";
  id: number;
  siteRule?: string;
  text: string; // the written reason (hide) or note (the rest)
}): Promise<SocialModerationResult> {
  const me = await requireAdmin(); // not logged in -> login page; not an admin -> 404
  if (
    !input ||
    !["hide", "dismiss", "restore", "remove"].includes(input.action) ||
    typeof input.id !== "number" ||
    typeof input.text !== "string" ||
    (input.siteRule !== undefined && typeof input.siteRule !== "string")
  ) {
    return { error: "other" };
  }
  try {
    const result =
      input.action === "hide"
        ? await hideSocialPost({ actorId: me.id, postId: input.id, siteRule: input.siteRule ?? "", reason: input.text })
        : input.action === "dismiss"
          ? await dismissSocialReports({ actorId: me.id, postId: input.id, note: input.text })
          : await decideSocialReview({ actorId: me.id, postId: input.id, decision: input.action, note: input.text });
    if ("error" in result) return { error: result.error };
    refresh();
    return { ok: true };
  } catch (error) {
    console.error("socialModeration failed:", error);
    return { error: "other" };
  }
}
