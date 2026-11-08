// Test for the audit trail of the final erasure (Part 9). Run:  npm run test:purge-audit
// Part 1 needs no database. Part 2 uses the local database but changes NOTHING: everything happens inside one transaction
// that is rolled back at the end (same as test:purge-social).
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { writeSystemAudit } from "../src/lib/purge";
import { erasureAuditReason, isSystemActor, SYSTEM_ACTOR_ID, sweepAuditReason, warningAuditReason } from "../src/lib/purge-rules";
import { AuditAction, AuditTarget, Role, UserStatus } from "../generated/prisma/client";

function ok(name: string) { console.log("OK  " + name); }
class Rollback extends Error {}

function part1() {
  // The three reasons are written to be KEPT: no name, no e-mail, no username, no text the person wrote.
  const w = warningAuditReason("Ban", new Date("2026-11-20T10:00:00Z"));
  const e1 = erasureAuditReason({ kind: "ban", reasons: ["BAN", "OPEN_REPORT"], recordId: 12, keepDays: 730 });
  const e2 = erasureAuditReason({ kind: "deletion", reasons: [], recordId: null, keepDays: 180 });
  const s = sweepAuditReason(12);
  assert.equal(w, "ban erasure warning e-mailed; erase on or after 2026-11-20T10:00:00.000Z");
  assert.equal(e1, "account erased (ban); safety record #12 (BAN+OPEN_REPORT) kept 730 days");
  assert.equal(e2, "account erased (deletion); no safety record kept");
  assert.equal(s, "safety record #12 deleted: keep-until date passed and no legal hold");
  ok("the four reasons say what happened and nothing else");

  assert.equal(isSystemActor(SYSTEM_ACTOR_ID), true);
  assert.equal(isSystemActor("clx123abc"), false);
  ok("only the system id counts as the system actor");
}

async function part2() {
  const now = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      const stamp = Date.now();
      const person = await tx.user.create({ data: { username: `t_audit_${stamp}`, email: `t_audit_${stamp}@example.invalid` } });

      await writeSystemAudit(tx, AuditAction.ACCOUNT_ERASE_WARNED, person.id, warningAuditReason("Deletion", now));
      await writeSystemAudit(tx, AuditAction.ACCOUNT_ERASED, person.id, erasureAuditReason({ kind: "deletion", reasons: [], recordId: null, keepDays: 180 }));

      const shells = await tx.user.findMany({ where: { id: SYSTEM_ACTOR_ID } });
      assert.equal(shells.length, 1);
      ok("calling it twice made exactly one system actor");

      const sys = shells[0];
      assert.equal(sys.role, Role.USER);
      assert.equal(sys.status, UserStatus.DELETED);
      assert.equal(await tx.account.count({ where: { userId: sys.id } }), 0);
      assert.equal(await tx.session.count({ where: { userId: sys.id } }), 0);
      ok("the system actor is not an admin, has no login method and no session");

      const rows = await tx.auditLog.findMany({ where: { targetType: AuditTarget.USER, targetId: person.id }, orderBy: { id: "asc" } });
      assert.deepEqual(rows.map((r) => r.action), [AuditAction.ACCOUNT_ERASE_WARNED, AuditAction.ACCOUNT_ERASED]);
      assert.ok(rows.every((r) => r.actorId === SYSTEM_ACTOR_ID && r.actorRole === Role.USER));
      ok("the rows are attributed to the system actor and point to the account id");

      for (const r of rows) {
        const text = JSON.stringify(r);
        assert.ok(!text.includes(person.email) && !text.includes(person.username));
      }
      ok("no e-mail address and no username is written into an audit row");

      // The sweep's guard (same condition as in runPurge): a held record is never deleted, an expired free one is.
      const past = new Date(now.getTime() - 86_400_000);
      const mkRecord = (hold: boolean) =>
        tx.safetyRecord.create({
          data: { userId: person.id, emailHash: "x", accountCreatedAt: past, reasons: "BAN", auditLogIds: "[]", content: "{}", appeals: "[]", keepUntil: past, legalHold: hold },
          select: { id: true },
        });
      const held = await mkRecord(true);
      const free = await mkRecord(false);
      const del = (id: number) => tx.safetyRecord.deleteMany({ where: { id, legalHold: false, keepUntil: { lte: now } } });
      assert.equal((await del(held.id)).count, 0);
      assert.equal((await del(free.id)).count, 1);
      assert.equal(await tx.safetyRecord.count({ where: { id: held.id } }), 1);
      ok("a record under legal hold is not deleted, an expired one without a hold is");

      throw new Rollback(); // leave the database exactly as it was
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

async function main() {
  part1();
  await part2();
  console.log("\nAll erasure audit tests passed (nothing was saved to the database).");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
