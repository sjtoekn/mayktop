// Settles finished ads into the creator ledger (CREATOR_EARNINGS_PLAN.md, S4). Run from the web/ folder:
//   npm run creator:settle                     PREVIEW: shows what would be written. Changes nothing.
//   npm run creator:settle -- --run            DOES IT: writes the earnings of every finished, paid, not yet settled ad.
//   npm run creator:settle -- --ad 3           preview one ad (add --run to write; the ad must be finished)
//   npm run creator:settle -- --ad 3 --force   preview a RUNNING ad too (testing only; with --run it settles it NOW and later
//                                              impressions of that ad are never paid)
// Run `npm run creator:settle -- --run` once a day (a scheduled job, later). Safe to run twice: a settled ad is skipped.
import { prisma } from "../src/lib/prisma";
import { dueAdIds, settleOneAd } from "../src/lib/creator-settle";
import { formatUsd } from "../src/lib/creator-rules";

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--run");
  const force = args.includes("--force");
  const adIdx = args.indexOf("--ad");
  const only = adIdx >= 0 ? Number(args[adIdx + 1]) : null;
  if (adIdx >= 0 && (!Number.isInteger(only) || (only as number) <= 0)) {
    console.log("--ad needs an ad number.");
    process.exitCode = 1;
    return;
  }

  let ids: number[];
  if (only !== null) {
    const due = await dueAdIds();
    if (!due.includes(only) && !force) {
      console.log(`Ad ${only} is not finished + paid + unsettled (add --force to preview it anyway).`);
      process.exitCode = 1;
      return;
    }
    ids = [only];
  } else {
    ids = await dueAdIds();
  }

  console.log(write ? "WRITING the earnings." : "PREVIEW only: nothing is written. Add --run to write.");
  if (ids.length === 0) console.log("No finished, paid ads waiting to be settled.");
  let totalPeople = 0;
  let totalMicro = 0;
  for (const id of ids) {
    const s = await settleOneAd(id, { write });
    if (!s) {
      console.log(`Ad ${id}: skipped (not found, not paid, or already settled).`);
      continue;
    }
    totalPeople += s.people;
    totalMicro += s.activeMicro;
    console.log(
      `Ad ${s.adId} "${s.title}": pool $${formatUsd(s.poolMicro)}, to creators $${formatUsd(s.activeMicro)} (${s.rows} rows, ${s.people} people)` +
        (s.voidMicro > 0 ? `, void $${formatUsd(s.voidMicro)}` : "") +
        (write ? (s.written ? " - written" : " - already settled by another run") : ""),
    );
  }
  console.log(`Total to creators: $${formatUsd(totalMicro)}.`);
  void totalPeople;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
