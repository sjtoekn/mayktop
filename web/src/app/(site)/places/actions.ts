"use server";

// Adds a new Place (Photos plan, stage 3). A login is needed (anybody may SEE places).
//  1. Every field is checked and cleaned on the server (src/lib/place-input.ts).
//  2. Nobody logged in: refused with reason "login".
//  3. Rate limit (placeLimits in src/config/site.ts): counted from the person's earlier places in the database, in the same
//     transaction as the save. Removed places count too. A new account gets the stricter limits (limitsFor).
//  4. The same place twice: the database key `dupKey` is UNIQUE; a second copy is answered with reason "exists" (and the id of
//     the existing place when it may be shown), so the person can open it instead.
import { placeLimits } from "@/config/site";
import { limitsFor } from "@/lib/account-limits";
import { parsePlaceInput, type PlaceField } from "@/lib/place-input";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { checkRules, type RateRule } from "@/lib/social-limits";

const createRules: RateRule[] = placeLimits.creates.map((rule) => ({ max: rule.max, windowMs: rule.windowMinutes * 60_000 }));
const LONGEST_WINDOW_MS = Math.max(...createRules.map((rule) => rule.windowMs));

export type CreatePlaceResult =
  | { ok: true; id: number }
  | { ok: false; reason: "login" | "error" | "tooMany" | "exists" | PlaceField; waitMinutes?: number; existingId?: number };

export async function createPlace(form: FormData): Promise<CreatePlaceResult> {
  if (!(form instanceof FormData)) return { ok: false, reason: "error" };

  const parsed = parsePlaceInput(form);
  if (!parsed.ok) return { ok: false, reason: parsed.field };
  const value = parsed.value;

  const owner = await getSessionUser();
  if (!owner) return { ok: false, reason: "login" };

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const now = Date.now();
      const same = await tx.place.findUnique({ where: { dupKey: value.dupKey }, select: { id: true, status: true, deletedAt: true } });
      if (same) return { kind: "exists" as const, id: same.status === "VISIBLE" && same.deletedAt === null ? same.id : undefined };

      const earlier = await tx.place.findMany({
        where: { createdById: owner.id, createdAt: { gte: new Date(now - LONGEST_WINDOW_MS) } },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      const rate = checkRules(earlier.map((row) => row.createdAt.getTime()), limitsFor(createRules, owner), now);
      if (!rate.ok) return { kind: "rate" as const, retryAfterMs: rate.retryAfterMs };

      const created = await tx.place.create({
        data: {
          name: value.name,
          type: value.type,
          city: value.city,
          region: value.region,
          country: value.country,
          description: value.description,
          latitude: value.latitude,
          longitude: value.longitude,
          website: value.website,
          dupKey: value.dupKey,
          createdById: owner.id,
        },
        select: { id: true },
      });
      return { kind: "ok" as const, id: created.id };
    });

    if (outcome.kind === "exists") return { ok: false, reason: "exists", existingId: outcome.id };
    if (outcome.kind === "rate") return { ok: false, reason: "tooMany", waitMinutes: Math.max(1, Math.ceil(outcome.retryAfterMs / 60_000)) };
    return { ok: true, id: outcome.id };
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") return { ok: false, reason: "exists" }; // two people added it at the same moment
    console.error("createPlace failed:", error);
    return { ok: false, reason: "error" };
  }
}
