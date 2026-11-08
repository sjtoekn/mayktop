// Moderation tool for "hidden pending review" (TODO 38). There is no moderator panel yet (Phase 4), so it is done here.
// Run from the web/ folder:
//   npm run review -- rules   <community>                                 (the rule numbers of a community)
//   npm run review -- pending                                             (everything waiting for a second person)
//   npm run review -- check                                               (hidden / removed items without a rule, a reason or an audit row)
//   npm run review -- hide    <person> post|comment <id> <rule-number> "<written reason>"   (step 1)
//   npm run review -- restore <person> post|comment <id> "<written note>"                   (step 2: a DIFFERENT person)
//   npm run review -- remove  <person> post|comment <id> "<written note>"                   (step 2: a DIFFERENT person)
// <person> = the username of a moderator of that community or an admin. The rules live in src/lib/review.ts.
import { communityRules, decideReview, findIncomplete, hideForReview, listPending, type ReviewError, type ReviewKind } from "../src/lib/review";
import { prisma } from "../src/lib/prisma";
import { reviewConfig, staffConfig } from "../src/config/site";

const messages: Record<ReviewError, string> = {
  actor: "The first name is not an active account.",
  notfound: "No such post / comment (check the kind and the number).",
  allowed: "That person is not a moderator of this community and not an admin.",
  self: "Nobody can act on their own post or comment.",
  rule: "The rule number is not an open rule of that community (run: rules <community>).",
  reason: `A written reason / note of ${staffConfig.minReasonLength}-${staffConfig.maxReasonLength} characters is required.`,
  state: "It is not in the state this step needs (hide: it must be visible; restore / remove: it must be hidden for review).",
  same: "Refused: a DIFFERENT person must decide. You are the one who hid it.",
};

function kindOf(value: string | undefined): ReviewKind | null {
  return value === "post" || value === "comment" ? value : null;
}

function show(result: { ok: true; auditId: number } | { error: ReviewError }, done: string) {
  if ("error" in result) {
    console.log("NOT DONE: " + messages[result.error]);
    process.exitCode = 1;
  } else {
    console.log(`${done} Audit log row #${result.auditId}. The author was emailed (printed in the npm run dev terminal if the site is running; here otherwise).`);
    console.log("The site shows the change after its cache expires (a few minutes).");
  }
}

async function main() {
  const [command, ...a] = process.argv.slice(2);
  if (command === "rules" && a.length === 1) {
    const rules = await communityRules(a[0]);
    if (rules.length === 0) console.log("No open rules (check the community name).");
    for (const r of rules) console.log(`${r.position}. ${r.title}`);
  } else if (command === "pending" && a.length === 0) {
    const list = await listPending();
    if (list.length === 0) console.log("Nothing is waiting for review.");
    for (const p of list) {
      console.log(`${p.kind} #${p.id}  c/${p.community}  hidden ${p.hiddenAt?.toISOString() ?? "?"}${p.overdue ? `  OVERDUE (more than ${reviewConfig.dueDays} days)` : ""}`);
      console.log(`     rule: ${p.rule}\n     reason: ${p.reason}`);
    }
  } else if (command === "hide" && a.length === 5 && kindOf(a[1])) {
    show(await hideForReview({ actor: a[0], kind: kindOf(a[1])!, id: Number(a[2]), rule: Number(a[3]), reason: a[4] }), "Hidden for review. Nothing is erased.");
  } else if ((command === "restore" || command === "remove") && a.length === 4 && kindOf(a[1])) {
    const remove = command === "remove";
    show(
      await decideReview({ actor: a[0], kind: kindOf(a[1])!, id: Number(a[2]), decision: remove ? "remove" : "restore", note: a[3] }),
      remove ? "Removed (it stays in the database and in the public mod log)." : "Restored: it is visible again.",
    );
  } else if (command === "check" && a.length === 0) {
    const bad = await findIncomplete();
    if (bad.length === 0) console.log("OK: every hidden / removed post and comment has a rule, a written reason and an audit-log row.");
    for (const b of bad) console.log(`${b.kind} #${b.id} (${b.status}) is missing: ${b.missing.join(", ")}`);
    if (bad.length > 0) {
      console.log("Fix: restore it (npm run review -- restore ...) or hide it again properly (hide ...). Sample data from db:seed is expected to show up here.");
      process.exitCode = 1;
    }
  } else {
    console.log("See the comment at the top of scripts/review.ts for the commands.");
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
