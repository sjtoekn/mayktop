"use server";

// Social REPLY moderation and ACCOUNT report actions (patch-social-report-more). The ACTOR is the logged-in admin, never
// a form value. "A different admin decides", "not your own reply", the written note and the audit row are all enforced
// in src/lib/social-reply-review.ts.
import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import {
  closeAccountReports,
  decideSocialReplyReview,
  dismissSocialReplyReports,
  hideSocialReply,
  type ReviewError,
} from "@/lib/social-reply-review";

export type SocialItemResult = { ok: true } | { error: ReviewError | "other" };

const REPLY_ACTIONS = ["hide", "dismiss", "restore", "remove"];
const ACCOUNT_ACTIONS = ["dismiss", "handled"];

function refresh() {
  updateTag("social-posts"); // replies are cached with the feeds: make the change show up at once
  revalidatePath("/admin/social");
  revalidatePath("/admin");
}

export async function socialItemModeration(input: {
  kind: "reply" | "account";
  action: "hide" | "dismiss" | "restore" | "remove" | "handled";
  id: string; // a reply number, or an account id
  siteRule?: string;
  text: string; // the written reason (hide) or note (the rest)
}): Promise<SocialItemResult> {
  const me = await requireAdmin(); // not logged in -> login page; not an admin -> 404
  if (
    !input ||
    (input.kind !== "reply" && input.kind !== "account") ||
    typeof input.action !== "string" ||
    typeof input.id !== "string" ||
    typeof input.text !== "string" ||
    (input.siteRule !== undefined && typeof input.siteRule !== "string") ||
    !(input.kind === "reply" ? REPLY_ACTIONS : ACCOUNT_ACTIONS).includes(input.action)
  ) {
    return { error: "other" };
  }
  try {
    let result;
    if (input.kind === "account") {
      result = await closeAccountReports({
        actorId: me.id, reportedId: input.id, outcome: input.action === "handled" ? "handled" : "dismiss", note: input.text,
      });
    } else {
      const replyId = Number(input.id);
      result =
        input.action === "hide"
          ? await hideSocialReply({ actorId: me.id, replyId, siteRule: input.siteRule ?? "", reason: input.text })
          : input.action === "dismiss"
            ? await dismissSocialReplyReports({ actorId: me.id, replyId, note: input.text })
            : await decideSocialReplyReview({ actorId: me.id, replyId, decision: input.action as "restore" | "remove", note: input.text });
    }
    if ("error" in result) return { error: result.error };
    refresh();
    return { ok: true };
  } catch (error) {
    console.error("socialItemModeration failed:", error);
    return { error: "other" };
  }
}
