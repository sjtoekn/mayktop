"use server";

// One review step on ONE ad (admin Part 8). The ACTOR is the logged-in admin, never a form value.
// "Not your own ad", the ad rule + written reason, the audit row and the email are all enforced in ad-review.ts.
import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { approveAd, markAdPaid, pauseAd, rejectAd, restoreAd, type AdError, type AdResult } from "@/lib/ad-review";

export type AdActionResult = { ok: true } | { error: AdError | "other" };
const KINDS = ["approve", "reject", "paid", "pause", "restore"] as const;

export async function adAction(input: {
  adId: number;
  kind: (typeof KINDS)[number];
  rule?: string;
  reason?: string;
}): Promise<AdActionResult> {
  const me = await requireAdmin(); // not logged in -> login page; not an admin -> 404
  if (!input || typeof input.adId !== "number" || !KINDS.includes(input.kind)) return { error: "other" };
  const adId = input.adId;
  const reason = typeof input.reason === "string" ? input.reason : "";
  const rule = typeof input.rule === "string" ? input.rule : "";
  try {
    let result: AdResult;
    if (input.kind === "approve") result = await approveAd({ actor: me.username, adId });
    else if (input.kind === "reject") result = await rejectAd({ actor: me.username, adId, rule, reason });
    else if (input.kind === "paid") result = await markAdPaid({ actor: me.username, adId });
    else if (input.kind === "pause") result = await pauseAd({ actor: me.username, adId, reason });
    else result = await restoreAd({ actor: me.username, adId, reason });
    if ("error" in result) return { error: result.error };
    updateTag("ads"); // the pool of running ads is cached
    revalidatePath("/admin/ads");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    console.error("adAction failed:", error);
    return { error: "other" };
  }
}
