// Sends the "your ad ends soon" emails that are due (ADS_PLAN Session 4c). Run from the web/ folder:
//   npm run ad:notices
// Safe to run as often as you like: every ad is told once. In production put it on a schedule (for example once an hour);
// that goes into the hosting notes (TODO 56). Until an email service is connected (src/lib/email.ts) the emails are printed here.
import { sendEndingSoonNotices } from "../src/lib/ad-notices";
import { prisma } from "../src/lib/prisma";

async function main() {
  const { sent, failed } = await sendEndingSoonNotices();
  console.log(`Ending-soon emails: ${sent} sent, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
