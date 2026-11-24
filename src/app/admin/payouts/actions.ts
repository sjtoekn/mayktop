"use server";

// The steps of paying creators (TODO 12, S8). The ACTOR is the logged-in admin, never a form value.
// The rules, the "only once" checks and the audit rows are in creator-payouts.ts.
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import {
  createPayoutBatch,
  markPayoutFailed,
  markPayoutPaid,
  reverseOpenEarnings,
  setEarningsHold,
  type PayoutError,
} from "@/lib/creator-payouts";

export type PayoutActionResult = { ok: true } | { error: PayoutError | "other" };
const KINDS = ["batch", "paid", "failed", "hold", "release", "reverse"] as const;
export type PayoutActionKind = (typeof KINDS)[number];

export async function payoutAction(input: {
  kind: PayoutActionKind;
  payoutId?: number;
  userId?: string;
  country?: string | null;
  text?: string; // the reference (paid) or the written reason (the others)
}): Promise<PayoutActionResult> {
  const me = await requireAdmin(); // not logged in -> login page; not an admin -> 404
  if (!input || !KINDS.includes(input.kind)) return { error: "other" };
  const text = typeof input.text === "string" ? input.text : "";
  try {
    let result: { ok: true } | { error: PayoutError };
    if (input.kind === "batch") {
      result = await createPayoutBatch({ actorId: me.id, country: typeof input.country === "string" ? input.country : null });
    } else if (input.kind === "paid") {
      result = await markPayoutPaid({ actorId: me.id, payoutId: Number(input.payoutId), reference: text });
    } else if (input.kind === "failed") {
      result = await markPayoutFailed({ actorId: me.id, payoutId: Number(input.payoutId), reason: text });
    } else if (input.kind === "reverse") {
      result = await reverseOpenEarnings({ actorId: me.id, userId: String(input.userId ?? ""), reason: text });
    } else {
      result = await setEarningsHold({ actorId: me.id, userId: String(input.userId ?? ""), hold: input.kind === "hold", reason: text });
    }
    if ("error" in result) return { error: result.error };
    revalidatePath("/admin/payouts");
    return { ok: true };
  } catch (error) {
    console.error("payoutAction failed:", error);
    return { error: "other" };
  }
}
