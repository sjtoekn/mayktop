// Final erasure tool (TODO 36e). Run from the web/ folder:
//   npm run purge                      PREVIEW: shows who would be warned / erased. Changes nothing, sends nothing.
//   npm run purge -- --run             DOES IT: warns (email), erases accounts whose date has passed, sweeps old safety records.
//   npm run purge -- records           lists the safety records (never public; admins only)
//   npm run purge -- hold <admin> <person> "<reason>"          legal hold on a person who is not erased yet
//   npm run purge -- release <admin> <person> "<reason>"       release that hold
//   npm run purge -- hold-record <admin> <record-number> "<reason>"      legal hold on an existing safety record
//   npm run purge -- release-record <admin> <record-number> "<reason>"   release it (normal keep-until date applies again)
// Run `npm run purge -- --run` once a day (a scheduled job, later). It is safe to run twice: the second run finds nothing to do.
// The rules are in src/lib/purge.ts, the numbers in src/config/site.ts (purgeConfig).
import { prisma } from "../src/lib/prisma";
import { listSafetyRecords, runPurge, setPersonHold, setRecordHold, type HoldError, type HoldResult, type PurgeLine } from "../src/lib/purge";
import { staffConfig } from "../src/config/site";

const holdMessages: Record<HoldError, string> = {
  actor: "The first name is not an active admin.",
  notfound: "No such account / record.",
  reason: `A written reason of ${staffConfig.minReasonLength}-${staffConfig.maxReasonLength} characters is required.`,
  state: "Nothing to change (already in that state, or the account is already erased: use hold-record).",
};

function showHold(r: HoldResult) {
  if ("error" in r) {
    console.log("NOT DONE: " + holdMessages[r.error]);
    process.exitCode = 1;
  } else console.log(`Done. Audit log row #${r.auditId}.`);
}

function section(title: string, lines: PurgeLine[]) {
  if (lines.length === 0) return;
  console.log(`\n${title}`);
  for (const l of lines) console.log(`  ${l.who}: ${l.what}`);
}

async function main() {
  const [command, ...a] = process.argv.slice(2);
  if (command === undefined || command === "--run" || command === "--preview") {
    const run = command === "--run";
    const r = await runPurge({ run });
    console.log(run ? "PURGE RUN" : "PREVIEW ONLY (nothing was changed or sent). To do it: npm run purge -- --run");
    section("Warning emails", r.warned);
    section("Erasures", r.erased);
    section("Waiting", r.waiting);
    section("PROBLEMS", r.failed);
    if (r.recordsSwept.length) console.log(`\nSafety records ${run ? "deleted" : "that would be deleted"} (keep-until date passed): ${r.recordsSwept.join(", ")}`);
    if (r.notes.length) {
      console.log("\nFor the owner to handle by hand:");
      for (const n of r.notes) console.log("  - " + n);
    }
    if (!r.warned.length && !r.erased.length && !r.waiting.length && !r.failed.length && !r.recordsSwept.length) console.log("\nNothing to do.");
    console.log(`\nAccounts waiting for a later erase date: ${r.notDueYet}`);
    if (r.failed.length) process.exitCode = 1;
  } else if (command === "records" && a.length === 0) {
    const list = await listSafetyRecords();
    if (list.length === 0) console.log("No safety records.");
    for (const x of list) {
      console.log(`#${x.id}  person ${x.userId}  ${x.reasons}${x.siteRule ? "  rule " + x.siteRule : ""}  erased ${x.erasedAt.toISOString()}  keep until ${x.keepUntil.toISOString()}${x.legalHold ? "  LEGAL HOLD" : ""}`);
    }
  } else if ((command === "hold" || command === "release") && a.length === 3) {
    showHold(await setPersonHold({ actor: a[0], person: a[1], hold: command === "hold", reason: a[2] }));
  } else if ((command === "hold-record" || command === "release-record") && a.length === 3) {
    showHold(await setRecordHold({ actor: a[0], recordId: Number(a[1]), hold: command === "hold-record", reason: a[2] }));
  } else {
    console.log('Usage:\n  npm run purge                (preview only)\n  npm run purge -- --run       (do it)\n  npm run purge -- records\n  npm run purge -- hold|release <admin> <person> "<reason>"\n  npm run purge -- hold-record|release-record <admin> <record-number> "<reason>"');
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("purge FAILED:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
