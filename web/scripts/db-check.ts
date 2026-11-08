// Quick test that the database connection works and the tables exist.
// Run from the web/ folder:  npx tsx --env-file=.env scripts/db-check.ts
import { prisma } from "../src/lib/prisma";

async function main() {
  const rows = await prisma.$queryRaw`SELECT 1 AS ok`;
  console.log("Database connection OK:", rows);

  // If these work, the app and the Prisma commands are using the same database file.
  const [users, communities, posts, comments] = await Promise.all([
    prisma.user.count(),
    prisma.community.count(),
    prisma.post.count(),
    prisma.comment.count(),
  ]);
  console.log("Rows:", { users, communities, posts, comments });
}

main()
  .catch((error) => {
    console.error("Database check FAILED:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
