import fs from "node:fs";
import { prisma } from "../src/lib/prisma";

async function main() {
  const doDelete = process.argv.includes("--delete");
  const ads = await prisma.adCampaign.findMany({
    where: { title: { startsWith: "Sample" } },
    select: { id: true, title: true, slot: true, status: true },
    orderBy: { id: "asc" },
  });

  if (ads.length === 0) {
    console.log('No ads with a title starting with "Sample" found. Nothing to do.');
    return;
  }

  console.log(`Found ${ads.length} sample ad(s):`);
  for (const ad of ads) console.log(`  #${ad.id}  ${ad.slot.padEnd(12)} ${ad.status.padEnd(10)} ${ad.title}`);

  if (!doDelete) {
    console.log("\nNothing was changed. If this list is right, run again with --delete");
    return;
  }

  const url = process.env.DATABASE_URL ?? "";
  const dbPath = url.replace(/^file:/, "");
  if (!dbPath || !fs.existsSync(dbPath)) {
    console.error(`Cannot find the database file (${dbPath || "DATABASE_URL empty"}). Run this from the web/ folder. Nothing deleted.`);
    process.exit(1);
  }
  const backup = `${dbPath}.backup-before-remove-samples`;
  fs.copyFileSync(dbPath, backup);
  console.log(`\nBackup written: ${backup}`);

  const ids = ads.map((ad) => ad.id);
  const [stats, removed] = await prisma.$transaction([
    prisma.adDailyStat.deleteMany({ where: { adId: { in: ids } } }),
    prisma.adCampaign.deleteMany({ where: { id: { in: ids } } }),
  ]);
  console.log(`Deleted ${removed.count} ad(s) and ${stats.count} daily counter row(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
