// Saves the profile (patch-profile-security; professional fields: SITE_PLAN C7). The rules are in profile-rules.ts; this only reads the staff flag and writes.
// `db` is the Prisma client or a transaction; a test passes a small stand-in.
// The professional fields are optional in the input: a caller that does not send one leaves it as it was.
import {
  cleanBio,
  cleanDisplayName,
  cleanProfession,
  cleanProfileVideo,
  cleanQualifications,
  cleanSocialLinks,
  cleanWebsite,
  serialiseSocialLinks,
  type SocialLink,
} from "@/lib/profile-rules";
import { containsLink } from "@/lib/reputation-rules";

export type ProfileData = {
  displayName: string | null;
  bio: string | null;
  profession?: string | null;
  qualifications?: string | null;
  website?: string | null;
  socialLinks?: string | null;
  profileVideo?: string | null;
};

export type ProfileDb = {
  user: {
    findUnique(args: { where: { id: string }; select: { role: true; bio: true; profession: true; qualifications: true; website: true; socialLinks: true; profileVideo: true } }): Promise<{ role: string; bio?: string | null; profession?: string | null; qualifications?: string | null; website?: string | null; socialLinks?: string | null; profileVideo?: string | null } | null>;
    update(args: { where: { id: string }; data: ProfileData }): Promise<unknown>;
  };
};

export type ProfileResult =
  | {
      ok: true;
      displayName: string | null;
      bio: string | null;
      // Only present when the caller sent that field.
      profession?: string | null;
      qualifications?: string | null;
      website?: string | null;
      socialLinks?: SocialLink[];
      profileVideo?: string | null;
    }
  | {
      ok: false;
      error:
        | "name-long" | "name-reserved" | "bio-long"
        | "profession-long" | "qualifications-long" | "website-invalid" | "links-invalid"
        | "video-invalid" | "links-locked" | "video-locked"
        | "input" | "missing";
    };

export async function applyProfile(
  db: ProfileDb,
  input: {
    userId: string;
    displayName: unknown;
    bio: unknown;
    profession?: unknown;
    qualifications?: unknown;
    website?: unknown;
    socialLinks?: unknown;
    profileVideo?: unknown;
    // What the person's reputation allows (SITE_PLAN D). `false` = may not ADD OR CHANGE one (keeping or removing what is there is always fine).
    // Left out = allowed, so old callers and tests are unchanged.
    allowLinks?: boolean;
    allowVideo?: boolean;
  },
): Promise<ProfileResult> {
  const user = await db.user.findUnique({ where: { id: input.userId }, select: { role: true, bio: true, profession: true, qualifications: true, website: true, socialLinks: true, profileVideo: true } });
  if (!user) return { ok: false, error: "missing" };

  // A web address typed into a free-text field is a link too (SITE_PLAN D9): adding or changing one needs the "link" privilege.
  // Keeping the text that is already stored, or removing the link, is always fine (old profiles are not locked out of saving).
  const linkTyped = (cleaned: string | null, stored: string | null | undefined) =>
    input.allowLinks === false && cleaned !== null && cleaned !== (stored ?? null) && containsLink(cleaned);

  const name = cleanDisplayName(input.displayName, user.role !== "USER");
  if (!name.ok) return { ok: false, error: name.reason === "long" ? "name-long" : name.reason === "reserved" ? "name-reserved" : "input" };
  const bio = cleanBio(input.bio);
  if (!bio.ok) return { ok: false, error: bio.reason === "long" ? "bio-long" : "input" };

  if (linkTyped(bio.bio, user.bio)) return { ok: false, error: "links-locked" };

  const data: ProfileData = { displayName: name.name, bio: bio.bio };
  let profession: string | null | undefined;
  let qualifications: string | null | undefined;
  let website: string | null | undefined;
  let links: SocialLink[] | undefined;
  let profileVideo: string | null | undefined;

  if (input.profession !== undefined) {
    const cleaned = cleanProfession(input.profession);
    if (!cleaned.ok) return { ok: false, error: cleaned.reason === "long" ? "profession-long" : "input" };
    if (linkTyped(cleaned.value, user.profession)) return { ok: false, error: "links-locked" };
    profession = data.profession = cleaned.value;
  }
  if (input.qualifications !== undefined) {
    const cleaned = cleanQualifications(input.qualifications);
    if (!cleaned.ok) return { ok: false, error: cleaned.reason === "long" ? "qualifications-long" : "input" };
    if (linkTyped(cleaned.value, user.qualifications)) return { ok: false, error: "links-locked" };
    qualifications = data.qualifications = cleaned.value;
  }
  if (input.website !== undefined) {
    const cleaned = cleanWebsite(input.website);
    if (!cleaned.ok) return { ok: false, error: cleaned.reason === "invalid" || cleaned.reason === "long" ? "website-invalid" : "input" };
    if (input.allowLinks === false && cleaned.url !== null && cleaned.url !== (user.website ?? null)) return { ok: false, error: "links-locked" };
    website = data.website = cleaned.url;
  }
  if (input.socialLinks !== undefined) {
    const cleaned = cleanSocialLinks(input.socialLinks);
    if (!cleaned.ok) return { ok: false, error: cleaned.reason === "invalid" ? "links-invalid" : "input" };
    const serialised = serialiseSocialLinks(cleaned.links);
    if (input.allowLinks === false && serialised !== null && serialised !== (user.socialLinks ?? null)) return { ok: false, error: "links-locked" };
    links = cleaned.links;
    data.socialLinks = serialised;
  }
  if (input.profileVideo !== undefined) {
    const cleaned = cleanProfileVideo(input.profileVideo);
    if (!cleaned.ok) return { ok: false, error: cleaned.reason === "invalid" || cleaned.reason === "long" ? "video-invalid" : "input" };
    if (input.allowVideo === false && cleaned.url !== null && cleaned.url !== (user.profileVideo ?? null)) return { ok: false, error: "video-locked" };
    profileVideo = data.profileVideo = cleaned.url;
  }

  await db.user.update({ where: { id: input.userId }, data });
  return {
    ok: true,
    displayName: name.name,
    bio: bio.bio,
    ...(profession !== undefined && { profession }),
    ...(qualifications !== undefined && { qualifications }),
    ...(website !== undefined && { website }),
    ...(links !== undefined && { socialLinks: links }),
    ...(profileVideo !== undefined && { profileVideo }),
  };
}
