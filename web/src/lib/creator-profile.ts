// Joining the creator program and saving payout settings (TODO 12, S6). Server only. The rules are in creator-profile-rules.ts.
// The person is always the logged-in one (the caller passes the id from the login cookie, never from the browser).
// Payout details are saved ENCRYPTED and only a masked form is ever read back for the page.
import { prisma } from "@/lib/prisma";
import { creatorsConfig } from "@/config/site";
import {
  cleanPayout,
  decryptDetails,
  encryptDetails,
  maskDetails,
  payoutChanged,
  payoutKey,
  type PayoutError,
  type PayoutInput,
} from "@/lib/creator-profile-rules";

export type CreatorSettings = {
  joinedAt: Date;
  termsVersion: string;
  country: string | null;
  method: string | null;
  hasDetails: boolean;
  masked: string | null; // "ma***@mail.com" (null when nothing is saved or it cannot be read)
  detailsChangedAt: Date | null;
  holdUntil: Date | null; // no payout before this (after a change); null = no waiting time now
  frozen: boolean; // staff froze the earnings
};

/** What the settings page shows. Null = the person has not joined. */
export async function getCreatorSettings(userId: string, now: Date = new Date()): Promise<CreatorSettings | null> {
  const row = await prisma.creatorProfile.findUnique({ where: { userId } });
  if (!row) return null;
  const key = payoutKey();
  const plain = key ? decryptDetails(row.payoutDetails, key) : null;
  const holdEnd = row.payoutDetailsChangedAt
    ? new Date(row.payoutDetailsChangedAt.getTime() + creatorsConfig.detailsChangeHoldDays * 86_400_000)
    : null;
  return {
    joinedAt: row.joinedAt,
    termsVersion: row.termsVersion,
    country: row.payoutCountry,
    method: row.payoutMethod,
    hasDetails: !!row.payoutDetails,
    masked: maskDetails(row.payoutMethod, plain),
    detailsChangedAt: row.payoutDetailsChangedAt,
    holdUntil: holdEnd && holdEnd > now ? holdEnd : null,
    frozen: row.earningsHold,
  };
}

export type JoinInput = PayoutInput & { acceptTerms: unknown };
export type SaveResult = { ok: true; changed: boolean } | { ok: false; error: PayoutError | "terms" | "noKey" | "exists" | "notJoined" };

/** Joins the program: terms accepted, a country chosen (payout details are optional now, and can be added later). */
export async function joinCreator(userId: string, input: JoinInput): Promise<SaveResult> {
  if (input.acceptTerms !== true) return { ok: false, error: "terms" };
  const clean = cleanPayout(input);
  if (!clean.ok) return clean;
  const { country, method, details } = clean.value;

  let sealed: string | null = null;
  if (details) {
    const key = payoutKey();
    if (!key) return { ok: false, error: "noKey" }; // no key, no saving: details are never kept as plain text
    sealed = encryptDetails(details, key);
  }
  try {
    await prisma.creatorProfile.create({
      data: {
        userId,
        termsVersion: creatorsConfig.termsVersion,
        payoutCountry: country,
        payoutMethod: method,
        payoutDetails: sealed,
        payoutDetailsChangedAt: sealed ? new Date() : null,
      },
      select: { userId: true },
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") return { ok: false, error: "exists" };
    throw error;
  }
  return { ok: true, changed: !!sealed };
}

/**
 * Saves the country, method and details of someone who joined. Details left empty = keep the saved ones (when the method is
 * the same). A real change starts the waiting time (creatorsConfig.detailsChangeHoldDays) before the next payout.
 */
export async function savePayout(userId: string, input: PayoutInput): Promise<SaveResult> {
  const existing = await prisma.creatorProfile.findUnique({ where: { userId } });
  if (!existing) return { ok: false, error: "notJoined" };
  const clean = cleanPayout(input);
  if (!clean.ok) return clean;
  const { country, method, details } = clean.value;

  // A new method (or a country that now has one) needs its details; the old ones belong to another method.
  if (method && details === null && method !== existing.payoutMethod) return { ok: false, error: method === "PAYPAL" ? "paypal" : "bank" };

  const key = payoutKey();
  if (details && !key) return { ok: false, error: "noKey" };
  const before = {
    country: existing.payoutCountry,
    method: existing.payoutMethod,
    details: key ? decryptDetails(existing.payoutDetails, key) : null,
  };
  const changed = payoutChanged(before, { country, method, details });
  if (!changed) return { ok: true, changed: false };

  await prisma.creatorProfile.update({
    where: { userId },
    data: {
      payoutCountry: country,
      payoutMethod: method,
      // no method = nothing to pay to: the old details are removed; no new details given = the old ones stay
      ...(method === null ? { payoutDetails: null } : details && key ? { payoutDetails: encryptDetails(details, key) } : {}),
      payoutDetailsChangedAt: new Date(),
    },
    select: { userId: true },
  });
  return { ok: true, changed: true };
}
