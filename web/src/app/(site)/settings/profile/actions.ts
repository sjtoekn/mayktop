"use server";

// Save the profile: display name, bio and the professional fields (patch-profile-security; SITE_PLAN C7). The person comes
// from the login cookie only; the rules are in src/lib/profile-rules.ts (tested by `npm run test:profile`).
// "Verified" is NOT set here: only an admin can give it (src/lib/staff.ts), so this action never reads or writes it.
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { takeActionDb } from "@/lib/rate-limit-db";
import { applyProfile, type ProfileDb } from "@/lib/profile";
import { profileConfig } from "@/config/site";
import { getAccess } from "@/lib/reputation";
import { hasPrivilege } from "@/lib/reputation-rules";

const rules = profileConfig.profileEdit.map((rule) => ({ max: rule.max, windowMs: rule.windowSeconds * 1000 }));

export type ProfileErrorCode =
  | "login" | "tooMany" | "nameLong" | "nameReserved" | "bioLong"
  | "professionLong" | "qualificationsLong" | "websiteInvalid" | "linksInvalid"
  | "videoInvalid" | "linksLocked" | "videoLocked" | "generic";
export type ProfileInput = {
  displayName: string;
  bio: string;
  profession: string;
  qualifications: string;
  website: string;
  video: string; // a YouTube address, or empty
  links: Record<string, string>; // by kind: { linkedin: "https://...", github: "" }
};
export type ProfileActionResult =
  | { ok: true; displayName: string; bio: string; profession: string; qualifications: string; website: string; video: string; links: Record<string, string> }
  | { error: ProfileErrorCode };

const ERRORS: Record<string, ProfileErrorCode> = {
  "name-long": "nameLong",
  "name-reserved": "nameReserved",
  "bio-long": "bioLong",
  "profession-long": "professionLong",
  "qualifications-long": "qualificationsLong",
  "website-invalid": "websiteInvalid",
  "links-invalid": "linksInvalid",
  "video-invalid": "videoInvalid",
  "links-locked": "linksLocked",
  "video-locked": "videoLocked",
};

export async function saveProfile(input: ProfileInput): Promise<ProfileActionResult> {
  const viewer = await getSessionUser();
  if (!viewer) return { error: "login" };
  if (!(await takeActionDb(`profile-edit:${viewer.id}`, rules)).ok) return { error: "tooMany" };

  try {
    const rawLinks = input?.links && typeof input.links === "object" && !Array.isArray(input.links) ? input.links : {};
    // A web link or a video on the profile has to be earned, like in a post (reputationConfig.privileges); staff may always.
    const access = await getAccess(viewer.id);
    const result = await applyProfile(prisma as unknown as ProfileDb, {
      userId: viewer.id,
      displayName: input?.displayName,
      bio: input?.bio,
      profession: input?.profession,
      qualifications: input?.qualifications,
      website: input?.website,
      profileVideo: input?.video,
      allowLinks: hasPrivilege(access.reputation, "link", access.staff),
      allowVideo: hasPrivilege(access.reputation, "video", access.staff),
      socialLinks: Object.entries(rawLinks).map(([kind, url]) => ({ kind, url })),
    });
    if (!result.ok) return { error: ERRORS[result.error] ?? "generic" };
    // The name shows on cached Social feeds and post pages: let them read it again.
    updateTag("social-posts");
    return {
      ok: true,
      displayName: result.displayName ?? "",
      bio: result.bio ?? "",
      profession: result.profession ?? "",
      qualifications: result.qualifications ?? "",
      website: result.website ?? "",
      video: result.profileVideo ?? "",
      links: Object.fromEntries((result.socialLinks ?? []).map((link) => [link.kind, link.url])),
    };
  } catch (error) {
    console.error("saveProfile failed:", error);
    return { error: "generic" };
  }
}
