"use server";

// "Appeal this decision" for a REMOVED Social post / reply (SOCIAL_TODO 29). The rules live in src/lib/social-appeal.ts.
// The browser is not trusted: the person comes from the login cookie, and only the author can appeal.
import { getSessionUser } from "@/lib/session";
import { fileSocialAppeal } from "@/lib/social-appeal";
import { parseSocialKind } from "@/lib/social-appeal-rules";

export type SocialAppealResult = { ok: true } | { error: "short" | "window" | "exists" | "generic" };

export async function submitSocialAppeal(input: { kind: string; id: number; message: string }): Promise<SocialAppealResult> {
  const kind = parseSocialKind(input?.kind);
  if (!kind || typeof input.message !== "string" || !Number.isInteger(input.id)) return { error: "generic" };
  try {
    const user = await getSessionUser();
    if (!user) return { error: "generic" };
    const result = await fileSocialAppeal({ userId: user.id, kind, id: input.id, message: input.message });
    if ("ok" in result) return { ok: true };
    if (result.error === "message") return { error: "short" };
    if (result.error === "window" || result.error === "exists") return { error: result.error };
    return { error: "generic" };
  } catch (error) {
    console.error("submitSocialAppeal failed:", error);
    return { error: "generic" };
  }
}
