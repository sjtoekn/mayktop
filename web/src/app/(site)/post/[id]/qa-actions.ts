"use server";

// The question-and-answer actions of a post page (SITE_PLAN B4, B6): accept an answer, offer a bounty.
// Like every action, they work for the LOGGED-IN person only (src/lib/session.ts) and check everything again here.
import { updateTag } from "next/cache";
import { getSessionUser } from "@/lib/session";
import { setAcceptedAnswer } from "@/lib/answers";
import { offerBounty } from "@/lib/bounty";

const MAX_ID = 2_147_483_647;
const isId = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_ID;

export type QaResult = { ok: true; awarded?: number } | { error: true; login?: true; reason?: string };

/** The asker accepts an answer (accept = true) or takes the mark back (false). */
export async function acceptAnswer(input: { commentId: number; accept: boolean }): Promise<QaResult> {
  if (!isId(input?.commentId) || typeof input.accept !== "boolean") return { error: true };
  const user = await getSessionUser();
  if (!user) return { error: true, login: true };
  try {
    const result = await setAcceptedAnswer(user.id, input.commentId, input.accept);
    if (!result.ok) return { error: true, reason: result.error };
    updateTag("comments");
    updateTag("posts");
    return { ok: true, awarded: result.awarded };
  } catch (error) {
    console.error("acceptAnswer failed:", error);
    return { error: true };
  }
}

/** The asker puts a bounty (reputation points) on their question. */
export async function createBounty(input: { postId: number; amount: number }): Promise<QaResult> {
  if (!isId(input?.postId)) return { error: true };
  const user = await getSessionUser();
  if (!user) return { error: true, login: true };
  try {
    const result = await offerBounty(user.id, input.postId, input.amount);
    if (!result.ok) return { error: true, reason: result.error };
    updateTag("posts");
    return { ok: true };
  } catch (error) {
    console.error("createBounty failed:", error);
    return { error: true };
  }
}
