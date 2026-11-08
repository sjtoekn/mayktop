// Moderator tool (TODO 42). There is no admin panel yet (Phase 4), so moderators are appointed here.
// Run from the web/ folder:
//   npm run mods -- list   <community>                              (its moderators, member count, large or not)
//   npm run mods -- led    <person>                                 (the communities a person leads, how many are large)
//   npm run mods -- check                                           (people who lead MORE large communities than allowed)
//   npm run mods -- add    <admin> <community> <person> "<written reason>"
//   npm run mods -- remove <admin> <community> <person> "<written reason>"   (never the last moderator)
// The rules live in src/lib/moderators.ts, the numbers in `modConfig` (src/config/site.ts).
import { appointModerator, findOverLimit, leadershipOf, moderatorsOf, removeModerator, type ModError } from "../src/lib/moderators";
import { prisma } from "../src/lib/prisma";
import { modConfig, staffConfig } from "../src/config/site";

const messages: Record<ModError, string> = {
  actor: "The first name is not an active admin.",
  notfound: "No such community or person (check the names).",
  target: "That person cannot be a moderator (the account is not active).",
  reason: `A written reason of ${staffConfig.minReasonLength}-${staffConfig.maxReasonLength} characters is required.`,
  already: "That person already is a moderator of this community.",
  limit: `Refused: that person already leads ${modConfig.maxLargeCommunities} large communities (${modConfig.largeMemberThreshold}+ members), the most one person may lead.`,
  notmod: "That person is not a moderator of this community.",
  last: "Refused: this is the last moderator. Appoint another one first, then remove this one.",
};

function show(r: { ok: true; auditId: number } | { error: ModError }, done: string) {
  if ("error" in r) {
    console.log("NOT DONE: " + messages[r.error]);
    process.exitCode = 1;
  } else console.log(`${done} Audit log row #${r.auditId}.`);
}

async function main() {
  const [command, ...a] = process.argv.slice(2);
  if (command === "list" && a.length === 1) {
    const r = await moderatorsOf(a[0]);
    if (!r) { console.log("No such community."); process.exitCode = 1; return; }
    console.log(`c/${a[0]}: ${r.members} members (${r.large ? "LARGE" : "small"}; large = ${modConfig.largeMemberThreshold}+)`);
    if (r.mods.length === 0) console.log("No moderators: appoint one (add).");
    for (const m of r.mods) console.log(`  ${m.person}  since ${m.since.toISOString().slice(0, 10)}`);
  } else if (command === "led" && a.length === 1) {
    const r = await leadershipOf(a[0]);
    if (!r) { console.log("No account with that username."); process.exitCode = 1; return; }
    console.log(`${a[0]} leads ${r.led.length} communities, ${r.largeCount} of them large (the limit is ${modConfig.maxLargeCommunities}).`);
    for (const l of r.led) console.log(`  c/${l.slug}  ${l.members} members  ${l.large ? "LARGE" : "small"}`);
  } else if (command === "check" && a.length === 0) {
    const over = await findOverLimit();
    if (over.length === 0) console.log(`OK: nobody leads more than ${modConfig.maxLargeCommunities} large communities.`);
    for (const o of over) console.log(`${o.person} leads ${o.large.length} large communities: ${o.large.map((s) => "c/" + s).join(", ")}`);
    if (over.length > 0) {
      console.log("They keep their roles (nothing is taken away silently) but cannot take another large community. Hand some over: add another moderator, then remove this one.");
      process.exitCode = 1;
    }
  } else if (command === "add" && a.length === 4) {
    show(await appointModerator({ actor: a[0], community: a[1], person: a[2], reason: a[3] }), `${a[2]} is now a moderator of c/${a[1]}.`);
  } else if (command === "remove" && a.length === 4) {
    show(await removeModerator({ actor: a[0], community: a[1], person: a[2], reason: a[3] }), `${a[2]} is no longer a moderator of c/${a[1]} (still a member).`);
  } else {
    console.log("See the comment at the top of scripts/mods.ts for the commands.");
    process.exitCode = 1;
  }
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
