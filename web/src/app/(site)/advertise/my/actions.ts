"use server";

// Pause / run again / end / edit / appeal an ad of the logged-in advertiser (ADS_PLAN Sessions 4a + 4b + 4c). The advertiser is the
// logged-in person, never a form value. All rules (own ad only, who paused it, end date, audit row) are enforced in src/lib/ad-own.ts.
import { revalidatePath, updateTag } from "next/cache";
import { getSessionUser } from "@/lib/session";
import { endOwnAd, pauseOwnAd, resubmitOwnAd, resumeOwnAd, type EditAdResult } from "@/lib/ad-own";
import { fileAdAppeal } from "@/lib/appeals";
import type { OwnAdError } from "@/lib/ad-own-rules";

export type MyAdActionResult = { ok: true } | { error: OwnAdError | "login" };
export type EditMyAdResult = EditAdResult | { error: "login" };

export async function myAdAction(input: { adId: number; kind: "pause" | "resume" | "end" }): Promise<MyAdActionResult> {
  const user = await getSessionUser();
  if (!user) return { error: "login" };
  if (!input || !Number.isInteger(input.adId) || !["pause", "resume", "end"].includes(input.kind)) return { error: "other" };
  try {
    const result =
      input.kind === "pause" ? await pauseOwnAd(user.id, input.adId)
      : input.kind === "resume" ? await resumeOwnAd(user.id, input.adId)
      : await endOwnAd(user.id, input.adId);
    if ("error" in result) return { error: result.error };
    updateTag("ads"); // the pool of running ads is cached
    revalidatePath("/advertise/my");
    revalidatePath("/admin/ads");
    return { ok: true };
  } catch (error) {
    console.error("myAdAction failed:", error);
    return { error: "other" };
  }
}

/** Fix a rejected ad and send it again for review. */
export async function editMyAd(input: { adId: number; title: string; body: string; url: string; email: string; agree: boolean }): Promise<EditMyAdResult> {
  const user = await getSessionUser();
  if (!user) return { error: "login" };
  if (
    !input || !Number.isInteger(input.adId) ||
    typeof input.title !== "string" || typeof input.body !== "string" || typeof input.url !== "string" || typeof input.email !== "string"
  ) {
    return { error: "other" };
  }
  try {
    const result = await resubmitOwnAd(user.id, input.adId, {
      title: input.title, body: input.body, url: input.url, email: input.email, agree: input.agree === true,
    });
    if ("error" in result) return result;
    revalidatePath("/advertise/my");
    revalidatePath("/admin/ads");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    console.error("editMyAd failed:", error);
    return { error: "other" };
  }
}

export type AdAppealResult = { ok: true } | { error: "short" | "window" | "exists" | "state" | "login" | "generic" };

/** The advertiser of a REJECTED ad appeals the rejection (once per rejection). The rules are in src/lib/appeals.ts (fileAdAppeal). */
export async function submitAdAppeal(input: { adId: number; message: string }): Promise<AdAppealResult> {
  const user = await getSessionUser();
  if (!user) return { error: "login" };
  if (!input || !Number.isInteger(input.adId) || typeof input.message !== "string") return { error: "generic" };
  try {
    const result = await fileAdAppeal({ userId: user.id, adId: input.adId, message: input.message });
    if ("ok" in result) {
      revalidatePath("/advertise/my");
      revalidatePath(`/advertise/my/${input.adId}/appeal`);
      revalidatePath("/admin/appeals");
      revalidatePath("/admin");
      return { ok: true };
    }
    if (result.error === "message") return { error: "short" };
    if (result.error === "window" || result.error === "exists" || result.error === "state") return { error: result.error };
    return { error: "generic" };
  } catch (error) {
    console.error("submitAdAppeal failed:", error);
    return { error: "generic" };
  }
}
