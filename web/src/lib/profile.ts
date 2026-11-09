// Saves the profile (patch-profile-security). The rules are in profile-rules.ts; this only reads the staff flag and writes.
// `db` is the Prisma client or a transaction; a test passes a small stand-in.
import { cleanBio, cleanDisplayName } from "@/lib/profile-rules";

export type ProfileDb = {
  user: {
    findUnique(args: { where: { id: string }; select: { role: true } }): Promise<{ role: string } | null>;
    update(args: { where: { id: string }; data: { displayName: string | null; bio: string | null } }): Promise<unknown>;
  };
};

export type ProfileResult =
  | { ok: true; displayName: string | null; bio: string | null }
  | { ok: false; error: "name-long" | "name-reserved" | "bio-long" | "input" | "missing" };

export async function applyProfile(
  db: ProfileDb,
  input: { userId: string; displayName: unknown; bio: unknown },
): Promise<ProfileResult> {
  const user = await db.user.findUnique({ where: { id: input.userId }, select: { role: true } });
  if (!user) return { ok: false, error: "missing" };

  const name = cleanDisplayName(input.displayName, user.role !== "USER");
  if (!name.ok) return { ok: false, error: name.reason === "long" ? "name-long" : name.reason === "reserved" ? "name-reserved" : "input" };
  const bio = cleanBio(input.bio);
  if (!bio.ok) return { ok: false, error: bio.reason === "long" ? "bio-long" : "input" };

  await db.user.update({ where: { id: input.userId }, data: { displayName: name.name, bio: bio.bio } });
  return { ok: true, displayName: name.name, bio: bio.bio };
}
