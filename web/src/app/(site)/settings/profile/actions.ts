"use server";

// Save the profile: display name and bio (patch-profile-security). The person comes from the login cookie only;
// the rules are in src/lib/profile-rules.ts (tested by `npm run test:profile`).
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { takeActionDb } from "@/lib/rate-limit-db";
import { applyProfile, type ProfileDb } from "@/lib/profile";
import { profileConfig } from "@/config/site";

const rules = profileConfig.profileEdit.map((rule) => ({ max: rule.max, windowMs: rule.windowSeconds * 1000 }));

export type ProfileErrorCode = "login" | "tooMany" | "nameLong" | "nameReserved" | "bioLong" | "generic";
export type ProfileActionResult = { ok: true; displayName: string; bio: string } | { error: ProfileErrorCode };

export async function saveProfile(input: { displayName: string; bio: string }): Promise<ProfileActionResult> {
  const viewer = await getSessionUser();
  if (!viewer) return { error: "login" };
  if (!(await takeActionDb(`profile-edit:${viewer.id}`, rules)).ok) return { error: "tooMany" };

  try {
    const result = await applyProfile(prisma as unknown as ProfileDb, { userId: viewer.id, displayName: input?.displayName, bio: input?.bio });
    if (!result.ok) {
      if (result.error === "name-long") return { error: "nameLong" };
      if (result.error === "name-reserved") return { error: "nameReserved" };
      if (result.error === "bio-long") return { error: "bioLong" };
      return { error: "generic" };
    }
    // The name shows on cached Social feeds and post pages: let them read it again.
    updateTag("social-posts");
    return { ok: true, displayName: result.displayName ?? "", bio: result.bio ?? "" };
  } catch (error) {
    console.error("saveProfile failed:", error);
    return { error: "generic" };
  }
}
