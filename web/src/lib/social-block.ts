// Block and Mute: the writes (SOCIAL_TODO A7, patch-social-block). The server actions call these inside a transaction;
// a test calls them too, so the rules live in ONE place. The words (what Block and Mute mean) are in social-block-rules.ts.
//
// Rules (ACCOUNT_RULES.md 3.16):
//  - the person comes from the login cookie (getSessionUser: only an ACTIVE account);
//  - nobody blocks or mutes themselves;
//  - BLOCK and MUTE need a target whose posts may be shown (`isSocialAuthorShown`); an unknown or hidden target is
//    "not found" (it does not say which). UNBLOCK and UNMUTE are always allowed, whatever the state of the other account;
//  - doing the same thing twice changes nothing (no error, no second row);
//  - BLOCK removes every follow between the two, in BOTH directions. Unblock does not bring a follow back;
//  - the other person is never told (no notification, no message). A refused action looks like any other refusal;
//  - `isBlockedEitherWay` is the ONE question the write paths ask (follow, like, repost, quote, reply, mention).
// Not here: login check and rate limit (the action does them first).
import type { Prisma } from "../../generated/prisma/client";
import { isSocialAuthorShown } from "@/lib/social-visibility";

type Db = Prisma.TransactionClient;

export const MAX_BLOCK_USERNAME_LENGTH = 64;

/** Usernames are saved in lower case; accept a little noise from the browser, refuse everything else (same rule as Follow). */
export function cleanBlockUsername(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().toLowerCase();
  return name.length > 0 && name.length <= MAX_BLOCK_USERNAME_LENGTH ? name : null;
}

/** True when either person blocked the other. Same person or an empty id: false. */
export async function isBlockedEitherWay(db: Db, aId: string, bId: string): Promise<boolean> {
  if (!aId || !bId || aId === bId) return false;
  const row = await db.socialBlock.findFirst({
    where: { OR: [{ blockerId: aId, blockedId: bId }, { blockerId: bId, blockedId: aId }] },
    select: { blockerId: true },
  });
  return row !== null;
}

export type SocialBlockResult =
  | { ok: true; blocked: boolean; changed: boolean; followsRemoved: number }
  | { ok: false; reason: "error" | "notfound" | "self" };

export async function applySocialBlock(
  db: Db,
  input: { actorId: string; username: unknown; block: unknown },
): Promise<SocialBlockResult> {
  const username = cleanBlockUsername(input.username);
  if (username === null || typeof input.block !== "boolean" || !input.actorId) return { ok: false, reason: "error" };

  const target = await db.user.findFirst({ where: { username }, select: { id: true, status: true, deletedAt: true } });
  if (!target) return { ok: false, reason: "notfound" };
  if (target.id === input.actorId) return { ok: false, reason: "self" };

  const key = { blockerId_blockedId: { blockerId: input.actorId, blockedId: target.id } };
  const existing = await db.socialBlock.findUnique({ where: key, select: { blockerId: true } });

  let changed = false;
  let followsRemoved = 0;

  if (input.block) {
    if (!existing) {
      if (!isSocialAuthorShown(target)) return { ok: false, reason: "notfound" };
      await db.socialBlock.create({ data: { blockerId: input.actorId, blockedId: target.id } });
      changed = true;
      const removed = await db.follow.deleteMany({
        where: {
          OR: [
            { followerId: input.actorId, followingId: target.id },
            { followerId: target.id, followingId: input.actorId },
          ],
        },
      });
      followsRemoved = removed.count;
    }
  } else if (existing) {
    await db.socialBlock.delete({ where: key });
    changed = true;
  }

  return { ok: true, blocked: input.block, changed, followsRemoved };
}

export type SocialMuteResult =
  | { ok: true; muted: boolean; changed: boolean }
  | { ok: false; reason: "error" | "notfound" | "self" };

export async function applySocialMute(
  db: Db,
  input: { actorId: string; username: unknown; mute: unknown },
): Promise<SocialMuteResult> {
  const username = cleanBlockUsername(input.username);
  if (username === null || typeof input.mute !== "boolean" || !input.actorId) return { ok: false, reason: "error" };

  const target = await db.user.findFirst({ where: { username }, select: { id: true, status: true, deletedAt: true } });
  if (!target) return { ok: false, reason: "notfound" };
  if (target.id === input.actorId) return { ok: false, reason: "self" };

  const key = { muterId_mutedId: { muterId: input.actorId, mutedId: target.id } };
  const existing = await db.socialMute.findUnique({ where: key, select: { muterId: true } });

  let changed = false;
  if (input.mute) {
    if (!existing) {
      if (!isSocialAuthorShown(target)) return { ok: false, reason: "notfound" };
      await db.socialMute.create({ data: { muterId: input.actorId, mutedId: target.id } });
      changed = true;
    }
  } else if (existing) {
    await db.socialMute.delete({ where: key });
    changed = true;
  }

  return { ok: true, muted: input.mute, changed };
}

/** Final erasure of an account (purge-social.ts): every block and mute the person made or received. Safe to run twice. */
export async function eraseSocialBlocks(db: Db, userId: string): Promise<number> {
  const blocks = await db.socialBlock.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
  const mutes = await db.socialMute.deleteMany({ where: { OR: [{ muterId: userId }, { mutedId: userId }] } });
  return blocks.count + mutes.count;
}
