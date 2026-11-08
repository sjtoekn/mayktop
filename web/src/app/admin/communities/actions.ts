"use server";

// Appoint or remove ONE moderator (admin Part 7). The ACTOR is the logged-in admin, never a form value.
// "Only an active admin", the written reason, the limit on large communities, "never the last moderator" and the
// audit row are all enforced in moderators.ts (appointModerator / removeModerator).
import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { appointModerator, removeModerator, type ModError } from "@/lib/moderators";

export type ModeratorActionResult = { ok: true } | { error: ModError | "other" };

export async function moderatorAction(input: {
  kind: "add" | "remove";
  community: string;
  person: string;
  reason: string;
}): Promise<ModeratorActionResult> {
  const me = await requireAdmin(); // not logged in -> login page; not an admin -> 404
  if (
    !input ||
    (input.kind !== "add" && input.kind !== "remove") ||
    typeof input.community !== "string" ||
    typeof input.person !== "string" ||
    typeof input.reason !== "string"
  ) {
    return { error: "other" };
  }
  const person = input.person.trim().replace(/^@/, "");
  if (person.length === 0 || person.length > 64) return { error: "notfound" };
  try {
    const args = { actor: me.username, community: input.community, person, reason: input.reason };
    const result = input.kind === "add" ? await appointModerator(args) : await removeModerator(args);
    if ("error" in result) return { error: result.error };
    updateTag("communities");
    revalidatePath("/admin/communities");
    revalidatePath("/admin/people");
    return { ok: true };
  } catch (error) {
    console.error("moderatorAction failed:", error);
    return { error: "other" };
  }
}
