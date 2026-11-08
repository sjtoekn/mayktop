"use server";

// "Appeal this decision" for a REMOVED post / comment (TODO 40, PROJECT.md 8g). The rules live in src/lib/appeals.ts.
// The browser is not trusted: the person comes from the login cookie, and only the author can appeal.
import { getSessionUser } from "@/lib/session";
import { fileContentAppeal } from "@/lib/appeals";

export type ContentAppealResult = { ok: true } | { error: "short" | "window" | "exists" | "generic" };

export async function submitContentAppeal(input: { kind: string; id: number; message: string }): Promise<ContentAppealResult> {
  if (input?.kind !== "post" && input?.kind !== "comment") return { error: "generic" };
  if (typeof input.message !== "string" || !Number.isInteger(input.id)) return { error: "generic" };
  try {
    const user = await getSessionUser();
    if (!user) return { error: "generic" };
    const result = await fileContentAppeal({ userId: user.id, kind: input.kind, id: input.id, message: input.message });
    if ("ok" in result) return { ok: true };
    if (result.error === "message") return { error: "short" };
    if (result.error === "window" || result.error === "exists") return { error: result.error };
    return { error: "generic" };
  } catch (error) {
    console.error("submitContentAppeal failed:", error);
    return { error: "generic" };
  }
}
