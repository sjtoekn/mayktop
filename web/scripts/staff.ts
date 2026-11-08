// Staff tool (TODO 36d). There is no admin panel yet (Phase 4), so suspend / ban / lift are done here.
// Run from the web/ folder:
//   npm run staff -- rules
//   npm run staff -- make-first-admin <username>                (only works while no admin exists)
//   npm run staff -- make-admin <admin> <person>                (a ban needs two admins, so make a second one)
//   npm run staff -- suspend <admin> <person> <days 1-30> <RULE> "<written reason>"
//   npm run staff -- propose-ban <admin> <person> <RULE> "<written reason>"   (step 1: nothing happens yet)
//   npm run staff -- proposals                                                 (open ban proposals)
//   npm run staff -- approve-ban <other-admin> <proposal-number> "<written note>"   (step 2: a DIFFERENT admin)
//   npm run staff -- reject-ban  <admin> <proposal-number> "<written note>"
//   npm run staff -- lift    <admin> <person> "<written reason>"
// The rules and limits live in src/lib/staff.ts and src/config/site.ts (staffConfig).
import { prisma } from "../src/lib/prisma";
import { decideBan, liftSuspension, makeAdmin, removeAdmin, listBanProposals, makeFirstAdmin, proposeBan, suspendUser, type StaffError } from "../src/lib/staff";
import { staffConfig } from "../src/config/site";

const messages: Record<StaffError, string> = {
  actor: "The first name is not an active admin.",
  notfound: "No account with that username.",
  target: "That account cannot be acted on (staff or already erased).",
  self: "You cannot act on your own account.",
  rule: `The rule must be one of: ${staffConfig.siteRules.map((r) => r.key).join(", ")}.`,
  reason: `A written reason of ${staffConfig.minReasonLength}-${staffConfig.maxReasonLength} characters is required.`,
  days: `Days must be a whole number from 1 to ${staffConfig.maxSuspensionDays}.`,
  state: "The account is not in a state where this applies (see its status).",
  ladder: "Refused: this rule is not 'serious' and the person has no earlier suspension in the last year. Suspend first.",
  pending: "This person already has an open ban proposal (see: proposals).",
  noproposal: "No open proposal with that number (it may be decided already, or lapsed after 7 days).",
  approver: "Refused: a ban needs a DIFFERENT admin to approve. You made this proposal.",
  lastadmin: "Refused: the last admin cannot be removed.",
};

function show(result: { ok: true; auditId: number } | { error: StaffError }) {
  if ("error" in result) {
    console.log("NOT DONE: " + messages[result.error]);
    process.exitCode = 1;
  } else {
    console.log(`Done. Audit log row #${result.auditId}. The person was emailed (printed in the npm run dev terminal if the site is running; here otherwise).`);
  }
}

async function main() {
  const [command, ...a] = process.argv.slice(2);
  if (command === "rules") {
    for (const r of staffConfig.siteRules) console.log(`${r.key}${r.serious ? "  (serious: a ban is allowed at once)" : ""}`);
  } else if (command === "make-first-admin" && a.length === 1) {
    const r = await makeFirstAdmin(a[0]);
    console.log(r === "ok" ? `${a[0]} is now the first admin.` : r === "exists" ? "An admin already exists." : "No account with that username.");
    if (r !== "ok") process.exitCode = 1;
  } else if (command === "make-admin" && a.length === 2) {
    show(await makeAdmin({ actor: a[0], target: a[1] }));
  } else if (command === "remove-admin" && a.length === 3) {
    show(await removeAdmin({ actor: a[0], target: a[1], reason: a[2] }));
  } else if (command === "suspend" && a.length === 5) {
    show(await suspendUser({ actor: a[0], target: a[1], days: Number(a[2]), rule: a[3], reason: a[4] }));
  } else if (command === "propose-ban" && a.length === 4) {
    const r = await proposeBan({ actor: a[0], target: a[1], rule: a[2], reason: a[3] });
    if ("error" in r) show(r);
    else console.log(`Proposal #${r.proposalId} saved. NOTHING has happened to ${a[1]} yet. A different admin must run: approve-ban <admin> ${r.proposalId} "<note>"`);
  } else if (command === "proposals") {
    const list = await listBanProposals();
    if (list.length === 0) console.log("No open ban proposals.");
    for (const p of list) console.log(`#${p.id}  ${p.person}  rule ${p.rule}  proposed by ${p.proposedBy}  ${p.createdAt.toISOString()}\n     reason: ${p.reason}`);
  } else if ((command === "approve-ban" || command === "reject-ban") && a.length === 3) {
    show(await decideBan({ actor: a[0], proposalId: Number(a[1]), approve: command === "approve-ban", note: a[2] }));
  } else if (command === "lift" && a.length === 3) {
    show(await liftSuspension({ actor: a[0], target: a[1], reason: a[2] }));
  } else {
    console.log("Usage:\n  npm run staff -- rules\n  npm run staff -- make-first-admin <username>\n  npm run staff -- make-admin <admin> <person>\n  npm run staff -- remove-admin <admin> <person> \"<reason>\"\n  npm run staff -- suspend <admin> <person> <days> <RULE> \"<reason>\"\n  npm run staff -- propose-ban <admin> <person> <RULE> \"<reason>\"\n  npm run staff -- proposals\n  npm run staff -- approve-ban|reject-ban <admin> <number> \"<note>\"\n  npm run staff -- lift <admin> <person> \"<reason>\"");
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("staff FAILED:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
