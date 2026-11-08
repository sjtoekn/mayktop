import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { collectNewsNow } from "../src/lib/news-collector";

try {
  const result = await collectNewsNow();
  console.log("Mayktop News collection:", result);
} catch (error) {
  console.error("Mayktop News collection failed:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
