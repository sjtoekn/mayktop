// Test helper (TODO 48 Part 8): there is no advertiser form yet (ADS_PLAN Sessions 3-4), so this puts a test ad in the
// "waiting for review" list of /admin/ads. Run from the web/ folder:
//   npm run ad:test -- <advertiser-username> [sidebar|feed]
// The ad belongs to that account (so that person cannot review it; another admin must).
import { prisma } from "../src/lib/prisma";
import { adsConfig } from "../src/config/site";

async function main() {
  const [username, slotArg] = process.argv.slice(2);
  if (!username) {
    console.log("Usage: npm run ad:test -- <advertiser-username> [sidebar|feed]");
    process.exitCode = 1;
    return;
  }
  const user = await prisma.user.findUnique({ where: { username: username.trim().toLowerCase() }, select: { id: true, email: true } });
  if (!user) {
    console.log("No account with that username.");
    process.exitCode = 1;
    return;
  }
  const now = new Date();
  const slot = slotArg === "feed" ? "FEED" : "SIDEBAR";
  const ad = await prisma.adCampaign.create({
    data: {
      advertiserId: user.id,
      contactEmail: user.email,
      title: "Test ad " + now.toISOString().slice(11, 19),
      body: "A test ad waiting for review. Safe to approve, reject or delete from the database.",
      destinationUrl: "https://example.com/",
      slot,
      priceCents: adsConfig.monthlyPriceCents,
      status: "SUBMITTED",
      submittedAt: now,
    },
    select: { id: true },
  });
  console.log(`Created test ad #${ad.id} (${slot}) for ${username}, status SUBMITTED. Open /admin/ads as ANOTHER admin.`);
}

main()
  .catch((error) => {
    console.error("ad-test FAILED:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
