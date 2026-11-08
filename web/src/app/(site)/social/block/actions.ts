"use server";

// Block / unblock and mute / unmute a person (SOCIAL_TODO A7, patch-social-block).
//  1. Nobody logged in (or the account is suspended / banned / deleting): refused with login: true.
//  2. Rate limit: socialLimits.blocks per person, Block and Mute counted together (server memory; a shared limiter is TODO 50).
//  3. The rules are in src/lib/social-block.ts and run in ONE transaction. The browser is not trusted: the person comes
//     from the login cookie only. The other person is never told.
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { socialLimits } from "@/config/site";
import { takeAction } from "@/lib/social-limits";
import { applySocialBlock, applySocialMute } from "@/lib/social-block";
import type { Prisma } from "../../../../../generated/prisma/client";

const blockRules = socialLimits.blocks.map((rule) => ({ max: rule.max, windowMs: rule.windowSeconds * 1000 }));

export type SocialBlockActionResult = { error: true; login?: true; tooMany?: true } | { on: boolean };

async function run(
  username: string,
  desired: boolean,
  work: (tx: Prisma.TransactionClient, actorId: string) => Promise<{ ok: boolean }>,
): Promise<SocialBlockActionResult> {
  if (typeof username !== "string" || typeof desired !== "boolean") return { error: true };

  const viewer = await getSessionUser();
  if (!viewer) return { error: true, login: true };

  if (!takeAction(`block:${viewer.id}`, blockRules).ok) return { error: true, tooMany: true };

  // Two quick clicks can both pass the "no row yet" check; the database refuses the second row (P2002). One more try
  // then sees the first row and reports the state, so the person never sees an error for it.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await prisma.$transaction((tx) => work(tx, viewer.id));
      if (!result.ok) return { error: true };
      updateTag("notifications"); // the bell and the list hide / show notifications of this person
      return { on: desired };
    } catch (error) {
      if ((error as { code?: string } | null)?.code === "P2002" && attempt === 0) continue;
      console.error("social block / mute failed:", error);
      return { error: true };
    }
  }
  return { error: true };
}

export async function setSocialBlock(username: string, desiredBlocked: boolean): Promise<SocialBlockActionResult> {
  return run(username, desiredBlocked, (tx, actorId) => applySocialBlock(tx, { actorId, username, block: desiredBlocked }));
}

export async function setSocialMute(username: string, desiredMuted: boolean): Promise<SocialBlockActionResult> {
  return run(username, desiredMuted, (tx, actorId) => applySocialMute(tx, { actorId, username, mute: desiredMuted }));
}
