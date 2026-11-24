// Paying creators by hand (TODO 12, S8). Server only. The caller (the server action / route) has already checked that the person is an admin.
// The rules (who is ready, the CSV) are in creator-payout-rules.ts. Here: reading the ledger, making a round, marking paid / failed,
// freezing, reversing. Every admin step writes ONE AuditLog row in the SAME transaction as the change.
//
// How money moves (nothing is ever deleted):
//   open row (EarningEntry, payoutId = null)  --make round-->  row.payoutId = Payout.id, Payout PENDING
//   Payout PENDING --mark paid (+ reference)--> PAID   (the rows stay with it forever: this IS the PAYOUT record of the plan)
//   Payout PENDING --mark failed (+ reason)---> FAILED (rows go back to the open balance)
// A row can be in ONE payout only (updateMany where payoutId is null, count checked), and a payout can be marked once (updateMany where PENDING).
import { prisma } from "@/lib/prisma";
import { creatorsConfig } from "@/config/site";
import { decryptDetails, payoutKey } from "@/lib/creator-profile-rules";
import {
  cleanReason,
  cleanReference,
  payoutCsv,
  planPayouts,
  sumMicro,
  type BlockedCreator,
  type CreatorForPayout,
  type ReadyPayout,
} from "@/lib/creator-payout-rules";
import { AuditAction, AuditTarget, Role, UserStatus } from "../../generated/prisma/client";

export type PayoutError =
  | "type" | "empty" | "conflict" | "state" | "notfound" | "reference" | "duplicate" | "reason" | "frozen" | "notallowed" | "nokey" | "country";

class Refused extends Error {
  constructor(public code: PayoutError) { super(code); }
}

type Reader = Pick<typeof prisma, "earningEntry" | "creatorProfile" | "user">;

/** Everybody with open (not yet paid-out) money, ready for planPayouts. */
async function loadCreators(db: Reader): Promise<CreatorForPayout[]> {
  const rows = await db.earningEntry.findMany({
    where: { status: "ACTIVE", payoutId: null },
    select: { id: true, userId: true, amountMicroUsd: true, createdAt: true },
  });
  const byUser = new Map<string, CreatorForPayout["rows"]>();
  for (const r of rows) {
    const list = byUser.get(r.userId) ?? [];
    list.push({ id: r.id, amountMicroUsd: r.amountMicroUsd, createdAtMs: r.createdAt.getTime() });
    byUser.set(r.userId, list);
  }
  const ids = [...byUser.keys()];
  if (ids.length === 0) return [];
  const [profiles, users] = await Promise.all([
    db.creatorProfile.findMany({ where: { userId: { in: ids } } }),
    db.user.findMany({ where: { id: { in: ids } }, select: { id: true, username: true, status: true } }),
  ]);
  const profile = new Map(profiles.map((p) => [p.userId, p]));
  const user = new Map(users.map((u) => [u.id, u]));
  const out: CreatorForPayout[] = [];
  for (const [userId, list] of byUser) {
    const p = profile.get(userId);
    const u = user.get(userId);
    if (!p || !u) continue; // money without a profile cannot be paid (never happens: settlement needs a profile)
    out.push({
      userId,
      username: u.username,
      accountActive: u.status === UserStatus.ACTIVE,
      country: p.payoutCountry,
      method: p.payoutMethod,
      hasDetails: !!p.payoutDetails,
      frozen: p.earningsHold,
      detailsChangedAtMs: p.payoutDetailsChangedAt ? p.payoutDetailsChangedAt.getTime() : null,
      rows: list,
    });
  }
  return out;
}

export type PayoutLine = {
  id: number;
  username: string;
  country: string;
  method: string;
  amountMicro: number;
  status: string;
  reference: string | null;
  paidAt: Date | null;
  createdAt: Date;
};
export type BatchView = { id: number; status: string; note: string | null; createdAt: Date; payouts: PayoutLine[] };
export type FrozenView = { userId: string; username: string; note: string | null; openMicro: number };
export type PayoutsPage = {
  country: string | null;
  ready: ReadyPayout[];
  readyMicro: number;
  blocked: BlockedCreator[];
  batches: BatchView[]; // OPEN rounds (something still to pay), newest first
  recentPaid: PayoutLine[]; // last 20 paid
  frozen: FrozenView[];
  keyReady: boolean; // CREATOR_PAYOUT_KEY is set (needed to export)
};

const toLine = (p: {
  id: number; amountMicroUsd: number; country: string; method: string; status: string; reference: string | null;
  paidAt: Date | null; createdAt: Date; user: { username: string };
}): PayoutLine => ({
  id: p.id, username: p.user.username, country: p.country, method: p.method, amountMicro: p.amountMicroUsd,
  status: p.status, reference: p.reference, paidAt: p.paidAt, createdAt: p.createdAt,
});

/** Everything the /admin/payouts page shows. `country` filters the "ready" list (null = all payout countries). */
export async function loadPayoutsPage(country: string | null, now: Date = new Date()): Promise<PayoutsPage> {
  const creators = await loadCreators(prisma);
  const plan = planPayouts(creators, now.getTime());
  const ready = country ? plan.ready.filter((r) => r.country === country) : plan.ready;
  const blocked = country ? plan.blocked.filter((b) => (b.country ?? "").toUpperCase() === country || b.reason === "account") : plan.blocked;

  const [batches, paid, frozenRows] = await Promise.all([
    prisma.payoutBatch.findMany({
      where: { status: "OPEN" },
      orderBy: { id: "desc" },
      take: 20,
      include: { payouts: { orderBy: { id: "asc" }, include: { user: { select: { username: true } } } } },
    }),
    prisma.payout.findMany({
      where: { status: "PAID" },
      orderBy: { paidAt: "desc" },
      take: 20,
      include: { user: { select: { username: true } } },
    }),
    prisma.creatorProfile.findMany({ where: { earningsHold: true }, include: { user: { select: { username: true } } } }),
  ]);
  const openByUser = new Map(creators.map((c) => [c.userId, sumMicro(c.rows)]));
  return {
    country,
    ready,
    readyMicro: ready.reduce((n, r) => n + r.amountMicro, 0),
    blocked,
    batches: batches.map((b) => ({ id: b.id, status: b.status, note: b.note, createdAt: b.createdAt, payouts: b.payouts.map(toLine) })),
    recentPaid: paid.map(toLine),
    frozen: frozenRows.map((f) => ({ userId: f.userId, username: f.user.username, note: f.earningsHoldNote, openMicro: openByUser.get(f.userId) ?? 0 })),
    keyReady: payoutKey() !== null,
  };
}

// ------------------------------------------------------------------ make a round

/**
 * Makes a payout round from everybody who is ready now (optionally only one country). The list is worked out AGAIN inside the
 * transaction, so what is paid is what is true at that moment, not what the page showed a minute ago.
 */
export async function createPayoutBatch(input: { actorId: string; country?: string | null }): Promise<{ ok: true; batchId: number; payouts: number } | { error: PayoutError }> {
  const country = input.country ? input.country.trim().toUpperCase() : null;
  if (country && !creatorsConfig.payoutCountries.includes(country)) return { error: "country" };
  try {
    return await prisma.$transaction(async (tx) => {
      const creators = await loadCreators(tx);
      const plan = planPayouts(creators, Date.now());
      const ready = country ? plan.ready.filter((r) => r.country === country) : plan.ready;
      if (ready.length === 0) throw new Refused("empty");

      const batch = await tx.payoutBatch.create({
        data: { createdById: input.actorId, note: country ?? "ALL" },
        select: { id: true },
      });
      for (const r of ready) {
        const payout = await tx.payout.create({
          data: { batchId: batch.id, userId: r.userId, amountMicroUsd: r.amountMicro, country: r.country, method: r.method },
          select: { id: true },
        });
        // Each row goes into ONE payout only. If somebody else took one a moment ago, the count is smaller: stop, nothing is saved.
        const taken = await tx.earningEntry.updateMany({
          where: { id: { in: r.rowIds }, payoutId: null, status: "ACTIVE" },
          data: { payoutId: payout.id },
        });
        if (taken.count !== r.rowIds.length) throw new Refused("conflict");
      }
      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          actorRole: Role.ADMIN,
          action: AuditAction.PAYOUT_BATCH_CREATED,
          targetType: AuditTarget.PAYOUT,
          targetId: String(batch.id),
          reason: `${ready.length} payouts (${country ?? "all countries"})`,
        },
      });
      return { ok: true as const, batchId: batch.id, payouts: ready.length };
    });
  } catch (error) {
    if (error instanceof Refused) return { error: error.code };
    throw error;
  }
}

// ------------------------------------------------------------------ mark paid / failed

/** The admin paid this payout outside the site (PayPal / bank) and writes down the reference. Works once per payout. */
export async function markPayoutPaid(input: { actorId: string; payoutId: number; reference: unknown }): Promise<{ ok: true } | { error: PayoutError }> {
  if (!Number.isInteger(input.payoutId)) return { error: "type" };
  const reference = cleanReference(input.reference);
  if (!reference) return { error: "reference" };
  try {
    await prisma.$transaction(async (tx) => {
      const payout = await tx.payout.findUnique({ where: { id: input.payoutId }, select: { id: true, userId: true, batchId: true, method: true } });
      if (!payout) throw new Refused("notfound");
      // The same transaction number twice is almost always a copy-paste mistake.
      const same = await tx.payout.findFirst({ where: { reference, method: payout.method, status: "PAID", id: { not: payout.id } }, select: { id: true } });
      if (same) throw new Refused("duplicate");
      const profile = await tx.creatorProfile.findUnique({ where: { userId: payout.userId }, select: { earningsHold: true } });
      if (profile?.earningsHold) throw new Refused("frozen"); // frozen after the round was made: release it, or mark the payout failed
      const changed = await tx.payout.updateMany({
        where: { id: payout.id, status: "PENDING" },
        data: { status: "PAID", reference, paidAt: new Date(), paidById: input.actorId },
      });
      if (changed.count !== 1) throw new Refused("state"); // already paid / failed: never paid twice
      await tx.auditLog.create({
        data: {
          actorId: input.actorId, actorRole: Role.ADMIN, action: AuditAction.PAYOUT_MARKED_PAID,
          targetType: AuditTarget.PAYOUT, targetId: String(payout.id), reason: `reference ${reference}`,
        },
      });
      await closeBatchIfDone(tx, payout.batchId);
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof Refused) return { error: error.code };
    throw error;
  }
}

/** The payment did not work (wrong account, PayPal refused ...). The money goes back to the creator's open balance. */
export async function markPayoutFailed(input: { actorId: string; payoutId: number; reason: unknown }): Promise<{ ok: true } | { error: PayoutError }> {
  if (!Number.isInteger(input.payoutId)) return { error: "type" };
  const reason = cleanReason(input.reason);
  if (!reason) return { error: "reason" };
  try {
    await prisma.$transaction(async (tx) => {
      const payout = await tx.payout.findUnique({ where: { id: input.payoutId }, select: { id: true, batchId: true } });
      if (!payout) throw new Refused("notfound");
      const changed = await tx.payout.updateMany({ where: { id: payout.id, status: "PENDING" }, data: { status: "FAILED" } });
      if (changed.count !== 1) throw new Refused("state");
      await tx.earningEntry.updateMany({ where: { payoutId: payout.id }, data: { payoutId: null } }); // back to the open balance
      await tx.auditLog.create({
        data: {
          actorId: input.actorId, actorRole: Role.ADMIN, action: AuditAction.PAYOUT_FAILED,
          targetType: AuditTarget.PAYOUT, targetId: String(payout.id), reason,
        },
      });
      await closeBatchIfDone(tx, payout.batchId);
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof Refused) return { error: error.code };
    throw error;
  }
}

async function closeBatchIfDone(tx: Pick<typeof prisma, "payout" | "payoutBatch">, batchId: number): Promise<void> {
  const left = await tx.payout.count({ where: { batchId, status: "PENDING" } });
  if (left === 0) await tx.payoutBatch.updateMany({ where: { id: batchId, status: "OPEN" }, data: { status: "DONE", doneAt: new Date() } });
}

// ------------------------------------------------------------------ freeze / reverse

/** Freezes (or releases) a creator's earnings: no round includes them, and an open payout cannot be marked paid. A written reason is required. */
export async function setEarningsHold(input: { actorId: string; userId: string; hold: boolean; reason: unknown }): Promise<{ ok: true } | { error: PayoutError }> {
  if (typeof input.userId !== "string" || typeof input.hold !== "boolean") return { error: "type" };
  const reason = cleanReason(input.reason);
  if (!reason) return { error: "reason" };
  try {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.creatorProfile.updateMany({
        where: { userId: input.userId, earningsHold: !input.hold },
        data: { earningsHold: input.hold, earningsHoldNote: input.hold ? reason : null },
      });
      if (changed.count !== 1) {
        const exists = await tx.creatorProfile.findUnique({ where: { userId: input.userId }, select: { userId: true } });
        throw new Refused(exists ? "state" : "notfound");
      }
      await tx.auditLog.create({
        data: {
          actorId: input.actorId, actorRole: Role.ADMIN,
          action: input.hold ? AuditAction.CREATOR_HOLD_SET : AuditAction.CREATOR_HOLD_RELEASED,
          targetType: AuditTarget.CREATOR, targetId: input.userId, reason,
        },
      });
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof Refused) return { error: error.code };
    throw error;
  }
}

/**
 * Takes back the OPEN balance of a creator (bad traffic found, banned account): one REVERSAL row of minus the open total
 * (append-only: the old rows are not touched), and one audit row. Only allowed when the earnings are frozen or the account is not
 * active, so a normal creator can never be hit by a slip. Money already in a payout is not touched (mark that payout failed first).
 */
export async function reverseOpenEarnings(input: { actorId: string; userId: string; reason: unknown }): Promise<{ ok: true; micro: number } | { error: PayoutError }> {
  if (typeof input.userId !== "string") return { error: "type" };
  const reason = cleanReason(input.reason);
  if (!reason) return { error: "reason" };
  try {
    return await prisma.$transaction(async (tx) => {
      const [profile, user] = await Promise.all([
        tx.creatorProfile.findUnique({ where: { userId: input.userId }, select: { earningsHold: true } }),
        tx.user.findUnique({ where: { id: input.userId }, select: { status: true } }),
      ]);
      if (!profile || !user) throw new Refused("notfound");
      if (!profile.earningsHold && user.status === UserStatus.ACTIVE) throw new Refused("notallowed");
      const rows = await tx.earningEntry.findMany({ where: { userId: input.userId, status: "ACTIVE", payoutId: null }, select: { amountMicroUsd: true } });
      const open = rows.reduce((n, r) => n + r.amountMicroUsd, 0);
      if (open <= 0) throw new Refused("empty");
      await tx.earningEntry.create({
        data: { userId: input.userId, kind: "REVERSAL", amountMicroUsd: -open, note: reason },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          actorId: input.actorId, actorRole: Role.ADMIN, action: AuditAction.EARNING_REVERSED,
          targetType: AuditTarget.CREATOR, targetId: input.userId, reason,
        },
      });
      return { ok: true as const, micro: open };
    });
  } catch (error) {
    if (error instanceof Refused) return { error: error.code };
    throw error;
  }
}

// ------------------------------------------------------------------ CSV export

/**
 * The CSV of ONE method for the PENDING payouts of ONE round. Payment details are decrypted only here, only for this file, and never logged.
 * A payout whose creator changed their details AFTER the round was made is left out (listed in `missing`): mark it failed, the next round
 * will wait the normal time after a change.
 */
export async function exportBatchCsv(batchId: number, method: string): Promise<{ csv: string; missing: number[]; count: number } | { error: PayoutError }> {
  if (!Number.isInteger(batchId) || !(method === "PAYPAL" || method === "BANK_LK")) return { error: "type" };
  const key = payoutKey();
  if (!key) return { error: "nokey" };
  const payouts = await prisma.payout.findMany({
    where: { batchId, method, status: "PENDING" },
    orderBy: { id: "asc" },
    include: { user: { select: { username: true } } },
  });
  if (payouts.length === 0) return { error: "empty" };
  const profiles = await prisma.creatorProfile.findMany({
    where: { userId: { in: payouts.map((p) => p.userId) } },
    select: { userId: true, payoutDetails: true, payoutDetailsChangedAt: true, payoutMethod: true },
  });
  const byUser = new Map(profiles.map((p) => [p.userId, p]));
  const rows = payouts.map((p) => {
    const prof = byUser.get(p.userId);
    const changedLater = !!prof?.payoutDetailsChangedAt && prof.payoutDetailsChangedAt > p.createdAt;
    const usable = prof && prof.payoutMethod === p.method && !changedLater;
    return { payoutId: p.id, username: p.user.username, amountMicro: p.amountMicroUsd, details: usable ? decryptDetails(prof.payoutDetails, key) : null };
  });
  const { csv, missing } = payoutCsv(method, rows);
  return { csv, missing, count: rows.length - missing.length };
}
