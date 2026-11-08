// Appeals tool (TODO 40). There is no moderator panel yet (Phase 4), so appeals are read and decided here.
// Run from the web/ folder:
//   npm run appeals -- list                                   (every open appeal, oldest first)
//   npm run appeals -- show   <appeal-number>                 (read the appeal, the first decision and the content)
//   npm run appeals -- accept <person> <appeal-number> "<written note>"   (reverse the first decision)
//   npm run appeals -- reject <person> <appeal-number> "<written note>"   (the first decision stands)
// <person> = the username of a moderator of that community or an admin (account appeals: an admin), and NOT the
// appellant and NOT anyone who decided the first time. The rules live in src/lib/appeals.ts.
import { decideAppeal, listOpenAppeals, showAppeal, type AppealError } from "../src/lib/appeals";
import { prisma } from "../src/lib/prisma";
import { appealConfig, staffConfig } from "../src/config/site";

const messages: Record<AppealError, string> = {
  actor: "The name is not an active account.",
  notfound: "No appeal with that number (run: list).",
  allowed: "That person may not decide this appeal (content: a moderator of that community or an admin; account: an admin).",
  self: "Refused: nobody decides their own appeal.",
  same: "Refused: a DIFFERENT person must decide. You took part in the first decision.",
  state: "The appeal is not open any more, or the post / comment / account changed in the meantime (run: show).",
  window: "Too late to appeal.",
  exists: "This decision was already appealed.",
  message: `A written note of ${staffConfig.minReasonLength}-${staffConfig.maxReasonLength} characters is required.`,
};

async function main() {
  const [command, ...a] = process.argv.slice(2);
  if (command === "list" && a.length === 0) {
    const list = await listOpenAppeals();
    if (list.length === 0) console.log("No open appeals.");
    for (const p of list) {
      console.log(`#${p.id}  ${p.kind}  ${p.what}  by ${p.appellant}  ${p.createdAt.toISOString()}${p.overdue ? `  OVERDUE (more than ${appealConfig.dueDays} days)` : ""}`);
    }
  } else if (command === "show" && a.length === 1) {
    const d = await showAppeal(Number(a[0]));
    if (!d) {
      console.log("No appeal with that number.");
      process.exitCode = 1;
      return;
    }
    console.log(`Appeal #${d.appealId}  (${d.kind})  status: ${d.status}  filed ${d.createdAt.toISOString()}  by ${d.appellant}`);
    console.log(`\nFIRST DECISION: ${d.firstAction} by ${d.firstActor}${d.community ? `  in c/${d.community}` : ""}`);
    console.log(`  rule:   ${d.rule || "(none recorded)"}\n  reason: ${d.reason || "(none recorded)"}`);
    if (d.content) console.log(`\nTHE ${(d.contentKind ?? `SOCIAL ${d.social}`).toUpperCase()} (id ${d.targetId}):\n${d.content.text}`);
    console.log(`\nTHE APPEAL (written by ${d.appellant}):\n${d.message}`);
    console.log(`\nTo decide: npm run appeals -- accept|reject <person> ${d.appealId} "<written note>"   (not the appellant, not anyone who decided the first time)`);
  } else if ((command === "accept" || command === "reject") && a.length === 3) {
    const accept = command === "accept";
    const r = await decideAppeal({ actor: a[0], appealId: Number(a[1]), accept, note: a[2] });
    if ("error" in r) {
      console.log("NOT DONE: " + messages[r.error]);
      process.exitCode = 1;
    } else {
      console.log(
        accept
          ? `Accepted: the first decision is reversed. Audit log row #${r.auditId}.`
          : `Rejected: the first decision stands. Audit log row #${r.auditId}.`,
      );
      console.log("The person was emailed (printed in the npm run dev terminal if the site is running; here otherwise).");
      console.log("The site shows a restored post / comment after its cache expires (a few minutes).");
    }
  } else {
    console.log("See the comment at the top of scripts/appeals.ts for the commands.");
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
