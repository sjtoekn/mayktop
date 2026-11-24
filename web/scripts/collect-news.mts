import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { collectNewsNow } from "../src/lib/news-collector";

try {
  const result = await collectNewsNow();
  console.log("Falvenco News collection:", result);
} catch (error) {
  console.error("Falvenco News collection failed:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
